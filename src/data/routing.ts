import type { LngLat } from '../types';

/**
 * Routing: OSRM (dane OpenStreetMap).
 * UWAGA: publiczny serwer router.project-osrm.org jest serwerem demonstracyjnym
 * (bez gwarancji dostępności). Do produkcji: własna instancja OSRM/Valhalla
 * albo płatny GraphHopper / OpenRouteService.
 */
const ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';

export interface Route {
  coords: LngLat[];
  segDurations: number[];
  distanceKm: number;
  durationSec: number;
}

type Raw = {
  code: string;
  message?: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: LngLat[] };
    legs: Array<{ annotation?: { duration: number[] } }>;
  }>;
};

export async function fetchRoutes(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<Route[]> {
  const url = `${ENDPOINT}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&annotations=duration&alternatives=true`;
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Nie udało się połączyć z serwerem tras.');
  }
  if (!res.ok) throw new Error(res.status === 429 ? 'Serwer tras jest przeciążony. Spróbuj za chwilę.' : `Serwer tras zwrócił błąd (${res.status}).`);
  const json = (await res.json()) as Raw;
  if (json.code !== 'Ok' || !json.routes?.length) throw new Error('Nie znaleziono trasy między wybranymi miejscami.');
  return json.routes.map((r) => ({
    coords: r.geometry.coordinates,
    segDurations: r.legs.flatMap((l) => l.annotation?.duration ?? []),
    distanceKm: r.distance / 1000,
    durationSec: r.duration,
  }));
}
