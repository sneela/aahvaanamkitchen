export type ReportOrder = {
 order_number:number; customer_name:string; customer_phone:string; created_at:Date|string; requested_date:string;
 status:string; payment_status:string; subtotal_cents:number; discount_cents?:number; delivery_fee_cents:number; total_cents:number;
 customer_id?:string;
 fulfillment:string; order_items:{product_slug_snapshot?:string;product_name_snapshot:string;unit_label_snapshot?:string;quantity:number;line_total_cents:number}[];
};
const eastern=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
const easternDateTimeParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function easternDate(value:Date|string):string {
 const parts=eastern.formatToParts(new Date(value));
 const p=(type:string)=>parts.find(x=>x.type===type)?.value||'';
 return p('year')+'-'+p('month')+'-'+p('day');
}
function easternDateTime(value:Date|string):string {
 const parts=easternDateTimeParts.formatToParts(new Date(value));
 const p=(type:string)=>parts.find(x=>x.type===type)?.value||'';
 return p('year')+'-'+p('month')+'-'+p('day')+'T'+p('hour')+':'+p('minute');
}
export function validDate(value:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function validDateTime(value:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;
 const d=new Date(value+':00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,16)===value;
}
const dollars=(cents:number)=>Math.round(cents)/100;
const customerKey=(o:ReportOrder)=>(o.customer_id||'').trim()||(o.customer_phone||'').replace(/\D/g,'')||'name:'+(o.customer_name||'').trim().toLowerCase();
const maskPhone=(value:string)=>{const d=(value||'').replace(/\D/g,'');if(!d)return '';if(d.length<=4)return '••'+d;return '••• ••• '+d.slice(-4);};
const normalize=(v:string)=>v.trim().toLowerCase();
const cents=(v:number|undefined)=>Math.max(0,Math.round(v||0));
const dayAfter=(value:string)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
const avg=(total:number,count:number)=>count?dollars(total/count):0;
export function buildReport(all:ReportOrder[],filters:{from?:string;to?:string;from_at?:string;to_at?:string;basis?:'placed'|'fulfillment';statuses?:string[];payment_statuses?:string[];fulfillment?:string;customer_id?:string;customer_phone?:string}={}){
 const statusSet=new Set((filters.statuses||[]).map(normalize));
 const paymentSet=new Set((filters.payment_statuses||[]).map(normalize));
 const fromAt=filters.from_at||'';
 const toAt=filters.to_at||'';
 const fromDay=filters.from||'';
 const toExclusive=filters.to?dayAfter(filters.to):'';
 const customerId=normalize(filters.customer_id||'');
 const customerPhone=(filters.customer_phone||'').replace(/\D/g,'');
 const orders=all.filter(o=>{
  const status=normalize(o.status||''),paymentStatus=normalize(o.payment_status||'');
  const day=filters.basis==='fulfillment'?(o.requested_date||''):easternDate(o.created_at);
  const at=filters.basis==='fulfillment'?(o.requested_date||'')+'T00:00':easternDateTime(o.created_at);
  const key=customerKey(o);
  const phone=(o.customer_phone||'').replace(/\D/g,'');
  return (!fromDay||day>=fromDay)&&(!toExclusive||day<toExclusive)&&(!fromAt||at>=fromAt)&&(!toAt||at<toAt)&&(!statusSet.size||statusSet.has(status))&&(!paymentSet.size||paymentSet.has(paymentStatus))&&(!filters.fulfillment||o.fulfillment===filters.fulfillment)&&(!customerId||normalize(key)===customerId)&&(!customerPhone||phone.includes(customerPhone));
 });
 const active=orders.filter(o=>!['cancelled','rejected'].includes(normalize(o.status||'')));
 const sum=(rows:ReportOrder[],f:(o:ReportOrder)=>number)=>rows.reduce((n,o)=>n+f(o),0);
 const summary={orders:active.length,cancelled:orders.length-active.length,subtotal:dollars(sum(active,o=>cents(o.subtotal_cents))),discounts:dollars(sum(active,o=>cents(o.discount_cents))),delivery:dollars(sum(active,o=>cents(o.delivery_fee_cents))),total:dollars(sum(active,o=>cents(o.total_cents))),collected:dollars(sum(active.filter(o=>normalize(o.payment_status)==='paid'),o=>cents(o.total_cents))),unpaid:dollars(sum(active.filter(o=>normalize(o.payment_status)==='unpaid'),o=>cents(o.total_cents))),outstanding:dollars(sum(active.filter(o=>normalize(o.payment_status)==='unpaid'||!['paid','refunded'].includes(normalize(o.payment_status||''))),o=>cents(o.total_cents))),refunded:dollars(sum(orders.filter(o=>normalize(o.payment_status)==='refunded'),o=>cents(o.total_cents))),payment_unknown:dollars(sum(active.filter(o=>!['paid','unpaid','refunded'].includes(normalize(o.payment_status||''))),o=>cents(o.total_cents)))};
 const items=new Map<string,{name:string;unit:string;quantity:number;orders:Set<number>;gross_cents:number;net_cents:number}>();
 const customers=new Map<string,{key:string;name:string;phone:string;orders:number;total_cents:number;paid_cents:number;outstanding_cents:number;last_order:string;first_order:string;cancelled:number;history:{order_number:number;date:string;status:string;payment_status:string;total:number;items:string}[]}>();
 const days=new Map<string,{date:string;orders:number;total_cents:number;paid_cents:number}>();
 for(const o of active){
  const day=filters.basis==='fulfillment'?o.requested_date:easternDate(o.created_at);
  const d=days.get(day)||{date:day,orders:0,total_cents:0,paid_cents:0};
  d.orders++;d.total_cents+=cents(o.total_cents);if(normalize(o.payment_status)==='paid')d.paid_cents+=cents(o.total_cents);days.set(day,d);
  const subtotal=cents(o.subtotal_cents),discount=cents(o.discount_cents);
  for(const item of o.order_items||[]){
   const name=item.product_name_snapshot||'Unknown item',unit=item.unit_label_snapshot||'';
   const key=(item.product_slug_snapshot||name.toLowerCase())+'|'+unit.toLowerCase();
   const gross=cents(item.line_total_cents);
   const discountShare=subtotal>0?Math.round(Math.min(discount,subtotal)*(gross/subtotal)):0;
   const row=items.get(key)||{name,unit,quantity:0,orders:new Set<number>(),gross_cents:0,net_cents:0};
   row.quantity+=item.quantity||0;row.orders.add(o.order_number);row.gross_cents+=gross;row.net_cents+=Math.max(0,gross-discountShare);items.set(key,row);
  }
  const key=customerKey(o);
  const c=customers.get(key)||{key,name:o.customer_name||'Unknown',phone:o.customer_phone||'',orders:0,total_cents:0,paid_cents:0,outstanding_cents:0,last_order:'',first_order:'',cancelled:0,history:[]};
  c.orders++;c.total_cents+=cents(o.total_cents);if(normalize(o.payment_status)==='paid')c.paid_cents+=cents(o.total_cents);if(normalize(o.payment_status)==='unpaid')c.outstanding_cents+=cents(o.total_cents);
  const stamp=new Date(o.created_at).toISOString();if(stamp>c.last_order)c.last_order=stamp;if(!c.first_order||stamp<c.first_order)c.first_order=stamp;
  c.history.push({order_number:o.order_number,date:stamp,status:o.status,payment_status:o.payment_status,total:dollars(cents(o.total_cents)),items:(o.order_items||[]).map(i=>i.quantity+' × '+i.product_name_snapshot).join(', ')});
  customers.set(key,c);
 }
 for(const o of orders){if(normalize(o.status)==='cancelled'){const key=customerKey(o),c=customers.get(key)||{key,name:o.customer_name||'Unknown',phone:o.customer_phone||'',orders:0,total_cents:0,paid_cents:0,outstanding_cents:0,last_order:'',first_order:'',cancelled:0,history:[]};c.cancelled++;customers.set(key,c);}}
 const daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({date:d.date,orders:d.orders,total:dollars(d.total_cents),collected:dollars(d.paid_cents)}));
 const weeks=new Map<string,{week:string;orders:number;total:number;collected:number}>();
 for(const day of daily){const date=new Date(day.date+'T12:00:00Z');const offset=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-offset);const week=date.toISOString().slice(0,10);const row=weeks.get(week)||{week,orders:0,total:0,collected:0};row.orders+=day.orders;row.total+=day.total;row.collected+=day.collected;weeks.set(week,row);}
 return {summary,items:[...items.values()].sort((a,b)=>b.quantity-a.quantity).map(i=>({name:i.name,unit:i.unit,quantity:i.quantity,orders:i.orders.size,gross:dollars(i.gross_cents),net:dollars(i.net_cents)})),customers:[...customers.values()].sort((a,b)=>b.total_cents-a.total_cents).map(c=>{const favorites=new Map<string,number>();for(const h of c.history){for(const item of h.items.split(', ').filter(Boolean)){const n=item.split(' × ').slice(1).join(' × ')||item;favorites.set(n,(favorites.get(n)||0)+1);}}return {key:c.key,name:c.name,phone:maskPhone(c.phone),orders:c.orders,total:dollars(c.total_cents),paid:dollars(c.paid_cents),outstanding:dollars(c.outstanding_cents),average_order:avg(c.total_cents,c.orders),first_order:c.first_order,last_order:c.last_order,cancelled:c.cancelled,favorite_items:[...favorites.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name])=>name),history:c.history.sort((a,b)=>b.date.localeCompare(a.date))};}),daily,weekly:[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week))};
}
