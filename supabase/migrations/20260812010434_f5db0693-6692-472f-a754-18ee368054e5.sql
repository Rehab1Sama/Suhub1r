CREATE TABLE public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  description_ar text,
  default_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.features TO anon;
GRANT SELECT ON public.features TO authenticated;
GRANT ALL ON public.features TO service_role;

ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

CREATE POLICY features_public_read ON public.features
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY features_owner_manage ON public.features
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE TRIGGER trg_features_updated BEFORE UPDATE ON public.features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tenant_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.features(key) ON UPDATE CASCADE ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

CREATE INDEX idx_tenant_features_tenant ON public.tenant_features(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_features TO authenticated;
GRANT ALL ON public.tenant_features TO service_role;

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_features_member_read ON public.tenant_features
  FOR SELECT TO authenticated
  USING (public.is_platform_owner(auth.uid()) OR public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY tenant_features_owner_manage ON public.tenant_features
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE TRIGGER trg_tenant_features_updated BEFORE UPDATE ON public.tenant_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tf.enabled FROM public.tenant_features tf
      WHERE tf.tenant_id = _tenant_id AND tf.feature_key = _feature_key),
    (SELECT f.default_enabled FROM public.features f WHERE f.key = _feature_key),
    false
  );
$$;

INSERT INTO public.features (key, name_ar, description_ar, default_enabled, sort_order) VALUES
  ('circles', 'الحلقات', 'إدارة الحلقات والمجموعات الدراسية', true, 1),
  ('recitation', 'التلاوة والتسميع', 'تسجيل جلسات التسميع والمتابعة اليومية', true, 2),
  ('exams', 'الاختبارات', 'اختبارات الحفظ والتقييم', false, 3),
  ('reports', 'التقارير', 'تقارير الأداء والحضور', true, 4),
  ('certificates', 'الشهادات', 'إصدار شهادات الإنجاز للطالبات', false, 5),
  ('competitions', 'المسابقات', 'تنظيم المسابقات القرآنية', false, 6),
  ('messaging', 'الرسائل', 'مراسلات داخلية بين المعلمات والطالبات', false, 7),
  ('custom_domain', 'النطاق المخصص', 'ربط نطاق خاص بالمقرأة', false, 8);