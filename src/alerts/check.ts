import type { Watch } from './store';
import { fetchForecast, hourIndex } from '../data/openMeteo';
import { fetchWarnings } from '../data/imgw';
import { applyWarnings, assessHour, LEVEL_LABEL } from '../risk/engine';
import type { RiskLevel } from '../types';
import { formatTime, parseWarsaw } from '../lib/time';

/** Najbliższy wyjazd (ms) dla obserwowanej trasy, w czasie lokalnym Polski. */
export function nextDeparture(w: Watch, now = Date.now()): number | null {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let d = 0; d < 8; d++) {
    const parts = fmt.formatToParts(new Date(now + d * 86_400_000));
    const g = (t: string) => parts.find((p) => p.type === t)!.value;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
    if (!w.days.includes(wd)) continue;
    const at = parseWarsaw(`${g('year')}-${g('month')}-${g('day')} ${pad(w.hour)}:${pad(w.minute)}:00`);
    if (at > now - 5 * 60_000) return at;
  }
  return null;
}

export interface CheckResult { watch: Watch; departAt: number; level: RiskLevel; headline: string; worstAt: number }

/** Sprawdza trasy, których wyjazd przypada w ciągu `leadMin` minut. */
export async function checkWatches(watches: Watch[], now = Date.now(), force = false): Promise<CheckResult[]> {
  const due = watches.filter((w) => w.enabled).map((w) => ({ w, at: nextDeparture(w, now) }))
    .filter((x): x is { w: Watch; at: number } => x.at != null && (force || x.at - now <= x.w.leadMin * 60_000));
  if (!due.length) return [];
  const warnings = await fetchWarnings().catch(() => []);
  const results: CheckResult[] = [];
  for (const { w, at } of due) {
    const fc = await fetchForecast(w.points.map((p) => ({ lat: p.lat, lon: p.lon })), { days: 3 });
    let best: CheckResult = { watch: w, departAt: at, level: 0, headline: 'Dobre warunki', worstAt: at };
    w.points.forEach((p, k) => {
      const t = at + p.eta * 1000;
      const hours = fc[k]?.hours ?? [];
      if (!hours.length) return;
      const local = p.teryt ? warnings.filter((x) => x.teryt.includes(p.teryt!)) : [];
      const r = applyWarnings(assessHour(hours, hourIndex(hours, t)), local, t);
      if (r.level > best.level) best = { watch: w, departAt: at, level: r.level, headline: r.headline, worstAt: t };
    });
    results.push(best);
  }
  return results;
}

export function notificationText(r: CheckResult): { title: string; body: string } {
  return {
    title: `${LEVEL_LABEL[r.level]}: ${r.watch.name}`,
    body: `Wyjazd o ${formatTime(r.departAt)}. ${r.headline} (ok. ${formatTime(r.worstAt)}). Zaplanuj więcej czasu i zachowaj ostrożność.`,
  };
}

export const dayStamp = (at: number) => new Date(at).toISOString().slice(0, 13);
