import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('order API rejects only past time, not minimum notice or maximum advance window',()=>{
 const source=read('app/api/orders/route.ts');
 assert.match(source,/requestedMs <= Date\.now\(\)/);
 assert.doesNotMatch(source,/noticeHours\s*\*\s*3600000/);
 assert.doesNotMatch(source,/max_advance_days\s*\*\s*86400000/);
});
test('customer checkout does not promise advance notice',()=>{
 const source=read('app/page.tsx');
 assert.doesNotMatch(source,/at least \{notice\} hours advance notice/);
 assert.match(source,/subject to kitchen confirmation/);
});
