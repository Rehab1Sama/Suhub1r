REVOKE ALL ON FUNCTION public.tenant_plan_limits(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.tenant_usage(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.tenant_within_limit(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.platform_revenue_monthly(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tenant_plan_limits(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_within_limit(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_revenue_monthly(integer) TO authenticated, service_role;