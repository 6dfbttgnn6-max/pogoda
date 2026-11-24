import type { ImgwWarning, LngLat, PointForecast, RiskLevel, RoadRisk } from '../types';
import { applyWarnings, assessHour, maxLevel } from './engine';
import { hourIndex } from '../data/openMeteo';
import type { RouteSample } from '../lib/geo';

export interface SampleRisk {
  sample: RouteSample;
  at: number; // ms – przewidywany moment przejazdu
  risk: RoadRisk;
  temp: number;
  teryt: string | null;
  area: string | null;
}

export interface RouteWeather {
  samples: SampleRisk[];
  max: RiskLevel;
  /** Suma poziomów ważona dystansem – do porównywania wariantów. */
  score: number;
}

export interface Ctx {
  forecasts: PointForecast[]; // równoległe do samples
  areas: Array<{ teryt: string; name: string } | null>;
  warnings: ImgwWarning[];
}

export function routeWeather(samples: RouteSample[], departMs: number, ctx: Ctx): RouteWeather {
  const out: SampleRisk[] = samples.map((s, k) => {
    const at = departMs + s.etaSec * 1000;
    const hours = ctx.forecasts[k]?.hours ?? [];
    const i = hourIndex(hours, at);
    const area = ctx.areas[k];
    const local = area ? ctx.warnings.filter((w) => w.teryt.includes(area.teryt)) : [];
    const base = hours.length ? assessHour(hours, i) : { level: 0 as RiskLevel, surfaceTemp: NaN, hazards: [], headline: 'Brak danych' };
    const risk = applyWarnings(base, local, at);
    return { sample: s, at, risk, temp: hours[i]?.temp ?? NaN, teryt: area?.teryt ?? null, area: area?.name ?? null };
  });
  let score = 0;
  for (let k = 1; k < out.length; k++) {
    const d = out[k].sample.distKm - out[k - 1].sample.distKm;
    score += d * Math.max(out[k].risk.level, out[k - 1].risk.level) ** 2;
  }
  return { samples: out, max: maxLevel(out.map((x) => x.risk.level)), score };
}

export interface DepartureOption { at: number; max: RiskLevel; score: number }

/** Ocena wyjazdów co godzinę w oknie `hours` (od najbliższej pełnej godziny). */
export function departureOptions(samples: RouteSample[], ctx: Ctx, from: number, hours = 12): DepartureOption[] {
  const start = Math.ceil(from / 3_600_000) * 3_600_000;
  const opts: DepartureOption[] = [{ at: from, ...pick(routeWeather(samples, from, ctx)) }];
  for (let k = 1; k <= hours; k++) {
    const at = start + (k - 1) * 3_600_000;
    if (at - from < 20 * 60_000) continue;
    opts.push({ at, ...pick(routeWeather(samples, at, ctx)) });
  }
  return opts;
}
const pick = (w: RouteWeather) => ({ max: w.max, score: w.score });

export function bestDeparture(opts: DepartureOption[]): DepartureOption | null {
  if (!opts.length) return null;
  return opts.reduce((b, o) => (o.max < b.max || (o.max === b.max && o.score < b.score * 0.85) ? o : b), opts[0]);
}

/** Odcinki o tym samym poziomie ryzyka i głównym zagrożeniu (do listy „co Cię czeka”). */
export interface Stretch { fromKm: number; toKm: number; level: RiskLevel; title: string; detail: string; at: number; area: string | null }

export function stretches(w: RouteWeather): Stretch[] {
  const res: Stretch[] = [];
  for (const s of w.samples) {
    const title = s.risk.hazards[0]?.title ?? 'Dobre warunki';
    const last = res[res.length - 1];
    if (last && last.level === s.risk.level && last.title === title) { last.toKm = s.sample.distKm; continue; }
    res.push({ fromKm: s.sample.distKm, toKm: s.sample.distKm, level: s.risk.level, title, detail: s.risk.hazards[0]?.detail ?? '', at: s.at, area: s.area });
  }
  return res;
}

/** Odcinki geometrii trasy z poziomem ryzyka – do kolorowania linii na mapie. */
export function coloredSegments(coords: LngLat[], w: RouteWeather) {
  const features = [];
  const S = w.samples;
  for (let k = 0; k < S.length - 1; k++) {
    const a = S[k].sample.index, b = S[k + 1].sample.index;
    const level = Math.max(S[k].risk.level, S[k + 1].risk.level);
    features.push({
      type: 'Feature' as const,
      properties: { level },
      geometry: { type: 'LineString' as const, coordinates: coords.slice(a, b + 1) },
    });
  }
  return { type: 'FeatureCollection' as const, features };
}
