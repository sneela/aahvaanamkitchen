import 'server-only';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { AccessError } from '@/lib/api';
export const COOKIE = 'aahvaanam_admin';
const TTL_SECONDS = 60 * 60 * 12;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new AccessError(503, 'Administrator authentication is not configured');
  return value;
}
export function authConfigured() { return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32); }
function mac(payload: string) { return createHmac('sha256', secret()).update(payload).digest('hex'); }
export function createSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Math.floor(Date.now()/1000) + TTL_SECONDS, nonce: randomBytes(12).toString('hex') })).toString('base64url');
  return `${payload}.${mac(payload)}`;
}
export function verifySession(value: string | undefined) {
  if (!value || !authConfigured()) return false;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = Buffer.from(mac(payload), 'hex');
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now()/1000 && data.email === process.env.ADMIN_EMAIL;
  } catch { return false; }
}
export async function requireAdmin() {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(COOKIE)?.value)) throw new AccessError(401, 'Administrator sign-in required');
}
// Keep the browser response generic. A diagnostic category may be written to
// private function logs only when explicitly enabled by the site operator.
export type AdminCredentialCheck = 'ok' | 'email_mismatch' | 'password_mismatch' | 'hash_format_invalid';
export function checkAdminCredentials(email: string, password: string): AdminCredentialCheck {
  const expectedEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  // Copy/paste from hosting dashboards can introduce surrounding whitespace.
  // Do not trim or otherwise normalize the actual password supplied by the user.
  const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  const [salt, hex, extra] = hash.split(':');
  if (!salt || !hex || extra || !/^[a-f0-9]{32,128}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return 'hash_format_invalid';
  const calculated = scryptSync(password, Buffer.from(salt, 'hex'), 64);
  const valid = timingSafeEqual(calculated, Buffer.from(hex, 'hex'));
  if (!valid) return 'password_mismatch';
  return email.trim().toLowerCase() === expectedEmail ? 'ok' : 'email_mismatch';
}
export function verifyPassword(email: string, password: string) {
  return checkAdminCredentials(email, password) === 'ok';
}
export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: TTL_SECONDS };
