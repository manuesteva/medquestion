ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_number integer,
  ADD COLUMN IF NOT EXISTS flagged_inconsistent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS questions_upload_number_idx
  ON public.questions(upload_id, question_number);