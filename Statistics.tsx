import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, BarChart3, Info } from 'lucide-react';
import { useData } from '../lib/store';
import { lastNDays, lastNMonths, lastNWeeks, masteredByMonth, streaks, goalProgress, chStats } from '../lib/stats';
import { addDays, dayKey, fmtHours, fmtKey, fmtMinutes, fmtMonthKey, relativeDays, shortWeekday, weekStartKey, daysBetween } from '../lib/time';
import { methodLabel } from '../lib/constants';
import { achievements } from '../lib/achievements';
import { BarChart, HBars, Heatmap } from '../components/charts';
import { Card, Dot, EmptyState, Segmented } from '../components/ui';
import { AchievementTile, GoalRow } from '../components/bits';

type Range = 'days' | 'weeks' | 'months';

export function Statistics() {
  const { data, d } = useData();
  const p = data.profile;
  const [range, setRange] = useState<Range>('days');
  useEffect(() => { if (location.hash === '#achievements') document.getElementById('achievements')?.scrollIntoView(); }, []);

  const series = useMemo(() => {
    if (range === 'days') return lastNDays(d.byDay, d.today, 7).map((x) => ({ key: x.key, label: x.key === d.today ? 'Today' : shortWeekday(x.key), value: x.minutes, title: fmtKey(x.key, { weekday: true }) }));
    if (range === 'weeks') return lastNWeeks(d.byDay, d.today, p.week_start, 8).map((x) => ({ key: x.key, label: fmtKey(x.key), value: x.minutes, title: `Week of ${fmtKey(x.key, { year: true })}` }));
    return lastNMonths(d.byDay, d.today, 12).map((x) => ({ key: x.key, label: fmtMonthKey(x.key), value: x.minutes, title: fmtMonthKey(x.key, true) }));
  }, [range, d, p.week_start]);
  const target = range === 'days' ? p.daily_goal_min : range === 'weeks' ? p.weekly_goal_min : null;
  const rangeTotal = series.reduce((a, b) => a + b.value, 0);

  const total = data.sessions.reduce((a, s) => a + s.duration_min, 0);
  const st = streaks(d.byDay, d.today, p.streak_min_minutes);
  const activeDays = [...d.byDay.values()].filter((v) => v > 0).length;
  const firstDay = data.sessions.length ? dayKey(data.sessions[data.sessions.length - 1].started_at, d.tz) : null;

  // range-limited breakdowns
  const [bdRange, setBdRange] = useState<'30' | '90' | 'all'>('30');
  const since = bdRange === 'all' ? '0000' : addDays(d.today, -(Number(bdRange) - 1));
  const inRange = data.sessions.filter((s) => dayKey(s.started_at, d.tz) >= since);
  const bySubject = data.subjects.map((s) => {
    const mins = inRange.filter((x) => x.subject_id === s.id).reduce((a, x) => a + x.duration_min, 0);
    const pctOf = rangeOf(inRange);
    return { id: s.id, label: s.name, value: mins, color: s.color, sub: pctOf ? `${Math.round((mins / pctOf) * 100)}%` : undefined };
  }).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const byMethod = Object.entries(inRange.reduce<Record<string, number>>((acc, s) => { acc[s.method] = (acc[s.method] ?? 0) + s.duration_min; return acc; }, {}))
    .map(([m, v]) => ({ id: m, label: methodLabel(m as never), value: v, color: 'var(--accent)' })).sort((a, b) => b.value - a.value);
  const byChapter = data.chapters.map((c) => {
    const mins = inRange.filter((x) => x.chapter_id === c.id).reduce((a, x) => a + x.duration_min, 0);
    const s = d.subjectById.get(c.subject_id);
    return { id: c.id, label: c.title, value: mins, color: s?.color ?? '#999', sub: s?.short_code || s?.name };
  }).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);

  // planned vs completed (this week)
  const ws = weekStartKey(d.today, p.week_start);
  const goals = goalProgress(data, d.tz, d.today);

  // neglected chapters
  const neglected = data.chapters
    .filter((c) => c.status !== 'not_started' && c.status !== 'mastered' && !d.subjectById.get(c.subject_id)?.archived)
    .map((c) => ({ c, last: chStats(d.chapterStats, c.id).lastStudied }))
    .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''))
    .slice(0, 6);

  const mastery = masteredByMonth(data.chapters, d.tz, d.today, 6);
  const ach = achievements(data, d.tz, p.streak_min_minutes);

  if (!data.sessions.length) {
    return <Card><EmptyState icon={<BarChart3 size={22} />} title="No statistics yet" text="Statistics are built only from study sessions you record. Log your first session and they’ll appear here." action={<Link className="btn btn-primary" to="/timer">Start studying</Link>} /></Card>;
  }

  return (
    <>
      <div className="cards-4">
        <div className="card stat"><div className="stat-top">Total study time</div><div className="stat-value">{fmtHours(total)}</div><div className="stat-sub">{data.sessions.length} sessions since {firstDay ? fmtKey(firstDay, { year: true }) : '—'}</div></div>
        <div className="card stat"><div className="stat-top">Days studied</div><div className="stat-value">{activeDays}</div><div className="stat-sub">Avg {fmtMinutes(activeDays ? total / activeDays : 0)} on days you study</div></div>
        <div className="card stat"><div className="stat-top">Current streak</div><div className="stat-value">{st.current} <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>days</span></div><div className="stat-sub">Best {st.longest} · {p.streak_min_minutes}+ min/day counts</div></div>
        <div className="card stat"><div className="stat-top">Chapters mastered</div><div className="stat-value">{data.chapters.filter((c) => c.status === 'mastered').length}</div><div className="stat-sub">of {data.chapters.length} chapters entered</div></div>
      </div>

      <div className="dash-grid" style={{ marginTop: 14 }}>
        <div className="col">
          <Card title="Study time" action={<Segmented<Range> value={range} onChange={setRange} options={[{ value: 'days', label: '7 days' }, { value: 'weeks', label: '8 weeks' }, { value: 'months', label: '12 months' }]} />}>
            <div className="muted small" style={{ marginBottom: 10 }}>{fmtMinutes(rangeTotal)} in this period{range === 'weeks' ? ` · weeks start ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.week_start]}` : ''}</div>
            <BarChart data={series} target={target} height={220} />
          </Card>

          <Card title="Study calendar · last 26 weeks">
            <Heatmap byDay={d.byDay} today={d.today} weekStart={p.week_start} />
          </Card>

          <Card title="Where your time goes" action={<Segmented value={bdRange} onChange={setBdRange} options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: 'all', label: 'All time' }]} />}>
            {bySubject.length ? (
              <div className="cards-2" style={{ gap: 24 }}>
                <div><div className="field-label" style={{ marginBottom: 10 }}>By subject</div><HBars items={bySubject} /></div>
                <div><div className="field-label" style={{ marginBottom: 10 }}>By method</div><HBars items={byMethod} /></div>
              </div>
            ) : <p className="muted small">No study in this period.</p>}
            {byChapter.length > 0 && <><div className="field-label" style={{ margin: '22px 0 10px' }}>Top chapters</div><HBars items={byChapter} /></>}
            <div className="notice plain" style={{ marginTop: 18 }}><Info size={16} /><div className="small">More time doesn’t automatically mean better understanding. Compare these totals with your confidence ratings and practice accuracy.</div></div>
          </Card>
        </div>

        <div className="col">
          <Card title={`Planned vs done · week of ${fmtKey(ws)}`} action={<Link to="/settings#goals" className="card-link">Edit goals</Link>}>
            {goals.length ? goals.map((g) => <GoalRow key={g.id} g={g} />) : <p className="muted small" style={{ margin: 0 }}>Set daily, weekly or per-subject targets in Settings to compare planned and completed study.</p>}
          </Card>

          <Card title="Chapters mastered over time">
            {mastery.at(-1)!.minutes ? <BarChart data={mastery.map((m) => ({ key: m.key, label: fmtMonthKey(m.key), value: m.minutes, title: `Mastered by end of ${fmtMonthKey(m.key, true)}` }))} format={(v) => String(Math.round(v))} height={160} color="var(--success)" integer />
              : <p className="muted small" style={{ margin: 0 }}>Chapters you mark as Mastered will be counted here.</p>}
          </Card>

          <Card title="Not studied recently">
            {neglected.length ? (
              <div className="list">
                {neglected.map(({ c, last }) => {
                  const s = d.subjectById.get(c.subject_id)!;
                  return (
                    <div key={c.id} className="list-item">
                      <Dot color={s.color} />
                      <div className="li-main"><Link className="li-title" to={`/subjects/${s.id}/chapters/${c.id}`}>{c.title}</Link><span className="li-sub">{s.name}</span></div>
                      <span className={'tag ' + (!last || daysBetween(dayKey(last, d.tz), d.today) >= p.rev_stale_days ? 'warn' : '')}>{last ? relativeDays(dayKey(last, d.tz), d.today) : 'never logged'}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="muted small" style={{ margin: 0 }}>Chapters you’ve started (but not mastered) will be listed here, oldest first.</p>}
          </Card>
        </div>
      </div>

      <div id="achievements" style={{ scrollMarginTop: 80 }}>
        <div className="section-title"><span className="row"><Award size={15} />Achievements</span><span className="muted small" style={{ textTransform: 'none', letterSpacing: 0 }}>{ach.filter((a) => a.earnedOn).length} of {ach.length} earned · based only on your saved study data</span></div>
        <div className="ach-list">{ach.map((a) => <AchievementTile key={a.id} a={a} />)}</div>
      </div>
    </>
  );
}

function rangeOf(sessions: { duration_min: number }[]) { return sessions.reduce((a, s) => a + s.duration_min, 0); }
