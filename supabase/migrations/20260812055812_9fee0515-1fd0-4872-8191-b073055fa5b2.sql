ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS compare_monthly numeric,
  ADD COLUMN IF NOT EXISTS compare_yearly numeric,
  ADD COLUMN IF NOT EXISTS compare_lifetime numeric;

DROP POLICY IF EXISTS "plans_owner_write" ON public.plans;
CREATE POLICY "plans_owner_write" ON public.plans
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));