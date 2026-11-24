import { useEffect, useMemo, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { ArrowDownUp, BellPlus, Check, Clock, Crosshair, Flag, Info, Loader2, RefreshCw, Route as RouteIcon, Sparkles } from 'lucide-react';
import type { ImgwWarning, LngLat, Place, RiskLevel } from '../types';
import { fetchRoutes, type Route } from '../data/routing';
import { fetchForecast } from '../data/openMeteo';
import { sampleRoute, type RouteSample } from '../lib/geo';
import { loadPowiaty, findPowiat } from '../data/powiaty';
import { bestDeparture, coloredSegments, departureOptions, routeWeather, stretches, type Ctx, type RouteWeather } from '../risk/route';
import { LEVEL_LABEL } from '../risk/engine';
import { formatDuration, formatTime, formatWhen, relativeDay } from '../lib/time';
import type { UserLocation } from '../lib/location';
import { PlaceSearch } from '../components/PlaceSearch';
import { Badge, HAZARD_ICON, LEVEL_COLOR, LEVEL_ICON, temp1 } from '../components/ui';
import { firstSymbolLayer, fitPadding, removeLayers, useMap, useMapEffect } from '../components/MapCanvas';
import { WarningCard } from '../components/WarningCard';
import { RouteProfile } from '../components/RouteProfile';
import { WatchForm } from '../components/WatchForm';
import type { Watch } from '../alerts/store';
import { useStored } from '../lib/store';

interface Props {
  loc: UserLocation;
  onLocate: () => void;
  warnings: ImgwWarning[];
  active: boolean;
  onSaveWatch: (w: Watch) => void;
}

interface Computed {
  routes: Array<{ route: Route; samples: RouteSample[]; ctx: Ctx }>;
}

const myPlace = (loc: UserLocation): Place => ({ name: 'Moja lokalizacja', label: loc.name, lat: loc.lat, lon: loc.lon });

export function RouteView({ loc, onLocate, warnings, active, onSaveWatch }: Props) {
  const [from, setFrom] = useStored<Place | null>('pd.route.from', null);
  const [to, setTo] = useStored<Place | null>('pd.route.to', null);
  const [depart, setDepart] = useState<number | null>(null); // null = teraz
  const [alt, setAlt] = useState(0);
  const [data, setData] = useState<Computed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { dark } = useMap();

  const start = from ?? myPlace(loc);

  useEffect(() => {
    if (!to) { setData(null); return; }
    const ac = new AbortController();
    setBusy(true); setError(null); setSaved(false);
    (async () => {
      const routes = (await fetchRoutes([start.lon, start.lat], [to.lon, to.lat], ac.signal)).slice(0, 3);
      const pw = await loadPowiaty();
      const out = await Promise.all(routes.map(async (route) => {
        const step = Math.max(8, route.distanceKm / 40);
        const samples = sampleRoute(route.coords, route.segDurations, step);
        const forecasts = await fetchForecast(samples.map((s) => ({ lat: s.at[1], lon: s.at[0] })), { days: 3, signal: ac.signal });
        const areas = samples.map((s) => {
          const f = findPowiat(pw, s.at);
          return f ? { teryt: f.properties.t, name: f.properties.n } : null;
        });
        return { route, samples, ctx: { forecasts, areas, warnings } };
      }));
      if (!ac.signal.aborted) { setData({ routes: out }); setAlt(0); }
    })()
      .catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!ac.signal.aborted) setBusy(false); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.lat, start.lon, to?.lat, to?.lon, rev]);

  // Ostrzeżenia mogą dojść później – aktualizuj kontekst bez ponownego liczenia trasy
  const routesCtx = useMemo(() => data?.routes.map((r) => ({ ...r, ctx: { ...r.ctx, warnings } })) ?? [], [data, warnings]);

  const departAt = depart ?? Date.now();
  const weathers = useMemo(() => routesCtx.map((r) => routeWeather(r.samples, departAt, r.ctx)), [routesCtx, departAt]);
  const sel = routesCtx[alt];
  const w = weathers[alt];
  const opts = useMemo(() => (sel ? departureOptions(sel.samples, sel.ctx, Date.now(), 12) : []), [sel]);
  const best = bestDeparture(opts);

  // ---- Mapa ----
  useMapEffect((map) => {
    if (!active || !routesCtx.length || !w) return;
    const colors = LEVEL_COLOR[dark ? 'dark' : 'light'];
    const before = firstSymbolLayer(map);
    const alts = {
      type: 'FeatureCollection' as const,
      features: routesCtx.map((r, k) => ({ type: 'Feature' as const, properties: { k }, geometry: { type: 'LineString' as const, coordinates: r.route.coords } })).filter((f) => f.properties.k !== alt),
    };
    map.addSource('rt-alts', { type: 'geojson', data: alts });
    map.addSource('rt-main', { type: 'geojson', data: coloredSegments(sel.route.coords, w), lineMetrics: false });
    map.addLayer({ id: 'rt-alts', type: 'line', source: 'rt-alts', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#475569' : '#94a3b8', 'line-width': 5, 'line-opacity': 0.8 } }, before);
    map.addLayer({ id: 'rt-casing', type: 'line', source: 'rt-main', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#020617' : '#ffffff', 'line-width': 10 } }, before);
    map.addLayer({
      id: 'rt-main', type: 'line', source: 'rt-main', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'level'], 1, colors[1], 2, colors[2], 3, colors[3], colors[0]], 'line-width': 6 },
    }, before);

    const pinEl = (cls: string, text: string, bg: string) => {
      const el = document.createElement('div'); el.className = `pin ${cls}`; el.style.background = bg;
      const s = document.createElement('span'); s.textContent = text; el.appendChild(s); return el;
    };
    const first = sel.route.coords[0], last = sel.route.coords[sel.route.coords.length - 1];
    const mA = new maplibregl.Marker({ element: pinEl('a', 'A', '#2563eb') }).setLngLat(first).addTo(map);
    const mB = new maplibregl.Marker({ element: pinEl('b', 'B', '#0f172a') }).setLngLat(last).addTo(map);

    const popup = new maplibregl.Popup({ closeButton: false, offset: 10 });
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
      let bestK = 0, bestD = Infinity;
      w.samples.forEach((s, k) => { const d = (s.sample.at[0] - p[0]) ** 2 + (s.sample.at[1] - p[1]) ** 2; if (d < bestD) { bestD = d; bestK = k; } });
      const s = w.samples[bestK];
      const div = document.createElement('div');
      div.innerHTML = `<div class="xs">km ${Math.round(s.sample.distKm)} · ${relativeDay(s.at)} ${formatTime(s.at)}</div>
        <div style="font-weight:700;margin:2px 0">${s.risk.headline}</div>
        <div class="small muted">Powietrze ${temp1(s.temp)} · nawierzchnia ${temp1(s.risk.surfaceTemp)}</div>
        ${s.area ? `<div class="xs" style="margin-top:2px">${s.area}</div>` : ''}`;
      popup.setLngLat(s.sample.at).setDOMContent(div).addTo(map);
    };
    const onAlt = (e: maplibregl.MapLayerMouseEvent) => { const k = e.features?.[0]?.properties?.k; if (k != null) setAlt(Number(k)); };
    map.on('click', 'rt-main', onClick);
    map.on('click', 'rt-alts', onAlt);
    const enter = () => (map.getCanvas().style.cursor = 'pointer');
    const leave = () => (map.getCanvas().style.cursor = '');
    map.on('mouseenter', 'rt-main', enter); map.on('mouseleave', 'rt-main', leave);
    map.on('mouseenter', 'rt-alts', enter); map.on('mouseleave', 'rt-alts', leave);

    return () => {
      map.off('click', 'rt-main', onClick); map.off('click', 'rt-alts', onAlt);
      map.off('mouseenter', 'rt-main', enter); map.off('mouseleave', 'rt-main', leave);
      map.off('mouseenter', 'rt-alts', enter); map.off('mouseleave', 'rt-alts', leave);
      popup.remove(); mA.remove(); mB.remove();
      removeLayers(map, ['rt-main', 'rt-casing', 'rt-alts'], ['rt-main', 'rt-alts']);
    };
  }, [active, routesCtx, w, alt, dark]);

  // Dopasowanie widoku do trasy tylko przy nowej trasie/wariancie
  const { map } = useMap();
  useEffect(() => {
    if (!map || !active || !sel) return;
    const b = new maplibregl.LngLatBounds();
    sel.route.coords.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: fitPadding(60), duration: 800, maxZoom: 11 });
  }, [map, active, sel]);

  const swap = () => { const a = from, b = to; setFrom(b); setTo(a ?? myPlace(loc)); };

  return (
    <div className="stack">
      <div className="route-form">
        <div className="rail" />
        <PlaceSearch value={from} onChange={setFrom} placeholder="Moja lokalizacja" near={loc}
          icon={<span style={{ width: 12, height: 12, borderRadius: 6, border: '3px solid var(--accent)', display: 'block' }} />}
          extra={[{ label: 'Moja lokalizacja', icon: <Crosshair size={16} />, onPick: () => { setFrom(null); onLocate(); } }]} />
        <PlaceSearch value={to} onChange={setTo} placeholder="Dokąd jedziesz?" near={loc} icon={<Flag size={16} />} autoFocus={!to && active} />
        <button className="icon-btn swap" aria-label="Zamień start i cel" onClick={swap}><ArrowDownUp size={16} /></button>
      </div>

      <div className="chips" role="group" aria-label="Godzina wyjazdu">
        <button className="chip" aria-pressed={depart == null} onClick={() => setDepart(null)}>Teraz</button>
        {[1, 2, 3].map((h) => {
          const at = Math.ceil(Date.now() / 3_600_000) * 3_600_000 + (h - 1) * 3_600_000;
          return <button key={h} className="chip" aria-pressed={depart === at} onClick={() => setDepart(at)}>{formatTime(at)}</button>;
        })}
        <label className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingRight: 4 }} aria-pressed={depart != null && depart > Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 2 * 3_600_000}>
          <Clock size={14} />
          <select aria-label="Inna godzina wyjazdu" style={{ border: 0, background: 'transparent', fontSize: 13, fontWeight: 600, color: 'inherit' }}
            value={depart != null && depart > Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 2 * 3_600_000 ? String(depart) : ''}
            onChange={(e) => setDepart(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Później…</option>
            {Array.from({ length: 33 }, (_, k) => Math.ceil(Date.now() / 3_600_000) * 3_600_000 + (k + 3) * 3_600_000).map((at) => (
              <option key={at} value={at}>{formatWhen(at)}</option>
            ))}
          </select>
        </label>
      </div>

      {!to && !busy && (
        <div className="empty">
          <div className="ico"><RouteIcon size={26} /></div>
          <h3>Sprawdź warunki na trasie</h3>
          <p className="small">Podaj cel podróży. Pokażemy oblodzenie, opady i mgłę dokładnie tam i wtedy, gdzie będziesz w drodze, oraz najlepszą godzinę wyjazdu.</p>
        </div>
      )}

      {busy && (
        <>
          <div className="note"><Loader2 size={16} className="spin" /> Wyznaczam trasę i pobieram prognozę dla punktów na drodze…</div>
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 110 }} />
        </>
      )}

      {error && !busy && (
        <>
          <div className="note error"><Info size={16} /><div><b>Nie udało się przygotować trasy.</b><br />{error}</div></div>
          <button className="btn" onClick={() => setRev((r) => r + 1)}><RefreshCw size={16} /> Spróbuj ponownie</button>
        </>
      )}

      {!busy && !error && sel && w && (
        <RouteResult
          w={w} route={sel.route} departAt={departAt} isNow={depart == null}
          alts={routesCtx.map((r, k) => ({ route: r.route, w: weathers[k] }))} alt={alt} setAlt={setAlt}
          opts={opts} best={best} onPickDepart={(at) => setDepart(Math.abs(at - Date.now()) < 60_000 ? null : at)}
          warnings={warnings}
        />
      )}

      {!busy && !error && sel && w && to && (
        saving ? (
          <WatchForm
            defaultName={`${start.name === 'Moja lokalizacja' ? loc.name : start.name} → ${to.name}`}
            departAt={departAt}
            onCancel={() => setSaving(false)}
            onSave={(partial) => {
              onSaveWatch({
                ...partial, id: crypto.randomUUID(), kind: 'route', enabled: true,
                points: sel.samples.map((s, k) => ({ lat: s.at[1], lon: s.at[0], eta: s.etaSec, teryt: sel.ctx.areas[k]?.teryt ?? null })).filter((_, k, a) => a.length <= 25 || k % Math.ceil(a.length / 25) === 0 || k === a.length - 1),
              });
              setSaving(false); setSaved(true);
            }}
          />
        ) : (
          <button className="btn block" onClick={() => setSaving(true)} disabled={saved}>
            {saved ? <><Check size={16} /> Trasa dodana do powiadomień</> : <><BellPlus size={16} /> Powiadamiaj mnie przed wyjazdem</>}
          </button>
        )
      )}
    </div>
  );
}

