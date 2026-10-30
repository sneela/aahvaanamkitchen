import { NextResponse, type NextRequest } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { defaultSettings, type OrderDoc, type ProductDoc, type SettingsDoc } from '@/lib/mongodb/models';
import { badRequest, isDate, isTime, isUuid, jsonError, parseBody, str, int } from '@/lib/api';
import { easternDateTimeMs } from '@/lib/time';
import { rateLimit } from '@/lib/mongodb/limits';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    if (!mongoConfigured()) return badRequest('Online order requests are not configured. Please contact us on WhatsApp.', 503);
    const b = await parseBody(request);
    if (b.website) return badRequest('Request rejected');
    const requestId = str(b.requestId, 40), name = str(b.name, 100), phone = str(b.phone, 30);
    const date = str(b.date, 10), time = str(b.time, 5), address = str(b.address, 400), notes = str(b.notes, 1000);
    if (!isUuid(requestId) || name.length < 2 || !/^[+\d().\s-]{7,30}$/.test(phone) || !isDate(date) || !isTime(time)) return badRequest('Invalid name, phone, date, time, or request ID');
    if (b.fulfillment !== 'pickup' && b.fulfillment !== 'delivery') return badRequest('Choose pickup or delivery');
    if (b.fulfillment === 'delivery' && address.length < 8) return badRequest('Delivery address required');
    if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 30) return badRequest('Invalid cart');
    const seen = new Set<string>(), requested: { slug: string; quantity: number }[] = [];
    for (const item of b.items) {
      if (!item || typeof item !== 'object') return badRequest('Invalid item');
      const slug = str(item.slug, 100), quantity = int(item.quantity, 1, 50);
      if (!/^[a-z0-9-]{2,100}$/.test(slug) || quantity === null || seen.has(slug)) return badRequest('Invalid or duplicate item');
      seen.add(slug); requested.push({ slug, quantity });
    }
    const db = await mongoDb();
    const orders = db.collection<OrderDoc>('orders');
    const previous = await orders.findOne({ client_request_id: requestId });
    if (previous) return NextResponse.json({ order: { number: previous.order_number, totalCents: previous.total_cents, deliveryFeeCents: previous.delivery_fee_cents } });
    await rateLimit(request, 'order', 10, 60);
    const s = await db.collection<SettingsDoc>('settings').findOne({ _id: 'store' });
    const settings = { ...defaultSettings, ...s };
    if (!settings.ordering_enabled) return badRequest('Online ordering is currently paused', 503);
    if (b.fulfillment === 'delivery' && !settings.delivery_enabled) return badRequest('Delivery is unavailable', 422);
    const products = await db.collection<ProductDoc>('products').find({ slug: { $in: requested.map(i => i.slug) }, is_available: true }).toArray();
    if (products.length !== requested.length) return badRequest('Some items are unavailable', 422);
    const bySlug = new Map(products.map(p => [p.slug, p]));
    const requestedMs = easternDateTimeMs(date, time);
    if (requestedMs === null) return badRequest('Invalid local date or time', 422);
    const noticeHours = Math.max(settings.minimum_notice_hours, ...products.map(p => p.requires_preorder ? Math.max(p.preorder_notice_hours, settings.default_preorder_notice_hours) : 0));
    if (requestedMs - Date.now() < noticeHours * 3600000) return badRequest('Please choose a later date/time to meet advance notice requirements', 422);
    if (requestedMs - Date.now() > settings.max_advance_days * 86400000) return badRequest('Requested date is too far ahead', 422);
    const items = requested.map(i => { const p = bySlug.get(i.slug)!; return { product_name_snapshot: p.name, quantity: i.quantity, unit_price_cents: p.price_cents, line_total_cents: p.price_cents * i.quantity }; });
    const subtotal = items.reduce((sum, i) => sum + i.line_total_cents, 0);
    if (b.fulfillment === 'delivery' && subtotal < settings.delivery_minimum_cents) return badRequest('Delivery minimum not met', 422);
    const fee = b.fulfillment === 'delivery' ? settings.default_delivery_fee_cents : 0;
    const counter = await db.collection<{ _id: string; value: number }>('counters').findOneAndUpdate({ _id: 'order' }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
    if (!counter) throw new Error('Order counter unavailable');
    const order: OrderDoc = { client_request_id: requestId, order_number: counter.value,
      customer_name: name, customer_phone: phone, fulfillment: b.fulfillment, requested_date: date, requested_time: time,
      delivery_address: b.fulfillment === 'delivery' ? address : null, customer_notes: notes,
      status: 'pending', payment_status: 'unpaid', subtotal_cents: subtotal, delivery_fee_cents: fee,
      total_cents: subtotal + fee, order_items: items, created_at: new Date(), updated_at: new Date() };
    try { await orders.insertOne(order); }
    catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 11000) {
        const existing = await orders.findOne({ client_request_id: requestId });
        if (existing) return NextResponse.json({ order: { number: existing.order_number, totalCents: existing.total_cents, deliveryFeeCents: existing.delivery_fee_cents } });
      }
      throw e;
    }
    return NextResponse.json({ order: { number: order.order_number, totalCents: order.total_cents, deliveryFeeCents: fee } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return jsonError(e, 'Unable to submit order request'); }
}
