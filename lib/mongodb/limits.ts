import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { mongoDb } from './client';
import { AccessError } from '@/lib/api';
import { clientIp } from './client-ip';
export async function rateLimit(request: NextRequest, kind: string, max: number, windowMinutes: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new AccessError(503, 'Service is not configured');
  // Netlify edge provides x-nf-client-connection-ip; other hosts must sanitize proxy headers.
  // User-Agent changes must never reset the bucket.
  const ip = clientIp(request.headers);
  const fingerprint = createHmac('sha256', secret).update(ip).digest('hex');
  const windowMs = windowMinutes * 60000;
  const bucket = Math.floor(Date.now() / windowMs);
  const db = await mongoDb();
  const result = await db.collection('rateLimits').findOneAndUpdate({ _id: `${kind}:${fingerprint}:${bucket}` as never },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket+2)*windowMs) } }, { upsert: true, returnDocument: 'after' });
  if (!result || result.count > max) throw new AccessError(429, 'Too many requests. Please try again later.');
}
