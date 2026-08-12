CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'tenant_admin',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_owner_manage ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY invitations_manager_read ON public.invitations
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_manager(auth.uid(), tenant_id));

CREATE POLICY invitations_manager_insert ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IS NOT NULL
    AND role <> 'platform_owner'
    AND public.is_tenant_manager(auth.uid(), tenant_id)
  );

CREATE POLICY invitations_manager_delete ON public.invitations
  FOR DELETE TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_manager(auth.uid(), tenant_id));

CREATE INDEX idx_invitations_email ON public.invitations (lower(email));
CREATE INDEX idx_invitations_tenant ON public.invitations (tenant_id, status);

CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.plan_requests
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plan_requests_status ON public.plan_requests (status, created_at DESC);