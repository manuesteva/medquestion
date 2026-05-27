
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS validation_reason text,
  ADD COLUMN IF NOT EXISTS question_type text,
  ADD COLUMN IF NOT EXISTS affirmatives jsonb,
  ADD COLUMN IF NOT EXISTS explanation_raw text;

ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS pipeline_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_numbers integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pending_confirmation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_payload jsonb;
