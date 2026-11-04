import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import type { OrderDoc } from '@/lib/mongodb/models';
import { jsonError, badRequest } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fmt = (v: number) => Math.round(v) / 100;
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const params = req.nextUrl.searchParams;
    const from = params.get('from') || '';
    const to = params.get('to') || '';
    const basis = params.get('basis') || 'placed';
    if (!['placed','fulfillment'].includes(basis)) return badRequest('Invalid date basis');
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) return badRequest('Invalid date range');
    const db = await mongoDb();
    const docs = await db.collection<OrderDoc>('orders').find({}, { projection: { customer_name:1,customer_phone:1,order_number:1,created_at:1,requested_date:1,status:1,payment_status:1,subtotal_cents:1,discount_cents:1,delivery_fee_cents:1,total_cents:1,order_items:1,fulfillment:1 } }).toArray();
    const eastern = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
    const dateKey = (date:Date) => { const parts=eastern.formatToParts(date);const part=(name:string)=>parts.find(p=>p.type===name)?.value||'';return part('year')+'-'+part('month')+'-'+part('day'); };
    const statuses = (params.get('statuses')||'').split(',').filter(Boolean);
    const orders = docs.filter(o=>{const date=basis==='placed'?dateKey(new Date(o.created_at)):o.requested_date;return (!from||date>=from)&&(!to||date<=to)&&(!statuses.length||statuses.includes(o.status))&&(!params.get('fulfillment')||o.fulfillment===params.get('fulfillment'));});
    const valid=orders.filter(o=>!['cancelled','rejected'].includes(o.status));
    const sum=(items:OrderDoc[],fn:(o:OrderDoc)=>number)=>items.reduce((n,o)=>n+fn(o),0);
    const items=new Map<string,{name:string;unit:string;quantity:number;orders:number;gross_cents:number}>();
    for(const o of valid) for(const item of o.order_items||[]){
      const name=item.product_name_snapshot||'Unknown item',unit=item.unit_label_snapshot||'';
      const key=(item.product_slug_snapshot||name.toLowerCase())+'|'+unit.toLowerCase();
      const row=items.get(key)||{name,unit,quantity:0,orders:0,gross_cents:0};
      row.quantity+=item.quantity||0;row.orders++;row.gross_cents+=item.line_total_cents||0;items.set(key,row);
    }
    const customers=new Map<string,{name:string;phone:string;orders:number;total_cents:number;paid_cents:number;last_order:string}>();
    for(const o of valid){
      const phone=(o.customer_phone||'').replace(/\D/g,'');
      const key=phone||'name:'+(o.customer_name||'').trim().toLowerCase();
      const row=customers.get(key)||{name:o.customer_name||'Unknown',phone:o.customer_phone||'',orders:0,total_cents:0,paid_cents:0,last_order:''};
      row.orders++;row.total_cents+=o.total_cents||0;if(o.payment_status==='paid')row.paid_cents+=o.total_cents||0;
      const stamp=new Date(o.created_at).toISOString();if(stamp>row.last_order)row.last_order=stamp;customers.set(key,row);
    }
    const result={
      range:{from,to,basis,timezone:'America/New_York'},
      summary:{orders:valid.length,cancelled:orders.length-valid.length,subtotal:fmt(sum(valid,o=>o.subtotal_cents||0)),discounts:fmt(sum(valid,o=>o.discount_cents||0)),delivery:fmt(sum(valid,o=>o.delivery_fee_cents||0)),total:fmt(sum(valid,o=>o.total_cents||0)),collected:fmt(sum(valid.filter(o=>o.payment_status==='paid'),o=>o.total_cents||0)),unpaid:fmt(sum(valid.filter(o=>o.payment_status!=='paid'),o=>o.total_cents||0))},
      items:[...items.values()].sort((a,b)=>b.quantity-a.quantity).map(i=>({...i,gross:fmt(i.gross_cents),gross_cents:undefined})),
      customers:[...customers.values()].sort((a,b)=>b.total_cents-a.total_cents).map(c=>({...c,total:fmt(c.total_cents),paid:fmt(c.paid_cents),total_cents:undefined,paid_cents:undefined})),
    };
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error){return jsonError(error,'Unable to generate reports');}
}
