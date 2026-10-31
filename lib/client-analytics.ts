/** First-party aggregate metrics. No cookies, analytics IDs, or contact information. */
type EventName = 'visit' | 'product_view' | 'add_to_cart' | 'checkout_started';

export function recordActivity(event: EventName, slug?: string, oncePerTabSession = false): void {
  if (typeof window === 'undefined') return;
  if (oncePerTabSession) {
    const key = 'aahvaanam:activity:v1:' + event + ':' + (slug || 'site');
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch { /* Browser storage may be blocked; analytics still work without it. */ }
  }
  const body = JSON.stringify({ event, ...(slug ? { slug } : {}) });
  // Analytics is best-effort: it must never interrupt checkout or browsing.
  void fetch('/api/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body, cache: 'no-store', keepalive: true,
  }).catch(() => {});
}
