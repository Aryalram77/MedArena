-- Pragati Bibaran — Supabase schema + row level security
-- Run in the Supabase SQL editor. The front end uses the public anon key over
-- REST, so RLS is the only thing protecting each learner's rows.
--
-- IMPORTANT: existing MedArena accounts are custom (Google sub / pw:<email>),
-- not Supabase Auth users. For live Supabase writes either (a) migrate users to
-- Supabase Auth, or (b) configure the Supabase JWT secret to match the Worker's
-- HS256 secret so auth.jwt()->>'sub' equals the MedArena user key. Until then
-- the dashboard stores events locally and never sends unauthenticated rows.

create table if not exists public.pragati_profiles (
  user_key text primary key,
  display_name text,
  target_marks integer not null default 200 check (target_marks between 1 and 200),
  exam_date date,
  daily_minutes integer not null default 30 check (daily_minutes between 5 and 480),
  min_attempts integer not null default 12 check (min_attempts between 1 and 500),
  goals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.pragati_answer_events (
  id text primary key,
  user_key text not null references public.pragati_profiles(user_key) on delete cascade,
  bank_id text not null default '',
  question_key text not null,
  subject_id text not null default 'mixed',
  chapter text not null default 'General',
  selected_keys text[] not null default '{}',
  is_correct boolean not null default false,
  first_attempt boolean not null default true,
  attempted_at timestamptz not null default now(),
  session_id text,
  source text not null default 'practice'
);

create table if not exists public.pragati_sessions (
  id text primary key,
  user_key text not null references public.pragati_profiles(user_key) on delete cascade,
  bank_id text,
  label text,
  mode text,
  started_at timestamptz,
  finished_at timestamptz,
  total integer not null default 0,
  answered integer not null default 0,
  correct integer not null default 0,
  time_used_seconds integer not null default 0
);

create table if not exists public.pragati_chapter_progress (
  user_key text not null references public.pragati_profiles(user_key) on delete cascade,
  subject_id text not null,
  chapter text not null,
  completed boolean not null default false,
  completed_at timestamptz not null default now(),
  primary key (user_key, subject_id, chapter)
);

create table if not exists public.pragati_weightage (
  subject_id text primary key,
  name text not null,
  name_np text not null default '',
  group_key text not null,
  marks integer not null check (marks >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists pragati_answer_events_user_time_idx
  on public.pragati_answer_events (user_key, attempted_at desc);
create index if not exists pragati_answer_events_user_question_idx
  on public.pragati_answer_events (user_key, question_key);
create index if not exists pragati_sessions_user_time_idx
  on public.pragati_sessions (user_key, started_at desc);

-- RLS helper. Using the raw sub avoids casting non-UUID custom keys (pw:email)
-- to uuid, which would make auth.uid() raise an error.
create or replace function public.pragati_user_key()
returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() ->> 'sub', ''), '');
$$;

revoke all on function public.pragati_user_key() from public;
grant execute on function public.pragati_user_key() to anon, authenticated;

alter table public.pragati_profiles enable row level security;
alter table public.pragati_answer_events enable row level security;
alter table public.pragati_sessions enable row level security;
alter table public.pragati_chapter_progress enable row level security;
alter table public.pragati_weightage enable row level security;

drop policy if exists pragati_profile_select on public.pragati_profiles;
create policy pragati_profile_select on public.pragati_profiles
  for select to authenticated using (public.pragati_user_key() = user_key);
drop policy if exists pragati_profile_insert on public.pragati_profiles;
create policy pragati_profile_insert on public.pragati_profiles
  for insert to authenticated with check (public.pragati_user_key() = user_key);
drop policy if exists pragati_profile_update on public.pragati_profiles;
create policy pragati_profile_update on public.pragati_profiles
  for update to authenticated using (public.pragati_user_key() = user_key)
  with check (public.pragati_user_key() = user_key);

drop policy if exists pragati_events_select on public.pragati_answer_events;
create policy pragati_events_select on public.pragati_answer_events
  for select to authenticated using (public.pragati_user_key() = user_key);
drop policy if exists pragati_events_insert on public.pragati_answer_events;
create policy pragati_events_insert on public.pragati_answer_events
  for insert to authenticated with check (public.pragati_user_key() = user_key);

drop policy if exists pragati_sessions_select on public.pragati_sessions;
create policy pragati_sessions_select on public.pragati_sessions
  for select to authenticated using (public.pragati_user_key() = user_key);
drop policy if exists pragati_sessions_insert on public.pragati_sessions;
create policy pragati_sessions_insert on public.pragati_sessions
  for insert to authenticated with check (public.pragati_user_key() = user_key);
drop policy if exists pragati_sessions_update on public.pragati_sessions;
create policy pragati_sessions_update on public.pragati_sessions
  for update to authenticated using (public.pragati_user_key() = user_key)
  with check (public.pragati_user_key() = user_key);

drop policy if exists pragati_chapter_select on public.pragati_chapter_progress;
create policy pragati_chapter_select on public.pragati_chapter_progress
  for select to authenticated using (public.pragati_user_key() = user_key);
drop policy if exists pragati_chapter_insert on public.pragati_chapter_progress;
create policy pragati_chapter_insert on public.pragati_chapter_progress
  for insert to authenticated with check (public.pragati_user_key() = user_key);
drop policy if exists pragati_chapter_update on public.pragati_chapter_progress;
create policy pragati_chapter_update on public.pragati_chapter_progress
  for update to authenticated using (public.pragati_user_key() = user_key)
  with check (public.pragati_user_key() = user_key);
drop policy if exists pragati_chapter_delete on public.pragati_chapter_progress;
create policy pragati_chapter_delete on public.pragati_chapter_progress
  for delete to authenticated using (public.pragati_user_key() = user_key);

-- Weightage is public configuration. Only a service-role/server writer should
-- change it; there is deliberately no anon/authenticated write policy.
drop policy if exists pragati_weightage_select on public.pragati_weightage;
create policy pragati_weightage_select on public.pragati_weightage
  for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.pragati_weightage to anon, authenticated;
grant select, insert, update, delete on public.pragati_profiles,
  public.pragati_answer_events, public.pragati_sessions,
  public.pragati_chapter_progress to authenticated;
