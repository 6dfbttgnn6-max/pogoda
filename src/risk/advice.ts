import type { HazardKind, RiskLevel } from '../types';
import type { RouteWeather } from './route';

/**
 * Wskazówki dla kierowcy na podstawie warunków na trasie (w chwili przejazdu).
 *
 * Treści są autorskie. Odwołania do przepisów ograniczono do reguł ogólnie znanych
 * i jednoznacznych (Prawo o ruchu drogowym, znak C-18). Nie stanowią porady prawnej.
 */

export type AdviceIcon = 'chains' | 'tyre' | 'washer' | 'scraper' | 'ice' | 'fog' | 'wind' | 'kit' | 'clock' | 'lights' | 'fuel' | 'rain';

export interface Advice {
  id: string;
  priority: number; // im wyższy, tym ważniejsze
  level: RiskLevel;
  icon: AdviceIcon;
  title: string;
  text: string;
  /** Krótka informacja o przepisie, jeśli wskazówka z niego wynika */
  law?: string;
}

export interface RouteFacts {
  maxByKind: Partial<Record<HazardKind, RiskLevel>>;
  maxSnowfall: number; // cm/h
  maxRain: number; // mm/h
  minTemp: number; // °C powietrza
  minSurface: number; // °C nawierzchni (szac.)
  maxGust: number; // km/h
  minVisibility: number | null; // m
  snowOnGround: boolean;
  durationSec: number;
  distanceKm: number;
  max: RiskLevel;
  /** Fragment trasy w terenie górskim/podgórskim (szer. < 50,0° i dł. 18,5–23,5° albo Sudety) */
  mountains: boolean;
}

export function routeFacts(w: RouteWeather, extra: {
  durationSec: number; distanceKm: number;
  hourAt: (k: number) => { snowfall: number; rain: number; windGust: number; visibility: number | null; snowDepth: number | null } | null;
}): RouteFacts {
  const maxByKind: RouteFacts['maxByKind'] = {};
  let maxSnowfall = 0, maxRain = 0, minTemp = Infinity, minSurface = Infinity, maxGust = 0;
  let minVisibility: number | null = null, snowOnGround = false, mountains = false;
  w.samples.forEach((s, k) => {
    for (const h of s.risk.hazards) maxByKind[h.kind] = Math.max(maxByKind[h.kind] ?? 0, h.level) as RiskLevel;
    if (Number.isFinite(s.temp)) minTemp = Math.min(minTemp, s.temp);
    if (Number.isFinite(s.risk.surfaceTemp)) minSurface = Math.min(minSurface, s.risk.surfaceTemp);
    const h = extra.hourAt(k);
    if (h) {
      maxSnowfall = Math.max(maxSnowfall, h.snowfall);
      maxRain = Math.max(maxRain, h.rain);
      maxGust = Math.max(maxGust, h.windGust);
      if (h.visibility != null) minVisibility = minVisibility == null ? h.visibility : Math.min(minVisibility, h.visibility);
      if ((h.snowDepth ?? 0) >= 0.01) snowOnGround = true;
    }
    const [lon, lat] = s.sample.at;
    if ((lat < 50.0 && lon > 18.5 && lon < 23.5) || (lat < 50.9 && lon > 15.0 && lon < 17.3)) mountains = true;
  });
  return {
    maxByKind, maxSnowfall, maxRain, maxGust, minVisibility, snowOnGround, mountains,
    minTemp: Number.isFinite(minTemp) ? minTemp : NaN,
    minSurface: Number.isFinite(minSurface) ? minSurface : NaN,
    durationSec: extra.durationSec, distanceKm: extra.distanceKm, max: w.max,
  };
}

const lv = (f: RouteFacts, k: HazardKind) => f.maxByKind[k] ?? 0;

