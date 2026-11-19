import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/api/admin/orders/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function setup() {
  const calls = [];
  const collection = {
    countDocuments(query) { calls.push(['count', query]); return Promise.resolve(101); },
    find(query) {
      calls.push(['find', query]);
      return { sort() { return this; }, skip(n) { calls.push(['skip', n]); return this; }, limit() { return this; }, async toArray() { return [{ order_number: 7 }]; } };
    }
  };
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, options }) } },
    '@/lib/auth/session': { requireAdmin: async () => {} },
    '@/lib/mongodb/client': { mongoDb: async () => ({ collection: () => collection }) },
    '@/lib/mongodb/models': { serialize: x => x },
    '@/lib/api': { badRequest: message => ({ error: message }), jsonError: error => { throw error; } }
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => modules[name] });
  return { calls, get: params => exports.GET({ nextUrl: new URL('https://example.test/?' + params) }) };
}

test('admin API combines inclusive date bounds, status OR and search OR in the same Mongo query', async () => {
  const { calls, get } = setup();
  const result = await get('from=2026-11-12&to=2026-11-13&statuses=pending,completed&q=%237');
  const query = JSON.parse(JSON.stringify(calls[0][1]));
  assert.deepEqual(query.requested_date, { $gte: '2026-11-12', $lte: '2026-11-13' });
  assert.deepEqual(query.status, { $in: ['pending', 'completed'] });
  assert.ok(query.$or.some(x => x.order_number === 7));
  assert.equal(calls[0][1], calls[1][1], 'count and page must use the same filter');
  assert.equal(result.body.totalMatching, 101);
  assert.equal(result.body.nextOffset, 1);
});

test('admin API rejects invalid dates, reversed ranges and unsupported statuses before querying orders', async () => {
  for (const params of ['from=2026-02-30', 'from=2026-11-13&to=2026-11-12', 'statuses=unknown']) {
    const { calls, get } = setup();
    assert.ok((await get(params)).error);
    assert.equal(calls.length, 0);
  }
});

test('admin API supports leap day, fulfillment search, and cleared status selection', async () => {
  const { calls, get } = setup();
  await get('from=2028-02-29&q=DELIVERY&statuses=');
  const query = JSON.parse(JSON.stringify(calls[0][1]));
  assert.equal(query.requested_date.$gte, '2028-02-29');
  assert.ok(query.$or.some(x => x.fulfillment === 'delivery'));
  assert.equal(query.status, undefined);
});
