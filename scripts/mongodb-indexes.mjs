import { MongoClient } from 'mongodb';
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'aahvaanam_kitchen');
  await Promise.all([
    db.collection('products').createIndex({ slug: 1 }, { unique: true }),
    db.collection('categories').createIndex({ id: 1 }, { unique: true }),
    db.collection('orders').createIndex({ client_request_id: 1 }, { unique: true }),
    db.collection('orders').createIndex({ order_number: 1 }, { unique: true }),
    db.collection('orders').createIndex({ created_at: -1 }),
    db.collection('specials').createIndex({ is_published: 1, created_at: -1 }),
    db.collection('reviews').createIndex({ is_approved: 1, created_at: -1 }),
    db.collection('catering_inquiries').createIndex({ created_at: -1 }),
    db.collection('rateLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  console.log('MongoDB indexes ready');
} finally { await client.close(); }
