# Syllabix

**Your syllabus. Your progress. Your results.**

A study tracker for Cambridge IGCSE and O-Level students: enter your syllabus chapter by chapter, time your study sessions, see what needs revision, and count down to every exam.

- **Frontend:** React 18 + TypeScript + Vite (no server code to run)
- **Login and database:** Supabase (Auth + Postgres with row-level security)
- **Hosting:** Vercel (free Hobby plan)

---

## What's built

| Area | What it does |
|---|---|
| Accounts | Email + password sign-up with email confirmation, Google sign-in, log out, forgot/reset password, change password, delete account (with typed confirmation), data export |
| Onboarding | Name → timezone and week start → optional goals → add subjects |
| Subjects | Up to **6 per account**, enforced in the database (also under simultaneous requests). Name, short code, board, qualification, syllabus code, session, year, exam date, colour, weekly target. Edit, archive, delete (warns with counts; typing the name is required if it has data) |
| Chapters | Your own list, typed in. Description, subtopics checklist, status (Not Started → Learning → Practising → Needs Revision → Mastered), confidence, difficulty, notes, reorder, last studied, time, practice accuracy. Completion = chapters marked Mastered |
| Study timer | Start / Pause / Resume / Finish. Paused time is excluded. Saved to your account, so it survives refreshes, closed tabs and switching devices. Review form before saving. Each timer session has a fixed ID, so it can only be saved once |
| Study log | Manual entries, edit, delete (with confirmation), search, filter by subject, method and date range, day totals |
| Dashboard | Today, this week, chapters mastered, syllabus completion, 7-day chart, subject cards, recent sessions, streak, upcoming exams, revision list, goals, achievements. Empty states only, never fake data |
| Statistics | 7 days / 8 weeks / 12 months, 26-week heatmap, time by subject, method and chapter, goal progress, mastered over time, neglected chapters, achievements |
| Revision Centre | Clear rule (shown on the page and adjustable in Settings): marked Needs Revision, confidence ≤ 2/5, started but not studied for 14+ days. Optional: difficult chapters, chapters with no practice logged. Filters plus Revise / Log / update-confidence actions |
| Exam Planner | Exams with subject, paper, board, date, time and notes. Countdown, linked revision topics with checkboxes and "revise by" deadlines. Every date is labelled **entered by you**; "Checked" appears only if you tick that you verified it, and you can note where |
| Settings | Name, timezone, week start, theme (device / light / dark), goals, streak rule, revision rules, password, install instructions, export, delete account |
| App | Installable PWA (desktop and phone), responsive with a bottom tab bar on phones, light and dark themes |

**Not included on purpose:** reminders and notifications (not built, so there are no settings for them), CSV import (you chose manual entry), and pre-filled syllabus content (the app never claims a syllabus is official).

All dates (today, weeks, months, streaks) use the timezone set in your profile. New accounts start on **Asia/Riyadh** and weeks start on **Sunday**; both can be changed.

---

## Tests

```bash
npm install
npm test        # 16 logic tests (timer, timezones, stats, revision, achievements) + 19 database security checks
npm run build   # type-check + production build
npm run demo    # local demo with a fake in-browser backend: open http://localhost:5173/?seed=1
```

The database checks run the real migration on an in-process Postgres and confirm: the 6-subject limit, row-level security (users can't read, edit, delete or attach to another user's data), no duplicate session saves, cascade rules, and account deletion.

The demo backend (`npm run demo`) is swapped in at build time and is **never** part of the production site.

---

## Deploying it (about 30 minutes)

You need three free accounts: **GitHub**, **Supabase** and **Vercel**. Steps marked 👤 need you to sign in or click approve.

### 1. Create the Supabase project 👤

