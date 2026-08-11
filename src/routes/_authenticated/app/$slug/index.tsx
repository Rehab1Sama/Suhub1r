import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, Layers, ShieldCheck, CalendarCheck, BookMarked } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { tenantNav } from "@/components/layout/nav";
import { StatCard, LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { ROLE_LABELS, SUBSCRIPTION_STATUS_LABELS, type AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app/$slug/")({
  component: TenantDashboard,
});

function TenantDashboard() {
  const { slug } = useParams({ from: "/_authenticated/app/$slug/" });
  const { roles, isPlatformOwner, loading } = useAuth();

  const tenantQuery = useQuery({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, accent_color, short_description, status, subscriptions(status, expires_at, plans(name_ar, max_students, max_circles))",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tenant = tenantQuery.data;
  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const statsQuery = useQuery({
    queryKey: ["tenant-stats", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const roleCount = async (role: AppRole) => {
        const { count, error } = await supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant!.id)
          .eq("role", role);
        if (error) throw error;
        return count ?? 0;
      };
      const [students, teachers, supervisors, admins] = await Promise.all([
        roleCount("student"),
        roleCount("teacher"),
        roleCount("supervisor"),
        roleCount("tenant_admin"),
      ]);
      return { students, teachers, supervisors, admins };
    },
  });

  if (loading || tenantQuery.isLoading) return <LoadingBlock />;

  const myRoles = tenant ? roles.filter((r) => r.tenant_id === tenant.id).map((r) => r.role) : [];
  const canView = isPlatformOwner || myRoles.length > 0;

  if (!tenant || !canView) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title={tenant ? "لا تملكين صلاحية الوصول لهذه المقرأة" : "المقرأة غير موجودة"}
          description="تأكدي من الرابط أو تواصلي مع إدارة المقرأة."
          action={
            <Button asChild>
              <Link to="/dashboard">العودة للوحتي</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const sub = tenant.subscriptions?.[0];
  const plan = sub?.plans;

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle={myRoles.length ? ROLE_LABELS[myRoles[0]!] : "مالكة المنصة"}
      logoUrl={tenant.logo_url}
      nav={tenantNav(slug)}
      title="لوحة المقرأة"
      crumbs={[{ label: tenant.name }, { label: "لوحة المقرأة" }]}
    >
      <div className="space-y-6">
        <section className="surface-panel gradient-sky p-6">
          <h2 className="font-display text-xl font-bold">{tenant.name}</h2>
          {tenant.short_description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tenant.short_description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-card px-3 py-1">
              الباقة: {plan?.name_ar ?? "غير محددة"}
            </span>
            <span className="rounded-full bg-card px-3 py-1">
              الاشتراك: {sub ? (SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status) : "—"}
            </span>
            <span className="rounded-full bg-card px-3 py-1" dir="ltr">
              /m/{tenant.slug}
            </span>
          </div>
        </section>

        {statsQuery.isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="الطالبات"
              value={statsQuery.data?.students ?? 0}
              {...(plan?.max_students ? { hint: `الحد الأعلى ${plan.max_students}` } : {})}
              icon={<GraduationCap className="size-5" />}
            />
            <StatCard label="المعلمات" value={statsQuery.data?.teachers ?? 0} tone="success" icon={<Users className="size-5" />} />
            <StatCard label="المشرفات" value={statsQuery.data?.supervisors ?? 0} tone="gold" icon={<ShieldCheck className="size-5" />} />
            <StatCard label="الإداريات" value={statsQuery.data?.admins ?? 0} icon={<Layers className="size-5" />} />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title="الحضور اليومي"
            description="سيتم تفعيل تسجيل الحضور والسجل التاريخي في المرحلة القادمة."
          />
          <EmptyState
            icon={<BookMarked className="size-6" />}
            title="الإنجاز القرآني"
            description="الحفظ الجديد والمراجعة القريبة والبعيدة والتلاوة — قريبًا."
          />
        </div>
      </div>
    </AppShell>
  );
}
