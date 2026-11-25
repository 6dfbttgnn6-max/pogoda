import type { Place } from '../types';

/** Wyszukiwanie miejsc: Photon (komoot, dane OSM). Pozwala na podpowiedzi w trakcie pisania. */
const PHOTON = 'https://photon.komoot.io/api/';
type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; city?: string; county?: string; state?: string; country?: string;
    countrycode?: string; street?: string; housenumber?: string; postcode?: string; osm_value?: string;
  };
};

const uniq = (xs: Array<string | undefined>) => [...new Set(xs.filter(Boolean) as string[])];

export async function searchPlaces(q: string, signal?: AbortSignal, near?: { lat: number; lon: number }): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  const p = new URLSearchParams({ q, limit: '7' });
  // Preferuj Polskę i okolicę użytkownika
  const bias = near ?? { lat: 52.0, lon: 19.4 };
  p.set('lat', String(bias.lat));
  p.set('lon', String(bias.lon));
  p.set('bbox', '12.0,48.0,26.5,56.0');
  // Słaba preferencja okolicy: miasta w całej Polsce wygrywają z ulicami o podobnej nazwie obok
  p.set('location_bias_scale', '0.1');
  p.set('zoom', '7');
  const res = await fetch(`${PHOTON}?${p}`, { signal });
  if (!res.ok) throw new Error('Wyszukiwarka miejsc jest niedostępna.');
  const json = (await res.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  return json.features
    .map((f) => {
      const pr = f.properties;
      const street = pr.street ? `${pr.street}${pr.housenumber ? ' ' + pr.housenumber : ''}` : undefined;
      const name = pr.name ?? street ?? pr.city ?? '';
      const label = uniq([street !== name ? street : undefined, pr.city !== name ? pr.city : undefined, pr.county, pr.state, pr.countrycode !== 'PL' ? pr.country : undefined]).join(', ');
      const rank = pr.osm_value === 'city' ? 0 : pr.osm_value === 'town' ? 1 : pr.osm_value === 'village' ? 2 : street ? 4 : 3;
      return { name, label, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], rank };
    })
    .sort((a, b) => a.rank - b.rank)
    .filter((x) => {
      const k = `${x.name}|${x.label}`;
      if (!x.name || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(({ rank: _r, ...p }) => p);
}

export interface ReverseResult {
  name: string;
  label: string;
}

/** Odwrotne geokodowanie (nazwa miejsca) – Photon. Kod TERYT bierzemy z lokalnych granic powiatów. */
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<ReverseResult> {
  const p = new URLSearchParams({ lat: String(lat), lon: String(lon), limit: '1' });
  const res = await fetch(`https://photon.komoot.io/reverse?${p}`, { signal });
  if (!res.ok) throw new Error('Nie udało się ustalić nazwy miejsca.');
  const j = (await res.json()) as { features: PhotonFeature[] };
  const pr = j.features[0]?.properties;
  if (!pr) return { name: 'Twoja lokalizacja', label: '' };
  return { name: pr.city ?? pr.name ?? 'Twoja lokalizacja', label: uniq([pr.county, pr.state]).join(', ') };
}
