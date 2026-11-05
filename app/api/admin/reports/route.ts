import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import type { OrderDoc } from '@/lib/mongodb/models';
import { jsonError, badRequest } from '@/lib/api';
import { buildReport, validDate, validDateTime, type ReportOrder } from '@/lib/reporting';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 try {
  await requireAdmin();
  const p=request.nextUrl.searchParams;
  const from=p.get('from')||'',to=p.get('to')||'',fromAt=p.get('from_at')||'',toAt=p.get('to_at')||'',basis=p.get('basis')||'placed';
  if(!['placed','fulfillment'].includes(basis)||(from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to)||(fromAt&&!validDateTime(fromAt))||(toAt&&!validDateTime(toAt))||(fromAt&&toAt&&fromAt>=toAt))return badRequest('Invalid report date range');
  const statuses=(p.get('statuses')||'').split(',').map(v=>v.trim()).filter(Boolean);
  const paymentStatuses=(p.get('payment_statuses')||'').split(',').map(v=>v.trim()).filter(Boolean);
  const fulfillment=p.get('fulfillment')||'';
  const customerId=(p.get('customer_id')||'').trim();
  const customerPhone=(p.get('customer_phone')||'').trim();
  const db=await mongoDb();
  const query:Record<string,unknown>={};
  if(statuses.length)query.status={$in:statuses};
  if(paymentStatuses.length)query.payment_status={$in:paymentStatuses};
  if(fulfillment)query.fulfillment=fulfillment;
  if(customerId)query.customer_id=customerId;
  if(customerPhone)query.customer_phone={$regex:customerPhone.replace(/[^\d]/g,''),$options:'i'};
  const docs=await db.collection<OrderDoc>('orders').aggregate([
   {$match:query},
   {$project:{customer_name:1,customer_phone:1,customer_id:1,order_number:1,created_at:1,requested_date:1,status:1,payment_status:1,subtotal_cents:1,discount_cents:1,delivery_fee_cents:1,total_cents:1,order_items:1,fulfillment:1}},
  ],{allowDiskUse:true}).toArray();
  const report=buildReport(docs as ReportOrder[],{from,to,from_at:fromAt,to_at:toAt,basis:basis as 'placed'|'fulfillment',statuses,payment_statuses:paymentStatuses,fulfillment,customer_id:customerId,customer_phone:customerPhone});
  return NextResponse.json({range:{from,to,basis,timezone:'America/New_York'},...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return jsonError(error,'Unable to generate reports');}
}
