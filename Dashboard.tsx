import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, CheckCircle2, Clock3, Flame, Plus, Play, RotateCcw, Target, TrendingUp, Award } from 'lucide-react';
import { useData } from '../lib/store';
import { lastNDays, minutesInRange, streaks, goalProgress } from '../lib/stats';
import { addDays, fmtKey, fmtMinutes, shortWeekday, weekStartKey } from '../lib/time';
import { revisionItems, REASON_LABEL } from '../lib/revision';
import { achievements } from '../lib/achievements';
import { MAX_SUBJECTS } from '../lib/constants';
import { BarChart } from '../components/charts';
import { Card, Dot, EmptyState, Progress, Ring } from '../components/ui';
import { AchievementTile, ExamRow, GoalRow, SessionRow } from '../components/bits';
import { SubjectForm } from '../components/SubjectForm';
import { SessionForm } from '../components/SessionForm';
import { useStudyTimer } from '../lib/useTimer';

export function Dashboard() {
  const { data, d } = useData();
  const p = data.profile;
  const nav = useNavigate();
  const { timer } = useStudyTimer();
  const [addSubject, setAddSubject] = useState(false);
  const [logSession, setLogSession] = useState(false);

  const subjects = d.activeSubjects;
  const activeIds = new Set(subjects.map((s) => s.id));
  const chapters = data.chapters.filter((c) => activeIds.has(c.subject_id));
  const mastered = chapters.filter((c) => c.status === 'mastered').length;
  const pct = chapters.length ? Math.round((mastered / chapters.length) * 100) : 0;
  const todayMin = d.byDay.get(d.today) ?? 0;
  const ws = weekStartKey(d.today, p.week_start);
  const weekMin = minutesInRange(d.byDay, ws, addDays(ws, 6));
  const last7 = lastNDays(d.byDay, d.today, 7);
  const st = streaks(d.byDay, d.today, p.streak_min_minutes);
  const upcoming = data.exams.filter((e) => e.exam_date >= d.today).sort((a, b) => a.exam_date.localeCompare(b.exam_date)).slice(0, 4);
  const revision = useMemo(() => revisionItems(data.chapters, data.subjects, d.chapterStats, p, d.tz, d.today), [data.chapters, data.subjects, d, p]);
  const goals = goalProgress(data, d.tz, d.today);
  const ach = achievements(data, d.tz, p.streak_min_minutes);
  const earned = ach.filter((a) => a.earnedOn).sort((a, b) => b.earnedOn!.localeCompare(a.earnedOn!)).slice(0, 3);
  const nextUp = ach.filter((a) => !a.earnedOn).sort((a, b) => b.current / b.target - a.current / a.target)[0];

  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: d.tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = p.display_name.split(' ')[0];

  if (!subjects.length) {
    return (
      <>
        <div className="page-actions"><div><h2 style={{ fontSize: 20 }}>{greet}{first ? `, ${first}` : ''}</h2><div className="muted">Let’s set up your syllabus.</div></div></div>
        <Card>
          <EmptyState icon={<BookOpen size={22} />} title="Add your first subject"
            text={<>Syllabix tracks up to {MAX_SUBJECTS} subjects. Add a subject, then enter its chapters from your syllabus — your dashboard fills in as you study.</>}
            action={<button className="btn btn-primary" onClick={() => setAddSubject(true)}><Plus size={16} />Add a subject</button>} />
        </Card>
        {data.subjects.length > 0 && <p className="muted small" style={{ marginTop: 12 }}>All your subjects are archived. <Link to="/subjects">Manage subjects</Link></p>}
        <SubjectForm open={addSubject} onClose={() => setAddSubject(false)} />
      </>
    );
  }

  return (
    <>
      <div className="page-actions">
        <div>
          <h2 style={{ fontSize: 20, letterSpacing: '-.02em' }}>{greet}{first ? `, ${first}` : ''}</h2>
          <div className="muted">{todayMin ? `You’ve studied ${fmtMinutes(todayMin)} today.` : 'No study logged yet today.'}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setLogSession(true)}><Plus size={16} />Log session</button>
          <button className="btn btn-primary" onClick={() => nav('/timer')}><Play size={16} />{timer ? 'Open timer' : 'Start studying'}</button>
        </div>
      </div>

      <div className="cards-4">
        <div className="card stat">
          <div className="stat-top">Study today<span className="stat-icon"><Clock3 size={16} /></span></div>
          <div className="stat-value">{fmtMinutes(todayMin)}</div>
          {p.daily_goal_min ? <><Progress value={(todayMin / p.daily_goal_min) * 100} size="sm" color={todayMin >= p.daily_goal_min ? 'var(--success)' : 'var(--accent)'} /><div className="stat-sub">Goal {fmtMinutes(p.daily_goal_min)}</div></>
            : <div className="stat-sub">No daily goal set</div>}
        </div>
        <div className="card stat">
          <div className="stat-top">This week<span className="stat-icon violet"><TrendingUp size={16} /></span></div>
          <div className="stat-value">{fmtMinutes(weekMin)}</div>
          {p.weekly_goal_min ? <><Progress value={(weekMin / p.weekly_goal_min) * 100} size="sm" color={weekMin >= p.weekly_goal_min ? 'var(--success)' : 'var(--accent)'} /><div className="stat-sub">Goal {fmtMinutes(p.weekly_goal_min)} · since {shortWeekday(ws)}</div></>
            : <div className="stat-sub">Since {shortWeekday(ws)} {fmtKey(ws)}</div>}
        </div>
        <div className="card stat">
          <div className="stat-top">Chapters mastered<span className="stat-icon green"><CheckCircle2 size={16} /></span></div>
          <div className="stat-value">{mastered}<span className="muted" style={{ fontSize: 15, fontWeight: 600 }}> / {chapters.length}</span></div>
          <div className="stat-sub">{chapters.length ? `${chapters.filter((c) => c.status !== 'not_started' && c.status !== 'mastered').length} in progress` : 'No chapters added yet'}</div>
        </div>
        <div className="card stat">
          <div className="stat-top">Syllabus completion<span className="stat-icon amber"><Target size={16} /></span></div>
          <div className="stat-value">{chapters.length ? `${pct}%` : '—'}</div>
          {chapters.length ? <><Progress value={pct} size="sm" /><div className="stat-sub">Mastered ÷ all chapters</div></> : <div className="stat-sub">Add chapters to see this</div>}
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: 14 }}>
        <div className="col">
          <Card title="Study time · last 7 days" action={<Link to="/stats" className="card-link">Statistics →</Link>}>
            {last7.some((x) => x.minutes) ? (
              <BarChart data={last7.map((x) => ({ key: x.key, label: x.key === d.today ? 'Today' : shortWeekday(x.key), value: x.minutes, title: fmtKey(x.key, { weekday: true }) }))} target={p.daily_goal_min} />
            ) : (
              <EmptyState icon={<Clock3 size={20} />} title="No study logged this week" text="Start the timer or log a session — your chart will appear here." />
            )}
          </Card>

          <div>
            <div className="section-title" style={{ marginTop: 6 }}>Subjects<Link to="/subjects" className="card-link" style={{ textTransform: 'none', letterSpacing: 0 }}>Manage →</Link></div>
            <div className="subject-cards">
              {subjects.map((s) => {
                const ss = d.subjectStats.get(s.id)!;
                return (
                  <Link key={s.id} to={`/subjects/${s.id}`} className="card subject-card" style={{ ['--subject' as string]: s.color }}>
                    <div className="sc-head">
                      <div className="grow"><div className="sc-name">{s.name}</div><div className="sc-meta">{s.qualification}{s.syllabus_code ? ` · ${s.syllabus_code}` : ''}{s.exam_session ? ` · ${s.exam_session.split('/')[0].slice(0, 3)} ${s.exam_year ?? ''}` : ''}</div></div>
                      <Ring value={ss.pct} size={46} stroke={5} color={s.color}><span style={{ fontSize: 11.5 }}>{ss.total ? `${ss.pct}%` : '—'}</span></Ring>
                    </div>
                    <div className="sc-nums"><span><b>{ss.mastered}</b>/{ss.total} mastered</span><span><b>{fmtMinutes(ss.minutes)}</b> studied</span></div>
                    <div className="sc-foot">
                      {ss.total === 0 ? <span className="tag info">Add chapters</span>
                        : ss.needsRevision ? <span className="tag warn"><RotateCcw size={11} />{ss.needsRevision} to revise</span>
                          : <span className="tag ok">Nothing to revise</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <Card title="Recent study sessions" action={<Link to="/log" className="card-link">Study log →</Link>}>
            {data.sessions.length ? (
              <div className="list">{data.sessions.slice(0, 5).map((s) => <SessionRow key={s.id} s={s} />)}</div>
            ) : <EmptyState icon={<Clock3 size={20} />} title="No sessions yet" text="Your study sessions will be listed here." action={<button className="btn btn-sm" onClick={() => setLogSession(true)}>Log a session</button>} />}
          </Card>
        </div>

        <div className="col">
          <Card title={<><Flame size={16} color="var(--warn)" />Study streak</>}>
            <div className="streak">
              <div className="streak-num">{st.current}</div>
              <div><b>{st.current === 1 ? 'day' : 'days'} in a row</b><div className="muted small">Best: {st.longest} · counts days with {p.streak_min_minutes}+ min</div></div>
            </div>
            <div className="streak-week">
              {lastNDays(d.byDay, d.today, 7).map((x) => (
                <div key={x.key} className={'streak-day' + (x.minutes >= p.streak_min_minutes ? ' on' : '') + (x.key === d.today ? ' today' : '')} title={`${fmtKey(x.key, { weekday: true })}: ${fmtMinutes(x.minutes)}`}>
                  <i />{shortWeekday(x.key).slice(0, 2)}
                </div>
              ))}
            </div>
            {!st.todayDone && st.current > 0 && <div className="muted small" style={{ marginTop: 10 }}>Study {p.streak_min_minutes} min today to make it {st.current + 1}.</div>}
          </Card>

          <Card title="Upcoming exams" action={<Link to="/exams" className="card-link">Exam planner →</Link>}>
            {upcoming.length ? <div className="list">{upcoming.map((e) => <ExamRow key={e.id} e={e} />)}</div>
              : <EmptyState icon={<CalendarDays size={20} />} title="No exams added" text="Add your exam papers to see a countdown." action={<Link to="/exams" className="btn btn-sm">Add an exam</Link>} />}
          </Card>

          <Card title="Needs revision" action={revision.length ? <Link to="/revision" className="card-link">See all {revision.length} →</Link> : undefined}>
            {revision.length ? (
              <div className="list">
                {revision.slice(0, 5).map((r) => (
                  <div key={r.chapter.id} className="list-item">
                    <Dot color={r.subject.color} />
                    <div className="li-main">
                      <Link to={`/subjects/${r.subject.id}/chapters/${r.chapter.id}`} className="li-title">{r.chapter.title}</Link>
                      <span className="li-sub">{r.subject.name} · {r.reasons.map((x) => REASON_LABEL[x]).join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<RotateCcw size={20} />} title="Nothing flagged" text="Chapters that need attention will appear here, based on your own ratings and study history." />}
          </Card>

          <Card title="Goals" action={<Link to="/settings#goals" className="card-link">Edit →</Link>}>
            {goals.length ? goals.map((g) => <GoalRow key={g.id} g={g} />)
              : <EmptyState icon={<Target size={20} />} title="No goals set" text="Set daily or weekly study targets in Settings." />}
          </Card>

          <Card title={<><Award size={16} color="var(--warn)" />Achievements</>} action={<Link to="/stats#achievements" className="card-link">All →</Link>}>
            <div className="stack-sm">
              {earned.map((a) => <AchievementTile key={a.id} a={a} />)}
              {nextUp && <AchievementTile a={nextUp} />}
            </div>
          </Card>
        </div>
      </div>

      <SessionForm open={logSession} onClose={() => setLogSession(false)} />
    </>
  );
}
