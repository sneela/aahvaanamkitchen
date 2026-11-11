import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../app/api/admin/orders/route.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../app/admin/order-manager.tsx',import.meta.url),'utf8');
test('server combines search, inclusive requested date and status OR',()=>{
 assert.match(api,/\$in: statuses/);
 assert.match(api,/requested_date: \{/);
 assert.match(api,/\$gte: from/);
 assert.match(api,/\$lte: to/);
 assert.match(api,/\.\.\.textQuery, \.\.\.dateQuery/);
});
test('UI preserves combined filters across refresh and pagination',()=>{
 assert.match(ui,/const filterParams =/);
 assert.match(ui,/statuses:selectedStatuses\.join/);
 assert.match(ui,/offset=0&/);
 assert.match(ui,/nextOffset \+ '&' \+ filterParams/);
 assert.match(ui,/\[query, selectedStatuses, dateMode, startDate, endDate\]/);
});
test('tomorrow and next two days have explicit inclusive bounds',()=>{
 assert.match(ui,/dateMode === 'next2' \? addDays\(today, 2\)/);
 assert.match(ui,/Next 2 days \(tomorrow \+ following day\)/);
});

test('calendar dates reject impossible days and counts are server-side',()=>{
 assert.match(api,/function validCalendarDate/);
 assert.match(api,/parsed\.toISOString\(\)\.slice\(0, 10\) === value/);
 assert.match(api,/!validCalendarDate\(from\)/);
 assert.match(api,/!validCalendarDate\(to\)/);
 assert.match(api,/countDocuments\(query\)/);
 assert.match(api,/totalMatching,/);
 assert.match(ui,/setTotalMatching/);
});
