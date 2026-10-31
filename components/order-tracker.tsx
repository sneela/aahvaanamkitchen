'use client';

import { useEffect, useState, type FormEvent } from 'react';

type OrderLookup = {
  number: number;
  status: string;
  comment: string;
  statusUpdatedAt: string;
  paymentStatus: string;
  fulfillment: string;
  date: string;
  time: string;
  items: { name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
};

const descriptions: Record<string,string> = {
  pending: 'Received — waiting for the kitchen to review your request.',
  accepted: 'Confirmed by the kitchen.',
  rejected: 'The kitchen is unable to fulfill this order.',
  preparing: 'Your food is being prepared.',
  ready_for_pickup: 'Your order is ready for pickup.',
  out_for_delivery: 'Your order is out for delivery.',
  completed: 'Your order has been completed.',
  cancelled: 'This order has been cancelled.',
};
const labels: Record<string,string> = {
  pending: 'Pending review', accepted: 'Confirmed', rejected: 'Rejected',
  preparing: 'Preparing', ready_for_pickup: 'Ready for pickup',
  out_for_delivery: 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled',
};
const money = (cents: number) => '$' + (cents / 100).toFixed(2);

export default function OrderTracker({ initialOrderNumber }: { initialOrderNumber?: number | null }) {
  const [number, setNumber] = useState(initialOrderNumber ? String(initialOrderNumber) : '');
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<OrderLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (initialOrderNumber) { setNumber(String(initialOrderNumber)); setFound(null); } }, [initialOrderNumber]);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('order');
    if (fromUrl && /^\d{1,10}$/.test(fromUrl)) setNumber(fromUrl);
  }, []);
  async function lookup(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setFound(null);
    try {
      const response = await fetch('/api/orders/status', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: Number(number), phone: phone.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to check order status.');
      setFound(body.order);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to check order status.'); }
    finally { setLoading(false); }
  }
  return <div className="order-tracker">
    <p className="eyebrow">ORDER STATUS</p>
    <h2>Track your <em>order.</em></h2>
    <p>Enter your order number and the same phone number you used at checkout. You can check again whenever you like.</p>
    <form className="track-form" onSubmit={e => void lookup(e)}>
      <label>Order number<input required type="number" min={1} max={1000000000} inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 1001" /></label>
      <label>Phone number used at checkout<input required type="tel" maxLength={30} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 216-555-0123" /></label>
      <button type="submit" className="primary" disabled={loading}>{loading ? 'Checking…' : 'Check status'}</button>
    </form>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {found && <section className="track-result" aria-live="polite">
      <div className="track-result-heading"><h3>Order #{found.number}</h3><span className={'order-status order-status-' + found.status}>{labels[found.status] || found.status}</span></div>
      <p>{descriptions[found.status] || 'See the latest status from the kitchen.'}</p>
      {found.comment && <div className="track-comment"><strong>Message from Aahvaanam Kitchen</strong><p>{found.comment}</p></div>}
      <p><strong>Requested:</strong> {found.date} at {found.time} Eastern · {found.fulfillment}</p>
      <div className="track-items"><h4>Items</h4>{found.items.map((i, index) => <div className="track-item" key={index}><span>{i.quantity} × {i.name} <small>({money(i.unitPriceCents)} each)</small></span><strong>{money(i.lineTotalCents)}</strong></div>)}</div>
      <div className="track-item"><span>Subtotal</span><strong>{money(found.subtotalCents)}</strong></div>
      <div className="track-item"><span>Delivery</span><strong>{money(found.deliveryFeeCents)}</strong></div>
      <div className="track-item track-total"><span>Total</span><strong>{money(found.totalCents)}</strong></div>
      <p className="quiet">Payment: {found.paymentStatus}. No online payment is collected. Any order changes are confirmed manually.</p>
    </section>}
  </div>;
}
