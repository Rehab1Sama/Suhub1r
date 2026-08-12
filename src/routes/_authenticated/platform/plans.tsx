import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { platformNav } from "@/components/layout/nav";
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
import { useAuth } from "@/hooks/useAuth";
import type { PlanRow } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/platform/plans")({
  head: () => ({
    meta: [
      { title: "إدارة الباقات — سُحُب" },
      {
        name: "description",
        content: "إضافة وتعديل باقات منصة سُحُب: الأسعار، السعر قبل التخفيض، الحدود، والمزايا.",
      },
      { property: "og:title", content: "إدارة الباقات — سُحُب" },
      { property: "og:description", content: "تحكّمي في باقات المنصة وأسعارها ومزاياها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlansAdminPage,
});

type FormState = {
  code: string;
  name_ar: string;
  description_ar: string;
  max_students: string;
  max_circles: string;
  max_teachers: string;
  price_monthly: string;
  price_yearly: string;
  price_lifetime: string;
  compare_monthly: string;
  compare_yearly: string;
  compare_lifetime: string;
  currency: string;
  features: string;
  sort_order: string;
  is_active: boolean;
  is_featured: boolean;
  is_custom_priced: boolean;
};

const EMPTY: FormState = {
  code: "",
  name_ar: "",
  description_ar: "",
  max_students: "50",
  max_circles: "5",
  max_teachers: "5",
  price_monthly: "0",
  price_yearly: "0",
  price_lifetime: "0",
  compare_monthly: "",
  compare_yearly: "",
  compare_lifetime: "",
  currency: "ر.س",
  features: "",
  sort_order: "10",
  is_active: true,
  is_featured: false,
  is_custom_priced: false,
};

function toForm(plan: PlanRow): FormState {
  return {
    code: plan.code,
    name_ar: plan.name_ar,
    description_ar: plan.description_ar ?? "",
    max_students: String(plan.max_students),
    max_circles: String(plan.max_circles),
    max_teachers: String(plan.max_teachers),
    price_monthly: String(plan.price_monthly),
    price_yearly: String(plan.price_yearly),
    price_lifetime: String(plan.price_lifetime),
    compare_monthly: plan.compare_monthly == null ? "" : String(plan.compare_monthly),
    compare_yearly: plan.compare_yearly == null ? "" : String(plan.compare_yearly),
    compare_lifetime: plan.compare_lifetime == null ? "" : String(plan.compare_lifetime),
    currency: plan.currency,
    features: ((plan.features as string[] | null) ?? []).join("\n"),
    sort_order: String(plan.sort_order),
    is_active: plan.is_active,
    is_featured: plan.is_featured,
    is_custom_priced: plan.is_custom_priced,
  };
}

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function optNum(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPayload(form: FormState) {
  return {
    code: form.code.trim(),
    name_ar: form.name_ar.trim(),
    description_ar: form.description_ar.trim() || null,
    max_students: num(form.max_students),
    max_circles: num(form.max_circles),
    max_teachers: num(form.max_teachers),
    price_monthly: num(form.price_monthly),
    price_yearly: num(form.price_yearly),
    price_lifetime: num(form.price_lifetime),
    compare_monthly: optNum(form.compare_monthly),
    compare_yearly: optNum(form.compare_yearly),
    compare_lifetime: optNum(form.compare_lifetime),
    currency: form.currency.trim() || "ر.س",
    features: form.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    sort_order: num(form.sort_order),
    is_active: form.is_active,
    is_featured: form.is_featured,
    is_custom_priced: form.is_custom_priced,
  };
}

function PlansAdminPage() {
  const { isPlatformOwner, loading } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleting, setDeleting] = useState<PlanRow | null>(null);

  const plansQuery = useQuery({
    queryKey: ["platform-plans"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return data as PlanRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      if (!payload.code || !payload.name_ar) throw new Error("الرمز والاسم مطلوبان");
      if (editing) {
        const { error } = await supabase.from("plans").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم تحديث الباقة" : "تمت إضافة الباقة");
      setOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["platform-plans"] });
      void qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الباقة");
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ["platform-plans"] });
      void qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: () => toast.error("تعذّر الحذف — قد تكون الباقة مرتبطة باشتراكات"),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(plan: PlanRow) {
    setEditing(plan);
    setForm(toForm(plan));
    setOpen(true);
  }

  if (loading) return <LoadingBlock />;
  if (!isPlatformOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold">لا تملكين صلاحية الوصول</h1>
          <Button asChild className="mt-4">
            <Link to="/dashboard">العودة للوحتي</Link>
          </Button>
        </div>
      </div>
    );
  }

  const rows = plansQuery.data ?? [];

  return (
    <AppShell
      brandName="سُحُب"
      brandSubtitle="إدارة المنصة"
      nav={platformNav}
      title="الباقات والأسعار"
      crumbs={[{ label: "سُحُب", to: "/platform" }, { label: "الباقات والأسعار" }]}
      actions={
        <Button onClick={openNew}>
          <Plus className="size-4" /> باقة جديدة
        </Button>
      }
    >
      {plansQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          title="لا توجد باقات"
          description="أضيفي أول باقة لتظهر في صفحة الأسعار."
          action={
            <Button onClick={openNew}>
              <Plus className="size-4" /> باقة جديدة
            </Button>
          }
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الباقة</TableHead>
                <TableHead className="text-right">شهري</TableHead>
                <TableHead className="text-right">سنوي</TableHead>
                <TableHead className="text-right">شراء كامل</TableHead>
                <TableHead className="text-right">الحدود</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.name_ar}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {p.code}
                    </p>
                  </TableCell>
                  {(
                    [
                      [p.price_monthly, p.compare_monthly],
                      [p.price_yearly, p.compare_yearly],
                      [p.price_lifetime, p.compare_lifetime],
                    ] as [number, number | null][]
                  ).map(([price, before], i) => (
                    <TableCell key={i} className="tabular-nums">
                      {p.is_custom_priced ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="flex flex-col">
                          <span>{Number(price).toLocaleString("ar-EG")}</span>
                          {before != null && Number(before) > Number(price) ? (
                            <span className="text-xs text-muted-foreground line-through">
                              {Number(before).toLocaleString("ar-EG")}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs text-muted-foreground">
                    {p.max_students || "∞"} طالبة · {p.max_circles || "∞"} حلقة
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                        {p.is_active ? "مفعّلة" : "مخفية"}
                      </span>
                      {p.is_featured ? (
                        <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs text-gold-foreground">
                          مميزة
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Pencil className="size-4" /> تعديل
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الباقة" : "باقة جديدة"}</DialogTitle>
            <DialogDescription>
              "السعر قبل التخفيض" يظهر مشطوبًا بجانب السعر الحالي في صفحة الأسعار. اتركيه فارغًا لعدم إظهاره.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-name">اسم الباقة</Label>
              <Input
                id="p-name"
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-code">الرمز</Label>
              <Input
                id="p-code"
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-desc">الوصف</Label>
              <Textarea
                id="p-desc"
                rows={2}
                value={form.description_ar}
                onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-pm">السعر الشهري</Label>
              <Input
                id="p-pm"
                type="number"
                min={0}
                value={form.price_monthly}
                onChange={(e) => setForm({ ...form, price_monthly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-cm">الشهري قبل التخفيض</Label>
              <Input
                id="p-cm"
                type="number"
                min={0}
                placeholder="اتركيه فارغًا"
                value={form.compare_monthly}
                onChange={(e) => setForm({ ...form, compare_monthly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-py">السعر السنوي</Label>
              <Input
                id="p-py"
                type="number"
                min={0}
                value={form.price_yearly}
                onChange={(e) => setForm({ ...form, price_yearly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-cy">السنوي قبل التخفيض</Label>
              <Input
                id="p-cy"
                type="number"
                min={0}
                placeholder="اتركيه فارغًا"
                value={form.compare_yearly}
                onChange={(e) => setForm({ ...form, compare_yearly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-pl">سعر الشراء الكامل</Label>
              <Input
                id="p-pl"
                type="number"
                min={0}
                value={form.price_lifetime}
                onChange={(e) => setForm({ ...form, price_lifetime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-cl">الشراء الكامل قبل التخفيض</Label>
              <Input
                id="p-cl"
                type="number"
                min={0}
                placeholder="اتركيه فارغًا"
                value={form.compare_lifetime}
                onChange={(e) => setForm({ ...form, compare_lifetime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-cur">العملة</Label>
              <Input
                id="p-cur"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-sort">الترتيب</Label>
              <Input
                id="p-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-st">حد الطالبات (0 = بلا حد)</Label>
              <Input
                id="p-st"
                type="number"
                min={0}
                value={form.max_students}
                onChange={(e) => setForm({ ...form, max_students: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-ci">حد الحلقات (0 = بلا حد)</Label>
              <Input
                id="p-ci"
                type="number"
                min={0}
                value={form.max_circles}
                onChange={(e) => setForm({ ...form, max_circles: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-te">حد المعلمات (0 = بلا حد)</Label>
              <Input
                id="p-te"
                type="number"
                min={0}
                value={form.max_teachers}
                onChange={(e) => setForm({ ...form, max_teachers: e.target.value })}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-feat">المزايا (ميزة في كل سطر)</Label>
              <Textarea
                id="p-feat"
                rows={5}
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <Label htmlFor="p-active">مفعّلة (تظهر للعامة)</Label>
              <Switch
                id="p-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <Label htmlFor="p-featured">الأكثر اختيارًا</Label>
              <Switch
                id="p-featured"
                checked={form.is_featured}
                onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
              <Label htmlFor="p-custom">سعر بحسب الحاجة (بدون أرقام)</Label>
              <Switch
                id="p-custom"
                checked={form.is_custom_priced}
                onCheckedChange={(v) => setForm({ ...form, is_custom_priced: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف الباقة</DialogTitle>
            <DialogDescription>
              سيتم حذف «{deleting?.name_ar}» نهائيًا. إن كانت مرتبطة باشتراكات فالأفضل إخفاؤها بدل حذفها.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
