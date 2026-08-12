ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS teacher_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_circles_teacher_user ON public.circles(teacher_user_id);

ALTER TABLE public.progress_records
  ADD COLUMN IF NOT EXISTS from_surah smallint,
  ADD COLUMN IF NOT EXISTS from_ayah smallint,
  ADD COLUMN IF NOT EXISTS to_surah smallint,
  ADD COLUMN IF NOT EXISTS to_ayah smallint,
  ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES public.circles(id) ON DELETE SET NULL;

ALTER TABLE public.quotas
  ADD COLUMN IF NOT EXISTS from_surah smallint,
  ADD COLUMN IF NOT EXISTS from_ayah smallint,
  ADD COLUMN IF NOT EXISTS to_surah smallint,
  ADD COLUMN IF NOT EXISTS to_ayah smallint;