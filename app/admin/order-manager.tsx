'use client';

import { useEffect, useState, type FormEvent } from 'react';
import WhatsAppActions from './whatsapp-actions';
import { whatsappLink, whatsappOrderMessage } from '@/lib/whatsapp-order';

export type AdminOrder = {
  id: string; order_number: number; customer_name: string; customer_phone: string;
  fulfillment: 'pickup' | 'delivery'; requested_date: string; requested_time: string;
  delivery_address?: string | null; customer_notes?: string; created_at?: string;
  status: string; status_comment?: string; status_updated_at?: string;
  payment_status: string; subtotal_cents: number; delivery_fee_cents: number; total_cents: number;
  order_items: { product_name_snapshot: string; quantity: number; unit_price_cents: number; line_total_cents: number }[];
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
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    setStatus(order.status); setPayment(order.payment_status); setComment(order.status_comment || '');
    setLocalError('');
  }, [order.id, order.status, order.payment_status, order.status_comment]);
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
    await save('PATCH', {
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
        {order.order_items.map((item, index) => <tr key={index}><td>{item.product_name_snapshot}</td><td>{item.quantity}</td><td>{money(item.unit_price_cents)}</td><td>{money(item.line_total_cents)}</td></tr>)}
      </tbody></table>
      {order.customer_notes && <p><strong>Customer notes:</strong> {order.customer_notes}</p>}
    </td>
    <td className="admin-order-pricing"><small>Subtotal {money(order.subtotal_cents)}</small><small>Delivery {money(order.delivery_fee_cents)}</small><strong>{money(order.total_cents)}</strong></td>
    <td><span className={'order-status order-status-' + order.status}>{statuses.find(([code]) => code === order.status)?.[1] || order.status}</span></td>
    <td>
      <form className="admin-order-controls" onSubmit={submit}>
        <label>Status<select disabled={busy} value={status} onChange={e => setStatus(e.target.value)}>
          {statuses.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select></label>
        <label>Payment<select value={payment} disabled={busy} onChange={e => setPayment(e.target.value)}>
          {payments.map(p => <option key={p} value={p}>{p}</option>)}
        </select></label>
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
  const [filter, setFilter] = useState('all');
  const [olderOrders, setOlderOrders] = useState<AdminOrder[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(orders.length === 100 ? 100 : null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState('');
  useEffect(() => {
    setOlderOrders([]);
    setNextOffset(orders.length === 100 ? 100 : null);
    setOlderError('');
  }, [orders]);
  const loadedOrders = [...orders, ...olderOrders];
  const loadOlder = async () => {
    if (nextOffset === null || loadingOlder) return;
    setLoadingOlder(true); setOlderError('');
    try {
      const response = await fetch('/api/admin/orders?offset=' + nextOffset, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load older orders');
      setOlderOrders(previous => [...previous, ...json.orders]);
      setNextOffset(json.nextOffset);
    } catch (e) { setOlderError(e instanceof Error ? e.message : 'Unable to load older orders'); }
    finally { setLoadingOlder(false); }
  };
  const shown = loadedOrders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    const text = [o.order_number, o.customer_name, o.customer_phone, ...o.order_items.map(i => i.product_name_snapshot)].join(' ').toLowerCase();
    return text.includes(search.toLowerCase());
  });
  return <section className="admin-orders">
    <div className="admin-section-heading"><div><h2>Customer orders</h2><p>Review every item, confirm or reject requests, and leave customer-visible updates.</p></div><strong>{loadedOrders.filter(o => o.status === 'pending').length} pending in loaded orders</strong></div>
    <div className="admin-table-tools">
      <label>Search orders<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Order number, customer, product or phone" /></label>
      <label>Filter by status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label>
      <span>{shown.length} of {loadedOrders.length} loaded orders</span>
    </div>
    <div className="admin-table-scroll"><table className="admin-data-table admin-orders-table"><thead><tr>
      {['Order','Customer','Requested','Ordered items','Total','Current status','Review / update'].map(title => <th scope="col" key={title}>{title}</th>)}
    </tr></thead><tbody>
      {shown.map(o => <OrderRow key={o.id} order={o} busy={busy} save={save} />)}
      {!shown.length && <tr><td colSpan={7}>No matching orders in the loaded list.</td></tr>}
    </tbody></table></div>
    {olderError && <p role="alert" className="admin-error">{olderError}</p>}
    {nextOffset !== null && <div className="admin-older-orders"><button type="button" className="secondary" disabled={loadingOlder || busy} onClick={() => void loadOlder()}>{loadingOlder ? 'Loading older orders…' : 'Load older orders'}</button><small>Loads the next 100 orders when available.</small></div>}
  </section>;
}
