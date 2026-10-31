import assert from 'node:assert/strict';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { MongoClient } from 'mongodb';
const localUri=/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|\?|$)/;
if (!process.env.MONGODB_URI || !localUri.test(process.env.MONGODB_URI)) throw Error('This test is restricted to a local MongoDB instance only');
const dbName='aahvaanam_ci_'+Date.now(),password='IntegrationOnly-'+randomUUID();
const salt=randomBytes(16).toString('hex'),hash=scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex');
const env={...process.env,MONGODB_DB_NAME:dbName,ADMIN_EMAIL:'admin@example.test',ADMIN_PASSWORD_HASH:salt+':'+hash,SESSION_SECRET:randomBytes(40).toString('hex'),RESEND_API_KEY:'',TWILIO_ACCOUNT_SID:'',TWILIO_AUTH_TOKEN:''};
const client=new MongoClient(env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
let child,logs='';
const base='http://127.0.0.1:3218';
const request=async(path,method='GET',body,cookie)=>{const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text.slice(0,250)}}return {status:r.status,data,headers:r.headers}};
const expect=async(path,method,body,status,cookie)=>{const r=await request(path,method,body,cookie);assert.equal(r.status,status,path+' returned '+r.status+': '+JSON.stringify(r.data));return r};
const easternFuture=()=>{const d=new Date(Date.now()+7*86400000);const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day};
try{
 await client.connect();
 execFileSync(process.execPath,['scripts/mongodb-indexes.mjs'],{env,stdio:'pipe'});
 execFileSync(process.execPath,['scripts/seed-mongodb.mjs'],{env,stdio:'pipe'});
 const db=client.db(dbName);
 assert.equal(await db.collection('products').countDocuments(),31);
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3218'],{env,stdio:'pipe'});
 child.stdout.on('data',b=>logs+=b.toString());child.stderr.on('data',b=>logs+=b.toString());
 let ready=false;for(let i=0;i<50;i++){if(child.exitCode!==null)throw Error('Next exited: '+logs);try{const r=await fetch(base);if(r.ok){ready=true;break}}catch{}await sleep(500)}
 assert.ok(ready,'Next did not start: '+logs);
 const store=await expect('/api/storefront','GET',undefined,200);assert.equal(store.data.connected,true);assert.equal(store.data.products.length,31);assert.equal(store.data.settings.orderingEnabled,false);
 await expect('/api/orders','POST',{},400); // Validation runs before the ordering-enabled check.
 await expect('/api/admin','GET',undefined,401);
 await expect('/api/auth/login','POST',{email:env.ADMIN_EMAIL,password:'incorrect'},401);
 const login=await expect('/api/auth/login','POST',{email:env.ADMIN_EMAIL,password},200);
 const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie?.startsWith('aahvaanam_admin='));
 for(let i=0;i<3;i++){
   const attempt=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'rotating-test-'+i},body:JSON.stringify({email:env.ADMIN_EMAIL,password:'incorrect'})});
   assert.equal(attempt.status,401,'Invalid login should be rejected');
 }
 const throttled=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'rotating-test-final'},body:JSON.stringify({email:env.ADMIN_EMAIL,password:'incorrect'})});
 assert.equal(throttled.status,429,'Changing User-Agent must not bypass the login rate limit');
 const admin=await expect('/api/admin','GET',undefined,200,cookie);assert.equal(admin.data.products.length,31);

 await expect('/api/admin','POST',{resource:'announcement',title:'Sunday special',message:'Bakshalu pre-orders open!',kind:'special',is_published:true,action_label:'See menu',action_href:'#menu'},200,cookie);
 const announcements=(await expect('/api/admin','GET',undefined,200,cookie)).data.announcements;
 assert.equal(announcements.length,1);
 assert.equal((await expect('/api/storefront','GET',undefined,200)).data.announcements[0].title,'Sunday special');
 await expect('/api/admin','PATCH',{resource:'announcement',id:announcements[0].id,is_published:false},200,cookie);
 assert.equal((await expect('/api/storefront','GET',undefined,200)).data.announcements.length,0);
 await expect('/api/admin','DELETE',{resource:'announcement',id:announcements[0].id},200,cookie);

 await expect('/api/admin/analytics?days=30','GET',undefined,401);
 await expect('/api/analytics','POST',{event:'visit'},200);
 await expect('/api/analytics','POST',{event:'product_view',slug:'juwar-roti'},200);
 await expect('/api/analytics','POST',{event:'add_to_cart',slug:'juwar-roti'},200);
 await expect('/api/analytics','POST',{event:'checkout_started'},200);
 await expect('/api/analytics','POST',{event:'product_view',slug:'missing-item'},404);
 const analytics=await expect('/api/admin/analytics?days=30','GET',undefined,200,cookie);
 assert.equal(analytics.data.totals.visits,1);
 assert.equal(analytics.data.totals.productViews,1);
 assert.equal(analytics.data.totals.addToCart,1);
 assert.equal(analytics.data.totals.checkoutStarted,1);
 assert.equal(analytics.data.totals.ordersPlaced,0);
 await expect('/api/admin','PATCH',{resource:'settings',analytics_enabled:false},200,cookie);
 const disabled=await fetch(base+'/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'visit'})});
 assert.equal(disabled.status,204);
 await expect('/api/admin','PATCH',{resource:'settings',analytics_enabled:true},200,cookie);



 // New catalog management: images, automatic slugs, updates and safe category deletion.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XmZkAAAAASUVORK5CYII=','base64');
 const form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'item.png');
 const anonymousUpload=await fetch(base+'/api/admin/images',{method:'POST',body:form});
 assert.equal(anonymousUpload.status,401,'Image uploads must require admin authentication');
 const uploaded=await fetch(base+'/api/admin/images',{method:'POST',body:form,headers:{Cookie:cookie,Origin:'http://127.0.0.1:3218'}});
 assert.equal(uploaded.status,201,'Authenticated admin image upload should succeed');
 const imageBody=await uploaded.json();assert.match(imageBody.image_url,/^\/api\/images\/[a-f0-9]{24}$/);
 const served=await fetch(base+imageBody.image_url);assert.equal(served.status,200);
 assert.equal(served.headers.get('content-type'),'image/png');
 assert.deepEqual(Buffer.from(await served.arrayBuffer()),png);
 const forged=await fetch(base+'/api/admin/images',{method:'POST',body:form,headers:{Cookie:cookie,Origin:'https://untrusted.example'}});
 assert.equal(forged.status,403,'Cross-origin image uploads must be rejected');
 await expect('/api/admin','POST',{resource:'category',name:'Freshly Prepared Snacks',is_active:true,sort_order:20},200,cookie);
 const newCategories=await expect('/api/admin','GET',undefined,200,cookie);
 assert.ok(newCategories.data.categories.some(c=>c.id==='freshly-prepared-snacks'),'Category ID should generate from name');
 await expect('/api/admin','POST',{resource:'product',name:'Integration Test Snack',description:'An automated test product',category_id:'freshly-prepared-snacks',price_cents:1299,unit_label:'5 pieces',image_url:imageBody.image_url,is_available:true,requires_preorder:false,preorder_notice_hours:12,is_vegetarian:true,sort_order:40},200,cookie);
 const createdAdmin=await expect('/api/admin','GET',undefined,200,cookie);
 const createdItem=createdAdmin.data.products.find(p=>p.slug==='integration-test-snack');
 assert.ok(createdItem?.id,'Product slug should be auto-generated from name');
 assert.equal(createdItem.image_url,imageBody.image_url);
 await expect('/api/admin','DELETE',{resource:'category',category_id:'freshly-prepared-snacks'},409,cookie);
 await expect('/api/admin','PATCH',{resource:'product',id:createdItem.id,name:'Updated Integration Snack',price_cents:1599},200,cookie);
 const updatedItem=(await expect('/api/admin','GET',undefined,200,cookie)).data.products.find(p=>p.id===createdItem.id);
 assert.equal(updatedItem.name,'Updated Integration Snack');
 assert.equal(updatedItem.price_cents,1599);
 assert.equal(updatedItem.slug,'integration-test-snack','Editing name must preserve order identifier');
 await expect('/api/admin','DELETE',{resource:'product',id:createdItem.id},200,cookie);
 assert.equal((await fetch(base+imageBody.image_url)).status,404,'Deleting a product removes its unreferenced photo');
 await expect('/api/admin','DELETE',{resource:'category',category_id:'freshly-prepared-snacks'},200,cookie);

 await expect('/api/admin','POST',{resource:'category',category_id:'integration-seasonal',name:'Integration Seasonal',sort_order:99,is_active:true},200,cookie);
 await expect('/api/admin','PATCH',{resource:'category',category_id:'integration-seasonal',is_active:false},200,cookie);
 const withCategory=await expect('/api/admin','GET',undefined,200,cookie);
 assert.equal(withCategory.data.categories.find(c=>c.id==='integration-seasonal')?.is_active,false);
 await expect('/api/admin','DELETE',{resource:'category',category_id:'traditional-rotis'},409,cookie);
 await expect('/api/admin','DELETE',{resource:'category',category_id:'integration-seasonal'},200,cookie);
 await expect('/api/admin','PATCH',{resource:'settings',ordering_enabled:true,delivery_enabled:true,delivery_minimum_cents:2000,default_delivery_fee_cents:300},200,cookie);
 const updated=await expect('/api/storefront','GET',undefined,200);assert.equal(updated.data.settings.orderingEnabled,true);
 const date=easternFuture(),order={name:'Test Customer',phone:'2165550101',date,time:'18:00',address:'123 Test Street, Cleveland OH 44101',notes:'Integration test',fulfillment:'delivery',requestId:randomUUID(),items:[{slug:'juwar-roti',quantity:2}],website:''};
 const created=await expect('/api/orders','POST',order,201);assert.equal(created.data.order.totalCents,2300);assert.equal(created.data.order.deliveryFeeCents,300);
 const repeat=await expect('/api/orders','POST',order,200);assert.equal(repeat.data.order.number,created.data.order.number);
 assert.equal(await db.collection('orders').countDocuments(),1);
 const stored=await db.collection('orders').findOne({client_request_id:order.requestId});assert.equal(stored.status,'pending');assert.equal(stored.payment_status,'unpaid');

 assert.equal(stored.order_items[0].product_slug_snapshot,'juwar-roti');
 for(let i=0;i<4;i++){
   await expect('/api/orders','POST',{...order,requestId:randomUUID()},201);
 }
 const popular=(await expect('/api/storefront','GET',undefined,200)).data.products.find(p=>p.id==='juwar-roti');
 assert.equal(popular.recentOrders24h,5);
 await expect('/api/admin','PATCH',{resource:'order',id:String(stored._id),status:'rejected',status_comment:'Test rejection'},200,cookie);
 const reduced=(await expect('/api/storefront','GET',undefined,200)).data.products.find(p=>p.id==='juwar-roti');
 assert.equal(reduced.recentOrders24h,4);
 await expect('/api/admin','PATCH',{resource:'order',id:String(stored._id),status:'accepted',status_comment:'Test re-confirmation'},200,cookie);


 // Customers can see only their own order using the correct number AND phone.
 const lookup={orderNumber:created.data.order.number,phone:order.phone};
 const publicPending=await expect('/api/orders/status','POST',lookup,200);
 assert.equal(publicPending.data.order.status,'pending');
 assert.equal(publicPending.data.order.items[0].name,'Jowar Roti');
 assert.equal(publicPending.data.order.items[0].quantity,2);
 assert.equal(publicPending.data.order.totalCents,2300);
 const paged=await expect('/api/admin/orders?offset=0','GET',undefined,200,cookie);
 assert.equal(paged.data.orders.length,1);
 assert.equal(paged.data.orders[0].order_number,created.data.order.number);
 await expect('/api/admin/orders?offset=bogus','GET',undefined,400,cookie);
 await expect('/api/admin/orders?offset=0','GET',undefined,401);
 const withCountryCode=await expect('/api/orders/status','POST',{...lookup,phone:'+1 (216) 555-0101'},200);
 assert.equal(withCountryCode.data.order.number,created.data.order.number);
 assert.ok(!('customer_name' in publicPending.data.order),'Customer identity must not leak');
 assert.ok(!('delivery_address' in publicPending.data.order),'Delivery address must remain private');
 await expect('/api/orders/status','POST',{...lookup,phone:'2165559999'},404);
 await expect('/api/orders/status','POST',{...lookup,orderNumber:999999},404);
 await expect('/api/admin','PATCH',{resource:'order',id:String(stored._id),status:'rejected',status_comment:''},422,cookie);
 await expect('/api/admin','PATCH',{resource:'order',id:String(stored._id),status:'rejected',status_comment:'We cannot prepare this item for the requested date.'},200,cookie);
 const rejected=await expect('/api/orders/status','POST',lookup,200);
 assert.equal(rejected.data.order.status,'rejected');
 assert.match(rejected.data.order.comment,/cannot prepare/);
 await expect('/api/admin','PATCH',{resource:'order',id:String(stored._id),status:'accepted',status_comment:'Confirmed. Please arrive at the selected time.'},200,cookie);
 const confirmed=await expect('/api/orders/status','POST',lookup,200);
 assert.equal(confirmed.data.order.status,'accepted');
 assert.match(confirmed.data.order.comment,/Confirmed/);

 await expect('/api/orders','POST',{...order,requestId:randomUUID(),items:[{slug:'juwar-roti',quantity:1}]},422);
 await expect('/api/catering','POST',{name:'Test Caterer',phone:'2165550102',date,guests:12,message:'A small family gathering with vegetarian food.',website:''},201);
 await expect('/api/reviews','POST',{name:'Test Reviewer',rating:5,review:'A very pleasant experience with homemade food.',website:''},201);
 const reviews=await db.collection('reviews').find().toArray();assert.equal(reviews.length,1);assert.equal(reviews[0].is_approved,false);
 await expect('/api/admin','PATCH',{resource:'review',id:String(reviews[0]._id),is_approved:true},200,cookie);
 const published=await expect('/api/storefront','GET',undefined,200);assert.equal(published.data.reviews.length,1);
 await expect('/api/admin','POST',{resource:'special',title:'Integration Festival Special',description:'Available by advance request',is_published:true},200,cookie);
 const special=await expect('/api/storefront','GET',undefined,200);assert.equal(special.data.specials.length,1);
 await expect('/api/admin','PATCH',{resource:'order',id:String(stored._id),status:'completed',payment_status:'paid'},200,cookie);
 const changed=await db.collection('orders').findOne({_id:stored._id});assert.equal(changed.status,'completed');assert.equal(changed.payment_status,'paid');
 const initialCatalogResponse=await fetch(base+'/catalog');assert.equal(initialCatalogResponse.status,200);
 const initialCatalogHtml=await initialCatalogResponse.text();assert.ok(initialCatalogHtml.includes('Jowar Roti'),'Live catalog should include available menu items');
 const jowar=admin.data.products.find(p=>p.slug==='juwar-roti'),ragi=admin.data.products.find(p=>p.slug==='ragi-roti');
 assert.ok(jowar?.id && ragi?.id,'Seeded rotis should exist');
 await expect('/api/admin','PATCH',{resource:'product',id:ragi.id,price_cents:1234},200,cookie);
 await expect('/api/admin','PATCH',{resource:'product',id:jowar.id,is_available:false},200,cookie);
 const currentCatalogResponse=await fetch(base+'/catalog');assert.equal(currentCatalogResponse.status,200);
 const currentCatalogHtml=await currentCatalogResponse.text();
 assert.ok(currentCatalogHtml.includes('12.34'),'Catalog must show current MongoDB price; HTML may split currency into React text nodes');
 assert.ok(!currentCatalogHtml.includes('Jowar Roti'),'Catalog must exclude unavailable products');
 const currentStorefront=await expect('/api/storefront','GET',undefined,200);
 assert.ok(!currentStorefront.data.products.some(p=>p.id==='juwar-roti'),'Storefront must exclude unavailable products');
 await expect('/api/auth/logout','POST',{},200,cookie);
 await expect('/api/admin','GET',undefined,401);
 console.log('MongoDB integration passed: seed, login rate limiting, admin protection, settings, pending orders, idempotency, delivery fees, catering, reviews, specials, status, category management, image uploads, automatic slugs, product edits/deletes, customer order lookup, confirm/reject comments, live catalog synchronization and logout.');
}finally{if(child){child.kill('SIGTERM');await sleep(300)}try{await client.db(dbName).dropDatabase()}catch{}await client.close()}
