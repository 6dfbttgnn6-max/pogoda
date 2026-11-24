const TZ = 'Europe/Warsaw';

/** Przesunięcie strefy Europe/Warsaw względem UTC (min) dla danej chwili. */
function warsawOffsetMin(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return Math.round((asUtc - utcMs) / 60000);
}

/** Parsuje "YYYY-MM-DD HH:mm:ss" jako czas lokalny w Polsce. */
export function parseWarsaw(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return NaN;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const off1 = warsawOffsetMin(naive - 60 * 60000);
  const guess = naive - off1 * 60000;
  const off2 = warsawOffsetMin(guess);
  return naive - off2 * 60000;
}

const fmtTime = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const fmtDayShort = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, weekday: 'short' });
const fmtDate = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const formatTime = (ms: number) => fmtTime.format(ms);
export const formatDay = (ms: number) => fmtDay.format(ms);
export const formatWeekday = (ms: number) => fmtDayShort.format(ms);
export const dayKey = (ms: number) => fmtDate.format(ms);

export function relativeDay(ms: number, now = Date.now()): string {
  const k = dayKey(ms);
  if (k === dayKey(now)) return 'dziś';
  if (k === dayKey(now + 86_400_000)) return 'jutro';
  return formatDay(ms);
}

/** Krótka etykieta dnia: „Dziś”, „Jutro”, „Czw 26.11”. */
export function dayLabel(ms: number, now = Date.now()): string {
  const r = relativeDay(ms, now);
  if (r === 'dziś' || r === 'jutro') return r[0].toUpperCase() + r.slice(1);
  const wd = formatWeekday(ms).replace('.', '');
  const dm = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(ms);
  return `${wd[0].toUpperCase()}${wd.slice(1)} ${dm}`;
}

export function formatWhen(ms: number, now = Date.now()): string {
  return `${relativeDay(ms, now)}, ${formatTime(ms)}`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`;
}

export function warsawHour(ms: number): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(ms));
}
