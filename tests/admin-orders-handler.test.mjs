import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../app/api/admin/orders/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup() {
  const calls = [];
  const cursor = { sort: () => cursor, skip: () => cursor, limit: () => cursor, toArray: async () => [{ order_number: 7 }] };
  const modules = {
    'next/server': { NextResponse: { json: (body) => ({ status: 200, body }) } },
    '@/lib/auth/session': { requireAdmin: async () => {} },
    '@/lib/mongodb/client': { mongoDb: async () => ({ collection: () => ({
      countDocuments: async q => { calls.push(q); return 1; },
      find: q => { calls.push(q); return cursor; },
    }) }) },
    '@/lib/mongodb/models': { serialize: x => x },
    '@/lib/api': { badRequest: message => ({ status: 400, message }), jsonError: error => { throw error; } },
  };
  const exports = {};
  runInNewContext(compiled, { exports, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; } });
  return { calls, get: params => exports.GET({ nextUrl: new URL('https://example.test/?' + params) }) };
}
test('admin API combines inclusive fulfillment dates, status OR and order number search', async () => {
  const { calls, get } = setup();
  const response = await get('from=2026-11-13&to=2026-11-14&statuses=pending,completed&q=%237');
  assert.equal(response.status, 200);
  assert.equal(response.body.totalMatching, 1);
  assert.equal(response.body.nextOffset, null);
  const q = JSON.parse(JSON.stringify(calls[0]));
  assert.deepEqual(q.requested_date, { $gte: '2026-11-13', $lte: '2026-11-14' });
  assert.deepEqual(q.status, { $in: ['pending', 'completed'] });
  assert.ok(q.$or.some(x => x.order_number === 7));
  assert.equal(JSON.stringify(calls[0]), JSON.stringify(calls[1]));
});
test('admin API rejects invalid dates and statuses before querying orders', async () => {
  for (const params of ['from=2026-02-30','from=2026-11-14&to=2026-11-13','statuses=unknown']) {
    const { calls, get } = setup();
    assert.equal((await get(params)).status, 400);
    assert.equal(calls.length, 0);
  }
});
test('admin API accepts leap day, case-insensitive fulfillment and cleared statuses', async () => {
  const { calls, get } = setup();
  assert.equal((await get('from=2028-02-29&q=DELIVERY&statuses=')).status, 200);
  assert.ok(calls[0].$or.some(x => x.fulfillment === 'delivery'));
  assert.equal(calls[0].status, undefined);
});
