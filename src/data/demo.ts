import type { HourSample, ImgwWarning, PointForecast } from '../types';

/**
 * Tryb demonstracyjny (?demo w adresie). Generuje syntetyczną, ale fizycznie spójną
 * pogodę zimową, żeby pokazać interfejs bez dostępu do API. Interfejs zawsze
 * oznacza ten tryb wyraźnym paskiem "Dane demonstracyjne".
 */
export function isDemo(): boolean {
  try {
    return new URLSearchParams(location.search).has('demo');
  } catch {
    return false;
  }
}

function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function demoForecast(points: Array<{ lat: number; lon: number }>, days: number): PointForecast[] {
  const startHour = Math.floor(Date.now() / 3_600_000) - 24;
  const n = 24 + days * 24;
  return points.map(({ lat, lon }) => {
    const hours: HourSample[] = [];
    for (let k = 0; k < n; k++) {
      const t = (startHour + k) * 3_600_000;
      const localH = (new Date(t).getUTCHours() + 1) % 24;
      const isDay = localH >= 7 && localH < 16;
      // Strefa frontu przesuwa się z zachodu na wschód, ok. 1° długości na 3 h.
      const frontLon = 14 + (k - 18) / 3 + (lat - 52) * 0.9 + Math.sin(lat * 2.1) * 0.5;
      const dist = lon - frontLon;
      const inFront = dist > -1.2 && dist < 0.8;
      const afterFront = dist <= -1.2;
      const north = (lat - 49) / 6; // 0 południe, 1 północ
      const mountains = lat < 50 && lon > 18.5 && lon < 23 ? 1 : 0;
      const diurnal = Math.cos(((localH - 14) / 24) * 2 * Math.PI) * 2.5;
      let temp = 2.2 - north * 1.2 - mountains * 3 + diurnal - (afterFront ? 3 : 0) + (hash(lat * 7 + lon * 3 + k) - 0.5) * 0.6;
      const cloud = inFront ? 100 : afterFront ? 25 : 70;
      const ground = temp - (isDay ? -0.5 : 1.2) - (cloud < 40 && !isDay ? 1 : 0);
      const intensity = inFront ? Math.max(0, 1 - Math.abs(dist + 0.2) / 1) : 0;
      let rain = 0, snowfall = 0, code = cloud > 80 ? 3 : cloud > 40 ? 2 : 0;
      if (intensity > 0.05) {
        if (temp > 1) { rain = 2.5 * intensity; code = rain > 2 ? 63 : 61; }
        else if (temp > -0.5) { rain = 1.2 * intensity; code = 66; }
        else { snowfall = 2.8 * intensity; code = snowfall > 2 ? 75 : 73; }
      }
      const humidity = inFront ? 97 : afterFront ? 90 : 82;
      const dewPoint = temp - (100 - humidity) / 5;
      const fog = !isDay && afterFront && hash(lat + lon + k) > 0.7;
      temp = Math.round(temp * 10) / 10;
      hours.push({
        time: t,
        temp,
        dewPoint: Math.round(dewPoint * 10) / 10,
        humidity,
        surfaceTemp: Math.round(ground * 10) / 10,
        precip: rain + snowfall * 0.7,
        rain,
        snowfall,
        snowDepth: afterFront ? 0.03 : 0,
        weatherCode: fog ? 45 : code,
        cloudCover: cloud,
        visibility: fog ? 250 : inFront ? 3000 : 20000,
        windSpeed: inFront ? 28 : 12,
        windGust: inFront ? 62 + mountains * 15 : 25,
        isDay,
      });
    }
    return { lat, lon, elevation: null, hours };
  });
}

export function demoWarnings(): ImgwWarning[] {
  const now = Date.now();
  return [
    {
      id: 'demo-1',
      event: 'Oblodzenie',
      level: 1,
      probability: 80,
      from: now - 2 * 3_600_000,
      to: now + 12 * 3_600_000,
      published: now - 6 * 3_600_000,
      text: 'Prognozuje się zamarzanie mokrej nawierzchni dróg i chodników po opadach deszczu i mokrego śniegu, powodujące ich oblodzenie. Temperatura minimalna około -4°C, przy gruncie około -7°C.',
      office: 'Centralne Biuro Prognoz Meteorologicznych w Warszawie',
      teryt: ['1465', '1412', '1421', '1432', '1434', '1417', '1418', '1419', '1404'],
    },
    {
      id: 'demo-2',
      event: 'Intensywne opady śniegu',
      level: 2,
      probability: 70,
      from: now + 3 * 3_600_000,
      to: now + 20 * 3_600_000,
      published: now - 3 * 3_600_000,
      text: 'Prognozuje się opady śniegu powodujące przyrost pokrywy śnieżnej od 15 cm do 20 cm.',
      office: 'Biuro Prognoz Meteorologicznych w Krakowie',
      teryt: ['1261', '1206', '1207', '1210', '1211', '1217', '1218', '1219', '1262'],
    },
  ];
}
