import { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap } from 'maplibre-gl';
import { createPortal } from 'react-dom';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre v6 ładuje workera z pliku obok modułu; po spakowaniu wskazujemy go jawnie.
maplibregl.setWorkerUrl(workerUrl);

/**
 * Wspólna mapa (MapLibre + kafelki wektorowe OpenFreeMap, dane OSM).
 * Widoki dodają własne warstwy przez `useMapEffect`, który ponawia je po zmianie stylu
 * (np. przełączeniu motywu jasny/ciemny).
 */
const STYLE = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
};

type Ctx = { map: MLMap | null; styleRev: number; dark: boolean; register: (m: MLMap | null) => void; bump: () => void };
const MapCtx = createContext<Ctx>({ map: null, styleRev: 0, dark: true, register: () => {}, bump: () => {} });
export const useMap = () => useContext(MapCtx);

export function MapProvider({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const [map, setMap] = useState<MLMap | null>(null);
  const [styleRev, setStyleRev] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (!map) return;
    if (first.current) { first.current = false; return; }
    map.setStyle(dark ? STYLE.dark : STYLE.light, { diff: false });
  }, [dark, map]);

  return (
    <MapCtx.Provider value={{ map: styleRev > 0 ? map : null, styleRev, dark, register: setMap, bump: () => setStyleRev((r) => r + 1) }}>
      {children}
    </MapCtx.Provider>
  );
}

/** Etykiety po polsku: name:pl, a gdy brak – nazwa lokalna. */
function polishLabels(m: MLMap) {
  for (const l of m.getStyle().layers ?? []) {
    if (l.type !== 'symbol') continue;
    const tf = m.getLayoutProperty(l.id, 'text-field');
    if (tf && JSON.stringify(tf).includes('name')) {
      m.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:pl'], ['get', 'name']]);
    }
  }
}

/** Kontener mapy. Renderowany raz, na stałe, w układzie aplikacji. */
export function MapSlot() {
  const ref = useRef<HTMLDivElement>(null);
  const { register, bump, dark } = useMap();
  useEffect(() => {
    const m = new maplibregl.Map({
      container: ref.current!,
      style: dark ? STYLE.dark : STYLE.light,
      center: [19.4, 52.0],
      zoom: 5.4,
      minZoom: 4,
      maxZoom: 17,
      attributionControl: { compact: true, customAttribution: 'Prognoza: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · Ostrzeżenia: IMGW-PIB' },
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('style.load', () => { polishLabels(m); bump(); });
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(ref.current!);
    register(m);
    return () => { ro.disconnect(); register(null); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className="map" />;
}

/**
 * Efekt rysujący na mapie. `setup` zwraca funkcję sprzątającą.
 * Uruchamiany ponownie po każdej zmianie stylu oraz zależności.
 */
export function useMapEffect(setup: (map: MLMap) => void | (() => void), deps: unknown[]) {
  const { map, styleRev } = useMap();
  useEffect(() => {
    if (!map) return;
    const cleanup = setup(map);
    return () => {
      try { cleanup?.(); } catch { /* styl mógł zostać już zastąpiony */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleRev, ...deps]);
}

/** Bezpieczne usunięcie warstw i źródeł. */
export function removeLayers(map: MLMap, layers: string[], sources: string[]) {
  for (const l of layers) if (map.getLayer(l)) map.removeLayer(l);
  for (const s of sources) if (map.getSource(s)) map.removeSource(s);
}

/** Pierwsza warstwa z etykietami, żeby nasze warstwy rysować pod nazwami miejscowości. */
export function firstSymbolLayer(map: MLMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
}

/** Odstępy do dopasowania widoku mapy, z uwzględnieniem dolnego arkusza na telefonie. */
export function fitPadding(top = 70): maplibregl.PaddingOptions | number {
  if (!window.matchMedia('(max-width: 860px)').matches) return 80;
  const sheet = document.querySelector('.app .panel-body') as HTMLElement | null;
  const sheetTop = sheet ? sheet.getBoundingClientRect().top : window.innerHeight * 0.5;
  return { top, left: 36, right: 36, bottom: Math.max(60, window.innerHeight - sheetTop + 24) };
}

/** Renderuje dzieci nad mapą (w kontenerze .map-wrap), niezależnie od miejsca w drzewie. */
export function MapOverlay({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.getElementById('map-overlay')), []);
  return el ? createPortal(children, el) : null;
}
