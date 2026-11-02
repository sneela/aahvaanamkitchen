/** Convert an ISO instant to a datetime-local value in the viewer's time zone.
 * Never slice an ISO string directly: that displays UTC as local clock time.
 */
export function isoToLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Interpret a datetime-local value in the viewer's time zone, preserving the instant. */
export function localDateTimeInputToIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
