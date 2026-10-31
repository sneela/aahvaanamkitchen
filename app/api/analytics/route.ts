import { NextResponse, type NextRequest } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { badRequest, jsonError, parseBody, str } from '@/lib/api';
import { rateLimit } from '@/lib/mongodb/limits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const productEvents = ['product_view','add_to_cart'];
const siteEvents = ['visit','checkout_started'];
const valid = [...productEvents,...siteEvents];

export async function POST(request: NextRequest) {
  try {
    if (!mongoConfigured()) return new NextResponse(null, { status: 204 });
    const body = await parseBody(request, 800);
    const event = str(body.event, 25);
    if (!valid.includes(event)) return badRequest('Invalid analytics event');
    const slug = productEvents.includes(event) ? str(body.slug, 100) : '';
    if (productEvents.includes(event) && !/^[a-z0-9-]{2,100}$/.test(slug)) return badRequest('Invalid product identifier');
    if (!productEvents.includes(event) && body.slug !== undefined) return badRequest('Unexpected product identifier');
    // Anonymous aggregate counts: no names, emails, phone numbers, IP addresses,
    // browser fingerprints, visitor IDs or raw event log in the analytics collection.
    await rateLimit(request, 'analytics', 100, 60);
    const db = await mongoDb();
    const setting = await db.collection<{ _id: string; analytics_enabled?: boolean }>('settings').findOne({ _id: 'store' });
    if (setting?.analytics_enabled === false) return new NextResponse(null, { status: 204 });
    if (slug) {
      const exists = await db.collection('products').findOne({ slug }, { projection: { _id: 1 } });
      if (!exists) return badRequest('Unknown product', 404);
    }
    const day = new Date().toISOString().slice(0, 10);
    const key = day + ':' + event + (slug ? ':' + slug : '');
    const expiration = new Date(Date.now() + 400*86400000);
    await db.collection('analytics_daily').updateOne(
      { _id: key as never },
      { $inc: { count: 1 }, $setOnInsert: { day, event, slug, expire_at: expiration } },
      { upsert: true },
    );
    return NextResponse.json({ recorded: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 'Unable to record analytics event'); }
}
