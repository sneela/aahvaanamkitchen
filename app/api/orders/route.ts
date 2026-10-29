import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { defaultSettings, type OrderDocument, type ProductDocument } from '@/lib/mongodb/collections';
import { badRequest, isDate, isTime, isUuid, parseBody, str, int } from '@/lib/api';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!mongoConfigured()) return badRequest('Ordering is not configured. Contact us on WhatsApp.', 503);
  try {
    const body = await parseBody(request);
    if (body.website) return badRequest('Request rejected');
    const requestId = str(body.requestId, 40);
    const customerName = str(body.name, 100), customerPhone = str(body.phone, 30);
    const requestedDate = str(body.date, 10), requestedTime = str(body.time, 5);
    const deliveryAddress = str(body.address, 400), notes = str(body.notes, 1000);
    const fulfillment = body.fulfillment;
    if (!isUuid(requestId) || customerName.length < 2 || !/^[+\d().\s-]{7,30}$/.test(customerPhone) || !isDate(requestedDate) || !isTime(requestedTime)) return badRequest('Invalid contact or pickup details');
    if (fulfillment !== 'pickup' && fulfillment !== 'delivery') return badRequest('Choose pickup or delivery');
    if (fulfillment === 'delivery' && deliveryAddress.length < 8) return badRequest('Delivery address required');
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) return badRequest('Invalid cart');
    const seen = new Set<string>(), requested: { slug: string; quantity: number }[] = [];
    for (const raw of body.items) {
      if (!raw || typeof raw !== 'object') return badRequest('Invalid item');
      const slug = str(raw.slug, 100), quantity = int(raw.quantity, 1, 50);
      if (!/^[a-z0-9-]{2,100}$/.test(slug) || quantity === null || seen.has(slug)) return badRequest('Invalid or duplicate item');
      seen.add(slug); requested.push({ slug, quantity });
    }
    const db = await mongoDb();
    const settings = { ...defaultSettings, ...((await db.collection('settings').findOne({ _id: 'store' as never })) || {}) };
    if (!settings.orderingEnabled) return badRequest('Online ordering is currently unavailable', 503);
    if (fulfillment === 'delivery' && !settings.deliveryEnabled) return badRequest('Delivery is unavailable', 422);
    const products = await db.collection<ProductDocument>('products').find({ slug: { $in: requested.map(i => i.slug) }, available: true }).toArray();
    if (products.length !== requested.length) return badRequest('Some items are unavailable', 422);
    const bySlug = new Map(products.map(p => [p.slug, p]));
    const requestedAt = new Date(requestedDate + 'T' + requestedTime + ':00-04:00');
    if (!Number.isFinite(requestedAt.getTime())) return badRequest('Invalid requested time');
    // Conservative: enforce UTC-independent advance notice by treating local time as UTC.
    const earliest = new Date(requestedDate + 'T' + requestedTime + ':00Z').getTime();
    const minNotice = Math.max(settings.minimumNoticeHours, ...products.map(p => p.requiresPreorder ? (p.preorderNoticeHours ?? settings.defaultPreorderNoticeHours) : 0));
    if (earliest - Date.now() < minNotice * 3600000) return badRequest('Please choose a later time to meet advance notice requirements', 422);
    if (earliest - Date.now() > settings.maxAdvanceDays * 86400000) return badRequest('Requested date is too far ahead', 422);
    const items = requested.map(i => { const p = bySlug.get(i.slug)!; return { slug: i.slug, name: p.name, quantity: i.quantity, unitPriceCents: p.priceCents, lineTotalCents: p.priceCents * i.quantity }; });
    const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);
    if (fulfillment === 'delivery' && subtotalCents < settings.deliveryMinimumCents) return badRequest('Delivery minimum not met', 422);
    const deliveryFeeCents = fulfillment === 'delivery' ? settings.deliveryFeeCents : 0;
    const order: OrderDocument = { requestId, orderNumber: 'AH-' + randomUUID().slice(0, 8).toUpperCase(), status: 'pending', paymentStatus: 'unpaid', customerName, customerPhone, fulfillment, requestedDate, requestedTime, deliveryAddress: deliveryAddress || null, notes, items, subtotalCents, deliveryFeeCents, totalCents: subtotalCents + deliveryFeeCents, createdAt: new Date(), updatedAt: new Date() };
    try { await db.collection<OrderDocument>('orders').insertOne(order); }
    catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 11000) {
        const previous = await db.collection<OrderDocument>('orders').findOne({ requestId });
        if (previous) return NextResponse.json({ order: { number: previous.orderNumber, status: previous.status, subtotalCents: previous.subtotalCents, deliveryFeeCents: previous.deliveryFeeCents, totalCents: previous.totalCents } });
      }
      throw e;
    }
    return NextResponse.json({ order: { number: order.orderNumber, status: 'pending', subtotalCents, deliveryFeeCents, totalCents: order.totalCents } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { console.error('Order submission failed', e); return badRequest('Unable to submit order request', 503); }
}
