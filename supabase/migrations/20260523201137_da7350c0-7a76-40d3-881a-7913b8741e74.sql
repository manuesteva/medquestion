
-- =========================
-- Profiles
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  theme text not null default 'light' check (theme in ('light','dark')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========================
-- User preferences
-- =========================
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text,
  specialty text,
  phase text,
  daily_goal integer not null default 20,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy "prefs_select_own" on public.user_preferences for select using (auth.uid() = user_id);
create policy "prefs_upsert_own" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "prefs_update_own" on public.user_preferences for update using (auth.uid() = user_id);

create trigger prefs_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- =========================
-- Uploads
-- =========================
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text,
  status text not null default 'processing' check (status in ('processing','done','failed')),
  error text,
  questions_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.uploads enable row level security;
create policy "uploads_select_own" on public.uploads for select using (auth.uid() = user_id);
create policy "uploads_insert_own" on public.uploads for insert with check (auth.uid() = user_id);
create policy "uploads_update_own" on public.uploads for update using (auth.uid() = user_id);
create policy "uploads_delete_own" on public.uploads for delete using (auth.uid() = user_id);

-- =========================
-- Questions
-- =========================
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_id uuid references public.uploads(id) on delete set null,
  statement text not null,
  subject text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  source text,
  created_at timestamptz not null default now()
);
alter table public.questions enable row level security;
create index questions_user_id_idx on public.questions(user_id);
create index questions_subject_idx on public.questions(subject);

create policy "questions_select_own" on public.questions for select using (auth.uid() = user_id);
create policy "questions_insert_own" on public.questions for insert with check (auth.uid() = user_id);
create policy "questions_update_own" on public.questions for update using (auth.uid() = user_id);
create policy "questions_delete_own" on public.questions for delete using (auth.uid() = user_id);

-- =========================
-- Question options
-- =========================
create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null check (label in ('A','B','C','D','E')),
  text text not null,
  is_correct boolean not null default false,
  unique(question_id, label)
);
alter table public.question_options enable row level security;
create index question_options_q_idx on public.question_options(question_id);

create policy "options_select_own" on public.question_options for select using (
  exists (select 1 from public.questions q where q.id = question_id and q.user_id = auth.uid())
);
create policy "options_insert_own" on public.question_options for insert with check (
  exists (select 1 from public.questions q where q.id = question_id and q.user_id = auth.uid())
);
create policy "options_update_own" on public.question_options for update using (
  exists (select 1 from public.questions q where q.id = question_id and q.user_id = auth.uid())
);
create policy "options_delete_own" on public.question_options for delete using (
  exists (select 1 from public.questions q where q.id = question_id and q.user_id = auth.uid())
);

-- =========================
-- Attempts
-- =========================
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid references public.question_options(id) on delete set null,
  is_correct boolean not null,
  time_ms integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.attempts enable row level security;
create index attempts_user_idx on public.attempts(user_id);
create index attempts_question_idx on public.attempts(question_id);

create policy "attempts_select_own" on public.attempts for select using (auth.uid() = user_id);
create policy "attempts_insert_own" on public.attempts for insert with check (auth.uid() = user_id);

-- =========================
-- Favorites
-- =========================
create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.favorites enable row level security;
create policy "fav_select_own" on public.favorites for select using (auth.uid() = user_id);
create policy "fav_insert_own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "fav_delete_own" on public.favorites for delete using (auth.uid() = user_id);

-- =========================
-- Explanations
-- =========================
create table public.explanations (
  question_id uuid primary key references public.questions(id) on delete cascade,
  summary text not null,
  correct_rationale text not null,
  wrong_rationales jsonb not null default '{}'::jsonb,
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.explanations enable row level security;
create policy "expl_select_own" on public.explanations for select using (
  exists (select 1 from public.questions q where q.id = question_id and q.user_id = auth.uid())
);
create policy "expl_insert_own" on public.explanations for insert with check (
  exists (select 1 from public.questions q where q.id = question_id and q.user_id = auth.uid())
);
create policy "expl_update_own" on public.explanations for update using (
  exists (select 1 from public.questions q where q.id = question_id and q.user_id = auth.uid())
);

-- =========================
-- Notes
-- =========================
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id, question_id)
);
alter table public.notes enable row level security;
create policy "notes_select_own" on public.notes for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes for update using (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes for delete using (auth.uid() = user_id);
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- =========================
-- Storage bucket
-- =========================
insert into storage.buckets (id, name, public) values ('prova-uploads','prova-uploads', false)
on conflict (id) do nothing;

create policy "uploads_own_read" on storage.objects for select using (
  bucket_id = 'prova-uploads' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "uploads_own_insert" on storage.objects for insert with check (
  bucket_id = 'prova-uploads' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "uploads_own_delete" on storage.objects for delete using (
  bucket_id = 'prova-uploads' and auth.uid()::text = (storage.foldername(name))[1]
);
