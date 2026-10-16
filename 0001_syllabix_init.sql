-- =====================================================================
-- Syllabix — database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run? No — run it on a fresh project. Later changes go in new files.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Profiles (one per account, created automatically on sign-up)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  display_name            text not null default '' check (char_length(display_name) <= 60),
  timezone                text not null default 'Asia/Riyadh' check (char_length(timezone) <= 64),
  week_start              smallint not null default 0 check (week_start between 0 and 6), -- 0 = Sunday
  theme                   text not null default 'system' check (theme in ('system','light','dark')),
  onboarded               boolean not null default false,
  -- goals (null = goal switched off)
  daily_goal_min          integer check (daily_goal_min between 1 and 1440),
  weekly_goal_min         integer check (weekly_goal_min between 1 and 10080),
  weekly_chapters_goal    integer check (weekly_chapters_goal between 1 and 100),
  -- streak rule: a day counts if at least this many minutes were logged
  streak_min_minutes      integer not null default 15 check (streak_min_minutes between 1 and 600),
  -- revision rules
  rev_low_confidence      smallint not null default 2 check (rev_low_confidence between 0 and 5), -- 0 = off
  rev_stale_days          integer not null default 14 check (rev_stale_days between 0 and 365),   -- 0 = off
  rev_flag_difficult      boolean not null default false,
  rev_flag_no_practice    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Subjects (max 6 per account, archived ones included)
-- ---------------------------------------------------------------------
create table public.subjects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 80),
  short_code        text check (char_length(short_code) <= 12),
  exam_board        text not null default 'Cambridge International' check (char_length(exam_board) <= 60),
  qualification     text not null default 'IGCSE' check (char_length(qualification) <= 40),
  syllabus_code     text check (char_length(syllabus_code) <= 20),
  exam_session      text check (exam_session in ('February/March','May/June','October/November')),
  exam_year         smallint check (exam_year between 2000 and 2100),
  exam_date         date,
  color             text not null default '#2563EB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  weekly_target_min integer check (weekly_target_min between 1 and 10080),
  archived          boolean not null default false,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id)
);
create index subjects_user_idx on public.subjects(user_id);

-- ---------------------------------------------------------------------
-- Chapters / topics
-- subtopics: [{ "id": "...", "title": "...", "done": false }]
-- ---------------------------------------------------------------------
create table public.chapters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id    uuid not null,
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  description   text check (char_length(description) <= 2000),
  position      integer not null default 0,
  subtopics     jsonb not null default '[]'::jsonb check (jsonb_typeof(subtopics) = 'array'),
  status        text not null default 'not_started'
                check (status in ('not_started','learning','practising','needs_revision','mastered')),
  difficulty    smallint check (difficulty between 1 and 5),
  confidence    smallint check (confidence between 1 and 5),
  notes         text check (char_length(notes) <= 10000),
  mastered_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete cascade
);
create index chapters_subject_idx on public.chapters(subject_id, position);
create index chapters_user_idx on public.chapters(user_id);

-- ---------------------------------------------------------------------
-- Study sessions (the single source of truth for study time)
-- ---------------------------------------------------------------------
create table public.study_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id          uuid not null,
  chapter_id          uuid,
  started_at          timestamptz not null,
  ended_at            timestamptz,
  duration_min        integer not null check (duration_min between 1 and 1440),
  method              text not null default 'notes'
                      check (method in ('textbook','notes','flashcards','past_papers','practice_questions','video_lesson','tuition_review','other')),
  questions_attempted integer check (questions_attempted between 0 and 10000),
  questions_correct   integer check (questions_correct between 0 and 10000),
  confidence          smallint check (confidence between 1 and 5),
  notes               text check (char_length(notes) <= 5000),
  source              text not null default 'manual' check (source in ('timer','manual')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (questions_correct is null or questions_attempted is not null),
  check (questions_correct is null or questions_correct <= questions_attempted),
  check (ended_at is null or ended_at >= started_at),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters(id, user_id) on delete set null (chapter_id)
);
create index sessions_user_started_idx on public.study_sessions(user_id, started_at desc);
create index sessions_chapter_idx on public.study_sessions(chapter_id);

-- ---------------------------------------------------------------------
-- Active timer (max one per account; survives refresh and other devices)
-- elapsed = accumulated_ms + (running_since is not null ? now - running_since : 0)
-- ---------------------------------------------------------------------
create table public.active_timers (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  subject_id     uuid not null,
  chapter_id     uuid,
  method         text not null default 'notes'
                 check (method in ('textbook','notes','flashcards','past_papers','practice_questions','video_lesson','tuition_review','other')),
  started_at     timestamptz not null default now(),
  accumulated_ms bigint not null default 0 check (accumulated_ms >= 0),
  running_since  timestamptz,
  -- id the finished session will be saved under, so a retry can never create a duplicate
  session_id     uuid not null default gen_random_uuid(),
  updated_at     timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters(id, user_id) on delete set null (chapter_id)
);

