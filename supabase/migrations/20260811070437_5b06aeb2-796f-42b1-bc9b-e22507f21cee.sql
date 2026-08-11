-- Public read of tenant branding for the public tenant landing page
CREATE POLICY "Anyone can view non-suspended tenants"
  ON public.tenants FOR SELECT
  TO anon, authenticated
  USING (status <> 'suspended');

GRANT SELECT ON public.tenants TO anon;

-- Bootstrap platform owner on signup
CREATE OR REPLACE FUNCTION public.bootstrap_platform_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'rrehabfall88@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'platform_owner', NULL)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_platform_owner_trigger ON public.profiles;
CREATE TRIGGER bootstrap_platform_owner_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_platform_owner();

-- Grant the role to the owner account if it already exists
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT id, 'platform_owner', NULL FROM public.profiles
WHERE lower(email) = 'rrehabfall88@gmail.com'
ON CONFLICT DO NOTHING;