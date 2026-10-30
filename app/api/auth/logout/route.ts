import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { jsonError, parseBody } from '@/lib/api';
export async function POST(request: NextRequest) {
  try {
    await parseBody(request, 100);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    return response;
  } catch (e) { return jsonError(e, 'Unable to sign out'); }
}