1. Go to <https://supabase.com> → **Start your project** → sign in (signing in with GitHub is easiest).
2. **New project** → name it `syllabix`, choose a strong database password (save it in a password manager; the app doesn't need it), and pick the region closest to you → **Create new project**.
3. When it's ready, open **SQL Editor** → **New query**, paste the whole of `supabase/migrations/0001_syllabix_init.sql`, then click **Run**. You should see "Success. No rows returned".
4. Open **Project Settings → API** (or the **Connect** button) and copy:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon / publishable key** → this is `VITE_SUPABASE_ANON_KEY`
   - ⚠️ Never copy the `service_role` / secret key anywhere in this project.

### 2. Turn on the right login settings 👤

In Supabase, go to **Authentication**:

- **Sign In / Providers → Email:** Email enabled, **Confirm email = ON**, minimum password length **8**.
- **URL Configuration:** fill this in after step 4, once you have your Vercel URL:
  - **Site URL:** `https://YOUR-APP.vercel.app`
  - **Redirect URLs:** add `https://YOUR-APP.vercel.app/**`

### 3. Put the code on GitHub 👤

Create an **empty private repository** called `syllabix` on GitHub, then from the project folder run:

```bash
git init && git add . && git commit -m "Syllabix v1"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/syllabix.git
git push -u origin main
```

### 4. Deploy on Vercel 👤

1. Go to <https://vercel.com> → sign up with GitHub (choose the **Hobby** plan; it's free).
2. **Add New → Project** → import `syllabix`. Vercel detects **Vite** automatically (build: `npm run build`, output: `dist`).
3. Open **Environment Variables** and add both values from step 1.4:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. When it finishes, your permanent address appears at the top, for example `https://syllabix-xyz.vercel.app`. To get a nicer free name, go to **Settings → Domains → Edit** and try `syllabix.vercel.app` or a variant (you can only use one that isn't already taken).
5. Go back to step 2 and fill in **Site URL** and **Redirect URLs** with this address.

Every later `git push` redeploys automatically.

### 5. Email sending (needed before other students sign up) 👤

Supabase's built-in email sender only delivers to members of your own Supabase team, and only about 2 emails per hour. It's fine for you while testing, but other students won't receive their confirmation or password-reset emails until you connect an email service:

1. Make a free account with an email provider that supports SMTP (Supabase suggests Resend, Brevo, Postmark, SendGrid, AWS SES and ZeptoMail). Most of them want you to verify a sending domain for reliable delivery.
2. In Supabase: **Authentication → Emails → SMTP Settings** → enable custom SMTP and enter the provider's host, port, username and password, plus a From address.
3. Optional: under **Authentication → Rate Limits**, raise the email limit (the default with custom SMTP is 30 per hour).

**Until that's done:** Google sign-in works for everyone, and email sign-up works for you.

### 6. Google sign-in (optional, about 10 minutes) 👤

1. In <https://console.cloud.google.com>, create a project → **APIs & Services → OAuth consent screen** (External, app name "Syllabix", your email) → **Credentials → Create credentials → OAuth client ID → Web application**.
2. **Authorized redirect URI:** copy the callback URL shown in Supabase under **Authentication → Sign In / Providers → Google** (it looks like `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Paste the Google **Client ID** and **Client secret** into that Supabase Google provider page → enable → **Save**.

Until this is done, the "Continue with Google" button shows a friendly "not switched on yet" message.

### 7. Check it works

On the live URL: sign up, confirm your email, add a subject and chapters, start the timer, pause it, refresh the page, finish and save, then log out and log back in on your phone. Your data should all be there.

---

## Using it every day

- **Bookmark:** open your Vercel URL in Chrome and press **Ctrl+D** (⌘+D on Mac).
- **Install as an app:** Chrome on a computer → install icon at the right of the address bar (or ⋮ → *Cast, save and share* → *Install page as app*). Android → ⋮ → *Add to home screen*. iPhone (Safari) → Share → *Add to Home Screen*.

---

## Maintenance

| Task | Where |
|---|---|
| Change environment variables | Vercel → Project → Settings → Environment Variables → then **Redeploy** |
| See or edit data | Supabase → Table Editor (row-level security protects users from each other, but you, the owner, can see everything) |
| Back up | Supabase → Database → Backups (on paid plans), or each student can use **Settings → Download your data** |
| Future database changes | Add a new file `supabase/migrations/0002_….sql` and run it in the SQL Editor. Never edit `0001` after it has been run |
| Logs / errors | Supabase → Logs; Vercel → Deployments → a deployment → Logs |

### Environment variables

| Name | Value | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Your project URL | No, it's visible in the browser by design |
| `VITE_SUPABASE_ANON_KEY` | Anon / publishable key | No, it's safe in the browser because every table uses row-level security |

There are no secret keys in this project. The `service_role` key must never be added.

---

## Costs and limits

Everything above is **free**. Nothing here requires a card, and no domain needs to be bought.

- **Vercel Hobby:** free, for personal, non-commercial use. It includes 100 GB of data transfer per month, far more than this app needs. If Syllabix ever becomes a paid product, Vercel requires the Pro plan.
- **Supabase Free:** 500 MB database (years of study logs), 50,000 monthly active users, 2 free projects. ⚠️ **Free projects pause after 7 days with no activity.** If nobody uses Syllabix for a week, open the Supabase dashboard and click **Restore**. Regular use keeps it awake.
- **Email:** see step 5. Most SMTP providers have free tiers.
- **Paid add-ons are optional:** a custom domain (e.g. `syllabix.com`) or Supabase Pro (no pausing, daily backups). Neither is needed, and nothing is switched on without you.

Limits change over time; check <https://supabase.com/pricing> and <https://vercel.com/pricing> for current numbers.

---

## Project structure

```
supabase/migrations/0001_syllabix_init.sql   database schema, security policies, 6-subject limit
src/lib/          types, timezone maths, stats, revision rule, achievements, Supabase data layer
src/components/   layout, forms, charts, shared UI
src/pages/        Dashboard, Subjects, SubjectDetail, ChapterDetail, Timer, StudyLog, Statistics, Revision, Exams, Settings, Auth, Onboarding
public/           icons, PWA manifest, service worker
tests/db.test.mjs database security tests
vercel.json       SPA routing and security headers
```
