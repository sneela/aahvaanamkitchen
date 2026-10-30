import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
if (!process.env.MONGODB_URI) throw Error('Set MONGODB_URI privately before running this check');
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:7000,maxPoolSize:2});
const database=process.env.MONGODB_DB_NAME||'aahvaanam_kitchen';
const id='aahvaanam-check-'+randomUUID();
try{
 await client.connect();
 const db=client.db(database);
 const ping=await db.command({ping:1});
 if(ping.ok!==1)throw Error('Database ping failed');
 const products=await db.collection('products').countDocuments();
 const settings=await db.collection('settings').findOne({_id:'store'});
 const checks=db.collection('connection_checks');
 try{
  await checks.insertOne({_id:id,created_at:new Date(),purpose:'temporary connection verification'});
  const found=await checks.findOne({_id:id});
  if(!found)throw Error('Database read/write verification failed');
 }finally{await checks.deleteOne({_id:id})}
 console.log('MongoDB connection verified. Database:',database,'Products:',products,'Store settings:',Boolean(settings));
 if(products===0||!settings)console.warn('Seed not yet complete; run npm run mongo:indexes and npm run mongo:seed');
}catch(e){console.error('MongoDB verification failed:',e instanceof Error?e.message:'Unknown error');process.exitCode=1}
finally{await client.close()}
