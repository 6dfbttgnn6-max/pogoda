import type { ImgwWarning } from '../types';
import { parseWarsaw } from '../lib/time';
import { demoWarnings, isDemo } from './demo';

/** Ostrzeżenia meteorologiczne IMGW-PIB. Źródło danych: IMGW-PIB (wymagane podanie źródła). */
const ENDPOINT = 'https://danepubliczne.imgw.pl/api/data/warningsmeteo';

type Raw = {
  id: string;
  nazwa_zdarzenia: string;
  stopien: string;
  prawdopodobienstwo: string;
  obowiazuje_od: string;
  obowiazuje_do: string;
  opublikowano: string;
  tresc: string;
  komentarz?: string;
  biuro: string;
  teryt: string[];
};

let cache: { at: number; data: ImgwWarning[] } | null = null;

export async function fetchWarnings(signal?: AbortSignal): Promise<ImgwWarning[]> {
  if (isDemo()) return demoWarnings();
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.data;
  const res = await fetch(ENDPOINT, { signal });
  if (!res.ok) throw new Error(`IMGW: błąd ${res.status}`);
  const raw = (await res.json()) as Raw[];
  const data = raw
    .map<ImgwWarning>((r) => ({
      id: r.id,
      event: r.nazwa_zdarzenia,
      level: Number(r.stopien) || 1,
      probability: Number(r.prawdopodobienstwo) || 0,
      from: parseWarsaw(r.obowiazuje_od),
      to: parseWarsaw(r.obowiazuje_do),
      published: parseWarsaw(r.opublikowano),
      text: (r.tresc || '').replace(/\s+/g, ' ').trim(),
      office: r.biuro,
      teryt: r.teryt ?? [],
    }))
    .filter((w) => w.to > Date.now());
  cache = { at: Date.now(), data };
  return data;
}

export function warningsFor(warnings: ImgwWarning[], teryt: string | null | undefined): ImgwWarning[] {
  if (!teryt) return [];
  return warnings.filter((w) => w.teryt.includes(teryt));
}

export const VOIVODESHIPS: Record<string, string> = {
  '02': 'dolnośląskie', '04': 'kujawsko-pomorskie', '06': 'lubelskie', '08': 'lubuskie',
  '10': 'łódzkie', '12': 'małopolskie', '14': 'mazowieckie', '16': 'opolskie',
  '18': 'podkarpackie', '20': 'podlaskie', '22': 'pomorskie', '24': 'śląskie',
  '26': 'świętokrzyskie', '28': 'warmińsko-mazurskie', '30': 'wielkopolskie', '32': 'zachodniopomorskie',
};

export function voivodeshipsOf(w: ImgwWarning): string[] {
  return [...new Set(w.teryt.map((t) => VOIVODESHIPS[t.slice(0, 2)]).filter(Boolean))];
}
