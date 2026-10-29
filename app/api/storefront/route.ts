import { NextResponse } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { defaultSettings, type ProductDocument } from '@/lib/mongodb/collections';
import { menuItems } from '@/lib/menu';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (!mongoConfigured()) return NextResponse.json({ connected: false, products: menuItems, settings: defaultSettings, specials: [], reviews: [] }, { headers });
  try {
    const db = await mongoDb();
    const [products, settings, specials, reviews] = await Promise.all([
      db.collection<ProductDocument>('products').find({ available: true }).sort({ sortOrder: 1 }).toArray(),
      db.collection('settings').findOne({ _id: 'store' as never }),
      db.collection('specials').find({ published: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: new Date() } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: new Date() } }] }] }).limit(12).toArray(),
      db.collection('reviews').find({ approved: true }).sort({ createdAt: -1 }).limit(8).toArray()
    ]);
    return NextResponse.json({ connected: true, products: products.map(p => ({ id: p.slug, name: p.name, category: p.category, price: p.priceCents / 100, unit: p.unit, description: p.description, preOrder: p.requiresPreorder, preorderNoticeHours: p.preorderNoticeHours, image: p.image || '/images/aahvaanam-logo.png', vegetarian: p.vegetarian })), settings: { ...defaultSettings, ...(settings || {}) }, specials: specials.map(({ _id, ...s }) => ({ id: String(_id), ...s })), reviews: reviews.map(({ _id, ...r }) => ({ id: String(_id), ...r })) }, { headers });
  } catch (e) { console.error('MongoDB storefront read failed', e); return NextResponse.json({ error: 'Menu temporarily unavailable' }, { status: 503, headers }); }
}
