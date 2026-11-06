import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('public contact visibility is off by default and requires explicit admin setting',()=>{
 const model=read('lib/mongodb/models.ts'),api=read('app/api/storefront/route.ts'),admin=read('app/api/admin/route.ts');
 assert.match(model,/show_whatsapp_contact:\s*false/);
 assert.match(api,/settings\.show_whatsapp_contact === true/);
 assert.match(admin,/show_whatsapp_contact/);
});
test('contact inquiries are stored server-side and rate limited',()=>{
 const api=read('app/api/contact/route.ts');
 assert.match(api,/rateLimit\(request,'contact'/);
 assert.match(api,/catering_inquiries/);
 assert.match(api,/customer_phone/);
});
test('homepage has private contact form and no duplicate hero logo',()=>{
 const page=read('app/page.tsx');
 assert.match(page,/id="contact"/);
 assert.match(page,/href="#contact">Contact us/);
 assert.match(page,/send\('\/api\/contact'/);
 assert.doesNotMatch(page,/className="hero-image"/);
 assert.doesNotMatch(page,/aahvaanam-food-catalog\.pdf/);
 assert.match(page,/settings\.showWhatsappContact&&settings\.whatsappNumber/);
});
