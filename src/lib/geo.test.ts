import { describe, expect, it } from 'vitest';
import { haversine, polygonContains, sampleRoute } from './geo';
import type { LngLat } from '../types';

describe('geo', () => {
  it('Warszawa–Kraków ok. 252 km w linii prostej', () => {
    expect(haversine([21.012, 52.23], [19.937, 50.062])).toBeGreaterThan(245);
    expect(haversine([21.012, 52.23], [19.937, 50.062])).toBeLessThan(260);
  });
  it('punkt w wielokącie z dziurą', () => {
    const g = { type: 'Polygon' as const, coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
    expect(polygonContains(g, [1, 1])).toBe(true);
    expect(polygonContains(g, [5, 5])).toBe(false);
    expect(polygonContains(g, [11, 5])).toBe(false);
  });
  it('próbkuje trasę i sumuje czas', () => {
    const coords: LngLat[] = Array.from({ length: 101 }, (_, i) => [20 + i * 0.01, 52]);
    const s = sampleRoute(coords, new Array(100).fill(36), 10);
    expect(s[0].etaSec).toBe(0);
    expect(s[s.length - 1].index).toBe(100);
    expect(s[s.length - 1].etaSec).toBe(3600);
    expect(s.length).toBeGreaterThanOrEqual(7);
  });
});
