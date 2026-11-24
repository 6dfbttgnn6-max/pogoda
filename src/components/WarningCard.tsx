import { useState } from 'react';
import type { ImgwWarning, RiskLevel } from '../types';
import { formatWhen } from '../lib/time';
import { voivodeshipsOf } from '../data/imgw';

export function WarningCard({ w, activeNow, showRegions }: { w: ImgwWarning; activeNow: boolean; showRegions?: boolean }) {
  const [open, setOpen] = useState(false);
  const lv = Math.min(3, w.level + 1) as RiskLevel;
  const regions = showRegions ? voivodeshipsOf(w) : [];
  return (
    <article className={`card warning lv-${lv}`}>
      <h4>{w.event}<span className={`badge lv-${lv}`}>{w.level}° stopień</span>{activeNow && <span className="xs">obowiązuje teraz</span>}</h4>
      <div className="small muted">{formatWhen(w.from)} – {formatWhen(w.to)} · prawdopodobieństwo {w.probability}%</div>
      {regions.length > 0 && <div className="small" style={{ marginTop: 6 }}>Województwa: {regions.join(', ')} · {w.teryt.length} {w.teryt.length === 1 ? 'powiat' : 'powiatów'}</div>}
      {w.text && (
        <p>{open || w.text.length < 180 ? w.text : `${w.text.slice(0, 170).trim()}… `}
          {w.text.length >= 180 && <button className="btn ghost sm" style={{ height: 24, padding: '0 4px', color: 'var(--accent)' }} onClick={() => setOpen(!open)}>{open ? 'zwiń' : 'więcej'}</button>}
        </p>
      )}
      <div className="meta">Źródło: IMGW-PIB · {w.office}</div>
    </article>
  );
}
