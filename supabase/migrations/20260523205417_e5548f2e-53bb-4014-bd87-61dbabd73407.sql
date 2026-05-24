
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS display_name text;

-- Add FK with CASCADE: questions -> uploads
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_upload_id_fkey,
  ADD CONSTRAINT questions_upload_id_fkey
    FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE CASCADE;

-- question_options -> questions
ALTER TABLE public.question_options
  DROP CONSTRAINT IF EXISTS question_options_question_id_fkey,
  ADD CONSTRAINT question_options_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- attempts -> questions
ALTER TABLE public.attempts
  DROP CONSTRAINT IF EXISTS attempts_question_id_fkey,
  ADD CONSTRAINT attempts_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- attempts -> question_options (selected_option_id)
ALTER TABLE public.attempts
  DROP CONSTRAINT IF EXISTS attempts_selected_option_id_fkey,
  ADD CONSTRAINT attempts_selected_option_id_fkey
    FOREIGN KEY (selected_option_id) REFERENCES public.question_options(id) ON DELETE SET NULL;

-- favorites -> questions
ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_question_id_fkey,
  ADD CONSTRAINT favorites_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- notes -> questions
ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS notes_question_id_fkey,
  ADD CONSTRAINT notes_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- explanations -> questions
ALTER TABLE public.explanations
  DROP CONSTRAINT IF EXISTS explanations_question_id_fkey,
  ADD CONSTRAINT explanations_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_questions_upload_id ON public.questions(upload_id);
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON public.attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
