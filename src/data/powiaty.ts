import type { LngLat } from '../types';
import { polygonContains } from '../lib/geo';

/** Granice powiatów z kodami TERYT. Dane: © OpenStreetMap contributors (ODbL). */
export type PowiatFeature = {
  type: 'Feature';
  properties: { t: string; n: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
  bbox?: [number, number, number, number];
};
export type PowiatCollection = { type: 'FeatureCollection'; features: PowiatFeature[] };

let loading: Promise<PowiatCollection> | null = null;

function withBbox(f: PowiatFeature): PowiatFeature {
  const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]);
  let w = 180, s = 90, e = -180, n = -90;
  for (const r of rings) for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return { ...f, bbox: [w, s, e, n] };
}

export function loadPowiaty(): Promise<PowiatCollection> {
  loading ??= fetch(`${import.meta.env.BASE_URL}data/powiaty.geojson`)
    .then((r) => (r.ok ? r.json() : { type: 'FeatureCollection', features: [] }))
    .then((fc: PowiatCollection) => ({ ...fc, features: fc.features.map(withBbox) }))
    .catch(() => ({ type: 'FeatureCollection', features: [] }));
  return loading;
}

export function findPowiat(fc: PowiatCollection, p: LngLat): PowiatFeature | null {
  for (const f of fc.features) {
    const b = f.bbox!;
    if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue;
    if (polygonContains(f.geometry, p)) return f;
  }
  return null;
}
