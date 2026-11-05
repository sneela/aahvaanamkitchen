import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import type { OrderDoc } from '@/lib/mongodb/models';
import { jsonError, badRequest } from '@/lib/api';
import { buildReport, validDate, type ReportOrder } from '@/lib/reporting';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 try {
  await requireAdmin();
  const p=request.nextUrl.searchParams;
  const from=p.get('from')||'',to=p.get('to')||'',basis=p.get('basis')||'placed';
  if(!['placed','fulfillment'].includes(basis)|| (from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to))return badRequest('Invalid report date range');
  const statuses=(p.get('statuses')||'').split(',').filter(Boolean);
  const db=await mongoDb();
  const docs=await db.collection<OrderDoc>('orders').find({},{projection:{customer_name:1,customer_phone:1,order_number:1,created_at:1,requested_date:1,status:1,payment_status:1,subtotal_cents:1,discount_cents:1,delivery_fee_cents:1,total_cents:1,order_items:1,fulfillment:1}}).toArray();
  const report=buildReport(docs as ReportOrder[],{from,to,basis:basis as 'placed'|'fulfillment',statuses,fulfillment:p.get('fulfillment')||''});
  return NextResponse.json({range:{from,to,basis,timezone:'America/New_York'},...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return jsonError(error,'Unable to generate reports');}
}
