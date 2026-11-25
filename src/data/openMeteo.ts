import type { HourSample, PointForecast } from '../types';
import { demoForecast, isDemo } from './demo';

/**
 * Dostawca prognozy: Open-Meteo (modele ICON-D2 / ICON-EU / ECMWF, wybór automatyczny).
 * Licencja: darmowe API tylko do użytku niekomercyjnego; dane CC BY 4.0.
 * Przy komercjalizacji należy przejść na płatny plan (customer-api.open-meteo.com + klucz)
 * albo podmienić dostawcę, implementując tę samą funkcję `fetchForecast`.
 */
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

const HOURLY = [
  'temperature_2m',
  'dew_point_2m',
  'relative_humidity_2m',
  'soil_temperature_0cm',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'snow_depth',
  'weather_code',
  'cloud_cover',
  'visibility',
  'wind_speed_10m',
  'wind_gusts_10m',
  'is_day',
] as const;

type Raw = {
  latitude: number;
  longitude: number;
  elevation?: number;
  hourly: Record<(typeof HOURLY)[number] | 'time', Array<number | null>>;
};

const num = (v: number | null | undefined, d = 0) => (v == null || Number.isNaN(v) ? d : v);

function parse(raw: Raw): PointForecast {
  const H = raw.hourly;
  const hours: HourSample[] = H.time.map((t, i) => ({
    time: num(t) * 1000,
    temp: num(H.temperature_2m[i]),
    dewPoint: num(H.dew_point_2m[i]),
    humidity: num(H.relative_humidity_2m[i]),
    surfaceTemp: H.soil_temperature_0cm[i] ?? null,
    precip: num(H.precipitation[i]),
    rain: num(H.rain[i]) + num(H.showers[i]),
    snowfall: num(H.snowfall[i]),
    snowDepth: H.snow_depth[i] ?? null,
    weatherCode: num(H.weather_code[i]),
    cloudCover: num(H.cloud_cover[i]),
    visibility: H.visibility[i] ?? null,
    windSpeed: num(H.wind_speed_10m[i]),
    windGust: num(H.wind_gusts_10m[i]),
    isDay: num(H.is_day[i], 1) === 1,
  }));
  return { lat: raw.latitude, lon: raw.longitude, elevation: raw.elevation ?? null, hours };
}

const cache = new Map<string, { at: number; data: PointForecast[] }>();
const TTL = 15 * 60 * 1000;

export class ForecastError extends Error {}

/**
 * Prognoza godzinowa dla wielu punktów w jednym zapytaniu.
 * Zwraca 1 dzień wstecz (potrzebny do oceny mokrej nawierzchni) i `days` dni w przód.
 */
export async function fetchForecast(
  points: Array<{ lat: number; lon: number }>,
  { days = 3, signal }: { days?: number; signal?: AbortSignal } = {},
): Promise<PointForecast[]> {
  if (!points.length) return [];
  if (isDemo()) return demoForecast(points, days);

  const lat = points.map((p) => p.lat.toFixed(3)).join(',');
  const lon = points.map((p) => p.lon.toFixed(3)).join(',');
  const key = `${lat}|${lon}|${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: HOURLY.join(','),
    past_days: '1',
    forecast_days: String(days),
    timeformat: 'unixtime',
    timezone: 'GMT',
    wind_speed_unit: 'kmh',
  });

  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(`${ENDPOINT}?${params}`, { signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new ForecastError('Brak połączenia z serwerem prognoz. Sprawdź internet.');
    }
    if (res.status !== 429) break;
    const reason = await res.clone().text().catch(() => '');
    if (/daily/i.test(reason)) throw new ForecastError('Wyczerpano dzienny limit zapytań do serwera prognoz dla Twojej sieci. Spróbuj później.');
    // Limit minutowy/godzinowy: jedna próba ponownie po krótkiej przerwie
    if (attempt === 0) await new Promise((r) => setTimeout(r, 4000));
  }
  if (!res) throw new ForecastError('Brak odpowiedzi serwera prognoz.');
  if (res.status === 429) throw new ForecastError('Przekroczono limit zapytań do serwera prognoz. Spróbuj za chwilę.');
  if (!res.ok) throw new ForecastError(`Serwer prognoz zwrócił błąd (${res.status}).`);
  const json = (await res.json()) as Raw | Raw[];
  const data = (Array.isArray(json) ? json : [json]).map(parse);
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Indeks godziny najbliższej momentowi `at` (ms). */
export function hourIndex(hours: HourSample[], at: number): number {
  if (!hours.length) return 0;
  const first = hours[0].time;
  const i = Math.round((at - first) / 3_600_000);
  return Math.max(0, Math.min(hours.length - 1, i));
}
