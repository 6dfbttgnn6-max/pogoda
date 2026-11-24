import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import type { Place } from '../types';
import { searchPlaces } from '../data/geocode';

interface Props {
  value: Place | null;
  onChange: (p: Place | null) => void;
  placeholder: string;
  icon?: React.ReactNode;
  near?: { lat: number; lon: number };
  extra?: Array<{ label: string; icon: React.ReactNode; onPick: () => void }>;
  autoFocus?: boolean;
}

export function PlaceSearch({ value, onChange, placeholder, icon, near, extra = [], autoFocus }: Props) {
  const [q, setQ] = useState(value?.name ?? '');
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(value?.name ?? ''), [value]);

  useEffect(() => {
    if (!open || q.trim().length < 2 || q === value?.name) { setItems([]); return; }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try { setItems(await searchPlaces(q, ac.signal, near)); setActive(0); }
      catch { /* przerwane lub brak sieci */ }
      finally { setBusy(false); }
    }, 220);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, open, near, value?.name]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (p: Place) => { onChange(p); setQ(p.name); setOpen(false); };
  const showExtra = open && q.trim().length < 2 && extra.length > 0;

  return (
    <div className="field" ref={box}>
      <span className="lead">{icon ?? <Search size={18} />}</span>
      <input
        className="input"
        value={q}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && items[active]) { e.preventDefault(); pick(items[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <span className="trail">
        {busy ? <span className="icon-btn" style={{ border: 0, background: 'transparent' }}><Loader2 size={16} className="spin" /></span>
          : q ? <button className="icon-btn" style={{ border: 0, background: 'transparent' }} aria-label="Wyczyść" onClick={() => { setQ(''); onChange(null); setOpen(true); }}><X size={16} /></button> : null}
      </span>
      {(open && items.length > 0) || showExtra ? (
        <div className="suggest" id={listId} role="listbox">
          {showExtra && extra.map((x) => (
            <button key={x.label} type="button" onClick={() => { x.onPick(); setOpen(false); }}>
              <span style={{ color: 'var(--accent)', display: 'grid' }}>{x.icon}</span><span><b>{x.label}</b></span>
            </button>
          ))}
          {items.map((p, i) => (
            <button key={`${p.lat},${p.lon},${i}`} type="button" role="option" aria-selected={i === active}
              onMouseEnter={() => setActive(i)} onClick={() => pick(p)}>
              <MapPin size={16} style={{ color: 'var(--text-3)', flex: 'none' }} />
              <span><b>{p.name}</b>{p.label && <small>{p.label}</small>}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
