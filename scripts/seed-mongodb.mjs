import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';
const menu = JSON.parse(readFileSync(new URL('./seed-menu.json', import.meta.url), 'utf8'));
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const slug = text => text.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'aahvaanam_kitchen');
  const categories = [...new Set(menu.map(i => i.category))];
  for (const [sort_order, name] of categories.entries()) {
    const id = slug(name);
    await db.collection('categories').updateOne({ id }, { $setOnInsert: { id, name, is_active: true, sort_order } }, { upsert: true });
  }
  for (const [sort_order, item] of menu.entries()) {
    await db.collection('products').updateOne({ slug: item.id }, { $setOnInsert: {
      slug: item.id, name: item.name, description: item.description, category_id: slug(item.category),
      price_cents: Math.round(item.price*100), unit_label: item.unit, image_url: item.image,
      is_available: true, requires_preorder: item.preOrder || false,
      preorder_notice_hours: item.preorderNoticeHours || (['idly-batter','dosa-batter','vada-batter'].includes(item.id) ? 48 : 24), is_vegetarian: item.vegetarian ?? null, sort_order,
    } }, { upsert: true });
  }
  await db.collection('settings').updateOne({ _id: 'store' }, { $setOnInsert: {
    ordering_enabled: false, delivery_enabled: false, delivery_minimum_cents: 0, default_delivery_fee_cents: 0,
    minimum_notice_hours: 2, default_preorder_notice_hours: 24, max_advance_days: 30,
    whatsapp_number: '12162364062', service_area_description: 'Greater Cleveland, Ohio',
  } }, { upsert: true });
  console.log(`Seeded missing records for ${menu.length} menu items and ${categories.length} categories. Existing records unchanged. Ordering remains off by default.`);
} finally { await client.close(); }
