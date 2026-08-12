import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { tenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { StudentRow } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/app/$slug/students")({
  head: () => ({
    meta: [
      { title: "الطالبات — سُحُب" },
      { name: "description", content: "إدارة سجلات طالبات المقرأة وتوزيعهن على الحلقات." },
      { property: "og:title", content: "الطالبات — سُحُب" },
      { property: "og:description", content: "إدارة طالبات المقرأة على منصة سُحُب." },
    ],
  }),
  component: StudentsPage,
});

type StudentEdit = {
  id: string | null;
  full_name: string;
  guardian_name: string;
  guardian_phone: string;
  date_of_birth: string;
  notes: string;
  circle_ids: string[];
};

function StudentsPage() {
  const { tenant, canManage, canRead, loading } = useTenantContext();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<StudentEdit | null>(null);
  const [term, setTerm] = useState("");

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const circlesQuery = useQuery({
    queryKey: ["circles", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["students", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, guardian_name, guardian_phone, date_of_birth, notes, status, created_at")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_students")
        .select("student_id, circle_id");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        (map[row.student_id] ??= []).push(row.circle_id);
      }
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async (values: StudentEdit) => {
      const payload = {
        full_name: values.full_name.trim(),
        guardian_name: values.guardian_name.trim() || null,
        guardian_phone: values.guardian_phone.trim() || null,
        date_of_birth: values.date_of_birth || null,
        notes: values.notes.trim() || null,
      };
      let studentId = values.id;
      if (values.id) {
        const { error } = await supabase.from("students").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("students")
          .insert({ ...payload, tenant_id: tenant!.id })
          .select("id")
          .single();
        if (error) throw error;
        studentId = data.id;
      }
      // إعادة بناء تسجيل الطالبة في الحلقات
      const { data: existing, error: exError } = await supabase
        .from("circle_students")
        .select("circle_id")
        .eq("student_id", studentId!);
      if (exError) throw exError;
      const existingIds = new Set((existing ?? []).map((r) => r.circle_id));
      const targetIds = new Set(values.circle_ids);
      const toAdd = [...targetIds].filter((id) => !existingIds.has(id));
      const toRemove = [...existingIds].filter((id) => !targetIds.has(id));
      if (toRemove.length) {
        const { error } = await supabase
          .from("circle_students")
          .delete()
          .eq("student_id", studentId!)
          .in("circle_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from("circle_students")
          .insert(toAdd.map((circle_id) => ({ student_id: studentId!, circle_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ الطالبة");
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["enrollments"] });
      void qc.invalidateQueries({ queryKey: ["circle-student-counts"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الحفظ"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "archived" }) => {
      const { error } = await supabase.from("students").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الطالبة");
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error("تعذّر تحديث الحالة"),
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

  const circleMap = new Map((circlesQuery.data ?? []).map((c) => [c.id, c.name]));
  const enroll = enrollmentsQuery.data ?? {};
  const rows = (studentsQuery.data ?? []).filter(
    (s) =>
      !term ||
      s.full_name.toLowerCase().includes(term.toLowerCase()) ||
      (s.guardian_phone ?? "").includes(term),
  );

  function openNew() {
    setEdit({
      id: null,
      full_name: "",
      guardian_name: "",
      guardian_phone: "",
      date_of_birth: "",
      notes: "",
      circle_ids: [],
    });
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الطالبات"
      logoUrl={tenant.logo_url}
      nav={tenantNav(tenant.slug)}
      title="الطالبات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الطالبات" }]}
      actions={
        canManage ? (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" />
            طالبة جديدة
          </Button>
        ) : undefined
      }
    >
      <div className="relative mb-4 min-w-56">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحثي بالاسم أو جوال وليّ الأمر"
          className="pr-9"
        />
      </div>

      {studentsQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Plus className="size-6" />}
          title={term ? "لا نتائج مطابقة" : "لا توجد طالبات بعد"}
          description={term ? "جرّبي كلمة بحث مختلفة." : "أضيفي أول طالبة ووزّعيها على الحلقات."}
          action={!term && canManage ? <Button onClick={openNew}>إضافة طالبة</Button> : undefined}
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الطالبة</TableHead>
                <TableHead className="text-right">ولي الأمر</TableHead>
                <TableHead className="text-right">الحلقات</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                {canManage ? <TableHead className="text-right">إجراءات</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.full_name}
                    {s.notes ? (
                      <p className="max-w-xs truncate text-xs text-muted-foreground">{s.notes}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p>{s.guardian_name || "—"}</p>
                    {s.guardian_phone ? (
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {s.guardian_phone}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {(enroll[s.id] ?? []).length ? (
                      <span className="flex flex-wrap gap-1">
                        {(enroll[s.id] ?? []).map((cid) => (
                          <span key={cid} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {circleMap.get(cid) ?? "—"}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canManage ? (
                        <Switch
                          checked={s.status === "active"}
                          onCheckedChange={(checked) =>
                            toggleStatus.mutate({ id: s.id, status: checked ? "active" : "archived" })
                          }
                        />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {s.status === "active" ? "نشطة" : "مؤرشفة"}
                      </span>
                    </div>
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEdit({
                            id: s.id,
                            full_name: s.full_name,
                            guardian_name: s.guardian_name ?? "",
                            guardian_phone: s.guardian_phone ?? "",
                            date_of_birth: s.date_of_birth ?? "",
                            notes: s.notes ?? "",
                            circle_ids: enroll[s.id] ?? [],
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "تعديل الطالبة" : "طالبة جديدة"}</DialogTitle>
            <DialogDescription>أدخلي بيانات الطالبة واختاري الحلقات التي تسجل فيها.</DialogDescription>
          </DialogHeader>
          {edit ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="s-name">اسم الطالبة</Label>
                <Input
                  id="s-name"
                  value={edit.full_name}
                  onChange={(e) => setEdit({ ...edit, full_name: e.target.value })}
                  required
                  maxLength={120}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="s-guardian">اسم وليّ الأمر</Label>
                  <Input
                    id="s-guardian"
                    value={edit.guardian_name}
                    onChange={(e) => setEdit({ ...edit, guardian_name: e.target.value })}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-phone">جوال وليّ الأمر</Label>
                  <Input
                    id="s-phone"
                    dir="ltr"
                    value={edit.guardian_phone}
                    onChange={(e) => setEdit({ ...edit, guardian_phone: e.target.value })}
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-dob">تاريخ الميلاد</Label>
                <Input
                  id="s-dob"
                  type="date"
                  value={edit.date_of_birth}
                  onChange={(e) => setEdit({ ...edit, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الحلقات المسجلة فيها</Label>
                {circlesQuery.data?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(circlesQuery.data ?? []).map((c) => {
                      const checked = edit.circle_ids.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            checked={checked}
                            onChange={() =>
                              setEdit({
                                ...edit,
                                circle_ids: checked
                                  ? edit.circle_ids.filter((id) => id !== c.id)
                                  : [...edit.circle_ids, c.id],
                              })
                            }
                          />
                          {c.name}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    لا توجد حلقات نشطة — أنشئي حلقات أولًا من صفحة الحلقات.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-notes">ملاحظات</Label>
                <Textarea
                  id="s-notes"
                  rows={2}
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  maxLength={300}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => edit && save.mutate(edit)} disabled={save.isPending || !edit?.full_name.trim()}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
