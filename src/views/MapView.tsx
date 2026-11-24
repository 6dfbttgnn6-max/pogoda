import { useEffect, useMemo, useState } from 'react';
import type { ImageSource } from 'maplibre-gl';
import { Info, Layers, Loader2, RefreshCw, ShieldAlert, Snowflake, Thermometer, CloudSnow } from 'lucide-react';
import type { ImgwWarning, PointForecast, RiskLevel } from '../types';
import { fetchForecast, hourIndex } from '../data/openMeteo';
import { assessSeries, LEVEL_LABEL, warningKind, isActive } from '../risk/engine';
import { loadPowiaty } from '../data/powiaty';
import { polygonContains } from '../lib/geo';
import { formatWhen } from '../lib/time';
import { firstSymbolLayer, fitPadding, MapOverlay, removeLayers, useMap, useMapEffect } from '../components/MapCanvas';
import { LEVEL_COLOR } from '../components/ui';
import { WarningCard } from '../components/WarningCard';
import { useStored } from '../lib/store';

type Mode = 'risk' | 'surface' | 'snow';
const BOUNDS: [number, number, number, number] = [13.9, 48.9, 24.3, 55.0];
const STEP = 0.4;

type Outline = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };

async function loadOutline(): Promise<Outline | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/polska.geojson`);
    if (!r.ok) return null;
    return (await r.json()).geometry as Outline;
  } catch { return null; }
}

interface Grid {
  points: Array<{ lat: number; lon: number }>;
  forecasts: PointForecast[];
  levels: RiskLevel[][]; // [punkt][godzina]
  outline: Outline | null;
}

export function MapView({ warnings, active }: { warnings: ImgwWarning[]; active: boolean }) {
  const [mode, setMode] = useStored<Mode>('pd.map.mode', 'risk');
  const [showWarn, setShowWarn] = useStored('pd.map.warn', true);
  const [offset, setOffset] = useState(0); // godziny od teraz
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const { dark } = useMap();

  // Siatkę ładujemy dopiero przy pierwszym wejściu w widok (oszczędza limit zapytań).
  const [wanted, setWanted] = useState(false);
  useEffect(() => { if (active) setWanted(true); }, [active]);

  useEffect(() => {
    if (!wanted) return;
    const ac = new AbortController();
    setError(null);
    (async () => {
      const outline = await loadOutline();
      const points: Array<{ lat: number; lon: number }> = [];
      for (let lat = BOUNDS[1]; lat <= BOUNDS[3]; lat += STEP) {
        for (let lon = BOUNDS[0]; lon <= BOUNDS[2]; lon += STEP * 1.5) {
          // punkty wewnątrz Polski + pas 1 oczka wokół (dla gładkiej interpolacji przy granicy)
          const inside = !outline || [[0, 0], [STEP * 1.5, 0], [-STEP * 1.5, 0], [0, STEP], [0, -STEP]].some(([dx, dy]) => polygonContains(outline, [lon + dx, lat + dy]));
          if (inside) points.push({ lat: +lat.toFixed(2), lon: +lon.toFixed(2) });
        }
      }
      const chunks: Array<typeof points> = [];
      for (let k = 0; k < points.length; k += 90) chunks.push(points.slice(k, k + 90));
      const parts = await Promise.all(chunks.map((c) => fetchForecast(c, { days: 3, signal: ac.signal })));
      const forecasts = parts.flat();
      const levels = forecasts.map((f) => assessSeries(f.hours).map((r) => r.level));
      if (!ac.signal.aborted) setGrid({ points, forecasts, levels, outline });
    })().catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ac.abort();
  }, [wanted, rev]);

  const at = Math.floor(Date.now() / 3_600_000) * 3_600_000 + offset * 3_600_000;

  // Raster interpolowany (IDW) i przycięty do granic Polski
  const image = useMemo(() => {
    if (!grid) return null;
    const colors = LEVEL_COLOR[dark ? 'dark' : 'light'];
    const W = 260, H = Math.round(W * ((BOUNDS[3] - BOUNDS[1]) / (BOUNDS[2] - BOUNDS[0])) * 1.55);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const vals = grid.forecasts.map((f, k) => {
      const i = hourIndex(f.hours, at);
      const h = f.hours[i];
      if (mode === 'risk') return grid.levels[k][i];
      if (mode === 'surface') return h ? (h.surfaceTemp ?? h.temp) : 0;
      return h ? h.snowfall : 0;
    });
    const img = g.createImageData(W, H);
    const pts = grid.points.map((p) => [(p.lon - BOUNDS[0]) / (BOUNDS[2] - BOUNDS[0]) * W, (1 - mercY(p.lat)) * H]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let num = 0, den = 0, nearest = Infinity, nv = 0;
        for (let k = 0; k < pts.length; k++) {
          const dx = pts[k][0] - x, dy = pts[k][1] - y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 900) continue;
          if (d2 < nearest) { nearest = d2; nv = vals[k]; }
          const wgt = 1 / (d2 + 1) ** 1.4;
          num += wgt * vals[k]; den += wgt;
        }
        if (!den) continue;
        const v = mode === 'risk' ? Math.max(num / den, nv * 0.6) : num / den;
        const [r, gg, b, a] = colorFor(mode, v, colors);
        const o = (y * W + x) * 4;
        img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = a;
      }
    }
    g.putImageData(img, 0, 0);
    // przycięcie do konturu kraju
    if (grid.outline) {
      g.globalCompositeOperation = 'destination-in';
      g.beginPath();
      const polys = grid.outline.type === 'Polygon' ? [grid.outline.coordinates] : grid.outline.coordinates;
      for (const p of polys) for (const ring of p) ring.forEach(([lon, lat], k) => {
        const X = (lon - BOUNDS[0]) / (BOUNDS[2] - BOUNDS[0]) * W, Y = (1 - mercY(lat)) * H;
        if (k) g.lineTo(X, Y); else g.moveTo(X, Y);
      });
      g.fill('evenodd');
    }
    return c.toDataURL();
  }, [grid, at, mode, dark]);

  const summary = useMemo(() => {
    if (!grid) return null;
    const counts = [0, 0, 0, 0];
    grid.forecasts.forEach((f, k) => {
      if (grid.outline && !polygonContains(grid.outline, [grid.points[k].lon, grid.points[k].lat])) return;
      counts[grid.levels[k][hourIndex(f.hours, at)]]++;
    });
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return counts.map((n) => Math.round((n / total) * 100));
  }, [grid, at]);

  const relevant = warnings.filter((w) => warningKind(w));
  const activeAt = relevant.filter((w) => isActive(w, at));

  // Warstwa rastrowa
  useMapEffect((map) => {
    if (!active || !image) return;
    const coords: [[number, number], [number, number], [number, number], [number, number]] = [
      [BOUNDS[0], BOUNDS[3]], [BOUNDS[2], BOUNDS[3]], [BOUNDS[2], BOUNDS[1]], [BOUNDS[0], BOUNDS[1]],
    ];
    const src = map.getSource('risk-img') as ImageSource | undefined;
    if (src) { src.updateImage({ url: image, coordinates: coords }); return; }
    map.addSource('risk-img', { type: 'image', url: image, coordinates: coords });
    map.addLayer({ id: 'risk-img', type: 'raster', source: 'risk-img', paint: { 'raster-opacity': dark ? 0.62 : 0.55, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, firstSymbolLayer(map));
  }, [active, image, dark]);
  useMapEffect((map) => () => removeLayers(map, ['risk-img'], ['risk-img']), [active]);

  // Powiaty z ostrzeżeniami IMGW
  useMapEffect((map) => {
    if (!active || !showWarn) return;
    let cancelled = false;
    loadPowiaty().then((fc) => {
      if (cancelled || !map.getStyle()) return;
      const lv = new Map<string, number>();
      for (const w of activeAt) for (const t of w.teryt) lv.set(t, Math.max(lv.get(t) ?? 0, w.level));
      const data = { type: 'FeatureCollection' as const, features: fc.features.filter((f) => lv.has(f.properties.t)).map((f) => ({ ...f, properties: { ...f.properties, l: lv.get(f.properties.t)! } })) };
      const colors = LEVEL_COLOR[dark ? 'dark' : 'light'];
      map.addSource('warn', { type: 'geojson', data });
      const before = firstSymbolLayer(map);
      map.addLayer({ id: 'warn-line', type: 'line', source: 'warn', paint: { 'line-color': ['match', ['get', 'l'], 3, colors[3], 2, colors[3], colors[2]], 'line-width': 1.6, 'line-dasharray': [2, 1.5] } }, before);
    });
    return () => { cancelled = true; removeLayers(map, ['warn-line'], ['warn']); };
  }, [active, showWarn, activeAt.map((w) => w.id).join(), dark]);

  useMapEffect((map) => {
    if (active) map.fitBounds([[14.1, 49.0], [24.15, 54.85]], { padding: fitPadding(70), duration: 700 });
  }, [active]);

  const slider = (
    <>
      <div className="row between"><b>{offset === 0 ? 'Teraz' : formatWhen(at)}</b><span className="xs">+{offset} h</span></div>
      <input type="range" min={0} max={36} step={1} value={offset} onChange={(e) => setOffset(Number(e.target.value))} aria-label="Godzina prognozy" style={{ width: '100%', accentColor: 'var(--accent)' }} />
      <Legend mode={mode} />
    </>
  );

  return (
    <>
      {active && (
        <MapOverlay>
          <div className="map-tools">
            <div className="seg" role="group" aria-label="Warstwa">
              <button aria-pressed={mode === 'risk'} onClick={() => setMode('risk')}><ShieldAlert size={14} /> Ryzyko</button>
              <button aria-pressed={mode === 'surface'} onClick={() => setMode('surface')}><Thermometer size={14} /> Nawierzchnia</button>
              <button aria-pressed={mode === 'snow'} onClick={() => setMode('snow')}><CloudSnow size={14} /> Śnieg</button>
            </div>
            <div className="seg"><button aria-pressed={showWarn} onClick={() => setShowWarn(!showWarn)} title="Powiaty z ostrzeżeniami IMGW"><Layers size={14} /><span className="hide-sm">IMGW</span></button></div>
          </div>
          <div className="time-slider desktop-only">{slider}</div>
          {!grid && !error && <div className="map-loading"><Loader2 size={15} className="spin" /> Liczę ryzyko dla całego kraju…</div>}
        </MapOverlay>
      )}
      <div className="stack">
        <div className="card mobile-only" style={{ padding: '10px 14px' }}>{slider}</div>
        <div className="section-title desktop-only" style={{ marginTop: 0 }}><span>Polska · {offset === 0 ? 'teraz' : formatWhen(at)}</span></div>
        {error && (
          <>
            <div className="note error"><Info size={16} /><div><b>Nie udało się pobrać prognozy.</b><br />{error}</div></div>
            <button className="btn" onClick={() => setRev((r) => r + 1)}><RefreshCw size={16} /> Spróbuj ponownie</button>
          </>
        )}
        {summary && (
          <div className="card">
            <div className="risk-strip" style={{ height: 10 }}>
              {summary.map((p, k) => p > 0 && <i key={k} className={`lv-${k}`} style={{ flex: p }} />)}
            </div>
            <div className="row between small" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
              {summary.map((p, k) => <span key={k} className="row" style={{ gap: 6 }}><i className={`lv-${k}`} style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--c)' }} />{LEVEL_LABEL[k as RiskLevel]} <b>{p}%</b></span>)}
            </div>
            <div className="xs" style={{ marginTop: 6 }}>Udział powierzchni kraju wg ryzyka na drogach</div>
          </div>
        )}
        <div className="section-title"><span>Ostrzeżenia IMGW ({activeAt.length})</span><Snowflake size={14} /></div>
        {activeAt.length === 0 ? <div className="note"><Info size={16} /> Brak aktywnych ostrzeżeń dla kierowców w wybranym czasie.</div>
          : activeAt.map((w) => <WarningCard key={w.id} w={w} activeNow showRegions />)}
      </div>
    </>
  );
}

function mercY(lat: number) {
  const m = (l: number) => Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 360));
  return (m(lat) - m(BOUNDS[1])) / (m(BOUNDS[3]) - m(BOUNDS[1]));
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const SURFACE_STOPS: Array<[number, string]> = [[-10, '#7c3aed'], [-5, '#2563eb'], [-2, '#0ea5e9'], [0, '#e0f2fe'], [2, '#a3e635'], [6, '#facc15'], [12, '#f97316']];
const SNOW_STOPS: Array<[number, string]> = [[0.05, '#93c5fd'], [0.5, '#3b82f6'], [1.5, '#6d28d9'], [3, '#db2777']];

function colorFor(mode: Mode, v: number, colors: Record<RiskLevel, string>): [number, number, number, number] {
  if (mode === 'risk') {
    const lo = Math.floor(Math.max(0, Math.min(3, v))), hi = Math.min(3, lo + 1);
    const t = Math.max(0, Math.min(1, v - lo));
    const c = lerp(hex(colors[lo as RiskLevel]), hex(colors[hi as RiskLevel]), t);
    return [c[0], c[1], c[2], v < 0.5 ? 120 : 210];
  }
  const stops = mode === 'surface' ? SURFACE_STOPS : SNOW_STOPS;
  if (mode === 'snow' && v < stops[0][0]) return [0, 0, 0, 0];
  for (let k = 0; k < stops.length - 1; k++) {
    if (v <= stops[k + 1][0]) {
      const t = Math.max(0, (v - stops[k][0]) / (stops[k + 1][0] - stops[k][0]));
      const c = lerp(hex(stops[k][1]), hex(stops[k + 1][1]), t);
      return [c[0], c[1], c[2], 215];
    }
  }
  const c = hex(stops[stops.length - 1][1]);
  return [c[0], c[1], c[2], 215];
}

function Legend({ mode }: { mode: Mode }) {
  if (mode === 'risk') return (
    <div className="map-legend">
      <div className="xs" style={{ fontWeight: 700 }}>Ryzyko na drogach</div>
      <div className="scale">{[0, 1, 2, 3].map((l) => <i key={l} className={`lv-${l}`} />)}</div>
      <div className="scale-l"><span>dobre</span><span>uwaga</span><span>trudne</span><span>groźne</span></div>
    </div>
  );
  const stops = mode === 'surface' ? SURFACE_STOPS : SNOW_STOPS;
  return (
    <div className="map-legend">
      <div className="xs" style={{ fontWeight: 700 }}>{mode === 'surface' ? 'Temperatura nawierzchni (szac.)' : 'Opad śniegu (cm/h)'}</div>
      <div style={{ height: 8, borderRadius: 4, marginTop: 6, background: `linear-gradient(90deg, ${stops.map((s) => s[1]).join(',')})` }} />
      <div className="row between" style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, marginTop: 4 }}>
        {stops.filter((_, k) => k % 2 === 0 || k === stops.length - 1).map((s) => <span key={s[0]}>{mode === 'surface' ? `${s[0]}°` : String(s[0]).replace('.', ',')}</span>)}
      </div>
    </div>
  );
}
