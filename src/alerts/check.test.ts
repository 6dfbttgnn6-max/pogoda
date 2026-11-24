import { describe, expect, it } from 'vitest';
import { nextDeparture } from './check';
import { parseWarsaw } from '../lib/time';
import type { Watch } from './store';

const w = (o: Partial<Watch>): Watch => ({ id: 'a', kind: 'place', name: 'x', points: [], hour: 7, minute: 30, days: [1, 2, 3, 4, 5], leadMin: 90, threshold: 2, enabled: true, ...o });

describe('czas lokalny', () => {
  it('parsuje czas zimowy (UTC+1) i letni (UTC+2)', () => {
    expect(parseWarsaw('2026-12-01 07:30:00')).toBe(Date.UTC(2026, 11, 1, 6, 30));
    expect(parseWarsaw('2026-07-01 07:30:00')).toBe(Date.UTC(2026, 6, 1, 5, 30));
  });
  it('wyznacza najbliższy wyjazd w dzień roboczy', () => {
    // wtorek 1.12.2026, 06:00 czasu polskiego
    const now = Date.UTC(2026, 11, 1, 5, 0);
    expect(nextDeparture(w({}), now)).toBe(Date.UTC(2026, 11, 1, 6, 30));
  });
  it('pomija weekend', () => {
    // sobota 5.12.2026, 10:00 → poniedziałek 7.12, 07:30
    const now = Date.UTC(2026, 11, 5, 9, 0);
    expect(nextDeparture(w({}), now)).toBe(Date.UTC(2026, 11, 7, 6, 30));
  });
});
