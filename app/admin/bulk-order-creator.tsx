'use client';
import { useState, type FormEvent } from 'react';

type Item = { name: string; unit: string; quantity: string; price: string };
const blank = (): Item => ({ name: '', unit: '', quantity: '', price: '' });
const toCents = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim()) ? Math.round(Number(v) * 100) : null;
export default function BulkOrderCreator({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [date, setDate] = useState(''), [time, setTime] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState(''), [fee, setFee] = useState('0'), [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([blank()]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const change = (index: number, field: keyof Item, value: string) => setItems(previous => previous.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0) + (fulfillment === 'delivery' ? Number(fee) || 0 : 0);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    const parsed = items.map(item => ({ name: item.name.trim(), unit: item.unit.trim(), quantity: Number(item.quantity), unit_price_cents: toCents(item.price) }));
    const deliveryFee = toCents(fee);
    if (parsed.some(item => !item.name || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.unit_price_cents === null) || deliveryFee === null) { setError('Enter a name, whole-number quantity, and dollar price for every item.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/bulk-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_name: name, customer_phone: phone, requested_date: date, requested_time: time, fulfillment, delivery_address: address, delivery_fee_cents: deliveryFee, customer_notes: notes, items: parsed }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save bulk order');
      setMessage('Bulk order #' + result.number + ' saved. Total $' + (result.totalCents / 100).toFixed(2));
      setItems([blank()]); setName(''); setPhone(''); setNotes(''); setAddress(''); setFee('0');
      await onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save order'); }
    finally { setBusy(false); }
  }
  return <section className="admin-card" style={{marginBottom:20}}>
    <h2>Create bulk / tray order</h2><p className="quiet">Enter any item, including half trays or full trays. Quantities and prices are custom for this order and do not change the public menu. New orders are marked confirmed and unpaid.</p>
    <form onSubmit={submit} style={{display:'grid',gap:12}}>
      <label>Customer name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Customer phone<input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      <label>Order date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label>Order time (Eastern)<input required type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
      <label>Fulfillment<select value={fulfillment} onChange={e=>setFulfillment(e.target.value as 'pickup'|'delivery')}><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label>
      {fulfillment==='delivery'&&<><label>Delivery address<input required value={address} onChange={e=>setAddress(e.target.value)}/></label><label>Delivery fee ($)<input required inputMode="decimal" value={fee} onChange={e=>setFee(e.target.value)}/></label></>}
      <h3>Items</h3>
      {items.map((item,index)=><div key={index} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,padding:12,border:'1px solid #ddd',borderRadius:8}}>
        <label>Item name<input required placeholder="Bisibelebath" value={item.name} onChange={e=>change(index,'name',e.target.value)}/></label>
        <label>Size / pieces<input placeholder="Half tray / 20 pieces" value={item.unit} onChange={e=>change(index,'unit',e.target.value)}/></label>
        <label>Quantity<input required type="number" min="1" step="1" placeholder="Enter quantity" value={item.quantity} onChange={e=>change(index,'quantity',e.target.value)}/></label>
        <label>Price per quantity ($)<input required inputMode="decimal" placeholder="50.00" value={item.price} onChange={e=>change(index,'price',e.target.value)}/></label>
        <button type="button" className="secondary" disabled={items.length===1} onClick={()=>setItems(old=>old.filter((_,i)=>i!==index))}>Remove item</button>
      </div>)}
      <button type="button" className="secondary" onClick={()=>setItems(old=>[...old,blank()])}>+ Add another item</button>
      <label>Kitchen notes<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <strong>Estimated total: ${total.toFixed(2)}</strong>
      {error&&<p role="alert" className="admin-error">{error}</p>}{message&&<p role="status" className="admin-success">{message}</p>}
      <button className="primary" disabled={busy}>{busy?'Saving…':'Save bulk order'}</button>
    </form>
  </section>;
}
