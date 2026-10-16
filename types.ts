export type ChapterStatus = 'not_started' | 'learning' | 'practising' | 'needs_revision' | 'mastered';
export type StudyMethod =
  | 'textbook' | 'notes' | 'flashcards' | 'past_papers'
  | 'practice_questions' | 'video_lesson' | 'tuition_review' | 'other';
export type ThemePref = 'system' | 'light' | 'dark';

export interface Profile {
  id: string;
  display_name: string;
  timezone: string;
  week_start: number;
  theme: ThemePref;
  onboarded: boolean;
  daily_goal_min: number | null;
  weekly_goal_min: number | null;
  weekly_chapters_goal: number | null;
  streak_min_minutes: number;
  rev_low_confidence: number;
  rev_stale_days: number;
  rev_flag_difficult: boolean;
  rev_flag_no_practice: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  short_code: string | null;
  exam_board: string;
  qualification: string;
  syllabus_code: string | null;
  exam_session: string | null;
  exam_year: number | null;
  exam_date: string | null;
  color: string;
  weekly_target_min: number | null;
  archived: boolean;
  position: number;
  created_at: string;
}

export interface Subtopic { id: string; title: string; done: boolean }

export interface Chapter {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  position: number;
  subtopics: Subtopic[];
  status: ChapterStatus;
  difficulty: number | null;
  confidence: number | null;
  notes: string | null;
  mastered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  subject_id: string;
  chapter_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_min: number;
  method: StudyMethod;
  questions_attempted: number | null;
  questions_correct: number | null;
  confidence: number | null;
  notes: string | null;
  source: 'timer' | 'manual';
  created_at: string;
}

export interface ActiveTimer {
  user_id: string;
  subject_id: string;
  chapter_id: string | null;
  method: StudyMethod;
  started_at: string;
  accumulated_ms: number;
  running_since: string | null;
  session_id: string;
}

export interface Exam {
  id: string;
  user_id: string;
  subject_id: string | null;
  name: string;
  paper: string | null;
  exam_board: string | null;
  exam_date: string;
  exam_time: string | null;
  notes: string | null;
  date_checked: boolean;
  date_source: string | null;
  created_at: string;
}

export interface ExamTopic {
  id: string;
  user_id: string;
  exam_id: string;
  chapter_id: string;
  done: boolean;
  deadline: string | null;
}

export interface AllData {
  profile: Profile;
  subjects: Subject[];
  chapters: Chapter[];
  sessions: StudySession[];
  timer: ActiveTimer | null;
  exams: Exam[];
  examTopics: ExamTopic[];
}

export interface TableRows {
  subjects: Subject;
  chapters: Chapter;
  study_sessions: StudySession;
  exams: Exam;
  exam_topics: ExamTopic;
}
export type TableName = keyof TableRows;

export interface AuthUser { id: string; email: string | null; provider: string | null }
