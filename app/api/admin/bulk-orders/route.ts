import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import type { OrderDoc } from '@/lib/mongodb/models';
import { jsonError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (message: string) => NextResponse.json({ error: message }, { status: 422 });
const cents = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100000000;
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid order');
    const b = body as Record<string, unknown>;
    const name = typeof b.customer_name === 'string' ? b.customer_name.trim() : '';
    const phone = typeof b.customer_phone === 'string' ? b.customer_phone.trim() : '';
    if (!name || name.length > 120 || !/^\+?[\d() .-]{7,30}$/.test(phone)) return fail('Customer name and valid phone are required');
    if (b.fulfillment !== 'pickup' && b.fulfillment !== 'delivery') return fail('Invalid fulfillment');
    if (typeof b.requested_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.requested_date) || Number.isNaN(Date.parse(b.requested_date+'T12:00:00Z'))) return fail('Invalid date');
    if (typeof b.requested_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.requested_time)) return fail('Invalid time');
    const address = typeof b.delivery_address === 'string' ? b.delivery_address.trim() : '';
    if (b.fulfillment === 'delivery' && !address) return fail('Delivery address required');
    if (address.length > 500) return fail('Address too long');
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100) return fail('Add 1–100 items');
    const items: OrderDoc['order_items'] = [];
    for (const entry of b.items) {
      if (!entry || typeof entry !== 'object') return fail('Invalid item');
      const item = entry as Record<string, unknown>;
      const label = typeof item.name === 'string' ? item.name.trim() : '';
      const unit = typeof item.unit === 'string' ? item.unit.trim() : '';
      if (!label || label.length > 120 || unit.length > 100 || !Number.isSafeInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 100000 || !cents(item.unit_price_cents)) return fail('Each item needs a name, quantity, and valid price');
      const line = (item.quantity as number) * (item.unit_price_cents as number);
      if (!Number.isSafeInteger(line) || line > 100000000) return fail('Line total exceeds limit');
      items.push({ product_name_snapshot: label, unit_label_snapshot: unit || undefined, quantity: item.quantity as number, unit_price_cents: item.unit_price_cents as number, line_total_cents: line });
    }
    const subtotal = items.reduce((sum, item) => sum + item.line_total_cents, 0);
    if (!cents(subtotal) || !cents(b.delivery_fee_cents)) return fail('Invalid order total or delivery fee');
    const fee = b.fulfillment === 'delivery' ? b.delivery_fee_cents as number : 0;
    if (subtotal + fee > 100000000) return fail('Order total exceeds limit');
    const notes = typeof b.customer_notes === 'string' ? b.customer_notes.trim() : '';
    if (notes.length > 2000) return fail('Notes too long');
    const db = await mongoDb();
    const counter = await db.collection<{ _id: string; value: number }>('counters').findOneAndUpdate({ _id: 'order' }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
    if (!counter) throw new Error('Order counter unavailable');
    const now = new Date();
    const order: OrderDoc = { client_request_id: 'admin-bulk-' + crypto.randomUUID(), order_number: counter.value, customer_name: name, customer_phone: phone, fulfillment: b.fulfillment, requested_date: b.requested_date, requested_time: b.requested_time, delivery_address: b.fulfillment === 'delivery' ? address : null, customer_notes: notes, status: 'accepted', payment_status: 'unpaid', subtotal_cents: subtotal, delivery_fee_cents: fee, total_cents: subtotal + fee, order_items: items, created_at: now, updated_at: now };
    await db.collection<OrderDoc>('orders').insertOne(order);
    return NextResponse.json({ number: order.order_number, totalCents: order.total_cents }, { status: 201 });
  } catch (error) { return jsonError(error, 'Unable to create bulk order'); }
}
