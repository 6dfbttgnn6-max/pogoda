import {
  CloudFog, CloudRain, CloudSnow, Snowflake, Wind, ShieldCheck, TriangleAlert, OctagonAlert, CircleAlert, Sparkles, Droplets,
} from 'lucide-react';
import type { HazardKind, RiskLevel } from '../types';
import { LEVEL_LABEL, LEVEL_SHORT } from '../risk/engine';

export const HAZARD_ICON: Record<HazardKind, typeof Snowflake> = {
  'freezing-rain': Droplets,
  'black-ice': Snowflake,
  frost: Sparkles,
  snow: CloudSnow,
  slush: CloudSnow,
  rain: CloudRain,
  fog: CloudFog,
  wind: Wind,
};

export const LEVEL_ICON: Record<RiskLevel, typeof ShieldCheck> = {
  0: ShieldCheck,
  1: CircleAlert,
  2: TriangleAlert,
  3: OctagonAlert,
};

/** Kolory poziomów do użycia poza CSS (mapa, wykresy). Jasny / ciemny motyw. */
export const LEVEL_COLOR: Record<'light' | 'dark', Record<RiskLevel, string>> = {
  light: { 0: '#16a34a', 1: '#d99a06', 2: '#ea580c', 3: '#dc2626' },
  dark: { 0: '#22c55e', 1: '#facc15', 2: '#fb923c', 3: '#f87171' },
};

export function Badge({ level, short }: { level: RiskLevel; short?: boolean }) {
  return <span className={`badge lv-${level}`}>{short ? LEVEL_SHORT[level] : LEVEL_LABEL[level]}</span>;
}

export const temp = (t: number) => `${Math.round(t) === 0 ? 0 : Math.round(t)}°`;
export const temp1 = (t: number) => `${t > 0 ? '+' : ''}${t.toFixed(1).replace('.', ',')}°`;
