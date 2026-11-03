import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import { jsonError } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
const valid = (s: any): s is Subscription => s && typeof s.endpoint === 'string' &&
  s.endpoint.length < 2048 && s.endpoint.startsWith('https://') &&
  typeof s.keys?.p256dh === 'string' && s.keys.p256dh.length < 256 &&
  typeof s.keys?.auth === 'string' && s.keys.auth.length < 256;
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '', configured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) });
  } catch (e) { return jsonError(e, 'Unable to load notification settings'); }
}
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const sub = await request.json();
    if (!valid(sub)) return NextResponse.json({ error: 'Invalid push subscription' }, { status: 422 });
    const db = await mongoDb();
    await db.collection('push_subscriptions').updateOne({ endpoint: sub.endpoint }, {
      $set: { endpoint: sub.endpoint, keys: sub.keys, updated_at: new Date() }
    }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (e) { return jsonError(e, 'Unable to save notification subscription'); }
}
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (typeof body.endpoint !== 'string') return NextResponse.json({ error: 'Invalid endpoint' }, { status: 422 });
    await (await mongoDb()).collection('push_subscriptions').deleteOne({ endpoint: body.endpoint });
    return NextResponse.json({ ok: true });
  } catch (e) { return jsonError(e, 'Unable to disable notifications'); }
}
