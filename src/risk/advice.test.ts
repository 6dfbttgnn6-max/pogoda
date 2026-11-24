import { describe, expect, it } from 'vitest';
import { routeAdvice, type RouteFacts } from './advice';

const base: RouteFacts = {
  maxByKind: {}, maxSnowfall: 0, maxRain: 0, minTemp: 8, minSurface: 8, maxGust: 20,
  minVisibility: 20000, snowOnGround: false, durationSec: 3600, distanceKm: 80, max: 0, mountains: false,
};
const ids = (f: Partial<RouteFacts>) => routeAdvice({ ...base, ...f }).map((a) => a.id);

describe('routeAdvice', () => {
  it('przy dobrej pogodzie tylko porada o światłach', () => {
    expect(ids({})).toEqual(['lights']);
  });
  it('intensywny śnieg: łańcuchy, odśnieżanie, zimowy płyn, opony', () => {
    const r = ids({ maxByKind: { snow: 2 }, maxSnowfall: 1.5, minTemp: -3, minSurface: -4, max: 2 });
    expect(r).toEqual(expect.arrayContaining(['chains', 'snow-clean', 'washer', 'tyres', 'time']));
    const washer = routeAdvice({ ...base, maxByKind: { snow: 2 }, minTemp: -3, minSurface: -4, max: 2 }).find((a) => a.id === 'washer')!;
    expect(washer.title).toMatch(/zimowy/);
  });
  it('łańcuchy: informacja o drodze pokrytej śniegiem i znaku C-18', () => {
    const a = routeAdvice({ ...base, maxByKind: { snow: 3 }, maxSnowfall: 3, max: 3 }).find((x) => x.id === 'chains')!;
    expect(a.law).toMatch(/C-18/);
  });
  it('w górach łańcuchy już przy słabym śniegu', () => {
    expect(ids({ maxByKind: { snow: 1 }, mountains: true, max: 1 })).toContain('chains');
    expect(ids({ maxByKind: { snow: 1 }, mountains: false, max: 1 })).not.toContain('chains');
  });
  it('obfity deszcz: płyn do spryskiwaczy i aquaplaning', () => {
    const r = ids({ maxByKind: { rain: 2 }, maxRain: 6, max: 2 });
    expect(r).toEqual(expect.arrayContaining(['washer', 'aquaplaning']));
  });
  it('marznący deszcz: na pierwszym miejscu sugestia przełożenia podróży', () => {
    expect(ids({ maxByKind: { 'freezing-rain': 3 }, minTemp: -1, minSurface: -1, max: 3 })[0]).toBe('ice-postpone');
  });
  it('gęsta mgła: przepis o tylnych światłach przeciwmgłowych (50 m)', () => {
    const a = routeAdvice({ ...base, maxByKind: { fog: 3 }, minVisibility: 100, max: 3 }).find((x) => x.id === 'fog')!;
    expect(a.law).toMatch(/50 m/);
    expect(a.text).toMatch(/100 m/);
  });
});
