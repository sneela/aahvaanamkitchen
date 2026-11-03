import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfigured, checkAdminCredentials, COOKIE, createSession, sessionCookieOptions } from '@/lib/auth/session';
import { jsonError, parseBody, str, AccessError } from '@/lib/api';
import { mongoConfigured } from '@/lib/mongodb/client';
import { rateLimit } from '@/lib/mongodb/limits';
export const runtime = 'nodejs';

/** A short, non-secret reference lets an operator correlate a 401 with private function logs. */
export async function POST(request: NextRequest) {
  const trace = randomUUID();
  try {
    if (!authConfigured() || !mongoConfigured()) throw new AccessError(503, 'Administrator sign-in is not configured');
    await rateLimit(request, 'admin-login', 5, 15);
    const b = await parseBody(request, 2500);
    // Passwords are byte-sensitive: do not trim whitespace as the general str() helper does.
    const email = str(b.email, 200);
    const password = typeof b.password === 'string' && b.password.length <= 256 ? b.password : '';
    const credentialCheck = email && password ? checkAdminCredentials(email, password) : 'password_mismatch';
    if (credentialCheck !== 'ok') {
      // Only a reason category and random request ID are written to private server logs.
      // The public response is always generic to prevent account enumeration.
      console.warn('Admin login denied', { reason: credentialCheck, trace });
      const denied = NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      denied.headers.set('X-Auth-Trace', trace);
      denied.headers.set('Cache-Control', 'no-store');
      return denied;
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, createSession(process.env.ADMIN_EMAIL!), sessionCookieOptions);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (e) {
    if (e instanceof AccessError) {
      console.warn('Admin login rejected', { status: e.status, trace });
    } else {
      // Do not log the raw exception: driver errors can contain connection details.
      // This category helps diagnose TLS/Atlas outages without exposing credentials.
      console.error('Admin login server failure', { reason: 'unexpected_server_error', trace });
    }
    const response = jsonError(e, 'Unable to sign in');
    response.headers.set('X-Auth-Trace', trace);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
