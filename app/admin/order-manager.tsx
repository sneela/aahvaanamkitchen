'use client';

import { useEffect, useState, type FormEvent } from 'react';
import WhatsAppActions from './whatsapp-actions';
import { whatsappLink, whatsappOrderMessage } from '@/lib/whatsapp-order';

export type AdminOrder = {
  id: string; order_number: number; customer_name: string; customer_phone: string;
  fulfillment: 'pickup' | 'delivery'; requested_date: string; requested_time: string;
  delivery_address?: string | null; customer_notes?: string; created_at?: string;
  status: string; status_comment?: string; status_updated_at?: string;
  payment_status: string; discount_type?: 'none' | 'fixed' | 'percent'; discount_value?: number; discount_cents?: number; discount_reason?: string; subtotal_cents: number; delivery_fee_cents: number; total_cents: number;
  order_items: { product_name_snapshot: string; unit_label_snapshot?: string; quantity: number; unit_price_cents: number; line_total_cents: number }[];
};
type Save = (method: 'PATCH', payload: Record<string, unknown>) => Promise<boolean>;
const money = (cents: number) => '$' + (cents / 100).toFixed(2);
const statuses = [
  ['pending','Pending review'], ['accepted','Confirmed'], ['rejected','Rejected'],
  ['preparing','Preparing'], ['ready_for_pickup','Ready for pickup'],
  ['out_for_delivery','Out for delivery'], ['completed','Completed'], ['cancelled','Cancelled'],
] as const;
const payments = ['unpaid','paid','refunded'] as const;

