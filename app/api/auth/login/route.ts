import { NextResponse, type NextRequest } from 'next/server';
import { authConfigured, COOKIE, createSession, sessionCookieOptions, verifyPassword } from '@/lib/auth/session';
import { jsonError, parseBody, str, AccessError } from '@/lib/api';
import { mongoConfigured } from '@/lib/mongodb/client';
import { rateLimit } from '@/lib/mongodb/limits';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    if (!authConfigured() || !mongoConfigured()) throw new AccessError(503, 'Administrator sign-in is not configured');
    await rateLimit(request, 'admin-login', 5, 15);
    const b = await parseBody(request, 2500);
    const email = str(b.email, 200), password = str(b.password, 256);
    if (!email || !password || !verifyPassword(email, password)) throw new AccessError(401, 'Invalid email or password');
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, createSession(process.env.ADMIN_EMAIL!), sessionCookieOptions);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (e) { return jsonError(e, 'Unable to sign in'); }
}
