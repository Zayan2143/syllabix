import type { ChapterStatus, StudyMethod } from './types';

export const APP_NAME = 'Syllabix';
export const TAGLINE = 'Your syllabus. Your progress. Your results.';
export const MAX_SUBJECTS = 6;

export const STATUSES: { value: ChapterStatus; label: string; short: string }[] = [
  { value: 'not_started', label: 'Not Started', short: 'Not started' },
  { value: 'learning', label: 'Learning', short: 'Learning' },
  { value: 'practising', label: 'Practising', short: 'Practising' },
  { value: 'needs_revision', label: 'Needs Revision', short: 'Revise' },
  { value: 'mastered', label: 'Mastered', short: 'Mastered' },
];
export const statusLabel = (s: ChapterStatus) => STATUSES.find((x) => x.value === s)?.label ?? s;

export const METHODS: { value: StudyMethod; label: string }[] = [
  { value: 'textbook', label: 'Textbook' },
  { value: 'notes', label: 'Notes' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'past_papers', label: 'Past Papers' },
  { value: 'practice_questions', label: 'Practice Questions' },
  { value: 'video_lesson', label: 'Video Lesson' },
  { value: 'tuition_review', label: 'Tuition Review' },
  { value: 'other', label: 'Other' },
];
export const methodLabel = (m: StudyMethod) => METHODS.find((x) => x.value === m)?.label ?? m;

export const QUALIFICATIONS = ['IGCSE', 'O-Level', 'International GCSE', 'AS Level', 'A Level', 'Other'];
export const EXAM_BOARDS = ['Cambridge International', 'Pearson Edexcel', 'Oxford AQA', 'Other'];
export const EXAM_SESSIONS = ['February/March', 'May/June', 'October/November'];

export const SUBJECT_COLORS = ['#2563EB', '#16A34A', '#7C3AED', '#DB2777', '#EA580C', '#0891B2'];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_TIMEZONE = 'Asia/Riyadh';

export const CONFIDENCE_LABELS = ['', 'Very low', 'Low', 'Okay', 'Good', 'Very confident'];
export const DIFFICULTY_LABELS = ['', 'Very easy', 'Easy', 'Medium', 'Hard', 'Very hard'];
