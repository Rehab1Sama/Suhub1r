import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { tenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app/$slug/volunteers")({
  head: () => ({
    meta: [
      { title: "المتطوعات — سُحُب" },
      { name: "description", content: "إدارة المتطوعات في المقرأة وتتبع أدوارهن ومشاركتهن." },
      { property: "og:title", content: "المتطوعات — سُحُب" },
      { property: "og:description", content: "إدارة متطوعات المقرأة على منصة سُحُب." },
    ],
  }),
  component: VolunteersPage,
});

type RoleRow = {
  user_id: string;
  role: AppRole;
  is_volunteer: boolean;
};

type MemberRow = RoleRow & {
  full_name: string | null;
  email: string | null;
};

function VolunteersPage() {
  const { tenant, canManage, canRead, loading } = useTenantContext();
  const qc = useQueryClient();

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const rolesQuery = useQuery({
    queryKey: ["tenant-members", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, is_volunteer")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["member-profiles", tenant?.id],
    enabled: canRead && !!tenant?.id && (rolesQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = rolesQuery.data!.map((r) => r.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p]));
    },
  });

  const toggleVolunteer = useMutation({
    mutationFn: async ({ user_id, is_volunteer }: { user_id: string; is_volunteer: boolean }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ is_volunteer })
        .eq("tenant_id", tenant!.id)
        .eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: () => toast.error("تعذّر التحديث"),
  });

  if (loading) return <LoadingBlock />;

  if (!tenant || !canRead) {
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

  const profiles = profilesQuery.data ?? new Map();
  const members: MemberRow[] = (rolesQuery.data ?? []).map((r) => {
    const p = profiles.get(r.user_id);
    return { ...r, full_name: p?.full_name ?? null, email: p?.email ?? null };
  });
  const volunteers = members.filter((m) => m.is_volunteer);
  const others = members.filter((m) => !m.is_volunteer);

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="المتطوعات"
      logoUrl={tenant.logo_url}
      nav={tenantNav(tenant.slug)}
      title="المتطوعات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المتطوعات" }]}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        سجّلي هنا من يساعدن في المقرأة من خارج الطاقم الأساسي (معلمات/مشرفات) — مثل المتطوعات في التنظيم أو
        الأنشطة. فعّلي خيار «متطوعة» بجانب اسم العضوة من قائمة الأعضاء أدناه.
      </p>

      {rolesQuery.isLoading ? (
        <LoadingBlock />
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title="لا يوجد أعضاء بعد"
          description="أضيفي أعضاءً عبر دعوتهم للمقرأة، ثم حدّدي من هن المتطوعات."
        />
      ) : (
        <div className="space-y-6">
          {volunteers.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 font-medium">
                <Heart className="size-4 text-primary" /> المتطوعات ({volunteers.length})
              </h2>
              <div className="surface-panel overflow-x-auto">
                <MemberTable
                  rows={volunteers}
                  canManage={canManage}
                  onToggle={(row) =>
                    toggleVolunteer.mutate({ user_id: row.user_id, is_volunteer: !row.is_volunteer })
                  }
                />
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              <h2 className="mb-2 font-medium">بقية الأعضاء ({others.length})</h2>
              <div className="surface-panel overflow-x-auto">
                <MemberTable
                  rows={others}
                  canManage={canManage}
                  onToggle={(row) =>
                    toggleVolunteer.mutate({ user_id: row.user_id, is_volunteer: !row.is_volunteer })
                  }
                />
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function MemberTable({
  rows,
  canManage,
  onToggle,
}: {
  rows: MemberRow[];
  canManage: boolean;
  onToggle: (row: MemberRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">الدور</TableHead>
          {canManage ? <TableHead className="text-right">متطوعة</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.user_id}>
            <TableCell>
              <p className="font-medium">{m.full_name || "—"}</p>
              {m.email ? (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {m.email}
                </p>
              ) : null}
            </TableCell>
            <TableCell>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs text-primary">
                {ROLE_LABELS[m.role]}
              </span>
            </TableCell>
            {canManage ? (
              <TableCell>
                <Switch checked={m.is_volunteer} onCheckedChange={() => onToggle(m)} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