function OrderRow({ order, busy, save }: { order: AdminOrder; busy: boolean; save: Save }) {
  const [status, setStatus] = useState(order.status);
  const [payment, setPayment] = useState(order.payment_status);
  const [comment, setComment] = useState(order.status_comment || '');
  const [discountType, setDiscountType] = useState(order.discount_type || 'none');
  const [discountValue, setDiscountValue] = useState(order.discount_type === 'fixed' ? String((order.discount_value || 0) / 100) : String(order.discount_value || 0));
  const [discountReason, setDiscountReason] = useState(order.discount_reason || '');
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    setStatus(order.status); setPayment(order.payment_status); setComment(order.status_comment || '');
    setDiscountType(order.discount_type || 'none'); setDiscountValue(order.discount_type === 'fixed' ? String((order.discount_value || 0) / 100) : String(order.discount_value || 0)); setDiscountReason(order.discount_reason || '');
    setLocalError('');
  }, [order.id, order.status, order.payment_status, order.status_comment, order.discount_type, order.discount_value, order.discount_reason]);
  const update = async (nextStatus: string) => {
    setLocalError('');
    let note = comment.trim();
    // Don't accidentally reuse a previous confirmation note as a rejection reason,
    // or display a past rejection reason after confirming a revised order.
    const previousComment = (order.status_comment || '').trim();
    if (nextStatus === 'accepted' && order.status === 'rejected' && note === previousComment) note = '';
    if (nextStatus === 'rejected' && (!note || (order.status !== 'rejected' && note === previousComment && previousComment.length > 0))) {
      setLocalError('Please write a new reason for rejecting this order. The customer will see your message.');
      return;
    }
    if (nextStatus === 'rejected' && !window.confirm('Reject order #' + order.order_number + '? The customer will see your comment.')) return;
    const numericDiscount = Number(discountValue);
    if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || (discountType === 'percent' && numericDiscount > 100) || (discountType === 'fixed' && Math.round(numericDiscount * 100) > order.subtotal_cents)) { setLocalError('Invalid discount amount'); return; }
    await save('PATCH', {
      discount_type: discountType, discount_value: discountType === 'fixed' ? Math.round(numericDiscount * 100) : numericDiscount, discount_reason: discountReason,
      resource: 'order', id: order.id, status: nextStatus,
      status_comment: note, payment_status: payment,
    });
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void update(status); };
  const chatLink = whatsappLink(order.customer_phone);
  const quickUpdateLink = whatsappLink(order.customer_phone, whatsappOrderMessage(order));
  return <tr className="admin-order-row">
    <td><strong>#{order.order_number}</strong><small>{order.created_at ? new Date(order.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : ''}</small></td>
    <td><strong>{order.customer_name}</strong><p><a href={'tel:' + order.customer_phone}>{order.customer_phone}</a></p>{chatLink && <div className="admin-quick-whatsapp"><a href={chatLink} target="_blank" rel="noopener noreferrer">Open WhatsApp chat ↗</a>{quickUpdateLink && <a href={quickUpdateLink} target="_blank" rel="noopener noreferrer">Prepare order update ↗</a>}</div>}</td>
    <td><strong>{order.requested_date}</strong><p>{order.requested_time} Eastern</p><small>{order.fulfillment}</small>{order.delivery_address && <p>{order.delivery_address}</p>}</td>
    <td className="admin-order-items"><strong>{order.order_items.length} item types</strong>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>
        {order.order_items.map((item, index) => <tr key={index}><td>{item.product_name_snapshot}{item.unit_label_snapshot && <> ({item.unit_label_snapshot})</>}</td><td>{item.quantity}</td><td>{money(item.unit_price_cents)}</td><td>{money(item.line_total_cents)}</td></tr>)}
      </tbody></table>
      {order.customer_notes && <p><strong>Customer notes:</strong> {order.customer_notes}</p>}
    </td>
    <td className="admin-order-pricing"><small>Subtotal {money(order.subtotal_cents)}</small><small>Delivery {money(order.delivery_fee_cents)}</small>{Boolean(order.discount_cents) && <small>Discount −{money(order.discount_cents || 0)}</small>}<strong>{money(order.total_cents)}</strong></td>
    <td><span className={'order-status order-status-' + order.status}>{statuses.find(([code]) => code === order.status)?.[1] || order.status}</span></td>
    <td>
      <form className="admin-order-controls" onSubmit={submit}>
        <label>Status<select disabled={busy} value={status} onChange={e => setStatus(e.target.value)}>
          {statuses.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select></label>
        <label>Payment<select value={payment} disabled={busy} onChange={e => setPayment(e.target.value)}>
          {payments.map(p => <option key={p} value={p}>{p}</option>)}
        </select></label>
        <label>Discount type<select disabled={busy} value={discountType} onChange={e => { setDiscountType(e.target.value as 'none' | 'fixed' | 'percent'); setDiscountValue('0'); }}><option value="none">No discount</option><option value="fixed">Fixed amount ($)</option><option value="percent">Percentage (%)</option></select></label>
        {discountType !== 'none' && <><label>Discount amount<input type="number" min="0" step="0.01" max={discountType === 'percent' ? 100 : order.subtotal_cents / 100} value={discountValue} onChange={e => setDiscountValue(e.target.value)} disabled={busy} /></label><label>Discount reason<input maxLength={250} value={discountReason} onChange={e => setDiscountReason(e.target.value)} disabled={busy} /></label></>}
        <label>Message to customer<textarea maxLength={1000} disabled={busy} placeholder="Reason for rejection, pickup details, or another update" value={comment} onChange={e => setComment(e.target.value)} /></label>
        <small>Customers can see this message in Track Order after you save.</small>
        {localError && <p role="alert" className="admin-inline-error">{localError}</p>}
        <div className="admin-order-actions">
          <button type="button" className="primary" disabled={busy} onClick={() => void update('accepted')}>Confirm</button>
          <button type="button" className="danger" disabled={busy} onClick={() => void update('rejected')}>Reject</button>
          <button type="submit" className="admin-action" disabled={busy}>Save changes</button>
        </div>
      </form>
      <WhatsAppActions order={order} />
    </td>
  </tr>;
}

