INSERT INTO public.profiles (id, full_name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), u.email
FROM auth.users u WHERE u.email = 'rrehabfall88@gmail.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT u.id, 'platform_owner'::public.app_role, NULL
FROM auth.users u WHERE u.email = 'rrehabfall88@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'platform_owner');