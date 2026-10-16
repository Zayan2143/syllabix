import { useNavigate } from 'react-router-dom';
import type { Subject } from '../lib/types';
import { useData } from '../lib/store';
import { friendlyError } from '../lib/api';
import { fmtMinutes } from '../lib/time';
import { useConfirm, useToast } from './ui';

export function useSubjectActions() {
  const { data, d, update, remove } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const nav = useNavigate();

  async function toggleArchive(s: Subject) {
    try {
      await update('subjects', s.id, { archived: !s.archived });
      toast(s.archived ? `${s.name} restored.` : `${s.name} archived. It still counts towards your 6 subjects.`);
    } catch (e) { toast(friendlyError(e), 'error'); }
  }

  async function deleteSubject(s: Subject, after?: string) {
    const st = d.subjectStats.get(s.id)!;
    const exams = data.exams.filter((e) => e.subject_id === s.id).length;
    const hasData = st.total > 0 || st.sessions > 0;
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      danger: true,
      confirmLabel: 'Delete permanently',
      requireText: hasData ? s.name : undefined,
      message: hasData ? (
        <>
          This permanently deletes:
          <ul>
            <li><b>{st.total}</b> chapter{st.total === 1 ? '' : 's'} (with notes and ratings)</li>
            <li><b>{st.sessions}</b> study session{st.sessions === 1 ? '' : 's'} ({fmtMinutes(st.minutes)} of study time)</li>
            {exams > 0 && <li>{exams} exam{exams === 1 ? '' : 's'} will be kept but unlinked from this subject</li>}
          </ul>
          <p style={{ marginBottom: 0 }}>This can’t be undone. To keep the history instead, archive the subject.</p>
        </>
      ) : 'This subject has no chapters or study time. It will be removed.',
    });
    if (!ok) return;
    try {
      await remove('subjects', s.id);
      toast(`${s.name} deleted.`);
      if (after) nav(after);
    } catch (e) { toast(friendlyError(e), 'error'); }
  }

  return { toggleArchive, deleteSubject };
}
