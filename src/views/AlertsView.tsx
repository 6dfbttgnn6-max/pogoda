import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Info, Loader2, MapPin, Route as RouteIcon, Trash2, Smartphone } from 'lucide-react';
import type { ImgwWarning } from '../types';
import { DAY_NAMES, type Watch } from '../alerts/store';
import { checkWatches, nextDeparture, type CheckResult } from '../alerts/check';
import { warningKind, isActive, LEVEL_LABEL } from '../risk/engine';
import { formatWhen } from '../lib/time';
import { Badge } from '../components/ui';
import { WarningCard } from '../components/WarningCard';
import type { UserLocation } from '../lib/location';
import { WatchForm } from '../components/WatchForm';

interface Props {
  watches: Watch[];
  setWatches: (w: Watch[]) => void;
  warnings: ImgwWarning[];
  loc: UserLocation;
}

type Support = { notifications: boolean; periodic: boolean; standalone: boolean; ios: boolean };

function detect(): Support {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    notifications: 'Notification' in window && 'serviceWorker' in navigator,
    periodic: 'serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype,
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    ios,
  };
}

export async function registerPeriodic(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const ps = (reg as unknown as { periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> } }).periodicSync;
    if (!ps) return false;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (st.state !== 'granted') return false;
    await ps.register('road-check', { minInterval: 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}

export function AlertsView({ watches, setWatches, warnings, loc }: Props) {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const [support] = useState(detect);
  const [bg, setBg] = useState(false);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => { if (perm === 'granted') registerPeriodic().then(setBg); }, [perm]);

  const enable = async () => {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('Powiadomienia włączone', { body: 'Ostrzeżemy Cię przed wyjazdem, gdy na trasie będzie ślisko.', icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: 'pd-test' });
    }
  };

  const checkAll = async () => {
    setChecking(true);
    try {
      const r = await checkWatches(watches, Date.now(), true);
      setResults(Object.fromEntries(r.map((x) => [x.watch.id, x])));
    } finally { setChecking(false); }
  };

  const update = (id: string, patch: Partial<Watch>) => setWatches(watches.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const relevant = warnings.filter((w) => warningKind(w) && w.to > Date.now());

  return (
    <div className="stack">
      <section className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="hazard-ico" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{perm === 'granted' ? <BellRing size={18} /> : <Bell size={18} />}</div>
          <div className="grow">
            <b>Powiadomienia przed wyjazdem</b>
            <div className="small muted">
              {perm === 'granted' ? 'Włączone. Sprawdzamy Twoje trasy przed zaplanowanym wyjazdem.'
                : perm === 'denied' ? 'Zablokowane w przeglądarce. Odblokuj je w ustawieniach witryny.'
                : perm === 'unsupported' ? 'Ta przeglądarka nie obsługuje powiadomień.'
                : 'Dostaniesz ostrzeżenie, gdy na Twojej trasie pojawi się gołoledź, śnieg lub mgła.'}
            </div>
          </div>
        </div>
        {perm === 'default' && <button className="btn primary block" style={{ marginTop: 12 }} onClick={enable}><Bell size={16} /> Włącz powiadomienia</button>}
        <div className="note" style={{ marginTop: 12 }}>
          <Smartphone size={16} />
          <div>
            {bg ? 'Sprawdzanie w tle jest aktywne (częstotliwość ustala system, zwykle nie częściej niż co godzinę).'
              : support.ios ? <>Na iPhonie dodaj aplikację do ekranu głównego (Udostępnij → „Do ekranu początk.”). iOS nie pozwala aplikacjom webowym na sprawdzanie w tle bez serwera push, więc alerty działają, gdy aplikacja jest otwarta.</>
              : support.periodic ? <>Zainstaluj aplikację (menu przeglądarki → „Zainstaluj aplikację”), aby włączyć sprawdzanie w tle.</>
              : <>Ta przeglądarka nie wspiera sprawdzania w tle. Alerty pojawią się, gdy aplikacja jest otwarta.</>}
          </div>
        </div>
      </section>

      <div className="section-title">
        <span>Moje trasy i miejsca</span>
        {watches.length > 0 && <button className="btn ghost sm" onClick={checkAll} disabled={checking}>{checking ? <Loader2 size={14} className="spin" /> : null} Sprawdź teraz</button>}
      </div>

      {watches.length === 0 && !adding && (
        <div className="empty">
          <div className="ico"><BellOff size={26} /></div>
          <h3>Brak zapisanych tras</h3>
          <p className="small">Wyznacz trasę w zakładce „Trasa” i wybierz „Powiadamiaj mnie przed wyjazdem” albo dodaj swoją lokalizację.</p>
        </div>
      )}

      {watches.map((w) => {
        const next = nextDeparture(w);
        const r = results[w.id];
        return (
          <article key={w.id} className="card" style={{ opacity: w.enabled ? 1 : 0.6 }}>
            <div className="row">
              <div className="hazard-ico" style={{ background: 'var(--bg-sunken)', color: 'var(--text-2)' }}>{w.kind === 'route' ? <RouteIcon size={18} /> : <MapPin size={18} />}</div>
              <div className="grow">
                <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</b>
                <div className="xs">{String(w.hour).padStart(2, '0')}:{String(w.minute).padStart(2, '0')} · {[1, 2, 3, 4, 5, 6, 0].filter((d) => w.days.includes(d)).map((d) => DAY_NAMES[d]).join(', ')} · od poziomu „{LEVEL_LABEL[w.threshold].toLowerCase()}”</div>
              </div>
              <label className="switch" aria-label="Włącz/wyłącz"><input type="checkbox" checked={w.enabled} onChange={(e) => update(w.id, { enabled: e.target.checked })} /><span /></label>
            </div>
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="small muted">{next ? `Najbliższy wyjazd: ${formatWhen(next)}` : 'Brak zaplanowanych wyjazdów'}</span>
              <button className="icon-btn" aria-label="Usuń" onClick={() => setWatches(watches.filter((x) => x.id !== w.id))}><Trash2 size={15} /></button>
            </div>
            {r && (
              <div className={`note lv-${r.level}`} style={{ marginTop: 10, background: 'var(--cs)', color: 'var(--text)' }}>
                <Badge level={r.level} short />
                <div>{r.level === 0 ? 'Dobre warunki w czasie przejazdu.' : `${r.headline}, ok. ${formatWhen(r.worstAt)}.`}</div>
              </div>
            )}
          </article>
        );
      })}

      {adding ? (
        <WatchForm defaultName={`Wyjazd z: ${loc.name}`} departAt={Date.now() + 3_600_000} onCancel={() => setAdding(false)}
          onSave={(p) => { setWatches([...watches, { ...p, id: crypto.randomUUID(), kind: 'place', enabled: true, points: [{ lat: loc.lat, lon: loc.lon, eta: 0 }] }]); setAdding(false); }} />
      ) : (
        <button className="btn block" onClick={() => setAdding(true)}><MapPin size={16} /> Dodaj alert dla: {loc.name}</button>
      )}

      <div className="section-title"><span>Ostrzeżenia IMGW w Polsce</span><span className="xs" style={{ textTransform: 'none', letterSpacing: 0 }}>dla kierowców</span></div>
      {relevant.length === 0 ? <div className="note"><Info size={16} /> Obecnie brak ostrzeżeń IMGW dotyczących dróg.</div>
        : relevant.map((w) => <WarningCard key={w.id} w={w} activeNow={isActive(w, Date.now())} showRegions />)}
    </div>
  );
}
