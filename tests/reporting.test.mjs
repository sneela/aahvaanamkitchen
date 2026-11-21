import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport,easternDate,validDate } from '../lib/reporting.ts';
const order=(overrides={})=>({order_number:1,customer_name:'A',customer_phone:'216 555 0100',created_at:'2026-11-01T03:30:00Z',requested_date:'2026-11-02',status:'completed',payment_status:'paid',subtotal_cents:2000,discount_cents:200,delivery_fee_cents:300,total_cents:2100,fulfillment:'pickup',order_items:[{product_name_snapshot:'Bonda',quantity:2,line_total_cents:2000,unit_label_snapshot:'plate'}],...overrides});
test('Eastern date changes at midnight and respects DST',()=>{
 assert.equal(easternDate('2026-11-01T03:30:00Z'),'2026-10-31');
 assert.equal(easternDate('2026-11-01T05:30:00Z'),'2026-11-01');
 assert.equal(easternDate('2026-03-08T04:59:00Z'),'2026-03-07');
 assert.equal(easternDate('2026-03-08T05:00:00Z'),'2026-03-08');
});
test('rejects impossible dates',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-11-04'),true)});
test('sales, payment, refunds and discounts do not count cancelled orders',()=>{
 const r=buildReport([order(),order({order_number:2,payment_status:'unpaid',total_cents:1000,subtotal_cents:1000,discount_cents:0,delivery_fee_cents:0}),order({order_number:3,status:'cancelled',payment_status:'refunded',total_cents:500})]);
 assert.equal(r.summary.orders,2);assert.equal(r.summary.cancelled,1);
 assert.equal(r.summary.total,31);assert.equal(r.summary.collected,21);assert.equal(r.summary.unpaid,10);assert.equal(r.summary.refunded,5);
 assert.equal(r.summary.discounts,2);
});
test('item quantities, order counts, histories and trends',()=>{
 const r=buildReport([order(),order({order_number:2,created_at:'2026-11-02T14:00:00Z',order_items:[{product_name_snapshot:'Bonda',quantity:3,line_total_cents:3000,unit_label_snapshot:'plate'}]})]);
 assert.equal(r.items[0].quantity,5);assert.equal(r.items[0].orders,2);
 assert.equal(r.customers.length,1);assert.equal(r.customers[0].history.length,2);
 assert.equal(r.daily.length,2);assert.equal(r.weekly.length,2);
});
test('inclusive date range and fulfillment basis',()=>{
 const r=buildReport([order()],{from:'2026-11-02',to:'2026-11-02',basis:'fulfillment'});
 assert.equal(r.summary.orders,1);
 assert.equal(buildReport([order()],{from:'2026-11-02',to:'2026-11-02',basis:'placed'}).summary.orders,0);
});

test('report status filters combine with dates and retain cancelled counts',()=>{
 const rows=[order(),order({order_number:2,status:'pending',payment_status:'unpaid'}),order({order_number:3,status:'cancelled',payment_status:'refunded'}),order({order_number:4,status:'completed',requested_date:'2026-11-03'})];
 const r=buildReport(rows,{basis:'fulfillment',from:'2026-11-02',to:'2026-11-02',statuses:['completed','cancelled']});
 assert.equal(r.summary.orders,1);assert.equal(r.summary.cancelled,1);assert.equal(r.summary.total,21);
 assert.deepEqual(r.byStatus,[{status:'cancelled',orders:1,total:21,collected:0},{status:'completed',orders:1,total:21,collected:21}]);
 assert.equal(buildReport(rows,{statuses:[]}).byStatus.length,3);
 assert.equal(buildReport(rows,{statuses:['preparing']}).byStatus.length,0);
});

test('weekly totals retain exact cents across daily totals',()=>{
 const r=buildReport([order({created_at:'2026-11-02T14:00:00Z',total_cents:10}),order({order_number:2,created_at:'2026-11-03T14:00:00Z',total_cents:20})]);
 assert.equal(r.weekly[0].total,0.3);assert.equal(r.weekly[0].collected,0.3);
});

test('catalog report includes unsold items and counts distinct orders and pieces',()=>{
 const catalog=[{slug:'mirchi-bajji',name:'Mirchi Bajji',unit_label:'5 pcs'},{slug:'chicken-curry',name:'Chicken Curry',unit_label:'16 oz'}];
 const rows=[order({order_items:[{product_slug_snapshot:'mirchi-bajji',product_name_snapshot:'Mirchi Bajji',unit_label_snapshot:'5 pcs',quantity:2,line_total_cents:2000}]}),order({order_number:2,order_items:[{product_slug_snapshot:'mirchi-bajji',product_name_snapshot:'Mirchi Bajji',unit_label_snapshot:'5 pcs',quantity:3,line_total_cents:3000}]}),order({order_number:3,status:'cancelled',order_items:[{product_slug_snapshot:'mirchi-bajji',product_name_snapshot:'Mirchi Bajji',unit_label_snapshot:'5 pcs',quantity:10,line_total_cents:10000}]})];
 const report=buildReport(rows,{},catalog);
 const bajji=report.itemSales.find(x=>x.slug==='mirchi-bajji');
 assert.equal(bajji.orders,2);assert.equal(bajji.quantity,5);assert.equal(bajji.pieces,25);
 const curry=report.itemSales.find(x=>x.slug==='chicken-curry');
 assert.equal(curry.orders,0);assert.equal(curry.quantity,0);assert.equal(curry.pieces,null);
});
test('item sales obey date and multi-status filters',()=>{
 const catalog=[{slug:'bonda',name:'Bonda',unit_label:'5 pieces'}];
 const rows=[order({status:'completed',order_items:[{product_slug_snapshot:'bonda',product_name_snapshot:'Bonda',unit_label_snapshot:'5 pieces',quantity:2,line_total_cents:2000}]}),order({order_number:2,status:'pending',requested_date:'2026-11-03',order_items:[{product_slug_snapshot:'bonda',product_name_snapshot:'Bonda',unit_label_snapshot:'5 pieces',quantity:4,line_total_cents:4000}]})];
 const r=buildReport(rows,{basis:'fulfillment',from:'2026-11-02',to:'2026-11-02',statuses:['completed','pending']},catalog);
 assert.equal(r.itemSales[0].orders,1);assert.equal(r.itemSales[0].pieces,10);
});

test('piece count falls back to explicit menu name when unit is plate',()=>{
 const catalog=[{slug:'punugulu',name:'Punugulu (12 pcs)',unit_label:'plate'},{slug:'vada',name:'Vada (5 pieces)',unit_label:'plate'},{slug:'curry',name:'Chicken Curry (16 oz)',unit_label:'container'}];
 const rows=[order({order_items:[{product_slug_snapshot:'punugulu',product_name_snapshot:'Punugulu (12 pcs)',unit_label_snapshot:'plate',quantity:3,line_total_cents:3000},{product_slug_snapshot:'vada',product_name_snapshot:'Vada (5 pieces)',unit_label_snapshot:'plate',quantity:2,line_total_cents:2000}]})];
 const result=buildReport(rows,{},catalog);
 assert.equal(result.itemSales.find(x=>x.slug==='punugulu').pieces,36);
 assert.equal(result.itemSales.find(x=>x.slug==='vada').pieces,10);
 assert.equal(result.itemSales.find(x=>x.slug==='curry').pieces,null);
});
