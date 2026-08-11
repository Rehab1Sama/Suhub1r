ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_yearly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_lifetime numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_custom_priced boolean NOT NULL DEFAULT false;

CREATE TYPE public.billing_period AS ENUM ('monthly', 'yearly', 'lifetime');
CREATE TYPE public.request_status AS ENUM ('new', 'contacted', 'approved', 'rejected');

CREATE TABLE public.plan_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  billing_period public.billing_period NOT NULL DEFAULT 'monthly',
  tenant_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  notes text,
  status public.request_status NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.plan_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.plan_requests TO authenticated;
GRANT ALL ON public.plan_requests TO service_role;
ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_request_plan" ON public.plan_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "platform_owner_reads_plan_requests" ON public.plan_requests
  FOR SELECT TO authenticated USING (public.is_platform_owner(auth.uid()));
CREATE POLICY "platform_owner_updates_plan_requests" ON public.plan_requests
  FOR UPDATE TO authenticated USING (public.is_platform_owner(auth.uid()));
CREATE POLICY "platform_owner_deletes_plan_requests" ON public.plan_requests
  FOR DELETE TO authenticated USING (public.is_platform_owner(auth.uid()));

CREATE TRIGGER set_plan_requests_updated_at
  BEFORE UPDATE ON public.plan_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.contact_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status public.request_status NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_send_message" ON public.contact_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "platform_owner_reads_messages" ON public.contact_messages
  FOR SELECT TO authenticated USING (public.is_platform_owner(auth.uid()));
CREATE POLICY "platform_owner_updates_messages" ON public.contact_messages
  FOR UPDATE TO authenticated USING (public.is_platform_owner(auth.uid()));
CREATE POLICY "platform_owner_deletes_messages" ON public.contact_messages
  FOR DELETE TO authenticated USING (public.is_platform_owner(auth.uid()));

CREATE TRIGGER set_contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();