import { describe, expect, it } from 'vitest';
import { bestDeparture, departureOptions, routeWeather, stretches } from './route';
import type { HourSample, PointForecast } from '../types';
import type { RouteSample } from '../lib/geo';

const T0 = Date.UTC(2026, 11, 1, 0);
const mk = (freezeFromHour: number): PointForecast => ({
  lat: 52, lon: 20, elevation: null,
  hours: Array.from({ length: 48 }, (_, k): HourSample => ({
    time: T0 + k * 3_600_000, temp: k >= freezeFromHour ? -1 : 4, dewPoint: 0, humidity: 80,
    surfaceTemp: k >= freezeFromHour ? -1 : 4, precip: k >= freezeFromHour ? 0.5 : 0, rain: k >= freezeFromHour ? 0.5 : 0,
    snowfall: 0, snowDepth: 0, weatherCode: k >= freezeFromHour ? 66 : 2, cloudCover: 90, visibility: 20000,
    windSpeed: 10, windGust: 20, isDay: true,
  })),
});
const samples: RouteSample[] = [
  { at: [20, 52], index: 0, distKm: 0, etaSec: 0 },
  { at: [20.5, 52], index: 1, distKm: 50, etaSec: 1800 },
  { at: [21, 52], index: 2, distKm: 100, etaSec: 3600 },
];

describe('routeWeather', () => {
  it('liczy ryzyko na moment przejazdu, a nie na moment wyjazdu', () => {
    // marznący deszcz od godziny 1 – start o 0:00 jest bezpieczny, ale meta (po 1 h) już nie
    const ctx = { forecasts: [mk(1), mk(1), mk(1)], areas: [null, null, null], warnings: [] };
    const w = routeWeather(samples, T0, ctx);
    expect(w.samples[0].risk.level).toBe(0);
    expect(w.samples[2].risk.level).toBe(3);
    expect(w.max).toBe(3);
  });
  it('wskazuje wcześniejszy wyjazd przed nadejściem gołoledzi', () => {
    const ctx = { forecasts: [mk(10), mk(10), mk(10)], areas: [null, null, null], warnings: [] };
    const opts = departureOptions(samples, ctx, T0 + 7 * 3_600_000, 6);
    const best = bestDeparture(opts)!;
    expect(best.max).toBe(0);
    expect(best.at).toBeLessThanOrEqual(T0 + 9 * 3_600_000);
  });
  it('łączy kolejne próbki o tym samym zagrożeniu w odcinki', () => {
    const ctx = { forecasts: [mk(0), mk(0), mk(99)], areas: [null, null, null], warnings: [] };
    const s = stretches(routeWeather(samples, T0, ctx));
    expect(s).toHaveLength(2);
    expect(s[0].toKm).toBe(50);
  });
});
