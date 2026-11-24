import { useEffect, useState } from 'react';

/** Stan zapisywany w localStorage (preferencje widza). Odporny na brak dostępu do storage. */
export function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* tryb prywatny */ }
  }, [key, v]);
  return [v, setV];
}

export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fn(ac.signal)
      .then((data) => !ac.signal.aborted && setState({ data, error: null, loading: false }))
      .catch((e: Error) => !ac.signal.aborted && e.name !== 'AbortError' && setState({ data: null, error: e.message || 'Błąd', loading: false }));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, rev]);
  return { ...state, reload: () => setRev((r) => r + 1) };
}
