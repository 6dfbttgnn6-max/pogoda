import { useState } from 'react';
import { Check, CircleDot, Clock, CloudFog, CloudRain, Eraser, Fuel, Lightbulb, Link2, Package, Scale, Snowflake, SprayCan, Wind } from 'lucide-react';
import type { Advice, AdviceIcon } from '../risk/advice';

const ICON: Record<AdviceIcon, typeof Snowflake> = {
  chains: Link2, tyre: CircleDot, washer: SprayCan, scraper: Eraser, ice: Snowflake, fog: CloudFog,
  wind: Wind, kit: Package, clock: Clock, lights: Lightbulb, fuel: Fuel, rain: CloudRain,
};

/** Lista kontrolna przed wyjazdem. Zaznaczenia są tylko lokalne (pomoc w przygotowaniu). */
export function AdviceCard({ items }: { items: Advice[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 4);
  const toggle = (id: string) => setDone((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="card advice-list">
      {shown.map((a) => {
        const I = ICON[a.icon];
        const ok = done.has(a.id);
        return (
          <div key={a.id} className={`advice lv-${a.level}`} data-done={ok || undefined}>
            <button className="advice-check" aria-pressed={ok} aria-label={ok ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'} onClick={() => toggle(a.id)}>
              {ok ? <Check size={14} strokeWidth={3} /> : null}
            </button>
            <div className="grow">
              <div className="advice-title"><I size={15} className="advice-ico" />{a.title}</div>
              <div className="advice-text">{a.text}</div>
              {a.law && <div className="advice-law"><Scale size={13} /><span>{a.law}</span></div>}
            </div>
          </div>
        );
      })}
      {items.length > 4 && (
        <button className="btn ghost sm block" style={{ marginTop: 6, color: 'var(--accent)' }} onClick={() => setAll(!all)}>
          {all ? 'Pokaż mniej' : `Pokaż wszystkie (${items.length})`}
        </button>
      )}
      <div className="xs" style={{ marginTop: 8 }}>Wskazówki mają charakter informacyjny i nie stanowią porady prawnej.</div>
    </div>
  );
}
