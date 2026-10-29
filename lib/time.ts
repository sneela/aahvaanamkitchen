/** Convert Eastern wall-clock date/time to UTC, rejecting DST spring-forward gaps. */
const eastern = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
function parts(ms: number) {
  const obj = Object.fromEntries(eastern.formatToParts(new Date(ms)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  return `${obj.year}-${String(obj.month).padStart(2,'0')}-${String(obj.day).padStart(2,'0')}T${String(obj.hour).padStart(2,'0')}:${String(obj.minute).padStart(2,'0')}`;
}
export function easternDateTimeMs(date: string, time: string): number | null {
  const target = `${date}T${time}`;
  const naive = Date.parse(target + ':00Z');
  if (!Number.isFinite(naive)) return null;
  const possible = [4,5].map(hours => naive + hours * 3600000).filter(ms => parts(ms) === target);
  return possible.length ? Math.min(...possible) : null;
}
