import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import { jsonError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DailyDoc = { day: string; event: string; slug: string; count: number };
type DayStats = { day: string; visits: number; productViews: number; addToCart: number; checkoutStarted: number; ordersPlaced: number };
type ProductStats = { slug: string; name: string; views: number; cartAdds: number };

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const raw = request.nextUrl.searchParams.get('days') || '30';
    if (!['7','30','90'].includes(raw)) return NextResponse.json({ error:'Choose 7, 30, or 90 days' }, { status: 400 });
    const days = Number(raw);
    const today = new Date();
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days + 1));
    const start = first.toISOString().slice(0,10);
    const db = await mongoDb();
    const [events, orders, products] = await Promise.all([
      db.collection<DailyDoc>('analytics_daily').find({ day: { $gte: start } }, { projection: { _id: 0, day: 1, event: 1, slug: 1, count: 1 } }).toArray(),
      db.collection<{ created_at: Date }>('orders').aggregate<{ _id: string; count: number }>([
        { $match: { created_at: { $gte: first } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at', timezone: 'UTC' } }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection<{ slug: string; name: string }>('products').find({}, { projection: { slug: 1, name: 1, _id: 0 } }).toArray(),
    ]);
    const byDay = new Map<string, DayStats>();
    for (let i=0;i<days;i++) {
      const d = new Date(first.getTime() + i * 86400000).toISOString().slice(0,10);
      byDay.set(d, { day: d, visits: 0, productViews: 0, addToCart: 0, checkoutStarted: 0, ordersPlaced: 0 });
    }
    const labels = new Map(products.map(p => [p.slug, p.name]));
    const productInterest = new Map<string, ProductStats>();
    for (const event of events) {
      const row = byDay.get(event.day);
      if (!row || !Number.isFinite(event.count)) continue;
      if (event.event === 'visit') row.visits += event.count;
      if (event.event === 'product_view') row.productViews += event.count;
      if (event.event === 'add_to_cart') row.addToCart += event.count;
      if (event.event === 'checkout_started') row.checkoutStarted += event.count;
      if (event.slug && ['product_view','add_to_cart'].includes(event.event)) {
        const p = productInterest.get(event.slug) || { slug: event.slug, name: labels.get(event.slug) || event.slug, views: 0, cartAdds: 0 };
        if (event.event === 'product_view') p.views += event.count;
        if (event.event === 'add_to_cart') p.cartAdds += event.count;
        productInterest.set(event.slug, p);
      }
    }
    for (const order of orders) {
      const row = byDay.get(order._id);
      if (row) row.ordersPlaced += order.count;
    }
    const daily = [...byDay.values()];
    const totals = daily.reduce((total, current) => ({
      visits: total.visits + current.visits,
      productViews: total.productViews + current.productViews,
      addToCart: total.addToCart + current.addToCart,
      checkoutStarted: total.checkoutStarted + current.checkoutStarted,
      ordersPlaced: total.ordersPlaced + current.ordersPlaced,
    }), { visits: 0, productViews: 0, addToCart: 0, checkoutStarted: 0, ordersPlaced: 0 });
    return NextResponse.json({
      days, totals, daily,
      topProducts: [...productInterest.values()].sort((a,b) => b.views - a.views || b.cartAdds - a.cartAdds).slice(0,20),
      note: 'Visits are approximate browsing sessions, not unique people. Product views are detail opens. Orders are real saved requests. Counts use UTC dates.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 'Unable to load website analytics'); }
}
