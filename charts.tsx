import { useState } from 'react';
import { addDays, fmtKey, fmtMinutes, weekStartKey } from '../lib/time';

export interface BarDatum { key: string; label: string; value: number; title?: string }

/** Simple vertical bar chart with hover values and an optional target line. */
export function BarChart({ data, height = 180, format = fmtMinutes, target, highlightLast = true, color = 'var(--accent)', integer = false }: {
  data: BarDatum[]; height?: number; format?: (v: number) => string; target?: number | null; highlightLast?: boolean; color?: string; integer?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value), target ?? 0);
  const nice = integer ? Math.max(2, Math.ceil(max / 2) * 2) : niceMax(max);
  const ticks = [0, nice / 2, nice];
  return (
    <div className="barchart" style={{ height }}>
      <div className="bc-axis">
        {ticks.slice().reverse().map((t) => <span key={t}>{format(t)}</span>)}
      </div>
      <div className="bc-plot">
        <div className="bc-area">
          {ticks.map((t) => <div key={t} className="bc-grid" style={{ bottom: `${(t / nice) * 100}%` }} />)}
          {target ? <div className="bc-target" style={{ bottom: `${Math.min(100, (target / nice) * 100)}%` }}><span>Goal {format(target)}</span></div> : null}
        </div>
        <div className="bc-bars">
          {data.map((d, i) => {
            const h = (d.value / nice) * 100;
            const last = highlightLast && i === data.length - 1;
            return (
              <div key={d.key} className="bc-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}
                aria-label={`${d.title ?? d.label}: ${format(d.value)}`}>
                {hover === i && <div className="bc-tip"><b>{format(d.value)}</b><span>{d.title ?? d.label}</span></div>}
                <div className="bc-bar-wrap">
                  <div className={'bc-bar' + (last ? ' last' : '') + (d.value === 0 ? ' zero' : '')}
                    style={{ height: d.value ? `max(${h}%, 3px)` : '2px', background: d.value ? (last ? color : undefined) : undefined }} />
                </div>
                <div className="bc-label">{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 60) return Math.ceil(v / 15) * 15 || 15;
  if (v <= 240) return Math.ceil(v / 60) * 60;
  if (v <= 1200) return Math.ceil(v / 120) * 120;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / step) * step;
}

/** Horizontal bars, e.g. time per subject. */
export function HBars({ items, format = fmtMinutes }: { items: { id: string; label: string; value: number; color: string; sub?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbars">
      {items.map((i) => (
        <div key={i.id} className="hbar">
          <div className="hbar-top"><span className="hbar-label">{i.label}</span><span className="hbar-val">{format(i.value)}{i.sub && <span className="muted"> · {i.sub}</span>}</span></div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Calendar heatmap of real logged minutes per day. */
export function Heatmap({ byDay, today, weekStart, weeks = 26 }: { byDay: Map<string, number>; today: string; weekStart: number; weeks?: number }) {
  const first = addDays(weekStartKey(today, weekStart), -7 * (weeks - 1));
  const cols: { key: string; v: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(first, w * 7 + d);
      col.push({ key, v: byDay.get(key) ?? 0, future: key > today });
    }
    cols.push(col);
  }
  const level = (v: number) => (v === 0 ? 0 : v < 30 ? 1 : v < 60 ? 2 : v < 120 ? 3 : 4);
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const months: { i: number; label: string }[] = [];
  cols.forEach((c, i) => {
    const firstOfMonth = c.find((x) => x.key.endsWith('-01') || (i === 0 && x === c[0]));
    if (firstOfMonth) months.push({ i, label: fmtKey(firstOfMonth.key).split(' ')[1] });
  });
  return (
    <div className="heatmap-wrap">
      <div className="heatmap">
        <div className="hm-days">{[0, 1, 2, 3, 4, 5, 6].map((d) => <span key={d}>{d % 2 === 1 ? dayNames[(weekStart + d) % 7] : ''}</span>)}</div>
        <div>
          <div className="hm-months" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
            {cols.map((_, i) => <span key={i}>{months.find((m) => m.i === i)?.label ?? ''}</span>)}
          </div>
          <div className="hm-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
            {cols.map((c, i) => (
              <div key={i} className="hm-col">
                {c.map((x) => (
                  <div key={x.key} className={`hm-cell l${x.future ? 'x' : level(x.v)}`} title={x.future ? '' : `${fmtKey(x.key, { weekday: true, year: true })}: ${x.v ? fmtMinutes(x.v) : 'no study logged'}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hm-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((l) => <div key={l} className={`hm-cell l${l}`} />)}<span>More</span><span className="muted" style={{ marginLeft: 8 }}>(&lt;30m · 30–60m · 1–2h · 2h+)</span></div>
    </div>
  );
}
