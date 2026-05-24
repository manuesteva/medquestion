CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('simulado','practice','review')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','finished')),
  question_ids uuid[] NOT NULL DEFAULT '{}',
  picks jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_index int NOT NULL DEFAULT 0,
  elapsed_sec int NOT NULL DEFAULT 0,
  time_limit_sec int,
  correct_count int NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX idx_study_sessions_user_status ON public.study_sessions(user_id, status, last_activity_at DESC);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ss_select_own" ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_insert_own" ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_update_own" ON public.study_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_delete_own" ON public.study_sessions FOR DELETE USING (auth.uid() = user_id);