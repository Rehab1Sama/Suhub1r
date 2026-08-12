import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { TRACK_CATEGORY_LABELS, TRACK_CATEGORY_KEYS, trackCategoryLabel } from "@/lib/track-categories";
import type { TrackRow } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/app/$slug/tracks")({
  head: () => ({
    meta: [
      { title: "المسارات — سُحُب" },
      { name: "description", content: "إدارة المسارات التي تضم حلقات المقرأة بنفس الفئة والفئة العمرية والتوجه." },
      { property: "og:title", content: "المسارات — سُحُب" },
      { property: "og:description", content: "إدارة مسارات الحلقات في مقرأة على منصة سُحُب." },
    ],
  }),
  component: TracksPage,
});

type EditState = {
  id: string | null;
  name: string;
  category: string;
  age_group: string;
  notes: string;
};

function TracksPage() {
  const { tenant, canManage, canRead, loading } = useTenantContext();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditState | null>(null);

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const tracksQuery = useQuery({
    queryKey: ["tracks", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, name, category, age_group, notes, status, sort_order, created_at")
        .eq("tenant_id", tenant!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (values: EditState) => {
      const payload = {
        name: values.name.trim(),
        category: values.category as TrackRow["category"],
        age_group: values.age_group.trim() || null,
        notes: values.notes.trim() || null,
      };
      if (values.id) {
        const { error } = await supabase.from("tracks").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tracks").insert({ ...payload, tenant_id: tenant!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ المسار");
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["tracks"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: () => toast.error("تعذّر الحفظ"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const { error } = await supabase.from("tracks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      void qc.invalidateQueries({ queryKey: ["tracks"] });
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

  const rows = tracksQuery.data ?? [];

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="المسارات"
      logoUrl={tenant.logo_url}
      nav={tenantNav(tenant.slug)}
      title="المسارات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المسارات" }]}
      actions={
        canManage ? (
          <Button
            size="sm"
            onClick={() => setEdit({ id: null, name: "", category: TRACK_CATEGORY_KEYS[0]!, age_group: "", notes: "" })}
          >
            <Plus className="size-4" />
            مسار جديد
          </Button>
        ) : undefined
      }
    >
      {tracksQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Plus className="size-6" />}
          title="لا توجد مسارات بعد"
          description="المسار اسم يضم عدة حلقات بنفس الفئة والعمر والتوجه، مثل مسار «سراج» الذي يضم سراج ١ و٢ للحفظ والمراجعة."
          action={
            canManage ? (
              <Button
                onClick={() =>
                  setEdit({ id: null, name: "", category: TRACK_CATEGORY_KEYS[0]!, age_group: "", notes: "" })
                }
              >
                إنشاء أول مسار
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المسار</TableHead>
                <TableHead className="text-right">الفئة</TableHead>
                <TableHead className="text-right">الفئة العمرية</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                {canManage ? <TableHead className="text-right">إجراءات</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-xs text-primary">
                      {trackCategoryLabel(t.category)}
                    </span>
                  </TableCell>
                  <TableCell>{t.age_group || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canManage ? (
                        <Switch
                          checked={t.status === "active"}
                          onCheckedChange={(checked) =>
                            toggleStatus.mutate({ id: t.id, status: checked ? "active" : "inactive" })
                          }
                        />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {t.status === "active" ? "نشط" : "متوقف"}
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
                            id: t.id,
                            name: t.name,
                            category: t.category,
                            age_group: t.age_group ?? "",
                            notes: t.notes ?? "",
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
            <DialogTitle>{edit?.id ? "تعديل المسار" : "مسار جديد"}</DialogTitle>
            <DialogDescription>
              المسار يجمع حلقات بنفس الاسم والفئة والعمر والتوجه، مثل مسار «سراج» بفئة الحفظ والمراجعة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t-name">اسم المسار</Label>
              <Input
                id="t-name"
                value={edit?.name ?? ""}
                onChange={(e) => setEdit((p) => (p ? { ...p, name: e.target.value } : p))}
                placeholder="مثال: سراج"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>الفئة (المنهج)</Label>
              <Select
                value={edit?.category ?? TRACK_CATEGORY_KEYS[0]}
                onValueChange={(v) => setEdit((p) => (p ? { ...p, category: v } : p))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACK_CATEGORY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {TRACK_CATEGORY_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                القائدة تختار المنهج المناسب لمقرأتها، مثل حفظ جديد أو مراجعة قريبة أو تلاوة.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-age">الفئة العمرية</Label>
              <Input
                id="t-age"
                value={edit?.age_group ?? ""}
                onChange={(e) => setEdit((p) => (p ? { ...p, age_group: e.target.value } : p))}
                placeholder="مثال: الأطفال ٧–١٠"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-notes">ملاحظات</Label>
              <Textarea
                id="t-notes"
                rows={3}
                value={edit?.notes ?? ""}
                onChange={(e) => setEdit((p) => (p ? { ...p, notes: e.target.value } : p))}
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => edit && save.mutate(edit)}
              disabled={save.isPending || !edit?.name.trim()}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
