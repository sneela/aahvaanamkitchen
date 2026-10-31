import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd(), read = p => readFileSync(join(root, p), 'utf8');
const menu = JSON.parse(read('scripts/seed-menu.json'));
assert.equal(menu.length, 31, 'Original starter catalog should contain 31 items');
assert.equal(new Set(menu.map(i => i.id)).size, menu.length, 'Unique menu slugs');
for (const file of [
  'public/images/aahvaanam-correct-wordmark.webp','app/catalog/page.tsx',
  'app/page.tsx','app/globals.css','app/admin/page.tsx','app/admin/login/page.tsx','app/admin/dashboard.tsx',
  'app/api/storefront/route.ts','app/api/orders/route.ts','app/api/reviews/route.ts','app/api/catering/route.ts',
  'app/api/admin/route.ts','app/api/admin/analytics/route.ts','app/api/analytics/route.ts','app/admin/analytics-dashboard.tsx','app/admin/announcement-manager.tsx','components/visit-tracker.tsx','lib/client-analytics.ts','app/api/auth/login/route.ts','app/api/auth/logout/route.ts',
  'lib/auth/session.ts','lib/mongodb/client.ts','lib/mongodb/models.ts',
  'scripts/mongodb-indexes.mjs','scripts/seed-mongodb.mjs',
]) assert.ok(existsSync(join(root,file)), `Missing: ${file}`);
for (const path of ['app/admin/dashboard.tsx','app/admin/login/page.tsx','app/api/admin/route.ts','app/api/orders/route.ts','app/api/storefront/route.ts']) {
  assert.ok(!/supabase/i.test(read(path)), `Unexpected Supabase reference in ${path}`);
}
assert.ok(read('app/api/admin/route.ts').includes('await requireAdmin()'), 'Admin API must authenticate');
assert.ok(read('app/api/orders/route.ts').includes('price_cents'), 'Order prices computed from DB');
assert.ok(!/^MONGODB_URI=\S+/m.test(read('.env.example')), 'No secret in example env');
for (const path of ['app/page.tsx','app/admin/dashboard.tsx','app/admin/login/page.tsx','app/catalog/page.tsx','app/api/storefront/route.ts']) {
  assert.ok(!read(path).includes('/images/aahvaanam-logo.jpg'), `Outdated logo reference in ${path}`);
}
console.log(`Source checks passed: ${menu.length} items, assets, MongoDB APIs, authenticated admin.`);
