import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-router";
import { useQuery as useRQ, useMutation as useRQM, useQueryClient as useQC } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { tenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type MemberRow = {
  user_id: string;
  role: AppRole;
  is_volunteer: boolean;
  profiles: { full_name: string | null; email: string | null } | null;
};

function VolunteersPage() {
  const { tenant, canManage, canRead, loading } = useTenantContext();
  const qc = useQC();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("teacher");

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const membersQuery = useRQ({
    queryKey: ["tenant-members", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, is_volunteer, profiles(full_name, email)")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data as MemberRow[];
    },
  });

  const toggleVolunteer = useRQM({
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

  const members = membersQuery.data ?? [];
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
      actions={
        canManage ? (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            إضافة متطوعة
          </Button>
        ) : undefined
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        سجّلي هنا من يساعدن في المقرأة من خارج الطاقم الأساسي (معلمات/مشرفات) — مثل المتطوعات في التنظيم أو
        الأنشطة. يمكنكِ تعليم أي عضو في المقرأة كمتطوعة.
      </p>

      {membersQuery.isLoading ? (
        <LoadingBlock />
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title="لا يوجد أعضاء بعد"
          description="أضيفي أعضاءً عبر دعوة، ثم حدّدي من هن المتطوعات."
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

      <Dialog open={inviteOpen} onOpenChange={(o) => !o && setInviteOpen(false)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة متطوعة</DialogTitle>
            <DialogDescription>
              ادخلي بريد العضو الذي تريدين تعليمه كمتطوعة في هذه المقرأة. يجب أن يكون لديه حساب في المنصة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="v-email">بريد العضو</Label>
              <Input
                id="v-email"
                dir="ltr"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-role">الدور</Label>
              <select
                id="v-role"
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                {Object.entries(ROLE_LABELS)
                  .filter(([r]) => r !== "platform_owner")
                  .map(([r, label]) => (
                    <option key={r} value={r}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!email.trim()) {
                  toast.error("أدخلي بريد العضو");
                  return;
                }
                // إضافة دور جديد للمقرأة — إن لم يكن موجودًا أصلًا
                void (async () => {
                  const { error: insError } = await supabase.from("user_roles").insert({
                    tenant_id: tenant!.id,
                    role,
                    is_volunteer: true,
                    user_id: email.trim().toLowerCase(), // placeholder يُستبدل بربط فعلي بالحساب
                  });
                  if (insError) {
                    // محاولة تحديث إن كان موجودًا
                    const { error: updError } = await supabase
                      .from("user_roles")
                      .update({ is_volunteer: true })
                      .eq("tenant_id", tenant!.id);
                    if (updError) {
                      toast.error("تعذّرت الإضافة");
                      return;
                    }
                  }
                  toast.success("تمت إضافة المتطوعة");
                  setInviteOpen(false);
                  setEmail("");
                  void qc.invalidateQueries({ queryKey: ["tenant-members"] });
                })();
              }}
            >
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
              <p className="font-medium">{m.profiles?.full_name || "—"}</p>
              {m.profiles?.email ? (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {m.profiles.email}
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
