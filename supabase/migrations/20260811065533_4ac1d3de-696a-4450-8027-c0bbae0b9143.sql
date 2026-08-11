-- ENUMS
CREATE TYPE public.app_role AS ENUM (
  'platform_owner', 'tenant_admin', 'admin_deputy', 'academic_deputy', 'supervisor', 'teacher', 'student'
);
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'pending');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  description_ar text,
  max_students integer NOT NULL DEFAULT 50,
  max_circles integer NOT NULL DEFAULT 5,
  max_teachers integer NOT NULL DEFAULT 5,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- TENANTS
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  custom_domain text UNIQUE,
  name text NOT NULL,
  short_description text,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#2E7D8F',
  accent_color text NOT NULL DEFAULT '#C9A227',
  contact_email text,
  contact_phone text,
  status public.tenant_status NOT NULL DEFAULT 'active',
  registration_open boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_status ON public.tenants(status);
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  provider text,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_subscriptions_active_tenant ON public.subscriptions(tenant_id) WHERE status IN ('trialing','active');
CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES (tenant scoped; tenant_id NULL = platform level)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_user_roles_unique ON public.user_roles(user_id, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), role);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'platform_owner');
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND tenant_id = _tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_manager(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_tenant_role(_user_id, _tenant_id, ARRAY['tenant_admin','admin_deputy']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id IS NOT NULL;
$$;

-- POLICIES: plans
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "plans_owner_manage" ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));

-- POLICIES: tenants
CREATE POLICY "tenants_public_active_read" ON public.tenants FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "tenants_member_read" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), id) OR public.is_platform_owner(auth.uid()));
CREATE POLICY "tenants_owner_insert" ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE TO authenticated
  USING (public.is_platform_owner(auth.uid()) OR public.is_tenant_manager(auth.uid(), id))
  WITH CHECK (public.is_platform_owner(auth.uid()) OR public.is_tenant_manager(auth.uid(), id));
CREATE POLICY "tenants_owner_delete" ON public.tenants FOR DELETE TO authenticated
  USING (public.is_platform_owner(auth.uid()));

-- POLICIES: subscriptions
CREATE POLICY "subs_read" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_platform_owner(auth.uid()) OR public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "subs_owner_manage" ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));

-- POLICIES: profiles
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_tenant_read" ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_platform_owner(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.id AND ur.tenant_id IN (SELECT public.my_tenant_ids())
    )
  );
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- POLICIES: user_roles
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "roles_tenant_read" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_platform_owner(auth.uid()) OR public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "roles_manage" ON public.user_roles FOR ALL TO authenticated
  USING (
    public.is_platform_owner(auth.uid())
    OR (tenant_id IS NOT NULL AND role <> 'platform_owner' AND public.is_tenant_manager(auth.uid(), tenant_id))
  )
  WITH CHECK (
    public.is_platform_owner(auth.uid())
    OR (tenant_id IS NOT NULL AND role <> 'platform_owner' AND public.is_tenant_manager(auth.uid(), tenant_id))
  );

-- TRIGGERS
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUTO PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED PLANS
INSERT INTO public.plans (code, name_ar, description_ar, max_students, max_circles, max_teachers, price_monthly, features, sort_order) VALUES
('basic', 'الباقة الأساسية', 'مناسبة للمقارئ الناشئة', 50, 5, 5, 0, '["إدارة الحلقات","تسجيل الحضور","تقارير أساسية"]'::jsonb, 1),
('advanced', 'الباقة المتقدمة', 'للمقارئ المتوسطة الحجم', 200, 20, 25, 149, '["كل مزايا الأساسية","إحصائيات متقدمة","إدارة المسارات","صفحة تسجيل مخصصة"]'::jsonb, 2),
('pro', 'الباقة الاحترافية', 'للمقارئ الكبيرة والمؤسسات', 2000, 200, 300, 399, '["كل المزايا","نطاق مخصص","تقارير متقدمة","دعم مخصص"]'::jsonb, 3);