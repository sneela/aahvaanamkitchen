import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import type { OrderDoc } from '@/lib/mongodb/models';
import { jsonError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({error:'Invalid request'}, {status:422});
    const b = body as Record<string,unknown>;
    if (typeof b.id !== 'string' || !/^[a-f0-9]{24}$/i.test(b.id) || !Array.isArray(b.items) || !b.items.length || b.items.length > 100) return NextResponse.json({error:'Invalid order or items'}, {status:422});
    const items: OrderDoc['order_items'] = [];
    for (const entry of b.items) {
      if (!entry || typeof entry !== 'object') return NextResponse.json({error:'Invalid item'}, {status:422});
      const i = entry as Record<string,unknown>;
      const name = typeof i.name === 'string' ? i.name.trim() : '';
      const unit = typeof i.unit === 'string' ? i.unit.trim() : '';
      if (!name || name.length > 120 || unit.length > 100 || !Number.isSafeInteger(i.quantity) || (i.quantity as number) < 1 || (i.quantity as number) > 100000 || !Number.isSafeInteger(i.unit_price_cents) || (i.unit_price_cents as number) < 0 || (i.unit_price_cents as number) > 100000000) return NextResponse.json({error:'Invalid item name, quantity or price'}, {status:422});
      const line = (i.quantity as number) * (i.unit_price_cents as number);
      if (!Number.isSafeInteger(line) || line > 100000000) return NextResponse.json({error:'Line total too large'}, {status:422});
      items.push({product_slug_snapshot:typeof i.slug==='string' && /^[a-z0-9-]{1,100}$/.test(i.slug) ? i.slug : undefined,product_name_snapshot:name,unit_label_snapshot:unit||undefined,quantity:i.quantity as number,unit_price_cents:i.unit_price_cents as number,line_total_cents:line});
    }
    const subtotal = items.reduce((sum,i)=>sum+i.line_total_cents,0);
    if (!Number.isSafeInteger(subtotal) || subtotal > 100000000) return NextResponse.json({error:'Subtotal too large'}, {status:422});
    const db = await mongoDb();
    const id = new ObjectId(b.id);
    const existing = await db.collection<OrderDoc>('orders').findOne({_id:id});
    if (!existing) return NextResponse.json({error:'Order not found'}, {status:404});
    const type = existing.discount_type || 'none';
    const value = existing.discount_value || 0;
    const discount = type === 'fixed' ? Math.min(value,subtotal) : type === 'percent' ? Math.round(subtotal*value/100) : 0;
    const total = subtotal - discount + existing.delivery_fee_cents;
    const result = await db.collection<OrderDoc>('orders').updateOne({_id:id,updated_at:existing.updated_at},{$set:{order_items:items,subtotal_cents:subtotal,discount_cents:discount,total_cents:total,updated_at:new Date()}});
    if (!result.matchedCount) return NextResponse.json({error:'Order was changed by another admin. Refresh and retry.'},{status:409});
    return NextResponse.json({totalCents:total});
  } catch(error) {return jsonError(error,'Unable to edit order items');}
}
