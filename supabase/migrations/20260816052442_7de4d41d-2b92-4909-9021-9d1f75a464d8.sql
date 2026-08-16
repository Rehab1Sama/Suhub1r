-- 1) أسماء جذابة + حدود متمايزة + ترتيب
UPDATE public.plans SET name_ar = 'نسمة', description_ar = 'تجربة مجانية لاستكشاف المنصة قبل الاشتراك', max_students = 15, max_circles = 2, max_teachers = 2, sort_order = 1, features = '["تجربة كاملة للأساسيات","بدون بطاقة دفع"]'::jsonb WHERE code = 'trial';

UPDATE public.plans SET name_ar = 'غيمة', description_ar = 'بداية خفيفة لمقرأة واحدة أو حلقات منزلية', max_students = 60, max_circles = 6, max_teachers = 5, sort_order = 2, features = '["مناسبة للمقارئ الناشئة","تصدير بيانات الطالبات"]'::jsonb WHERE code = 'beginning';

UPDATE public.plans SET name_ar = 'سحابة', description_ar = 'للمقارئ النشطة التي تحتاج فريقًا وتقارير أعمق', max_students = 200, max_circles = 20, max_teachers = 15, sort_order = 3, features = '["صلاحيات وكيلات ومشرفات","تقارير متقدمة وهوية مخصصة"]'::jsonb WHERE code = 'basic';

UPDATE public.plans SET name_ar = 'غيث', description_ar = 'الأنسب للمقارئ الكبيرة متعددة الحلقات والفرق', max_students = 800, max_circles = 80, max_teachers = 60, sort_order = 4, is_featured = true, features = '["صفحة تعريفية ونطاق مخصص","دعم ذو أولوية"]'::jsonb WHERE code = 'pro';

UPDATE public.plans SET name_ar = 'سماء', description_ar = 'للمؤسسات والجمعيات الكبيرة باحتياجات خاصة', max_students = 0, max_circles = 0, max_teachers = 0, sort_order = 5, features = '["بلا حدود للطالبات والحلقات","تهيئة وتدريب ومتابعة مخصصة"]'::jsonb WHERE code = 'enterprise';

-- 2) مزايا جديدة
INSERT INTO public.features (key, name_ar, description_ar, default_enabled, sort_order)
VALUES
  ('onboarding', 'تدريب وتهيئة للفريق', 'جلسات تهيئة وتدريب لفريق المقرأة', false, 160),
  ('account_manager', 'مديرة حساب مخصصة', 'متابعة مباشرة ومسؤولة حساب مخصصة', false, 170)
ON CONFLICT (key) DO NOTHING;

-- 3) إعادة ربط المزايا بالباقات
DELETE FROM public.plan_features;

INSERT INTO public.plan_features (plan_id, feature_key, sort_order)
SELECT p.id, f.key, f.sort_order
FROM public.plans p
JOIN public.features f ON TRUE
WHERE (p.code = 'trial' AND f.key IN ('students','circles','tracks','progress','attendance','reports_basic'))
   OR (p.code = 'beginning' AND f.key IN ('students','circles','tracks','progress','attendance','reports_basic','quotas','exports'))
   OR (p.code = 'basic' AND f.key IN ('students','circles','tracks','progress','attendance','reports_basic','quotas','exports','reports_advanced','roles_deputies','student_accounts','branding'))
   OR (p.code = 'pro' AND f.key IN ('students','circles','tracks','progress','attendance','reports_basic','quotas','exports','reports_advanced','roles_deputies','student_accounts','branding','public_page','custom_domain','priority_support'))
   OR (p.code = 'enterprise' AND f.key IN ('students','circles','tracks','progress','attendance','reports_basic','quotas','exports','reports_advanced','roles_deputies','student_accounts','branding','public_page','custom_domain','priority_support','onboarding','account_manager'));