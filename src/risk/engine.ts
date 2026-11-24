import type { Hazard, HazardKind, HourSample, ImgwWarning, RiskLevel, RoadRisk } from '../types';

/**
 * Silnik ryzyka drogowego.
 *
 * WAŻNE: darmowe modele pogodowe nie prognozują temperatury nawierzchni asfaltu.
 * Używamy temperatury gruntu 0 cm z modelu jako przybliżenia i korygujemy ją
 * o wypromieniowanie nocą przy bezchmurnym, spokojnym niebie. To heurystyka,
 * nie pomiar. Wynik ma charakter orientacyjny i tak musi być komunikowany.
 */

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  0: 'Dobre warunki',
  1: 'Uwaga',
  2: 'Trudne warunki',
  3: 'Niebezpiecznie',
};

export const LEVEL_SHORT: Record<RiskLevel, string> = {
  0: 'Dobre',
  1: 'Uwaga',
  2: 'Trudne',
  3: 'Groźne',
};

const FREEZING_CODES = new Set([56, 57, 66, 67]);
const FOG_CODES = new Set([45, 48]);

const lvl = (n: number): RiskLevel => Math.max(0, Math.min(3, Math.round(n))) as RiskLevel;

/** Szacowana temperatura nawierzchni (°C). */
export function estimateSurfaceTemp(h: HourSample): number {
  const base = h.surfaceTemp ?? h.temp;
  // Nocą przy pogodnym niebie i słabym wietrze asfalt wychładza się poniżej gruntu/powietrza.
  const clearCalmNight = !h.isDay && h.cloudCover < 30 && h.windSpeed < 15;
  const radiative = clearCalmNight ? -1 : 0;
  // Nawierzchnia nie bywa znacząco cieplejsza od powietrza nocą.
  const capped = !h.isDay ? Math.min(base, h.temp + 0.5) : base;
  return Math.round((capped + radiative) * 10) / 10;
}

/** Suma opadu ciekłego (mm) w godzinach [i-back, i]. Śnieg nie zwilża jezdni tak jak deszcz. */
function recentRain(hours: HourSample[], i: number, back: number): number {
  let s = 0;
  for (let k = Math.max(0, i - back); k <= i; k++) s += hours[k].rain;
  return s;
}

function push(list: Hazard[], kind: HazardKind, level: RiskLevel, title: string, detail: string) {
  if (level <= 0) return;
  const existing = list.find((x) => x.kind === kind);
  if (existing) {
    if (level > existing.level) Object.assign(existing, { level, title, detail });
    return;
  }
  list.push({ kind, level, title, detail });
}

