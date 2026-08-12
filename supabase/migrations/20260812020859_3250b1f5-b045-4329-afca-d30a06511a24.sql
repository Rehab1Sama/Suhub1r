CREATE TYPE public.tenant_progress_mode AS ENUM ('teacher', 'supervisor', 'both');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'excused');

ALTER TABLE public.tenants ADD COLUMN progress_entry_mode tenant_progress_mode NOT NULL DEFAULT 'both';

CREATE OR REPLACE FUNCTION public.can_record_academic(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    is_platform_owner(_user_id)
    OR is_tenant_manager(_user_id, _tenant_id)
    OR has_tenant_role(_user_id, _tenant_id, ARRAY['academic_deputy']::public.app_role[])
    OR (
      has_tenant_role(_user_id, _tenant_id, ARRAY['teacher']::public.app_role[])
      AND COALESCE((SELECT progress_entry_mode FROM public.tenants t WHERE t.id = _tenant_id), 'both'::public.tenant_progress_mode) IN ('teacher','both')
    )
    OR (
      has_tenant_role(_user_id, _tenant_id, ARRAY['supervisor']::public.app_role[])
      AND COALESCE((SELECT progress_entry_mode FROM public.tenants t WHERE t.id = _tenant_id), 'both'::public.tenant_progress_mode) IN ('supervisor','both')
    )
$$;

CREATE TABLE public.quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  target_amount numeric NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'يومي',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, track_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotas TO authenticated;
GRANT ALL ON public.quotas TO service_role;
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotas_member_read" ON public.quotas FOR SELECT TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "quotas_staff_write" ON public.quotas FOR ALL TO authenticated USING (can_record_academic(auth.uid(), tenant_id)) WITH CHECK (can_record_academic(auth.uid(), tenant_id));

CREATE TABLE public.progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX progress_records_tenant_date_idx ON public.progress_records (tenant_id, record_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_records TO authenticated;
GRANT ALL ON public.progress_records TO service_role;
ALTER TABLE public.progress_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_member_read" ON public.progress_records FOR SELECT TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "progress_staff_write" ON public.progress_records FOR ALL TO authenticated USING (can_record_academic(auth.uid(), tenant_id)) WITH CHECK (can_record_academic(auth.uid(), tenant_id));

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  notes text,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, student_id, record_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_member_read" ON public.attendance FOR SELECT TO authenticated USING (is_platform_owner(auth.uid()) OR is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "attendance_staff_write" ON public.attendance FOR ALL TO authenticated USING (can_record_academic(auth.uid(), tenant_id)) WITH CHECK (can_record_academic(auth.uid(), tenant_id));

CREATE OR REPLACE TRIGGER trg_quotas_updated BEFORE UPDATE ON public.quotas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_progress_records_updated BEFORE UPDATE ON public.progress_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();