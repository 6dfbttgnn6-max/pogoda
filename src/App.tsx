import { useEffect, useMemo, useState } from 'react';
import { Bell, Gauge, Map as MapIcon, Moon, Route as RouteIcon, Sun, Snowflake } from 'lucide-react';
import type { ImgwWarning } from './types';
import { MapProvider, MapSlot } from './components/MapCanvas';
import { NowView } from './views/NowView';
import { RouteView } from './views/RouteView';
import { MapView } from './views/MapView';
import { AlertsView } from './views/AlertsView';
import { useUserLocation } from './lib/location';
import { useStored } from './lib/store';
import { fetchWarnings, warningsFor } from './data/imgw';
import { findPowiat, loadPowiaty } from './data/powiaty';
import { loadWatches, saveWatches, type Watch } from './alerts/store';
import { runChecks } from './alerts/notify';
import { isDemo } from './data/demo';
import { isActive, warningKind } from './risk/engine';

type View = 'now' | 'route' | 'map' | 'alerts';
const TABS: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: 'now', label: 'Teraz', icon: Gauge },
  { id: 'route', label: 'Trasa', icon: RouteIcon },
  { id: 'map', label: 'Mapa', icon: MapIcon },
  { id: 'alerts', label: 'Alerty', icon: Bell },
];

function initialView(): View {
  const v = new URLSearchParams(location.search).get('view');
  return (TABS.some((t) => t.id === v) ? v : 'now') as View;
}

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [theme, setTheme] = useStored<'auto' | 'light' | 'dark'>('pd.theme', 'auto');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = theme === 'auto' ? systemDark : theme === 'dark';
  const { loc, status, locate, setManual } = useUserLocation();
  const [warnings, setWarnings] = useState<ImgwWarning[]>([]);
  const [teryt, setTeryt] = useState<string | null>(null);
  const [watches, setWatchesState] = useState<Watch[]>([]);
  const [sheet, setSheet] = useState<'min' | 'mid' | 'max'>('mid');

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const f = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.setAttribute('data-dark', dark ? '1' : '0');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#070b14' : '#f4f6fa');
  }, [theme, dark]);

  // Ostrzeżenia IMGW: odświeżanie co 15 min
  useEffect(() => {
    let alive = true;
    const load = () => fetchWarnings().then((w) => alive && setWarnings(w)).catch(() => {});
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Powiat (TERYT) bieżącej lokalizacji
  useEffect(() => {
    let alive = true;
    loadPowiaty().then((fc) => alive && setTeryt(findPowiat(fc, [loc.lon, loc.lat])?.properties.t ?? null));
    return () => { alive = false; };
  }, [loc.lat, loc.lon]);

  // Zapisane trasy + sprawdzanie, gdy aplikacja jest otwarta
  useEffect(() => { loadWatches().then(setWatchesState); }, []);
  const setWatches = (w: Watch[]) => { setWatchesState(w); saveWatches(w); };
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const run = () => navigator.serviceWorker.ready.then((reg) => runChecks(reg)).then((n) => { if (n) loadWatches().then(setWatchesState); }).catch(() => {});
    run();
    const t = setInterval(() => document.visibilityState === 'visible' && run(), 15 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const locWarnings = useMemo(() => warningsFor(warnings, teryt), [warnings, teryt]);
  const urgent = locWarnings.some((w) => isActive(w, Date.now()) && warningKind(w));

  const go = (v: View) => {
    setView(v);
    setSheet('mid');
    const u = new URL(location.href);
    if (v === 'now') u.searchParams.delete('view'); else u.searchParams.set('view', v);
    history.replaceState(null, '', u);
  };

  const cycleTheme = () => setTheme(theme === 'auto' ? (dark ? 'light' : 'dark') : theme === 'dark' ? 'light' : 'dark');

  return (
    <MapProvider dark={dark}>
      <div className="app" data-view={view} data-sheet={sheet}>
        <aside className="panel">
          <header className="panel-head">
            <div className="brand">
              <div className="brand-mark"><Snowflake size={18} /></div>
              <div>Pogoda Drogowa{isDemo() ? <small style={{ color: '#a78bfa', fontWeight: 700 }}>Tryb demonstracyjny</small> : <small>Warunki na drogach w Polsce</small>}</div>
            </div>
            <div className="head-actions">
              <button className="icon-btn" onClick={cycleTheme} aria-label={dark ? 'Motyw jasny' : 'Motyw ciemny'} title={dark ? 'Motyw jasny' : 'Motyw ciemny'}>
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </header>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} className="tab" role="tab" aria-selected={view === t.id} onClick={() => go(t.id)}>
                <t.icon size={15} /> {t.label}
                {t.id === 'now' && urgent && <span className="dot" aria-label="Aktywne ostrzeżenie" />}
              </button>
            ))}
          </nav>
          <div className="panel-body">
            <button className="sheet-handle" aria-label={sheet === 'max' ? 'Zwiń panel' : 'Rozwiń panel'}
              onClick={() => setSheet(sheet === 'mid' ? 'max' : sheet === 'max' ? 'min' : 'mid')} />
            <div hidden={view !== 'now'}>
              <NowView loc={loc} locStatus={status} onLocate={locate} onPick={setManual} warnings={locWarnings} active={view === 'now'} />
            </div>
            <div hidden={view !== 'route'}>
              <RouteView loc={loc} onLocate={locate} warnings={warnings} active={view === 'route'} onSaveWatch={(w) => setWatches([...watches, w])} />
            </div>
            <div hidden={view !== 'map'}>
              <MapView warnings={warnings} active={view === 'map'} />
            </div>
            <div hidden={view !== 'alerts'}>
              <AlertsView watches={watches} setWatches={setWatches} warnings={warnings} loc={loc} />
            </div>
            <footer className="xs" style={{ marginTop: 24, textAlign: 'center', lineHeight: 1.6 }}>
              Prognoza: Open-Meteo.com (CC BY 4.0) · Ostrzeżenia: IMGW-PIB<br />
              Mapa i trasy: © OpenStreetMap, OpenFreeMap, OSRM<br />
              Ocena ryzyka ma charakter orientacyjny. Zawsze dostosuj jazdę do warunków.
            </footer>
          </div>
        </aside>
        <main className="map-wrap" id="map-overlay"><MapSlot /></main>
      </div>
      {isDemo() && <div className="demo-bar">DANE DEMONSTRACYJNE</div>}
      <nav className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => go(t.id)}>
            <t.icon size={21} />{t.label}
            {t.id === 'now' && urgent && <span className="dot" />}
          </button>
        ))}
      </nav>
    </MapProvider>
  );
}
