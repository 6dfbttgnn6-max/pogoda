import { useState } from 'react';
import { DAY_NAMES, type Watch } from '../alerts/store';
import { warsawHour } from '../lib/time';

type Partial = Pick<Watch, 'name' | 'hour' | 'minute' | 'days' | 'leadMin' | 'threshold'>;

export function WatchForm({ defaultName, departAt, onSave, onCancel }: { defaultName: string; departAt: number; onSave: (p: Partial) => void; onCancel: () => void }) {
  const [name, setName] = useState(defaultName);
  const [time, setTime] = useState(() => `${String(warsawHour(departAt)).padStart(2, '0')}:${String(new Date(departAt).getMinutes()).padStart(2, '0')}`);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [threshold, setThreshold] = useState<1 | 2 | 3>(2);
  const [lead, setLead] = useState(90);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); const [h, m] = time.split(':').map(Number); onSave({ name, hour: h, minute: m, days, leadMin: lead, threshold }); }}>
      <b>Powiadomienie przed wyjazdem</b>
      <label className="stack" style={{ gap: 4 }}><span className="xs">Nazwa</span>
        <input className="input" style={{ paddingLeft: 14 }} value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <div className="row" style={{ gap: 10 }}>
        <label className="stack grow" style={{ gap: 4 }}><span className="xs">Godzina wyjazdu</span>
          <input className="input" style={{ paddingLeft: 14 }} type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
        <label className="stack grow" style={{ gap: 4 }}><span className="xs">Ostrzeż wcześniej</span>
          <select className="input" style={{ paddingLeft: 14 }} value={lead} onChange={(e) => setLead(Number(e.target.value))}>
            <option value={30}>30 min</option><option value={60}>1 h</option><option value={90}>1,5 h</option><option value={120}>2 h</option><option value={180}>3 h</option>
          </select></label>
      </div>
      <div className="stack" style={{ gap: 4 }}><span className="xs">Dni</span>
        <div className="chips">{order.map((d) => (
          <button type="button" key={d} className="chip" aria-pressed={days.includes(d)} onClick={() => setDays((x) => x.includes(d) ? x.filter((y) => y !== d) : [...x, d])}>{DAY_NAMES[d]}</button>
        ))}</div></div>
      <div className="stack" style={{ gap: 4 }}><span className="xs">Powiadamiaj, gdy warunki są co najmniej</span>
        <div className="chips">{([1, 2, 3] as const).map((t) => (
          <button type="button" key={t} className="chip" aria-pressed={threshold === t} onClick={() => setThreshold(t)}>{t === 1 ? 'Uwaga' : t === 2 ? 'Trudne' : 'Niebezpieczne'}</button>
        ))}</div></div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onCancel}>Anuluj</button>
        <button type="submit" className="btn primary" disabled={!days.length}>Zapisz</button>
      </div>
    </form>
  );
}