export function routeAdvice(f: RouteFacts): Advice[] {
  const out: Advice[] = [];
  const add = (a: Advice) => out.push(a);
  const snow = lv(f, 'snow');
  const slush = lv(f, 'slush');
  const ice = Math.max(lv(f, 'freezing-rain'), lv(f, 'black-ice'));
  const frost = lv(f, 'frost');
  const rain = lv(f, 'rain');
  const fog = lv(f, 'fog');
  const wind = lv(f, 'wind');
  const freezing = f.minTemp <= 0 || f.minSurface <= 0;

  // --- Gołoledź / oblodzenie ---
  if (lv(f, 'freezing-rain') >= 3) {
    add({
      id: 'ice-postpone', priority: 100, level: 3, icon: 'ice',
      title: 'Rozważ przełożenie podróży',
      text: 'Na trasie prognozujemy marznący deszcz lub deszcz na zamarzniętą jezdnię. To najgroźniejsze warunki zimowe: nawierzchnia może być śliska jak lodowisko. Sprawdź, czy inna godzina wyjazdu nie jest bezpieczniejsza.',
    });
  }
  if (ice >= 2) {
    add({
      id: 'ice-drive', priority: 90, level: ice as RiskLevel, icon: 'ice',
      title: 'Jedź płynnie, bez gwałtownych manewrów',
      text: 'Hamuj wcześnie i delikatnie, unikaj nagłych ruchów kierownicą i zmian biegów w zakrętach. Odstęp od poprzedzającego pojazdu zwiększ kilkukrotnie. Mosty, wiadukty i zacienione odcinki zamarzają najszybciej.',
      law: 'Prędkość trzeba dostosować do warunków na drodze, nawet poniżej obowiązującego limitu.',
    });
  } else if (ice === 1) {
    add({
      id: 'ice-local', priority: 60, level: 1, icon: 'ice',
      title: 'Uważaj na mostach i w zacienionych miejscach',
      text: 'Temperatura nawierzchni jest bliska zera. Lokalnie, szczególnie na obiektach mostowych i w lasach, jezdnia może być oblodzona, mimo że reszta drogi wygląda na mokrą.',
    });
  }

  // --- Śnieg i łańcuchy ---
  if (snow >= 2 || f.maxSnowfall >= 1 || (f.mountains && (snow >= 1 || f.snowOnGround))) {
    add({
      id: 'chains', priority: 85, level: Math.max(2, snow) as RiskLevel, icon: 'chains',
      title: 'Zabierz łańcuchy śniegowe',
      text: f.mountains
        ? 'Trasa prowadzi przez teren górski, gdzie spodziewane są opady lub zalegający śnieg. Przećwicz zakładanie łańcuchów przed wyjazdem, w suchym i bezpiecznym miejscu.'
        : 'Prognozujemy intensywne opady śniegu. Łańcuchy przydadzą się na nieodśnieżonych odcinkach i podjazdach. Przećwicz ich zakładanie przed wyjazdem.',
      law: 'Łańcuchy zakładaj tylko na drodze pokrytej śniegiem lub lodem. Na odcinkach oznaczonych znakiem C-18 ich użycie jest obowiązkowe.',
    });
  }
  if (snow >= 1 || slush >= 1 || f.snowOnGround) {
    add({
      id: 'snow-clean', priority: 70, level: Math.max(snow, slush) as RiskLevel, icon: 'scraper',
      title: 'Odśnież cały samochód, także dach',
      text: 'Usuń śnieg z szyb, lusterek, świateł, tablic rejestracyjnych i dachu. Zsuwający się z dachu śnieg może zasłonić Ci widok przy hamowaniu albo spaść na auto za Tobą. Zabierz szczotkę, skrobaczkę i małą łopatkę.',
      law: 'Pojazd nie może zagrażać innym uczestnikom ruchu, a kierowca musi mieć zapewnione dostateczne pole widzenia.',
    });
  }
  if (snow >= 1 || slush >= 1 || freezing) {
    add({
      id: 'tyres', priority: 55, level: 1, icon: 'tyre',
      title: 'Sprawdź opony',
      text: 'Poniżej ok. +7°C (często przyjmowana granica) i na śniegu lepszą przyczepność dają opony zimowe lub całoroczne z oznaczeniem 3PMSF (płatek śniegu na tle góry). Sprawdź też ciśnienie: spada ono wraz z temperaturą.',
    });
  }
  if (slush >= 1) {
    add({
      id: 'slush', priority: 65, level: slush, icon: 'rain',
      title: 'Błoto pośniegowe: zwolnij przed kałużami',
      text: 'Mokry śnieg na jezdni działa jak woda przy aquaplaningu i dodatkowo szybko brudzi szyby. Zwolnij i trzymaj się kolein wyjeżdżonych przez inne pojazdy.',
    });
  }

  // --- Płyn do spryskiwaczy ---
  if (rain >= 1 || snow >= 1 || slush >= 1 || f.maxRain >= 0.5) {
    add({
      id: 'washer', priority: rain >= 2 || slush >= 1 ? 68 : 50, level: Math.max(1, rain, slush) as RiskLevel, icon: 'washer',
      title: freezing ? 'Uzupełnij zimowy płyn do spryskiwaczy' : 'Uzupełnij płyn do spryskiwaczy',
      text: freezing
        ? `Na trasie temperatura spada do ok. ${Math.round(f.minTemp)}°C, a opady i błoto szybko zabrudzą szybę. Użyj płynu zimowego o temperaturze krzepnięcia niższej niż prognozowana i weź zapas w bagażniku.`
        : 'Prognozujemy opady, a spod kół innych pojazdów leci brudna woda. Pełny zbiornik i sprawne pióra wycieraczek to podstawa widoczności.',
    });
  }
  if (rain >= 2) {
    add({
      id: 'aquaplaning', priority: 75, level: rain, icon: 'rain',
      title: 'Ulewa: ryzyko aquaplaningu',
      text: 'Przy intensywnym deszczu zwolnij, szczególnie w koleinach i na zjazdach. Jeśli poczujesz, że kierownica „lekko chodzi”, nie hamuj gwałtownie: zdejmij nogę z gazu i trzymaj kierunek.',
      law: 'Prędkość trzeba dostosować do warunków na drodze, nawet poniżej obowiązującego limitu.',
    });
  }

  // --- Szron ---
  if (frost >= 1) {
    add({
      id: 'frost', priority: 58, level: frost, icon: 'scraper',
      title: 'Zarezerwuj czas na oskrobanie szyb',
      text: 'Spodziewany szron na nawierzchni i na samochodzie. Dolicz kilka minut na dokładne oczyszczenie szyb. Nie ruszaj z „okienkiem” wydrapanym na środku szyby.',
    });
  }

  // --- Mgła ---
  if (fog >= 1) {
    add({
      id: 'fog', priority: fog >= 2 ? 80 : 52, level: fog, icon: 'fog',
      title: fog >= 2 ? 'Gęsta mgła: zwolnij i zwiększ odstęp' : 'Ograniczona widoczność',
      text: `Widoczność spada ${f.minVisibility != null ? `do ok. ${f.minVisibility < 1000 ? `${Math.round(f.minVisibility / 10) * 10} m` : `${(f.minVisibility / 1000).toFixed(1).replace('.', ',')} km`}` : 'miejscami'}. Jedź tak, aby zatrzymać się na odcinku, który widzisz. Nie kieruj się wyłącznie światłami pojazdu przed Tobą.`,
      law: 'Przednie światła przeciwmgłowe możesz włączyć przy ograniczonej przejrzystości powietrza, a tylne dopiero, gdy widoczność spada poniżej 50 m.',
    });
  }

  // --- Wiatr ---
  if (wind >= 1) {
    add({
      id: 'wind', priority: wind >= 2 ? 72 : 48, level: wind, icon: 'wind',
      title: 'Silne porywy wiatru',
      text: `Porywy do ok. ${Math.round(f.maxGust)} km/h. Trzymaj kierownicę oburącz, uważaj przy wyprzedzaniu ciężarówek, na mostach i otwartych odcinkach. Przy jeździe z przyczepą lub busem rozważ zmniejszenie prędkości.`,
    });
  }

  // --- Mróz i długa trasa ---
  if (f.minTemp <= -10) {
    add({
      id: 'cold', priority: 62, level: 1, icon: 'fuel',
      title: 'Silny mróz na trasie',
      text: `Temperatura spada do ok. ${Math.round(f.minTemp)}°C. Zatankuj do pełna (w dieslu stosuj olej napędowy zimowy lub arktyczny), sprawdź akumulator i zabierz ciepłe ubranie.`,
    });
  }
  if (f.max >= 2 && f.durationSec >= 90 * 60) {
    add({
      id: 'kit', priority: 45, level: 1, icon: 'kit',
      title: 'Przygotuj się na przestój',
      text: 'W trudnych warunkach łatwo o korek lub zamkniętą drogę. Zabierz koc, ciepły napój, wodę, naładowany telefon z ładowarką i miej co najmniej pół zbiornika paliwa.',
    });
  }
  if (f.max >= 2) {
    add({
      id: 'time', priority: 40, level: 1, icon: 'clock',
      title: 'Zaplanuj więcej czasu',
      text: 'Czas przejazdu podany przez nawigację nie uwzględnia wolniejszej jazdy w trudnych warunkach. Wyjedź wcześniej, żeby nie musieć nadrabiać prędkością.',
    });
  }

  // --- Zawsze ---
  add({
    id: 'lights', priority: 10, level: 0, icon: 'lights',
    title: 'Światła mijania przez całą dobę',
    text: 'Sprawdź, czy wszystkie światła działają i są czyste. Brudne reflektory potrafią wyraźnie skrócić zasięg widoczności.',
    law: 'W Polsce trzeba jechać na światłach mijania przez całą dobę. W dzień, przy dobrej przejrzystości powietrza, można zamiast nich używać świateł do jazdy dziennej.',
  });

  return out.sort((a, b) => b.priority - a.priority);
}