-- ---------------------------------------------------------------------
-- Exams + linked revision topics
-- date_checked: the student ticked "I checked this against the official timetable"
-- ---------------------------------------------------------------------
create table public.exams (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id     uuid,
  name           text not null check (char_length(btrim(name)) between 1 and 120),
  paper          text check (char_length(paper) <= 60),
  exam_board     text check (char_length(exam_board) <= 60),
  exam_date      date not null,
  exam_time      time,
  notes          text check (char_length(notes) <= 5000),
  date_checked   boolean not null default false,
  date_source    text check (char_length(date_source) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete set null (subject_id)
);
create index exams_user_date_idx on public.exams(user_id, exam_date);

create table public.exam_topics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exam_id      uuid not null,
  chapter_id   uuid not null,
  done         boolean not null default false,
  deadline     date,
  created_at   timestamptz not null default now(),
  unique (exam_id, chapter_id),
  foreign key (exam_id, user_id) references public.exams(id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters(id, user_id) on delete cascade
);
create index exam_topics_user_idx on public.exam_topics(user_id);

-- =====================================================================
-- Triggers
-- =====================================================================

-- updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch  before update on public.profiles       for each row execute function public.touch_updated_at();
create trigger subjects_touch  before update on public.subjects       for each row execute function public.touch_updated_at();
create trigger chapters_touch  before update on public.chapters       for each row execute function public.touch_updated_at();
create trigger sessions_touch  before update on public.study_sessions for each row execute function public.touch_updated_at();
create trigger timers_touch    before update on public.active_timers  for each row execute function public.touch_updated_at();
create trigger exams_touch     before update on public.exams          for each row execute function public.touch_updated_at();

-- Ownership columns can never be changed after creation
create or replace function public.lock_user_id() returns trigger
language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end $$;

create trigger subjects_lock_owner    before update on public.subjects       for each row execute function public.lock_user_id();
create trigger chapters_lock_owner    before update on public.chapters       for each row execute function public.lock_user_id();
create trigger sessions_lock_owner    before update on public.study_sessions for each row execute function public.lock_user_id();
create trigger exams_lock_owner       before update on public.exams          for each row execute function public.lock_user_id();
create trigger exam_topics_lock_owner before update on public.exam_topics    for each row execute function public.lock_user_id();

-- Six-subject limit. The advisory lock serialises concurrent inserts for the
-- same account, so firing many requests at once still cannot exceed 6.
create or replace function public.enforce_subject_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('syllabix_subjects:' || new.user_id::text, 0));
  select count(*) into n from public.subjects where user_id = new.user_id;
  if n >= 6 then
    raise exception 'SUBJECT_LIMIT: You can have at most 6 subjects. Delete one to add another.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger subjects_limit before insert on public.subjects
  for each row execute function public.enforce_subject_limit();

-- mastered_at follows status
create or replace function public.track_mastered() returns trigger
language plpgsql as $$
begin
  if new.status = 'mastered' then
    if tg_op = 'INSERT' or old.status is distinct from 'mastered' then
      new.mastered_at := coalesce(new.mastered_at, now());
      if tg_op = 'UPDATE' then new.mastered_at := now(); end if;
    end if;
  else
    new.mastered_at := null;
  end if;
  return new;
end $$;

create trigger chapters_mastered before insert or update of status on public.chapters
  for each row execute function public.track_mastered();

-- Create a profile for every new account
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare tz text := coalesce(new.raw_user_meta_data->>'timezone', 'Asia/Riyadh');
begin
  if char_length(tz) > 64 then tz := 'Asia/Riyadh'; end if;
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'display_name',
                  new.raw_user_meta_data->>'full_name',
                  new.raw_user_meta_data->>'name', ''), 60),
    tz
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Row-level security: every table is private to its owner
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.subjects       enable row level security;
alter table public.chapters       enable row level security;
alter table public.study_sessions enable row level security;
alter table public.active_timers  enable row level security;
alter table public.exams          enable row level security;
alter table public.exam_topics    enable row level security;

create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['subjects','chapters','study_sessions','active_timers','exams','exam_topics'] loop
    execute format('create policy "own rows select" on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "own rows update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Only signed-in users get table access at all
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on
  public.subjects, public.chapters, public.study_sessions, public.active_timers,
  public.exams, public.exam_topics to authenticated;
grant select, update on public.profiles to authenticated;

-- =====================================================================
-- Delete my account (removes the login and, by cascade, all data)
-- =====================================================================
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.enforce_subject_limit() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
