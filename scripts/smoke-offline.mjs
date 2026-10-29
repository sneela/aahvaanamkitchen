import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const port=3217,base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{env:{...process.env,MONGODB_URI:'',ADMIN_EMAIL:'',ADMIN_PASSWORD_HASH:'',SESSION_SECRET:''},stdio:'pipe'});
let logs='';child.stdout.on('data',b=>{logs+=b.toString()});child.stderr.on('data',b=>{logs+=b.toString()});
async function get(path,options){const r=await fetch(base+path,options);return r}
try{
 let ready=false;
 for(let i=0;i<40;i++){if(child.exitCode!==null)throw Error('Server exited early: '+logs);try{const r=await get('/');if(r.status===200){ready=true;break}}catch{}await sleep(500)}
 assert.ok(ready,'Next.js server did not become ready: '+logs);
 const home=await get('/');assert.equal(home.status,200);assert.match(await home.text(),/Aahvaanam/);
 assert.equal((await get('/catalog')).status,200);
 assert.equal((await get('/privacy')).status,200);
 const storefront=await get('/api/storefront');assert.equal(storefront.status,200);const j=await storefront.json();assert.equal(j.connected,false);assert.equal(j.products.length,31);assert.equal(j.settings.orderingEnabled,false);
 assert.equal((await get('/api/admin')).status,401);
 assert.equal((await get('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
 assert.equal((await get('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
 console.log('Offline smoke checks passed: home, catalog, privacy, fallback menu, protected admin, disabled ordering and login.');
}finally{child.kill('SIGTERM');await sleep(300)}
