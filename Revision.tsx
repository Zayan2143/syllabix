import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Play, Plus, RotateCcw, Settings2 } from 'lucide-react';
import { useData } from '../lib/store';
import { friendlyError } from '../lib/api';
import { REASON_LABEL, revisionItems, ruleSummary, type RevisionReason } from '../lib/revision';
import { chStats } from '../lib/stats';
import { fmtMinutes } from '../lib/time';
import { CONFIDENCE_LABELS } from '../lib/constants';
import { Card, Dot, EmptyState, Modal, Rating, StatusSelect, useToast } from '../components/ui';
import { MiniRating } from '../components/bits';
import { SessionForm } from '../components/SessionForm';

export function Revision() {
  const { data, d, update } = useData();
  const p = data.profile;
  const nav = useNavigate();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState<RevisionReason | ''>('');
  const [maxConf, setMaxConf] = useState('');
  const [minDiff, setMinDiff] = useState('');
  const [minDays, setMinDays] = useState('');
  const [logFor, setLogFor] = useState<{ subject_id: string; chapter_id: string } | null>(null);
  const [confFor, setConfFor] = useState<string | null>(null);

  const all = useMemo(() => revisionItems(data.chapters, data.subjects, d.chapterStats, p, d.tz, d.today), [data.chapters, data.subjects, d, p]);
  const items = all.filter((r) =>
    (!subject || r.subject.id === subject) &&
    (!reason || r.reasons.includes(reason)) &&
    (!maxConf || (r.chapter.confidence != null && r.chapter.confidence <= Number(maxConf))) &&
    (!minDiff || (r.chapter.difficulty != null && r.chapter.difficulty >= Number(minDiff))) &&
    (!minDays || r.daysSince == null || r.daysSince >= Number(minDays)));
  const counts = (Object.keys(REASON_LABEL) as RevisionReason[]).map((k) => ({ k, n: all.filter((r) => r.reasons.includes(k)).length })).filter((x) => x.n);
  const confChapter = confFor ? d.chapterById.get(confFor) : null;

  return (
    <>
      <div className="cards-2 one-col-mobile" style={{ marginBottom: 14 }}>
          <Card title="How chapters are picked" action={<Link to="/settings#revision" className="card-link"><Settings2 size={13} style={{ verticalAlign: -2 }} /> Adjust</Link>}>
            <div className="rule-box">
              A chapter appears here if <b>any</b> of these is true:
              <ul>{ruleSummary(p).map((r) => <li key={r}>{r}</li>)}</ul>
              <p className="muted small" style={{ margin: '10px 0 0' }}>Based only on your own statuses, ratings and logged sessions. Most urgent first: “Needs Revision” and low confidence rank above “not studied recently”.</p>
            </div>
          </Card>
          <Card title="Summary">
            <dl className="kv">
              <dt>Chapters flagged</dt><dd>{all.length}</dd>
              {counts.map(({ k, n }) => <Fragment key={k}><dt>{REASON_LABEL[k]}</dt><dd>{n}</dd></Fragment>)}
            </dl>
          </Card>
      </div>
      <div className="stack">
          <div className="filters" style={{ marginBottom: 0 }}>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
              <option value="">All subjects</option>
              {d.activeSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value as RevisionReason | '')} aria-label="Reason">
              <option value="">Any reason</option>
              {counts.map(({ k, n }) => <option key={k} value={k}>{REASON_LABEL[k]} ({n})</option>)}
            </select>
            <select className="input" value={maxConf} onChange={(e) => setMaxConf(e.target.value)} aria-label="Confidence">
              <option value="">Any confidence</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Confidence ≤ {n}</option>)}
            </select>
            <select className="input" value={minDiff} onChange={(e) => setMinDiff(e.target.value)} aria-label="Difficulty">
              <option value="">Any difficulty</option>
              {[3, 4, 5].map((n) => <option key={n} value={n}>Difficulty ≥ {n}</option>)}
            </select>
            <select className="input" value={minDays} onChange={(e) => setMinDays(e.target.value)} aria-label="Last studied">
              <option value="">Any last-studied date</option>
              {[7, 14, 30, 60].map((n) => <option key={n} value={n}>Not studied for {n}+ days</option>)}
            </select>
          </div>

          <Card pad={false}>
            {!data.chapters.length ? (
              <EmptyState icon={<RotateCcw size={22} />} title="No chapters yet" text="Add chapters to your subjects and rate your confidence — the Revision Centre will pick out what needs attention." action={<Link to="/subjects" className="btn btn-primary">Go to My Subjects</Link>} />
            ) : !all.length ? (
              <EmptyState icon={<CheckCircle2 size={22} />} title="Nothing needs revision right now" text="No chapter matches your revision rules. Keep rating your confidence after each session so this stays accurate." />
            ) : !items.length ? (
              <EmptyState icon={<RotateCcw size={22} />} title="No chapters match these filters" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Chapter</th><th className="hide-mobile">Why</th><th className="hide-mobile">Confidence</th><th className="hide-mobile">Difficulty</th><th className="hide-mobile">Last studied</th><th className="hide-mobile">Status</th><th aria-label="Actions" /></tr></thead>
                  <tbody>
                    {items.map((r) => {
                      const st = chStats(d.chapterStats, r.chapter.id);
                      return (
                        <tr key={r.chapter.id}>
                          <td style={{ minWidth: 170 }}>
                            <Link to={`/subjects/${r.subject.id}/chapters/${r.chapter.id}`} className="ch-title">{r.chapter.title}</Link>
                            <div className="ch-sub"><Dot color={r.subject.color} size={7} /> {r.subject.name} · {fmtMinutes(st.minutes)} studied{st.attempted ? ` · ${st.correct}/${st.attempted} correct` : ''}</div>
                            <div className="reasons show-mobile">{r.reasons.map((x) => <span key={x} className={'tag ' + (x === 'needs_revision' || x === 'low_confidence' ? 'warn' : '')}>{REASON_LABEL[x]}</span>)}</div>
                          </td>
                          <td className="hide-mobile"><div className="reasons">{r.reasons.map((x) => <span key={x} className={'tag ' + (x === 'needs_revision' || x === 'low_confidence' ? 'warn' : '')}>{REASON_LABEL[x]}</span>)}</div></td>
                          <td className="hide-mobile"><button className="link-btn" onClick={() => setConfFor(r.chapter.id)} title="Update confidence"><MiniRating value={r.chapter.confidence} /></button></td>
                          <td className="hide-mobile"><MiniRating value={r.chapter.difficulty} /></td>
                          <td className="hide-mobile nowrap">{r.daysSince == null ? <span className="muted">Never logged</span> : r.daysSince === 0 ? 'Today' : `${r.daysSince} days ago`}</td>
                          <td className="hide-mobile"><StatusSelect value={r.chapter.status} onChange={async (status) => { try { await update('chapters', r.chapter.id, { status }); } catch (e) { toast(friendlyError(e), 'error'); } }} /></td>
                          <td className="nowrap" style={{ textAlign: 'right' }}>
                            <button className="icon-btn hide-mobile" title="Log a revision session" aria-label="Log a revision session" onClick={() => setLogFor({ subject_id: r.subject.id, chapter_id: r.chapter.id })}><Plus size={16} /></button>
                            <button className="btn btn-sm btn-primary" onClick={() => nav(`/timer?subject=${r.subject.id}&chapter=${r.chapter.id}`)}><Play size={13} />Revise</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
      </div>

      {logFor && <SessionForm open onClose={() => setLogFor(null)} defaults={logFor} />}
      <Modal open={!!confChapter} onClose={() => setConfFor(null)} title={`Confidence: ${confChapter?.title ?? ''}`} width={420}>
        {confChapter && <Rating value={confChapter.confidence} labels={CONFIDENCE_LABELS} name="Confidence" onChange={async (v) => {
          try { await update('chapters', confChapter.id, { confidence: v }); toast('Confidence updated.'); setConfFor(null); } catch (e) { toast(friendlyError(e), 'error'); }
        }} />}
      </Modal>
    </>
  );
}