export default function OrderManager({ orders, busy, save }: { orders: AdminOrder[]; busy: boolean; save: Save }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<'all'|'today'|'tomorrow'|'next2'|'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [freshOrders, setFreshOrders] = useState<AdminOrder[] | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const todayEastern = () => { const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const part = (type: string) => parts.find(p => p.type === type)?.value || ''; return `${part('year')}-${part('month')}-${part('day')}`; };
  const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setRefreshError('');
    try {
      const response = await fetch('/api/admin/orders?offset=0&q=' + encodeURIComponent(query), { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to refresh orders');
      setFreshOrders(json.orders);
      setOlderOrders([]);
      setNextOffset(json.nextOffset);
    } catch (e) { setRefreshError(e instanceof Error ? e.message : 'Unable to refresh orders'); }
    finally { setRefreshing(false); }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);
  const [olderOrders, setOlderOrders] = useState<AdminOrder[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(orders.length === 100 ? 100 : null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState('');
  useEffect(() => {
    setFreshOrders(null);
    setOlderOrders([]);
    setNextOffset(orders.length === 100 ? 100 : null);
    setOlderError('');
  }, [orders]);
  const loadedOrders = [...(freshOrders ?? orders), ...olderOrders];
  const loadOlder = async () => {
    if (nextOffset === null || loadingOlder) return;
    setLoadingOlder(true); setOlderError('');
    try {
      const response = await fetch('/api/admin/orders?offset=' + nextOffset + '&q=' + encodeURIComponent(query), { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load older orders');
      setOlderOrders(previous => [...previous, ...json.orders]);
      setNextOffset(json.nextOffset);
    } catch (e) { setOlderError(e instanceof Error ? e.message : 'Unable to load older orders'); }
    finally { setLoadingOlder(false); }
  };
  const shown = loadedOrders.filter(o => {
    if (selectedStatuses.length && !selectedStatuses.includes(o.status)) return false;
    const today = todayEastern();
    const from = dateMode === 'today' ? today : dateMode === 'tomorrow' || dateMode === 'next2' ? addDays(today, 1) : dateMode === 'custom' ? startDate : '';
    const to = dateMode === 'today' ? today : dateMode === 'tomorrow' ? addDays(today, 1) : dateMode === 'next2' ? addDays(today, 2) : dateMode === 'custom' ? endDate : '';
    if (from && o.requested_date < from) return false;
    if (to && o.requested_date > to) return false;
    return true;
  });
  return <section className="admin-orders">
    <div className="admin-section-heading"><div><h2>Customer orders</h2><p>Review every item, confirm or reject requests, and leave customer-visible updates.</p></div><strong>{loadedOrders.filter(o => o.status === 'pending').length} pending in loaded orders</strong></div>
    <div className="admin-table-tools">
      <label>Search orders<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Order number, customer, product or phone" /></label>
      <fieldset><legend>Statuses (select multiple)</legend><label><input type="checkbox" checked={selectedStatuses.length === 0} onChange={() => setSelectedStatuses([])} /> All statuses</label>{statuses.map(([code, label]) => <label key={code}><input type="checkbox" checked={selectedStatuses.includes(code)} onChange={e => setSelectedStatuses(old => e.target.checked ? [...old, code] : old.filter(s => s !== code))} /> {label}</label>)}</fieldset>
      <label>Scheduled date<select value={dateMode} onChange={e => setDateMode(e.target.value as typeof dateMode)}><option value="all">All dates</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="next2">Next 2 days (tomorrow + following day)</option><option value="custom">Custom range</option></select></label>
      {dateMode === 'custom' && <><label>From<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label>To<input type="date" min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} /></label></>}
      <button type="button" className="secondary" disabled={refreshing || busy} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh orders'}</button>
      <span>{shown.length} of {loadedOrders.length} loaded orders</span>
    </div>
    <div className="admin-table-scroll"><table className="admin-data-table admin-orders-table"><thead><tr>
      {['Order','Customer','Requested','Ordered items','Total','Current status','Review / update'].map(title => <th scope="col" key={title}>{title}</th>)}
    </tr></thead><tbody>
      {shown.map(o => <OrderRow key={o.id} order={o} busy={busy} save={save} />)}
      {!shown.length && <tr><td colSpan={7}>No matching orders found.</td></tr>}
    </tbody></table></div>
    {refreshError && <p role="alert" className="admin-error">{refreshError}</p>}
    {olderError && <p role="alert" className="admin-error">{olderError}</p>}
    {nextOffset !== null && <div className="admin-older-orders"><button type="button" className="secondary" disabled={loadingOlder || busy} onClick={() => void loadOlder()}>{loadingOlder ? 'Loading older orders…' : 'Load older orders'}</button><small>Loads the next 100 orders when available.</small></div>}
  </section>;
}
