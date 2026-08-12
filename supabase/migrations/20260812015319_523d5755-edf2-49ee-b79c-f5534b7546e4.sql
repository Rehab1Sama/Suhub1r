CREATE TYPE public.track_category AS ENUM ('hifz_new', 'thabit_new', 'review_general', 'review_recent', 'review_distant', 'tilawa');
CREATE TYPE public.tenant_students_mode AS ENUM ('records', 'accounts');

CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category track_category NOT NULL,
  age_group text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracks TO authenticated;
GRANT ALL ON public.tracks TO service_role;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracks_member_read" ON public.tracks FOR SELECT TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tracks_manager_write" ON public.tracks FOR ALL TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), tenant_id));

CREATE TABLE public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  name text NOT NULL,
  teacher_name text,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circles TO authenticated;
GRANT ALL ON public.circles TO service_role;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "circles_member_read" ON public.circles FOR SELECT TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "circles_manager_write" ON public.circles FOR ALL TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), tenant_id));

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  guardian_name text,
  guardian_phone text,
  date_of_birth date,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_member_read" ON public.students FOR SELECT TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "students_manager_write" ON public.students FOR ALL TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), tenant_id));

CREATE TABLE public.circle_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_students TO authenticated;
GRANT ALL ON public.circle_students TO service_role;
ALTER TABLE public.circle_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "circle_students_member_read" ON public.circle_students FOR SELECT TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_member(auth.uid(), (SELECT tenant_id FROM public.circles WHERE id = circle_id)));
CREATE POLICY "circle_students_manager_write" ON public.circle_students FOR ALL TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), (SELECT tenant_id FROM public.circles WHERE id = circle_id))) WITH CHECK (is_platform_owner(auth.uid()) OR is_tenant_manager(auth.uid(), (SELECT tenant_id FROM public.circles WHERE id = circle_id)));

ALTER TABLE public.user_roles ADD COLUMN is_volunteer boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN students_mode tenant_students_mode NOT NULL DEFAULT 'records';

CREATE OR REPLACE TRIGGER trg_tracks_updated BEFORE UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_circles_updated BEFORE UPDATE ON public.circles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();