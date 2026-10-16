// Tests the Supabase migration on an in-process Postgres (PGlite).
// Supabase's `auth` schema is stubbed with the same shape the migration relies on.
// Run: node tests/db.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let passed = 0;
const ok = (name) => { passed++; console.log('  ✓', name); };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
await db.exec(readFileSync(new URL('../supabase/migrations/0001_syllabix_init.sql', import.meta.url), 'utf8'));
ok('migration applies cleanly');

await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${A}', 'a@x.com', '{"display_name":"Shoaib","timezone":"Asia/Riyadh"}'),
  ('${B}', 'b@x.com', '{}');`);

// Run statements as a signed-in user
async function as(uid, sql, params) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
async function fails(fn, re) {
  try { await fn(); } catch (e) { if (re) assert.match(e.message, re); return; }
  assert.fail('expected an error');
}

// Profiles auto-created
const prof = await as(A, `select display_name, timezone, week_start from profiles`);
assert.equal(prof.rows.length, 1);
assert.equal(prof.rows[0].display_name, 'Shoaib');
assert.equal(prof.rows[0].week_start, 0);
ok('profile created on sign-up, user sees only own profile');

// Six-subject limit
for (let i = 1; i <= 6; i++) await as(A, `insert into subjects (name) values ($1)`, ['Subject ' + i]);
await fails(() => as(A, `insert into subjects (name) values ('Seventh')`), /SUBJECT_LIMIT/);
await fails(() => as(A, `insert into subjects (name) select 'x' || g from generate_series(1,3) g`), /SUBJECT_LIMIT/);
assert.equal((await as(A, `select count(*)::int n from subjects`)).rows[0].n, 6);
ok('7th subject rejected (single and batch insert)');

await as(A, `update subjects set archived = true where name = 'Subject 6'`);
await fails(() => as(A, `insert into subjects (name) values ('Seventh')`), /SUBJECT_LIMIT/);
ok('archived subjects still count towards 6');

await as(A, `delete from subjects where name = 'Subject 6'`);
await as(A, `insert into subjects (name) values ('Replacement')`);
ok('deleting a subject frees a slot');

// Isolation
await as(B, `insert into subjects (name) values ('B Physics')`);
assert.equal((await as(B, `select count(*)::int n from subjects`)).rows[0].n, 1);
assert.equal((await as(A, `select count(*)::int n from subjects where name = 'B Physics'`)).rows[0].n, 0);
const bSub = (await db.query(`select id from subjects where name = 'B Physics'`)).rows[0].id;
const aSub = (await db.query(`select id from subjects where name = 'Subject 1'`)).rows[0].id;
const upd = await as(A, `update subjects set name = 'hacked' where id = $1`, [bSub]);
assert.equal(upd.affectedRows, 0);
const del = await as(A, `delete from subjects where id = $1`, [bSub]);
assert.equal(del.affectedRows, 0);
ok("can't read, edit or delete another user's subject");

await fails(() => as(A, `insert into subjects (user_id, name) values ($1, 'x')`, [B]));
ok("can't create rows owned by another user");

await fails(() => as(A, `insert into chapters (subject_id, title) values ($1, 'sneaky')`, [bSub]));
ok("can't attach a chapter to another user's subject");

await fails(() => as(B, `update subjects set user_id = $1 where id = $2`, [A, bSub]));
ok("can't transfer ownership of a row");

await fails(() => db.exec(`set role anon; select * from subjects;`).finally(() => db.exec('reset role')));
ok('signed-out (anon) users have no table access');

// Chapters + mastered_at
const ch = (await as(A, `insert into chapters (subject_id, title) values ($1, 'Kinematics') returning id, mastered_at`, [aSub])).rows[0];
assert.equal(ch.mastered_at, null);
const m1 = (await as(A, `update chapters set status = 'mastered' where id = $1 returning mastered_at`, [ch.id])).rows[0];
assert.ok(m1.mastered_at);
const m2 = (await as(A, `update chapters set status = 'needs_revision' where id = $1 returning mastered_at`, [ch.id])).rows[0];
assert.equal(m2.mastered_at, null);
ok('mastered_at set when mastered, cleared when status changes back');

// Sessions
const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
await as(A, `insert into study_sessions (id, subject_id, chapter_id, started_at, duration_min, source) values ($1,$2,$3, now(), 25, 'timer')`, [sid, aSub, ch.id]);
await fails(() => as(A, `insert into study_sessions (id, subject_id, started_at, duration_min) values ($1,$2, now(), 25)`, [sid, aSub]));
ok('same session id cannot be saved twice (no duplicate durations)');
await fails(() => as(A, `insert into study_sessions (subject_id, started_at, duration_min, questions_attempted, questions_correct) values ($1, now(), 10, 5, 7)`, [aSub]));
ok('correct answers cannot exceed attempts');
await fails(() => as(A, `insert into study_sessions (subject_id, started_at, duration_min) values ($1, now(), 0)`, [aSub]));
ok('zero-minute sessions rejected');

await as(A, `delete from chapters where id = $1`, [ch.id]);
const s = (await as(A, `select chapter_id, subject_id from study_sessions where id = $1`, [sid])).rows[0];
assert.equal(s.chapter_id, null); assert.equal(s.subject_id, aSub);
ok('deleting a chapter keeps its sessions (chapter link cleared)');

// Active timer: one per user
await as(A, `insert into active_timers (subject_id, running_since) values ($1, now())`, [aSub]);
await fails(() => as(A, `insert into active_timers (subject_id) values ($1)`, [aSub]));
ok('only one active timer per account');

// Exams
const ex = (await as(A, `insert into exams (name, subject_id, exam_date) values ('Paper 2', $1, '2027-05-10') returning id`, [aSub])).rows[0];
const ch2 = (await as(A, `insert into chapters (subject_id, title) values ($1, 'Waves') returning id`, [aSub])).rows[0];
await as(A, `insert into exam_topics (exam_id, chapter_id) values ($1, $2)`, [ex.id, ch2.id]);
assert.equal((await as(B, `select count(*)::int n from exams`)).rows[0].n, 0);
ok('exams and revision topics saved and private');

// Delete subject cascades
await as(A, `delete from subjects where id = $1`, [aSub]);
assert.equal((await as(A, `select count(*)::int n from study_sessions`)).rows[0].n, 0);
assert.equal((await as(A, `select count(*)::int n from exams where id = $1`, [ex.id])).rows[0].n, 1);
ok('deleting a subject removes its chapters/sessions; exams stay (unlinked)');

// Account deletion
await as(B, `select delete_my_account()`);
assert.equal((await db.query(`select count(*)::int n from subjects where user_id = $1`, [B])).rows[0].n, 0);
assert.equal((await db.query(`select count(*)::int n from profiles where id = $1`, [B])).rows[0].n, 0);
assert.equal((await db.query(`select count(*)::int n from auth.users where id = $1`, [A])).rows[0].n, 1);
ok('delete_my_account removes only that account and all its data');

console.log(`\n${passed} database checks passed`);
