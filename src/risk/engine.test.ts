import { describe, expect, it } from 'vitest';
import { applyWarnings, assessHour, estimateSurfaceTemp, warningKind } from './engine';
import type { HourSample, ImgwWarning } from '../types';

const base: HourSample = {
  time: Date.UTC(2026, 11, 1, 6),
  temp: 5, dewPoint: 1, humidity: 75, surfaceTemp: 5,
  precip: 0, rain: 0, snowfall: 0, snowDepth: 0, weatherCode: 1,
  cloudCover: 60, visibility: 20000, windSpeed: 10, windGust: 20, isDay: true,
};
const h = (o: Partial<HourSample>): HourSample => ({ ...base, ...o });
const series = (...items: Partial<HourSample>[]) => items.map(h);

describe('estimateSurfaceTemp', () => {
  it('wychładza nawierzchnię w pogodną, spokojną noc', () => {
    expect(estimateSurfaceTemp(h({ isDay: false, cloudCover: 5, windSpeed: 5, surfaceTemp: 1, temp: 2 }))).toBe(0);
  });
  it('bez temperatury gruntu używa temperatury powietrza', () => {
    expect(estimateSurfaceTemp(h({ surfaceTemp: null, temp: 3 }))).toBe(3);
  });
});

describe('assessHour', () => {
  it('dobre warunki przy suchej, ciepłej pogodzie', () => {
    const r = assessHour(series({}), 0);
    expect(r.level).toBe(0);
    expect(r.hazards).toHaveLength(0);
  });

  it('marznący deszcz (WMO 66) => gołoledź, poziom 3', () => {
    const r = assessHour(series({ weatherCode: 66, temp: -1, surfaceTemp: -1, rain: 0.5, precip: 0.5 }), 0);
    expect(r.level).toBe(3);
    expect(r.hazards[0].kind).toBe('freezing-rain');
  });

  it('deszcz na zamarzniętą nawierzchnię => gołoledź', () => {
    const r = assessHour(series({ temp: 1.5, surfaceTemp: -0.5, rain: 0.4, precip: 0.4, weatherCode: 61 }), 0);
    expect(r.level).toBe(3);
    expect(r.headline).toMatch(/Gołoledź/);
  });

  it('mokra jezdnia po opadach zamarza => oblodzenie', () => {
    const r = assessHour(series(
      { rain: 1, precip: 1, temp: 2, surfaceTemp: 1.5, weatherCode: 61 },
      { rain: 0, precip: 0, temp: -0.5, surfaceTemp: -1.5, weatherCode: 3, isDay: false },
    ), 1);
    expect(r.level).toBe(3);
    expect(r.hazards.some((x) => x.kind === 'black-ice')).toBe(true);
  });

  it('szron przy wilgotnym powietrzu i mrozie', () => {
    const r = assessHour(series({ temp: -1, surfaceTemp: -1.5, dewPoint: -1.5, humidity: 95 }), 0);
    expect(r.hazards.some((x) => x.kind === 'frost')).toBe(true);
    expect(r.level).toBeGreaterThanOrEqual(1);
  });

  it('strefa przejściowa: ostrzega o mostach przy +1°C i wilgoci', () => {
    const r = assessHour(series({ temp: 1.5, surfaceTemp: 1.2, humidity: 95, dewPoint: 1 }), 0);
    expect(r.level).toBe(1);
    expect(r.hazards[0].title).toMatch(/lokalne oblodzenie/);
  });

  it('intensywny śnieg => poziom 3', () => {
    const r = assessHour(series({ snowfall: 3, precip: 2, temp: -3, surfaceTemp: -2, weatherCode: 75 }), 0);
    expect(r.level).toBe(3);
    expect(r.hazards[0].kind).toBe('snow');
  });

  it('mokry śnieg wokół 0°C => błoto pośniegowe', () => {
    const r = assessHour(series({ snowfall: 1.2, precip: 1, temp: 0.5, surfaceTemp: 1, weatherCode: 73 }), 0);
    expect(r.hazards.some((x) => x.kind === 'slush')).toBe(true);
  });

  it('ulewa => aquaplaning, poziom 2', () => {
    const r = assessHour(series({ rain: 6, precip: 6, temp: 15, surfaceTemp: 15, weatherCode: 65 }), 0);
    expect(r.level).toBe(2);
    expect(r.hazards[0].kind).toBe('rain');
  });

  it('gęsta mgła => poziom 3 przy widoczności < 150 m', () => {
    const r = assessHour(series({ visibility: 100, weatherCode: 45 }), 0);
    expect(r.level).toBe(3);
  });

  it('porywy 80 km/h => poziom 2', () => {
    const r = assessHour(series({ windGust: 80 }), 0);
    expect(r.level).toBe(2);
    expect(r.hazards[0].kind).toBe('wind');
  });
});

describe('ostrzeżenia IMGW', () => {
  const w: ImgwWarning = {
    id: 'x', event: 'Oblodzenie', level: 1, probability: 80,
    from: Date.UTC(2026, 11, 1, 0), to: Date.UTC(2026, 11, 1, 12),
    published: 0, text: '', office: '', teryt: ['1465'],
  };
  it('rozpoznaje rodzaj zjawiska', () => {
    expect(warningKind({ event: 'Oblodzenie' })).toBe('black-ice');
    expect(warningKind({ event: 'Intensywne opady śniegu' })).toBe('snow');
    expect(warningKind({ event: 'Upał' })).toBeNull();
  });
  it('aktywne ostrzeżenie podnosi poziom ryzyka', () => {
    const r = applyWarnings(assessHour(series({}), 0), [w], base.time);
    expect(r.level).toBe(2);
    expect(r.headline).toMatch(/IMGW/);
  });
  it('nieaktywne ostrzeżenie nie zmienia oceny', () => {
    const r = applyWarnings(assessHour(series({}), 0), [w], Date.UTC(2026, 11, 2));
    expect(r.level).toBe(0);
  });
});
