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
    const orders = await db.collection<OrderDoc>('orders').find()
      .sort({ created_at: -1, _id: -1 }).skip(offset).limit(PAGE_SIZE).toArray();
    return NextResponse.json({
      orders: orders.map(serialize),
      nextOffset: orders.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 'Unable to load older orders'); }
}