const fmt = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}°C`;

/**
 * Ocena warunków drogowych dla godziny `i` w serii `hours`.
 * Seria powinna zawierać kilka godzin wstecz, bo mokra nawierzchnia po opadzie
 * jest kluczowa dla oblodzenia.
 */
export function assessHour(hours: HourSample[], i: number): RoadRisk {
  const h = hours[i];
  const ts = estimateSurfaceTemp(h);
  const hazards: Hazard[] = [];
  const wet3h = recentRain(hours, i, 3);
  const liquidNow = h.rain >= 0.1 && h.snowfall < 0.1;
  const isFreezingCode = FREEZING_CODES.has(h.weatherCode);

  // 1. Marznący deszcz / mżawka => gołoledź (najgroźniejsze)
  if (isFreezingCode) {
    push(hazards, 'freezing-rain', 3, 'Gołoledź – marznący deszcz',
      'Opad zamarza w kontakcie z jezdnią. Nawierzchnia może być całkowicie oblodzona.');
  } else if (liquidNow && ts <= 0.5) {
    push(hazards, 'freezing-rain', 3, 'Gołoledź',
      `Deszcz pada na wychłodzoną nawierzchnię (ok. ${fmt(ts)}). Lód tworzy się natychmiast.`);
  }

  // 2. Zamarzanie mokrej nawierzchni po opadach (czarny lód)
  if (!liquidNow && wet3h >= 0.3 && ts <= 0) {
    push(hazards, 'black-ice', ts <= -1 ? 3 : 2, 'Oblodzenie mokrej jezdni',
      `Nawierzchnia mokra po opadach zamarza (ok. ${fmt(ts)}). Lód bywa niewidoczny.`);
  }

  // 3. Szron / szadź: nawierzchnia poniżej 0°C i poniżej punktu rosy
  if (ts <= 0 && h.dewPoint >= ts - 0.5 && h.humidity >= 88) {
    push(hazards, 'frost', ts <= -2 ? 2 : 1, 'Szron na nawierzchni',
      'Para wodna osadza się na zimnej jezdni jako cienka warstwa lodu.');
  }
  if (h.weatherCode === 48 && ts <= 0) {
    push(hazards, 'frost', 2, 'Mgła osadzająca szadź',
      'Szadź osadza się na jezdni, mostach i znakach.');
  }

  // 4. Strefa przejściowa wokół 0°C: mosty i wiadukty marzną pierwsze
  if (ts > 0 && ts <= 2 && h.temp <= 3 && (wet3h >= 0.1 || h.humidity >= 90)) {
    push(hazards, 'black-ice', 1, 'Możliwe lokalne oblodzenie',
      'Na mostach, wiaduktach i w zacienionych miejscach nawierzchnia bywa o 1–2°C chłodniejsza.');
  }

  // 5. Śnieg
  if (h.snowfall >= 0.1) {
    const sl = h.snowfall >= 2.5 ? 3 : h.snowfall >= 1 ? 2 : 1;
    push(hazards, 'snow', lvl(sl), h.snowfall >= 2.5 ? 'Intensywne opady śniegu' : 'Opady śniegu',
      `Ok. ${h.snowfall.toFixed(1).replace('.', ',')} cm/h. Ograniczona przyczepność i widoczność.`);
    if (h.temp > -1 && h.temp <= 2) {
      push(hazards, 'slush', lvl(Math.max(1, sl - 1)), 'Mokry śnieg i błoto pośniegowe',
        'Ryzyko poślizgu i zjawiska aquaplaningu na błocie pośniegowym.');
    }
  } else if ((h.snowDepth ?? 0) >= 0.01 && ts <= 0.5) {
    push(hazards, 'snow', 1, 'Zalegający śnieg',
      'Możliwy ubity śnieg i koleiny na drogach lokalnych.');
  }

  // 6. Deszcz
  if (liquidNow && ts > 0.5) {
    const rl = h.rain >= 10 ? 3 : h.rain >= 4 ? 2 : h.rain >= 0.5 ? 1 : 0;
    push(hazards, 'rain', lvl(rl), rl >= 2 ? 'Ulewa – ryzyko aquaplaningu' : 'Mokra nawierzchnia',
      `Opad ok. ${h.rain.toFixed(1).replace('.', ',')} mm/h. Droga hamowania wydłuża się.`);
  }

  // 7. Mgła / widoczność
  if (h.visibility != null) {
    const v = h.visibility;
    const fl = v < 150 ? 3 : v < 300 ? 2 : v < 1000 ? 1 : 0;
    push(hazards, 'fog', lvl(fl), fl >= 2 ? 'Gęsta mgła' : 'Ograniczona widoczność',
      `Widoczność ok. ${v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(v / 10) * 10} m`}.`);
  } else if (FOG_CODES.has(h.weatherCode)) {
    push(hazards, 'fog', 1, 'Mgła', 'Ograniczona widoczność.');
  }

  // 8. Wiatr (porywy) – szczególnie dla wysokich pojazdów i przyczep
  const wl = h.windGust >= 95 ? 3 : h.windGust >= 75 ? 2 : h.windGust >= 55 ? 1 : 0;
  push(hazards, 'wind', lvl(wl), 'Silne porywy wiatru',
    `Porywy do ${Math.round(h.windGust)} km/h. Uwaga na otwartych odcinkach i mostach.`);

  hazards.sort((a, b) => b.level - a.level);
  const level = (hazards[0]?.level ?? 0) as RiskLevel;
  return { level, surfaceTemp: ts, hazards, headline: hazards[0]?.title ?? 'Dobre warunki drogowe' };
}

/** Ocena całej serii (z pominięciem godzin z przeszłości w wyniku, ale z ich użyciem w kontekście). */
export function assessSeries(hours: HourSample[]): RoadRisk[] {
  return hours.map((_, i) => assessHour(hours, i));
}

/* ---------- Ostrzeżenia IMGW ---------- */

const WARNING_RULES: Array<{ re: RegExp; kind: HazardKind }> = [
  { re: /marzn|gołoled|goloted/i, kind: 'freezing-rain' },
  { re: /oblodz/i, kind: 'black-ice' },
  { re: /szadź|szadz/i, kind: 'frost' },
  { re: /zawiej|zamieć|zamiec/i, kind: 'snow' },
  { re: /śnieg|snieg/i, kind: 'snow' },
  { re: /mgł|mgl/i, kind: 'fog' },
  { re: /wiatr/i, kind: 'wind' },
  { re: /deszcz|burz/i, kind: 'rain' },
];

/** Czy ostrzeżenie IMGW dotyczy kierowców (oblodzenie, opady, mgła, wiatr). */
export function warningKind(w: Pick<ImgwWarning, 'event'>): HazardKind | null {
  return WARNING_RULES.find((r) => r.re.test(w.event))?.kind ?? null;
}

export function isActive(w: ImgwWarning, at: number): boolean {
  return at >= w.from && at <= w.to;
}

/** Podnosi poziom ryzyka zgodnie z aktywnymi ostrzeżeniami IMGW (źródło oficjalne). */
export function applyWarnings(risk: RoadRisk, warnings: ImgwWarning[], at: number): RoadRisk {
  const relevant = warnings.filter((w) => isActive(w, at) && warningKind(w));
  if (!relevant.length) return risk;
  const hazards = risk.hazards.map((h) => ({ ...h }));
  for (const w of relevant) {
    push(hazards, warningKind(w)!, lvl(Math.min(3, w.level + 1)), `Ostrzeżenie IMGW: ${w.event}`,
      `Stopień ${w.level}, prawdopodobieństwo ${w.probability}%.`);
  }
  hazards.sort((a, b) => b.level - a.level);
  const level = Math.max(risk.level, hazards[0].level) as RiskLevel;
  return { ...risk, level, hazards, headline: hazards[0].title };
}

export function maxLevel(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((m, l) => (l > m ? l : m), 0);
}
