
-- Folders table
CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY folders_select_own ON public.folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY folders_insert_own ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY folders_update_own ON public.folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY folders_delete_own ON public.folders FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_folders_user ON public.folders(user_id, position);

-- Add folder_id to uploads (nullable; on folder delete -> SET NULL via app logic since no FK exists in existing schema)
ALTER TABLE public.uploads ADD COLUMN folder_id uuid NULL REFERENCES public.folders(id) ON DELETE SET NULL;
CREATE INDEX idx_uploads_folder ON public.uploads(user_id, folder_id);

-- Review later table
CREATE TABLE public.review_later (
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
ALTER TABLE public.review_later ENABLE ROW LEVEL SECURITY;
CREATE POLICY rl_select_own ON public.review_later FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rl_insert_own ON public.review_later FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rl_delete_own ON public.review_later FOR DELETE USING (auth.uid() = user_id);

-- Avatars bucket (public read, user-scoped write)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_user_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "avatars_user_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
