export type LngLat = [number, number];

/** Jedna godzina prognozy w jednym punkcie. Wartości w jednostkach SI / metrycznych. */
export interface HourSample {
  time: number; // unix ms (UTC)
  temp: number; // °C, 2 m
  dewPoint: number; // °C
  humidity: number; // %
  surfaceTemp: number | null; // °C, temperatura gruntu 0 cm (przybliżenie nawierzchni)
  precip: number; // mm/h (suma: deszcz + przelotne + śnieg w wodzie)
  rain: number; // mm/h (deszcz + przelotne)
  snowfall: number; // cm/h
  snowDepth: number | null; // m
  weatherCode: number; // WMO
  cloudCover: number; // %
  visibility: number | null; // m
  windSpeed: number; // km/h
  windGust: number; // km/h
  isDay: boolean;
}

export interface PointForecast {
  lat: number;
  lon: number;
  elevation: number | null;
  hours: HourSample[];
}

export type RiskLevel = 0 | 1 | 2 | 3;

export type HazardKind =
  | 'freezing-rain'
  | 'black-ice'
  | 'frost'
  | 'snow'
  | 'slush'
  | 'rain'
  | 'fog'
  | 'wind';

export interface Hazard {
  kind: HazardKind;
  level: RiskLevel;
  title: string;
  detail: string;
}

export interface RoadRisk {
  level: RiskLevel;
  /** Szacowana temperatura nawierzchni, °C */
  surfaceTemp: number;
  hazards: Hazard[];
  /** Najważniejsze zagrożenie (do krótkiego komunikatu) */
  headline: string;
}

export interface ImgwWarning {
  id: string;
  event: string;
  level: number; // stopień 1-3
  probability: number; // %
  from: number; // unix ms
  to: number; // unix ms
  published: number;
  text: string;
  office: string;
  teryt: string[];
}

export interface Place {
  name: string;
  label: string;
  lat: number;
  lon: number;
}
