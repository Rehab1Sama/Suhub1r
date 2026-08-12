-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','processing','succeeded','failed','canceled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','open','paid','void','refunded','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.webhook_event_status AS ENUM ('received','processed','ignored','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SUBSCRIPTIONS: extend
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_period public.billing_period NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub_uniq
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- CHECKOUT / PAYMENT ATTEMPTS
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  plan_request_id uuid REFERENCES public.plan_requests(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  billing_period public.billing_period NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider text,
  provider_ref text,
  checkout_url text,
  idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  customer_email text,
  customer_name text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_idem_uniq ON public.payment_intents (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_provider_ref_uniq
  ON public.payment_intents (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_intents_tenant_idx ON public.payment_intents (tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_intents owner manage" ON public.payment_intents
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "payment_intents tenant read" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_payment_intents_updated BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVOICES
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL DEFAULT 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0'),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id),
  billing_period public.billing_period NOT NULL DEFAULT 'monthly',
  description text,
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  provider text,
  provider_invoice_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_uniq ON public.invoices (number);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_invoice_uniq
  ON public.invoices (provider, provider_invoice_id) WHERE provider_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON public.invoices (tenant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status, paid_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices owner manage" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "invoices tenant read" ON public.invoices
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_manager(auth.uid(), tenant_id));

CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WEBHOOK EVENTS (source of truth for activation)
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  status public.webhook_event_status NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_uniq ON public.payment_webhook_events (provider, event_id);

GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_payment_webhook_events_updated BEFORE UPDATE ON public.payment_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PLAN LIMITS
CREATE OR REPLACE FUNCTION public.tenant_plan_limits(_tenant_id uuid)
RETURNS TABLE (plan_id uuid, plan_name text, max_students integer, max_circles integer, max_teachers integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name_ar, p.max_students, p.max_circles, p.max_teachers
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trialing')
  ORDER BY s.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tenant_usage(_tenant_id uuid)
RETURNS TABLE (students integer, circles integer, teachers integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.students st WHERE st.tenant_id = _tenant_id AND st.status = 'active'),
    (SELECT count(*)::int FROM public.circles c WHERE c.tenant_id = _tenant_id AND c.status = 'active'),
    (SELECT count(DISTINCT ur.user_id)::int FROM public.user_roles ur WHERE ur.tenant_id = _tenant_id AND ur.role = 'teacher')
$$;

-- returns true when tenant may add one more of _kind ('students'|'circles'|'teachers')
CREATE OR REPLACE FUNCTION public.tenant_within_limit(_tenant_id uuid, _kind text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE lim int; used int;
BEGIN
  SELECT CASE _kind WHEN 'students' THEN l.max_students WHEN 'circles' THEN l.max_circles WHEN 'teachers' THEN l.max_teachers END
    INTO lim FROM public.tenant_plan_limits(_tenant_id) l;
  IF lim IS NULL THEN RETURN true; END IF;      -- no active plan -> no enforcement here
  IF lim <= 0 THEN RETURN true; END IF;          -- 0 or negative = unlimited
  SELECT CASE _kind WHEN 'students' THEN u.students WHEN 'circles' THEN u.circles WHEN 'teachers' THEN u.teachers END
    INTO used FROM public.tenant_usage(_tenant_id) u;
  RETURN COALESCE(used, 0) < lim;
END $$;

-- REVENUE
CREATE OR REPLACE FUNCTION public.platform_revenue_monthly(_months integer DEFAULT 12)
RETURNS TABLE (month date, currency text, paid_total numeric, invoice_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', i.paid_at)::date AS month,
         i.currency,
         sum(i.amount + i.tax_amount) AS paid_total,
         count(*)::int
  FROM public.invoices i
  WHERE public.is_platform_owner(auth.uid())
    AND i.status = 'paid' AND i.paid_at IS NOT NULL
    AND i.paid_at >= date_trunc('month', now()) - make_interval(months => GREATEST(_months,1) - 1)
  GROUP BY 1, 2
  ORDER BY 1 DESC
$$;

REVOKE ALL ON FUNCTION public.platform_revenue_monthly(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.platform_revenue_monthly(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_plan_limits(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_within_limit(uuid, text) TO authenticated, service_role;