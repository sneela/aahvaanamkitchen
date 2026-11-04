export type ReportOrder = {
 order_number:number; customer_name:string; customer_phone:string; created_at:Date|string; requested_date:string;
 status:string; payment_status:string; subtotal_cents:number; discount_cents?:number; delivery_fee_cents:number; total_cents:number;
 fulfillment:string; order_items:{product_slug_snapshot?:string;product_name_snapshot:string;unit_label_snapshot?:string;quantity:number;line_total_cents:number}[];
};
const eastern=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export function easternDate(value:Date|string):string {
 const parts=eastern.formatToParts(new Date(value));
 const p=(type:string)=>parts.find(x=>x.type===type)?.value||'';
 return p('year')+'-'+p('month')+'-'+p('day');
}
export function validDate(value:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
const dollars=(cents:number)=>Math.round(cents)/100;
const customerKey=(o:ReportOrder)=>(o.customer_phone||'').replace(/\D/g,'')||'name:'+(o.customer_name||'').trim().toLowerCase();
export function buildReport(all:ReportOrder[],filters:{from?:string;to?:string;basis?:'placed'|'fulfillment';statuses?:string[];fulfillment?:string}={}){
 const orders=all.filter(o=>{
  const day=filters.basis==='fulfillment'?o.requested_date:easternDate(o.created_at);
  return (!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to)&&(!filters.statuses?.length||filters.statuses.includes(o.status))&&(!filters.fulfillment||o.fulfillment===filters.fulfillment);
 });
 const active=orders.filter(o=>!['cancelled','rejected'].includes(o.status));
 const sum=(rows:ReportOrder[],f:(o:ReportOrder)=>number)=>rows.reduce((n,o)=>n+f(o),0);
 const summary={orders:active.length,cancelled:orders.length-active.length,subtotal:dollars(sum(active,o=>o.subtotal_cents||0)),discounts:dollars(sum(active,o=>o.discount_cents||0)),delivery:dollars(sum(active,o=>o.delivery_fee_cents||0)),total:dollars(sum(active,o=>o.total_cents||0)),collected:dollars(sum(active.filter(o=>o.payment_status==='paid'),o=>o.total_cents||0)),unpaid:dollars(sum(active.filter(o=>o.payment_status==='unpaid'),o=>o.total_cents||0)),refunded:dollars(sum(orders.filter(o=>o.payment_status==='refunded'),o=>o.total_cents||0)),payment_unknown:dollars(sum(active.filter(o=>!['paid','unpaid','refunded'].includes(o.payment_status)),o=>o.total_cents||0))};
 const items=new Map<string,{name:string;unit:string;quantity:number;orders:Set<number>;gross_cents:number}>();
 const customers=new Map<string,{key:string;name:string;phone:string;orders:number;total_cents:number;paid_cents:number;last_order:string;history:{order_number:number;date:string;status:string;payment_status:string;total:number;items:string}[]}>();
 const days=new Map<string,{date:string;orders:number;total_cents:number;paid_cents:number}>();
 for(const o of active){
  const day=filters.basis==='fulfillment'?o.requested_date:easternDate(o.created_at);
  const d=days.get(day)||{date:day,orders:0,total_cents:0,paid_cents:0};
  d.orders++;d.total_cents+=o.total_cents||0;if(o.payment_status==='paid')d.paid_cents+=o.total_cents||0;days.set(day,d);
  for(const item of o.order_items||[]){
   const name=item.product_name_snapshot||'Unknown item',unit=item.unit_label_snapshot||'';
   const key=(item.product_slug_snapshot||name.toLowerCase())+'|'+unit.toLowerCase();
   const row=items.get(key)||{name,unit,quantity:0,orders:new Set<number>(),gross_cents:0};
   row.quantity+=item.quantity||0;row.orders.add(o.order_number);row.gross_cents+=item.line_total_cents||0;items.set(key,row);
  }
  const key=customerKey(o);
  const c=customers.get(key)||{key,name:o.customer_name||'Unknown',phone:o.customer_phone||'',orders:0,total_cents:0,paid_cents:0,last_order:'',history:[]};
  c.orders++;c.total_cents+=o.total_cents||0;if(o.payment_status==='paid')c.paid_cents+=o.total_cents||0;
  const stamp=new Date(o.created_at).toISOString();if(stamp>c.last_order)c.last_order=stamp;
  c.history.push({order_number:o.order_number,date:stamp,status:o.status,payment_status:o.payment_status,total:dollars(o.total_cents||0),items:(o.order_items||[]).map(i=>i.quantity+' × '+i.product_name_snapshot).join(', ')});
  customers.set(key,c);
 }
 const daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({date:d.date,orders:d.orders,total:dollars(d.total_cents),collected:dollars(d.paid_cents)}));
 const weeks=new Map<string,{week:string;orders:number;total:number;collected:number}>();
 for(const day of daily){const date=new Date(day.date+'T12:00:00Z');const offset=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-offset);const week=date.toISOString().slice(0,10);const row=weeks.get(week)||{week,orders:0,total:0,collected:0};row.orders+=day.orders;row.total+=day.total;row.collected+=day.collected;weeks.set(week,row);}
 return {summary,items:[...items.values()].sort((a,b)=>b.quantity-a.quantity).map(i=>({name:i.name,unit:i.unit,quantity:i.quantity,orders:i.orders.size,gross:dollars(i.gross_cents)})),customers:[...customers.values()].sort((a,b)=>b.total_cents-a.total_cents).map(c=>({key:c.key,name:c.name,phone:c.phone,orders:c.orders,total:dollars(c.total_cents),paid:dollars(c.paid_cents),last_order:c.last_order,history:c.history.sort((a,b)=>b.date.localeCompare(a.date))})),daily,weekly:[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week))};
}
