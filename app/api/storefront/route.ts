import { NextResponse } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { defaultSettings, serialize, type ProductDoc, type SettingsDoc } from '@/lib/mongodb/models';
import { menuItems } from '@/lib/menu';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };
export async function GET() {
  if (!mongoConfigured()) return NextResponse.json({ connected: false, products: menuItems, settings: {
    orderingEnabled: false, deliveryEnabled: false, analyticsEnabled: false, deliveryMinimumCents: 0, deliveryFeeCents: 0,
    minimumNoticeHours: 2, defaultPreorderNoticeHours: 24, maxAdvanceDays: 30,
    whatsappNumber: defaultSettings.whatsapp_number, serviceArea: defaultSettings.service_area_description,
  }, specials: [], reviews: [], announcements: [] }, { headers: noStore });
  try {
    const db = await mongoDb();
    const [products, categories, s, specials, reviews, announcements, recentOrders] = await Promise.all([
      db.collection<ProductDoc>('products').find({ is_available: true }).sort({ sort_order: 1 }).toArray(),
      db.collection<{ id: string; name: string; is_active: boolean }>('categories').find({ is_active: true }).toArray(),
      db.collection<SettingsDoc>('settings').findOne({ _id: 'store' }),
      db.collection('specials').find({ is_published: true }).sort({ created_at: -1 }).limit(100).toArray(),
      db.collection('reviews').find({ is_approved: true }).sort({ created_at: -1 }).limit(8).toArray(),
      db.collection('announcements').find({ is_published: true }).sort({ sort_order: 1, created_at: -1 }).limit(20).toArray(),
      db.collection<{ order_items: Array<{ product_slug_snapshot?: string; product_name_snapshot: string }> }>('orders')
        .find({ created_at: { $gte: new Date(Date.now() - 24*60*60*1000) }, status: { $nin: ['rejected','cancelled'] } })
        .project<{ order_items: Array<{ product_slug_snapshot?: string; product_name_snapshot: string }> }>({ order_items: 1, _id: 0 }).toArray(),
    ]);
    const settings = { ...defaultSettings, ...s };
    const names = new Map(categories.map(c => [c.id, c.name]));
    const now = Date.now();
    // Actual placed orders only: each order contributes once for each product type.
    // Older orders lack a stored slug, so match their original item names only.
    const recentBySlug = new Map<string, number>();
    const recentByName = new Map<string, number>();
    for (const order of recentOrders) {
      const seen = new Set<string>();
      for (const item of order.order_items || []) {
        const key = item.product_slug_snapshot
          ? 'slug:' + item.product_slug_snapshot : 'name:' + item.product_name_snapshot;
        if (!seen.has(key)) {
          seen.add(key);
          if (item.product_slug_snapshot) {
            recentBySlug.set(item.product_slug_snapshot, (recentBySlug.get(item.product_slug_snapshot) || 0) + 1);
          } else {
            recentByName.set(item.product_name_snapshot, (recentByName.get(item.product_name_snapshot) || 0) + 1);
          }
        }
      }
    }
    return NextResponse.json({ connected: true,
      products: products.filter(p => p.category_id === null || names.has(p.category_id)).map(p => ({
        id: p.slug, name: p.name, category: names.get(p.category_id || '') || 'Other', price: p.price_cents / 100,
        unit: p.unit_label, description: p.description, preOrder: p.requires_preorder,
        preorderNoticeHours: p.preorder_notice_hours, image: p.image_url || '/images/aahvaanam-correct-wordmark.webp', vegetarian: p.is_vegetarian,
        recentOrders24h: (recentBySlug.get(p.slug) || 0) + (recentByName.get(p.name) || 0),
      })),
      settings: { orderingEnabled: settings.ordering_enabled, deliveryEnabled: settings.delivery_enabled, analyticsEnabled: settings.analytics_enabled !== false,
        deliveryMinimumCents: settings.delivery_minimum_cents, deliveryFeeCents: settings.default_delivery_fee_cents,
        minimumNoticeHours: settings.minimum_notice_hours, defaultPreorderNoticeHours: settings.default_preorder_notice_hours,
        maxAdvanceDays: settings.max_advance_days, whatsappNumber: settings.whatsapp_number,
        serviceArea: settings.service_area_description },
      specials: specials.filter(s => (!s.starts_at || new Date(s.starts_at).getTime() <= now) && (!s.ends_at || new Date(s.ends_at).getTime() >= now)).map(serialize),
      reviews: reviews.map(serialize),
      announcements: announcements.filter(a =>
        (!a.starts_at || Date.parse(String(a.starts_at)) <= now) &&
        (!a.ends_at || Date.parse(String(a.ends_at)) >= now)
      ).slice(0, 3).map(a => ({
        id: String(a._id), title: String(a.title || ''), message: String(a.message || ''),
        kind: a.kind === 'special' ? 'special' : 'notice',
        actionLabel: String(a.action_label || ''), actionHref: String(a.action_href || ''),
      })),
    }, { headers: noStore });
  } catch (e) { console.error('Storefront read failed', e); return NextResponse.json({ error: 'Menu temporarily unavailable' }, { status: 503, headers: noStore }); }
}
