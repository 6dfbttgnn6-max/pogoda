import { get, set } from 'idb-keyval';

/** Zapisane trasy/miejsca do powiadomień. IndexedDB, bo service worker nie ma dostępu do localStorage. */
export interface Watch {
  id: string;
  kind: 'place' | 'route';
  name: string;
  /** Punkty z czasem dojazdu od wyjazdu (s). Dla miejsca: jeden punkt z eta 0. */
  points: Array<{ lat: number; lon: number; eta: number; teryt?: string | null }>;
  hour: number;
  minute: number;
  /** Dni tygodnia 0=nd … 6=sob */
  days: number[];
  /** Ile minut przed wyjazdem ostrzegać */
  leadMin: number;
  /** Minimalny poziom ryzyka do powiadomienia */
  threshold: 1 | 2 | 3;
  enabled: boolean;
  lastNotified?: string;
}

const KEY = 'pd.watches';

export async function loadWatches(): Promise<Watch[]> {
  try { return ((await get(KEY)) as Watch[] | undefined) ?? []; } catch { return []; }
}

export async function saveWatches(w: Watch[]): Promise<void> {
  try { await set(KEY, w); } catch { /* brak IndexedDB */ }
}

export const DAY_NAMES = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
