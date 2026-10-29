import { isIP } from 'node:net';

/**
 * Return a bounded, validated client IP for abuse-rate limiting.
 * On Netlify, x-nf-client-connection-ip is set by the edge and takes priority.
 * For other hosts, x-real-ip/x-forwarded-for are safe ONLY when a trusted
 * reverse proxy overwrites incoming client-supplied versions of those headers.
 * Unknown sources share one rate-limit bucket (fail closed).
 */
export function clientIp(headers: Headers): string {
  const candidates = [
    headers.get('x-nf-client-connection-ip'),
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
  ];
  for (const candidate of candidates) {
    const ip = candidate?.trim();
    if (ip && isIP(ip)) return ip;
  }
  return 'unknown';
}
