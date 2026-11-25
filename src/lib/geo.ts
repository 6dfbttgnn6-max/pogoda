import type { LngLat } from '../types';

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Odległość po kuli w km. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

type Ring = number[][];
type PolyGeom = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

function ringContains(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonContains(g: PolyGeom, [x, y]: LngLat): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.some((p) => p.length > 0 && ringContains(p[0], x, y) && !p.slice(1).some((h) => ringContains(h, x, y)));
}

export function bbox(coords: LngLat[]): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) {
    if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
  }
  return [w, s, e, n];
}

export interface RouteSample {
  at: LngLat;
  index: number; // indeks wierzchołka geometrii
  distKm: number;
  etaSec: number;
}

/**
 * Punkty próbkowania wzdłuż trasy co `stepKm`, z czasem dojazdu wyliczonym
 * z czasów odcinków (annotation.duration z OSRM).
 */
export function sampleRoute(coords: LngLat[], segDurations: number[], stepKm: number): RouteSample[] {
  const out: RouteSample[] = [{ at: coords[0], index: 0, distKm: 0, etaSec: 0 }];
  let dist = 0, eta = 0, next = stepKm;
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(coords[i - 1], coords[i]);
    dist += d;
    eta += segDurations[i - 1] ?? 0;
    if (dist >= next) {
      out.push({ at: coords[i], index: i, distKm: dist, etaSec: eta });
      next = dist + stepKm;
    }
  }
  const last = coords.length - 1;
  if (out[out.length - 1].index !== last) {
    if (dist - out[out.length - 1].distKm < stepKm * 0.35 && out.length > 1) out.pop();
    out.push({ at: coords[last], index: last, distKm: dist, etaSec: eta });
  }
  return out;
}
