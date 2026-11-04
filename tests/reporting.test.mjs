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
