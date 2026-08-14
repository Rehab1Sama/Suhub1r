-- 1) Fix privilege escalation on user_roles
DROP POLICY IF EXISTS roles_manage ON public.user_roles;

-- Platform owner: full control
CREATE POLICY roles_owner_manage ON public.user_roles
FOR ALL TO authenticated
USING (public.is_platform_owner(auth.uid()))
WITH CHECK (public.is_platform_owner(auth.uid()));

-- Tenant managers: only non-elevated roles inside their own tenant
CREATE POLICY roles_manager_insert_basic ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IS NOT NULL
  AND public.is_tenant_manager(auth.uid(), tenant_id)
  AND role = ANY (ARRAY['academic_deputy','supervisor','teacher','student']::public.app_role[])
);

CREATE POLICY roles_manager_update_basic ON public.user_roles
FOR UPDATE TO authenticated
USING (
  tenant_id IS NOT NULL
  AND public.is_tenant_manager(auth.uid(), tenant_id)
  AND role = ANY (ARRAY['academic_deputy','supervisor','teacher','student']::public.app_role[])
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND public.is_tenant_manager(auth.uid(), tenant_id)
  AND role = ANY (ARRAY['academic_deputy','supervisor','teacher','student']::public.app_role[])
);

CREATE POLICY roles_manager_delete_basic ON public.user_roles
FOR DELETE TO authenticated
USING (
  tenant_id IS NOT NULL
  AND public.is_tenant_manager(auth.uid(), tenant_id)
  AND role = ANY (ARRAY['academic_deputy','supervisor','teacher','student']::public.app_role[])
);

-- Elevated tenant roles only via a valid pending invitation addressed to the caller
CREATE POLICY roles_accept_invitation ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role <> 'platform_owner'::public.app_role
  AND EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.tenant_id = public.user_roles.tenant_id
      AND i.role = public.user_roles.role
      AND i.status = 'pending'
      AND i.expires_at > now()
      AND lower(i.email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
  )
);

-- 2) Remove redundant broader public read on tenants (keeps active-only public read)
DROP POLICY IF EXISTS "Anyone can view non-suspended tenants" ON public.tenants;