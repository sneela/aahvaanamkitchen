import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import { serialize, type OrderDoc } from '@/lib/mongodb/models';
import { badRequest, jsonError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const raw = request.nextUrl.searchParams.get('offset') || '0';
    if (!/^\d{1,6}$/.test(raw)) return badRequest('Invalid page offset');
    const offset = Number(raw);
    const db = await mongoDb();
    const search = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
    const orderNumberSearch = /^#(\d+)$/.exec(search)?.[1];
    const escaped = search.replace(/[^a-zA-Z0-9 ]/g, ch => String.fromCharCode(92) + ch);
    const textQuery = search ? { $or: [
      { customer_name: { $regex: escaped, $options: 'i' } },
      { customer_phone: { $regex: escaped, $options: 'i' } },
      { 'order_items.product_name_snapshot': { $regex: escaped, $options: 'i' } },
      ...( /^[0-9]+$/.test(search) ? [{ order_number: Number(search) }] : [] ),
      ...(orderNumberSearch ? [{ order_number: Number(orderNumberSearch) }] : []),
    ] } : {};
    const from = request.nextUrl.searchParams.get('from') || '';
    const to = request.nextUrl.searchParams.get('to') || '';
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) return badRequest('Invalid date range');
    const statuses = (request.nextUrl.searchParams.get('statuses') || '').split(',').filter(Boolean);
    const allowed = ['pending','accepted','rejected','preparing','ready_for_pickup','out_for_delivery','completed','cancelled'];
    if (statuses.some(status => !allowed.includes(status))) return badRequest('Invalid order status');
    const dateQuery = from || to ? { requested_date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {};
    const query = { ...textQuery, ...dateQuery, ...(statuses.length ? { status: { $in: statuses } } : {}) };
    const orders = await db.collection<OrderDoc>('orders').find(query)
      .sort({ created_at: -1, _id: -1 }).skip(offset).limit(PAGE_SIZE).toArray();
    return NextResponse.json({
      orders: orders.map(serialize),
      nextOffset: orders.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 'Unable to load older orders'); }
}
