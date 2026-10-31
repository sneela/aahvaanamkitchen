import { NextResponse, type NextRequest } from 'next/server';
export class AccessError extends Error { constructor(public status: number, message: string) { super(message); } }
export function jsonError(error: unknown, fallback = 'Request failed') {
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
export function badRequest(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
/** Verify browser-originating writes, including multipart image uploads. */
export function validateSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin) {
    let submitted: URL;
    try { submitted = new URL(origin); } catch { throw new AccessError(403, 'Cross-site request blocked'); }
    const approvedHosts = new Set(['aahvaanamkitchen.com', 'www.aahvaanamkitchen.com', 'aahvaanamkitchen.netlify.app']);
    const requestHost = request.headers.get('host')?.toLowerCase();
    const forwardedHost = request.headers.get('x-forwarded-host')?.toLowerCase();
    const sameOrigin = origin === new URL(request.url).origin;
    // Netlify's Next.js adapter may expose an internal request URL behind its reverse proxy.
    // Accept the public hostname only when it is a known Aahvaanam host AND matches
    // the inbound host or the platform's forwarded host. Never accept arbitrary origins.
    const proxyOrigin = submitted.protocol === 'https:' && approvedHosts.has(submitted.hostname.toLowerCase()) &&
      (submitted.host.toLowerCase() === requestHost || submitted.host.toLowerCase() === forwardedHost);
    if (!sameOrigin && !proxyOrigin) throw new AccessError(403, 'Cross-site request blocked');
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin','none'].includes(fetchSite)) throw new AccessError(403, 'Cross-site request blocked');
}
export async function parseBody(request: NextRequest, maxBytes = 16000): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new AccessError(413, 'Request is too large');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new AccessError(415, 'JSON is required');
  validateSameOrigin(request);
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new AccessError(413, 'Request is too large');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new AccessError(400, 'Invalid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AccessError(400, 'Expected an object');
  return data as Record<string, unknown>;
}
export const str = (value: unknown, max = 100): string => typeof value === 'string' && value.length <= max ? value.trim() : '';
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T12:00:00Z')) && new Date(v+'T12:00:00Z').toISOString().slice(0,10) === v;
export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isUuid = (v: string) => /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
export const int = (v: unknown, min: number, max: number): number | null => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
export const bool = (v: unknown): boolean | null => typeof v === 'boolean' ? v : null;
