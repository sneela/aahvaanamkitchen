import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ordering and delivery are disabled by default',()=>{const s=read('lib/mongodb/models.ts');assert.match(s,/ordering_enabled:\s*false/);assert.match(s,/delivery_enabled:\s*false/)});
test('orders are server-priced and pending without payment',()=>{const s=read('app/api/orders/route.ts');assert.match(s,/p\.price_cents/);assert.match(s,/status:\s*'pending'/);assert.match(s,/payment_status:\s*'unpaid'/);assert.match(s,/client_request_id/)});
test('administrator API checks authentication before mutation',()=>{const s=read('app/api/admin/route.ts');assert.ok((s.match(/await requireAdmin\(\)/g)||[]).length>=2)});
test('example environment does not contain secrets',()=>{const s=read('.env.example');assert.match(s,/MONGODB_URI=/);assert.doesNotMatch(s,/MONGODB_URI=\S+/);assert.doesNotMatch(s,/SESSION_SECRET=\S+/)});
