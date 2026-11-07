import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('admin can change delivery fee without trusting client totals',()=>{
 const api=read('app/api/admin/route.ts');
 assert.match(api,/b\.delivery_fee_cents !== undefined/);
 assert.match(api,/Number\.isSafeInteger\(b\.delivery_fee_cents\)/);
 assert.match(api,/existing\.fulfillment === 'pickup'/);
 assert.match(api,/existing\.subtotal_cents - amount \+ deliveryFee/);
});
test('admin order form exposes delivery fee for delivery orders',()=>{
 const page=read('app/admin/order-manager.tsx');
 assert.match(page,/Delivery fee \(\$\)/);
 assert.match(page,/delivery_fee_cents: Math\.round\(numericFee \* 100\)/);
 assert.match(page,/order\.fulfillment === 'pickup'/);
});
test('admin date filter uses real digit regex',()=>{
 const api=read('app/api/admin/orders/route.ts');
 assert.ok(api.includes(String.raw`/^\\d{4}-\\d{2}-\\d{2}$/`),'Date regex must match YYYY-MM-DD');
 assert.ok(!api.includes(String.raw`/^\\\\d{4}`),'Date regex must not match a literal backslash');
});
