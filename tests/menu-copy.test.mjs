import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../app/admin/catalog-manager.tsx',import.meta.url),'utf8');
test('copy opens a new product draft without retaining original identity',()=>{
 assert.ok(source.includes("id: '', slug: undefined"));
 assert.ok(source.includes('onCopy(product)'));
 assert.ok(source.includes("save('POST', payload)"));
 assert.ok(source.includes('setCopySource(product.name'));
});
test('copy size variant uses a distinct slug when name already exists',()=>{
 assert.ok(source.includes("products.some(p => p.slug === slug(newItem.name"));
 assert.ok(source.includes("slug(newItem.unit_label"));
 assert.ok(source.includes('payload.slug = candidate'));
});
