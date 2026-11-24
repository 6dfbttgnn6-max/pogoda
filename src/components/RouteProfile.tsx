import type { RouteWeather } from '../risk/route';
import { formatTime } from '../lib/time';

/** Wykres: temperatura powietrza i nawierzchni wzdłuż trasy + pasek ryzyka. */
export function RouteProfile({ w }: { w: RouteWeather }) {
  const S = w.samples.filter((s) => Number.isFinite(s.temp));
  if (S.length < 2) return null;
  const W = 360, H = 92, padL = 26, padR = 6, top = 6, bandH = 8, plotB = H - bandH - 18;
  const total = S[S.length - 1].sample.distKm || 1;
  const vals = S.flatMap((s) => [s.temp, s.risk.surfaceTemp]);
  let lo = Math.floor(Math.min(...vals, 0) - 1), hi = Math.ceil(Math.max(...vals, 0) + 1);
  if (hi - lo < 6) { const m = (hi + lo) / 2; lo = Math.floor(m - 3); hi = Math.ceil(m + 3); }
  const x = (km: number) => padL + (km / total) * (W - padL - padR);
  const y = (t: number) => top + ((hi - t) / (hi - lo)) * (plotB - top);
  const path = (f: (s: (typeof S)[number]) => number) => S.map((s, k) => `${k ? 'L' : 'M'}${x(s.sample.distKm).toFixed(1)},${y(f(s)).toFixed(1)}`).join('');
  const minGap = (hi - lo) * 0.18;
  const ticks = [0, lo, hi].filter((v, i, a) => a.indexOf(v) === i && (v === 0 || Math.abs(v) >= minGap));

  return (
    <div className="profile">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Temperatura powietrza i nawierzchni wzdłuż trasy">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--ice)' : 'var(--line)'} strokeDasharray={t === 0 ? '3 3' : undefined} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={padL - 5} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill={t === 0 ? 'var(--ice)' : 'var(--text-3)'} fontWeight={600}>{t}°</text>
          </g>
        ))}
        <path d={path((s) => s.temp)} fill="none" stroke="var(--text)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={path((s) => s.risk.surfaceTemp)} fill="none" stroke="var(--ice)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {S.slice(1).map((s, k) => (
          <rect key={k} x={x(S[k].sample.distKm)} width={Math.max(0.5, x(s.sample.distKm) - x(S[k].sample.distKm) - 0.6)} y={plotB + 6} height={bandH} rx={1.5}
            className={`lv-${Math.max(s.risk.level, S[k].risk.level)}`} fill="var(--c)" />
        ))}
        <text x={padL} y={H - 1} fontSize="9.5" fill="var(--text-3)" fontWeight={600}>start {formatTime(S[0].at)}</text>
        <text x={W - padR} y={H - 1} fontSize="9.5" fill="var(--text-3)" textAnchor="end" fontWeight={600}>cel {formatTime(S[S.length - 1].at)} · {Math.round(total)} km</text>
      </svg>
      <div className="row xs" style={{ gap: 14, marginTop: 4 }}>
        <span className="row" style={{ gap: 5 }}><i style={{ width: 12, height: 2, background: 'var(--text)', display: 'inline-block' }} />powietrze</span>
        <span className="row" style={{ gap: 5, color: 'var(--ice)' }}><i style={{ width: 12, height: 2, background: 'var(--ice)', display: 'inline-block' }} />nawierzchnia (szac.)</span>
      </div>
    </div>
  );
}
