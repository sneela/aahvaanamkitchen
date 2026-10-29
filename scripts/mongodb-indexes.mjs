import { MongoClient } from 'mongodb';
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before running');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'aahvaanam_kitchen');
  await Promise.all([
    db.collection('products').createIndex({ slug: 1 }, { unique: true }),
    db.collection('orders').createIndex({ requestId: 1 }, { unique: true }),
    db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true }),
    db.collection('orders').createIndex({ createdAt: -1 }),
    db.collection('reviews').createIndex({ approved: 1, createdAt: -1 }),
    db.collection('catering').createIndex({ createdAt: -1 }),
    db.collection('adminUsers').createIndex({ email: 1 }, { unique: true })
  ]);
  console.log('MongoDB indexes created');
} finally { await client.close(); }
