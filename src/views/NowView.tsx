import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Crosshair, Info, Loader2, MapPin, RefreshCw, Thermometer, Wind, Navigation } from 'lucide-react';
import type { ImgwWarning, RiskLevel } from '../types';
import { fetchForecast, hourIndex } from '../data/openMeteo';
import { applyWarnings, assessSeries, isActive, LEVEL_LABEL, maxLevel, warningKind } from '../risk/engine';
import { useAsync } from '../lib/store';
import type { UserLocation } from '../lib/location';
import { dayKey, dayLabel, formatTime, formatWeekday, formatWhen, relativeDay } from '../lib/time';
import { PlaceSearch } from '../components/PlaceSearch';
import { HAZARD_ICON, LEVEL_ICON, temp, temp1 } from '../components/ui';
import { useMapEffect } from '../components/MapCanvas';
import { WarningCard } from '../components/WarningCard';

interface Props {
  loc: UserLocation;
  locStatus: string;
  onLocate: () => void;
  onPick: (p: { name: string; label: string; lat: number; lon: number }) => void;
  warnings: ImgwWarning[];
  active: boolean;
}

export function NowView({ loc, locStatus, onLocate, onPick, warnings, active }: Props) {
  const fc = useAsync((s) => fetchForecast([{ lat: loc.lat, lon: loc.lon }], { days: 3, signal: s }).then((r) => r[0]), [loc.lat, loc.lon]);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [loc.lat, loc.lon]);

  const view = useMemo(() => {
    if (!fc.data) return null;
    const hours = fc.data.hours;
    const risks = assessSeries(hours).map((r, i) => applyWarnings(r, warnings, hours[i].time));
    const now = hourIndex(hours, Date.now());
    return { hours, risks, now };
  }, [fc.data, warnings]);

  // Znacznik lokalizacji na mapie (desktop)
  const marker = useRef<maplibregl.Marker | null>(null);
  useMapEffect((map) => {
    const el = document.createElement('div');
    el.className = 'loc-dot';
    marker.current = new maplibregl.Marker({ element: el }).setLngLat([loc.lon, loc.lat]).addTo(map);
    if (active) map.flyTo({ center: [loc.lon, loc.lat], zoom: 9, duration: 900 });
    return () => { marker.current?.remove(); };
  }, [loc.lat, loc.lon, active]);

  const search = (
    <PlaceSearch
      value={loc.source === 'default' ? null : loc}
      onChange={(p) => p && onPick(p)}
      placeholder="Szukaj miejscowości lub adresu"
      icon={<MapPin size={18} />}
      extra={[{ label: 'Użyj mojej lokalizacji', icon: <Crosshair size={16} />, onPick: onLocate }]}
    />
  );

  if (fc.error) {
    return (
      <div className="stack">
        {search}
        <div className="note error"><Info size={16} /><div><b>Nie udało się pobrać prognozy.</b><br />{fc.error}</div></div>
        <button className="btn" onClick={fc.reload}><RefreshCw size={16} /> Spróbuj ponownie</button>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="stack">
        {search}
        <div className="skeleton" style={{ height: 196 }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  const { hours, risks, now } = view;
  const i = sel ?? now;
  const h = hours[i];
  const r = risks[i];
  const Icon = LEVEL_ICON[r.level];

  // Najgorszy moment w ciągu najbliższych 12 h
  let worst = now;
  for (let k = now; k < Math.min(hours.length, now + 13); k++) if (risks[k].level > risks[worst].level) worst = k;
  const upcoming = risks[worst].level > risks[now].level
    ? `Pogorszenie ${relativeDay(hours[worst].time)} ok. ${formatTime(hours[worst].time)}. ${risks[worst].headline}.`
    : risks[now].level === 0 ? 'W ciągu 12 godzin bez istotnych zagrożeń na drodze.' : r.hazards[0]?.detail;

  const timeline = hours.slice(now, now + 48).map((x, k) => ({ x, r: risks[now + k], idx: now + k }));
  const days = groupDays(hours, risks, now);
  const localWarnings = warnings.filter((w) => w.to > Date.now() && warningKind(w));

  return (
    <div className="stack">
      {search}
      {locStatus === 'locating' && <div className="note"><Loader2 size={16} className="spin" /> Ustalam lokalizację…</div>}
      {locStatus === 'denied' && <div className="note"><Navigation size={16} /> Brak zgody na lokalizację. Wyszukaj miejsce ręcznie lub zezwól w ustawieniach przeglądarki.</div>}

      <section className={`card hero lv-${r.level}`} aria-live="polite">
        <div className="hero-band band" />
        <div className="hero-top">
          <div className="hero-icon tint"><Icon size={26} /></div>
          <div className="grow">
            <div className="hero-loc"><MapPin size={13} /> {loc.name}{loc.label ? ` · ${loc.label}` : ''}</div>
            <h2>{sel == null ? LEVEL_LABEL[r.level] : `${LEVEL_LABEL[r.level]} · ${formatWhen(h.time)}`}</h2>
            <p>{sel == null ? upcoming : r.headline}</p>
          </div>
        </div>
        <div className="metrics">
          <div className="metric"><div className="k"><Thermometer size={12} /> Powietrze</div><div className="v">{temp1(h.temp)}</div></div>
          <div className="metric"><div className="k" title="Szacunek na podstawie temperatury gruntu z modelu"><Thermometer size={12} /> Nawierzchnia*</div><div className="v" style={{ color: r.surfaceTemp <= 0 ? 'var(--ice)' : undefined }}>{temp1(r.surfaceTemp)}</div></div>
          <div className="metric"><div className="k"><Wind size={12} /> Porywy</div><div className="v">{Math.round(h.windGust)}<small>km/h</small></div></div>
        </div>
      </section>

      {r.hazards.length > 0 && (
        <section className="card">
          {r.hazards.map((z) => {
            const HI = HAZARD_ICON[z.kind];
            return (
              <div className="hazard" key={z.kind + z.title}>
                <div className={`hazard-ico tint lv-${z.level}`}><HI size={18} /></div>
                <div><b>{z.title}</b><span>{z.detail}</span></div>
              </div>
            );
          })}
        </section>
      )}

      <div className="section-title"><span>Najbliższe 48 godzin</span>{sel != null && <button className="btn ghost sm" onClick={() => setSel(null)}>Teraz</button>}</div>
      <div className="card" style={{ padding: '8px 6px' }}>
        <div className="timeline" role="listbox" aria-label="Prognoza godzinowa">
          {timeline.map(({ x, r: rr, idx }, k) => {
            const newDay = k > 0 && dayKey(x.time) !== dayKey(timeline[k - 1].x.time);
            return (
              <FragmentWithSep key={idx} sep={newDay}>
                <button className={`hour lv-${rr.level}`} aria-pressed={idx === i} onClick={() => setSel(idx === now ? null : idx)}
                  title={`${formatWhen(x.time)} – ${rr.headline}`}>
                  <span className="t" style={newDay ? { color: 'var(--accent)' } : undefined}>{k === 0 ? 'Teraz' : newDay ? formatWeekday(x.time).replace('.', '') : formatTime(x.time).slice(0, 2)}</span>
                  <span className="bar" />
                  <span className="temp">{temp(x.temp)}</span>
                  <span className="ts">{temp(rr.surfaceTemp)}</span>
                </button>
              </FragmentWithSep>
            );
          })}
        </div>
        <div className="row xs" style={{ padding: '4px 10px 2px', gap: 14 }}>
          <span>Górna: powietrze</span><span style={{ color: 'var(--ice)' }}>Dolna: nawierzchnia (szac.)</span>
        </div>
      </div>

      <div className="section-title"><span>Kolejne dni</span></div>
      <div className="days">
        {days.map((d) => (
          <div className="day" key={d.key}>
            <span className="name">{d.label}</span>
            <div className="risk-strip" title={`Najgorzej: ${LEVEL_LABEL[d.max]}`}>
              {d.levels.map((l, k) => <i key={k} className={`lv-${l}`} />)}
            </div>
            <span className="range">{temp(d.max_t)}<span className="lo">{temp(d.min_t)}</span></span>
          </div>
        ))}
      </div>

      <div className="section-title"><span>Ostrzeżenia IMGW dla kierowców</span></div>
      {localWarnings.length === 0 ? (
        <div className="note"><Info size={16} /> Brak aktywnych ostrzeżeń IMGW dotyczących dróg w tym powiecie.</div>
      ) : localWarnings.map((w) => <WarningCard key={w.id} w={w} activeNow={isActive(w, Date.now())} />)}

      <div className="note"><Info size={16} /><div>
        * Temperatura nawierzchni i ocena ryzyka są <b>szacunkiem</b> na podstawie modeli pogodowych (temperatura gruntu, opad, wilgotność, zachmurzenie). Nie zastępują obserwacji drogi. Mosty, wiadukty i odcinki w lesie mogą być bardziej śliskie.
      </div></div>
    </div>
  );
}

function FragmentWithSep({ sep, children }: { sep: boolean; children: React.ReactNode }) {
  return <>{sep && <div className="day-sep" />}{children}</>;
}

function groupDays(hours: { time: number; temp: number }[], risks: { level: RiskLevel }[], from: number) {
  const map = new Map<string, { key: string; label: string; levels: RiskLevel[]; min_t: number; max_t: number; max: RiskLevel }>();
  for (let k = from; k < hours.length; k++) {
    const key = dayKey(hours[k].time);
    let d = map.get(key);
    if (!d) { d = { key, label: dayLabel(hours[k].time), levels: [], min_t: Infinity, max_t: -Infinity, max: 0 }; map.set(key, d); }
    d.levels.push(risks[k].level);
    d.min_t = Math.min(d.min_t, hours[k].temp);
    d.max_t = Math.max(d.max_t, hours[k].temp);
  }
  return [...map.values()].filter((d) => d.levels.length >= 6).map((d) => ({ ...d, max: maxLevel(d.levels) })).slice(0, 3);
}