function RouteResult({ w, route, departAt, isNow, alts, alt, setAlt, opts, best, onPickDepart, warnings }: {
  w: RouteWeather; route: Route; departAt: number; isNow: boolean;
  alts: Array<{ route: Route; w: RouteWeather }>; alt: number; setAlt: (k: number) => void;
  opts: ReturnType<typeof departureOptions>; best: ReturnType<typeof bestDeparture>;
  onPickDepart: (at: number) => void; warnings: ImgwWarning[];
}) {
  const Icon = LEVEL_ICON[w.max];
  const worst = w.samples.reduce((b, s) => (s.risk.level > b.risk.level ? s : b), w.samples[0]);
  const arrive = departAt + route.durationSec * 1000;
  const list = stretches(w).filter((s) => s.level > 0);
  const teryts = new Set(w.samples.map((s) => s.teryt).filter(Boolean) as string[]);
  const routeWarnings = warnings.filter((x) => x.to > departAt && x.from < arrive && x.teryt.some((t) => teryts.has(t)));
  const currentOpt = opts.find((o) => Math.abs(o.at - departAt) < 60_000);
  const betterLater = best && currentOpt && best.max < currentOpt.max;

  return (
    <>
      <section className={`card hero lv-${w.max}`}>
        <div className="hero-band band" />
        <div className="hero-top">
          <div className="hero-icon tint"><Icon size={26} /></div>
          <div className="grow">
            <div className="hero-loc">Wyjazd {isNow ? 'teraz' : formatWhen(departAt)}</div>
            <h2>{w.max === 0 ? 'Dobre warunki na całej trasie' : LEVEL_LABEL[w.max]}</h2>
            <p>{w.max === 0 ? 'Nie przewidujemy oblodzenia ani intensywnych opadów na trasie.' :
              `${worst.risk.headline} ok. ${Math.round(worst.sample.distKm)} km od startu (${formatTime(worst.at)})${worst.area ? `, ${worst.area}` : ''}.`}</p>
          </div>
        </div>
        <div className="metrics">
          <div className="metric"><div className="k">Dystans</div><div className="v">{Math.round(route.distanceKm)}<small>km</small></div></div>
          <div className="metric"><div className="k">Czas jazdy</div><div className="v" style={{ fontSize: 18 }}>{formatDuration(route.durationSec)}</div></div>
          <div className="metric"><div className="k">Przyjazd</div><div className="v">{formatTime(arrive)}</div></div>
        </div>
      </section>

      {betterLater && best && (
        <button className={`note lv-${best.max}`} style={{ textAlign: 'left', cursor: 'pointer', borderColor: 'var(--accent)' }} onClick={() => onPickDepart(best.at)}>
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <div><b style={{ color: 'var(--text)' }}>Lepiej wyjechać {relativeDay(best.at)} o {formatTime(best.at)}</b><br />Warunki: {LEVEL_LABEL[best.max].toLowerCase()} zamiast „{LEVEL_LABEL[currentOpt!.max].toLowerCase()}”. Kliknij, aby sprawdzić.</div>
        </button>
      )}

      {alts.length > 1 && (
        <>
          <div className="section-title"><span>Warianty trasy</span></div>
          <div className="stack" style={{ gap: 8 }}>
            {alts.map((a, k) => (
              <button key={k} className="alt" aria-pressed={k === alt} onClick={() => setAlt(k)}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{formatDuration(a.route.durationSec)} <span className="muted small" style={{ fontWeight: 500 }}>· {Math.round(a.route.distanceKm)} km</span></div>
                  <div className="xs">{k === 0 ? 'Najszybsza' : `Wariant ${k + 1}`}{a.w.max < w.max && k !== alt ? ' · bezpieczniejsza' : ''}</div>
                </div>
                <Badge level={a.w.max} short />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-title"><span>Kiedy najlepiej wyjechać</span></div>
      <div className="card">
        <div className="depart-grid">
          {opts.map((o) => (
            <button key={o.at} className={`depart lv-${o.max}`} aria-pressed={Math.abs(o.at - departAt) < 60_000} onClick={() => onPickDepart(o.at)} title={LEVEL_LABEL[o.max]}>
              <div className="t">{Math.abs(o.at - Date.now()) < 60_000 ? 'Teraz' : formatTime(o.at)}</div>
              <div className="bar" />
              {best && o.at === best.at && <div className="xs" style={{ color: 'var(--accent)', fontWeight: 700, marginTop: 3 }}>najlepiej</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title"><span>Profil trasy</span><span className="xs" style={{ textTransform: 'none', letterSpacing: 0 }}>temperatura w chwili przejazdu</span></div>
      <div className="card" style={{ padding: '12px 12px 8px' }}>
        <RouteProfile w={w} />
      </div>

      <div className="section-title"><span>Co Cię czeka na trasie</span></div>
      <div className="card">
        {list.length === 0 ? <div className="small muted">Brak istotnych zagrożeń na drodze w czasie przejazdu.</div> : list.map((s, k) => {
          const HI = HAZARD_ICON[w.samples.find((x) => x.sample.distKm >= s.fromKm)?.risk.hazards[0]?.kind ?? 'rain'];
          return (
            <div className="segment" key={k}>
              <div className="km">{s.fromKm === s.toKm ? `km ${Math.round(s.fromKm)}` : `${Math.round(s.fromKm)}–${Math.round(s.toKm)}`}</div>
              <div>
                <div className="where row" style={{ gap: 6 }}><HI size={15} style={{ color: `var(--r${s.level})` }} />{s.title}</div>
                <div className="what">{formatTime(s.at)}{s.area ? ` · ${s.area}` : ''}</div>
              </div>
              <Badge level={s.level as RiskLevel} short />
            </div>
          );
        })}
      </div>

      {routeWarnings.length > 0 && (
        <>
          <div className="section-title"><span>Ostrzeżenia IMGW na trasie</span></div>
          {routeWarnings.map((x) => <WarningCard key={x.id} w={x} activeNow={x.from <= Date.now()} />)}
        </>
      )}

      <div className="note"><Info size={16} /><div>Prognoza liczona dla punktów co ok. {Math.round(w.samples[1]?.sample.distKm ?? 10)} km, na przewidywaną godzinę przejazdu. Czas jazdy nie uwzględnia korków ani wolniejszej jazdy w trudnych warunkach.</div></div>
    </>
  );
}
