import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, Upload, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { tenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { TENANT_LOGOS_BUCKET, useTenantLogo } from "@/lib/tenant-branding";
import { PROGRESS_MODE_OPTIONS } from "@/lib/progress";
import type { TenantProgressMode } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/app/$slug/settings")({
  component: TenantBrandingPage,
});

const MANAGER_ROLES = new Set(["tenant_admin", "admin_deputy"]);

function TenantBrandingPage() {
  const { slug } = useParams({ from: "/_authenticated/app/$slug/settings" });
  const { roles, isPlatformOwner, loading } = useAuth();
  const qc = useQueryClient();

  const tenantQuery = useQuery({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, accent_color, short_description, contact_email, contact_phone, registration_open, students_mode, progress_entry_mode, status",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tenant = tenantQuery.data;
  const [primary, setPrimary] = useState("#2E7D8F");
  const [accent, setAccent] = useState("#C9A227");
  const [registration, setRegistration] = useState(false);
  const [studentsMode, setStudentsMode] = useState<"records" | "accounts">("records");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setPrimary(tenant.primary_color ?? "#2E7D8F");
    setAccent(tenant.accent_color ?? "#C9A227");
    setRegistration(tenant.registration_open);
    setStudentsMode(tenant.students_mode === "accounts" ? "accounts" : "records");
  }, [tenant]);

  useTenantTheme(primary, accent);
  const logoUrl = useTenantLogo(tenant?.logo_url);

  const save = useMutation({
    mutationFn: async (values: TablesUpdate<"tenants">) => {
      const { error } = await supabase.from("tenants").update(values).eq("id", tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ هوية المقرأة");
      void qc.invalidateQueries({ queryKey: ["tenant", slug] });
      void qc.invalidateQueries({ queryKey: ["public-tenant", slug] });
    },
    onError: () => toast.error("تعذّر الحفظ — تأكدي من صلاحياتك"),
  });

  async function handleLogo(file: File) {
    if (!tenant) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الشعار يجب أن يكون أقل من ٢ ميجابايت");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${tenant.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(TENANT_LOGOS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      toast.error("تعذّر رفع الشعار");
      return;
    }
    save.mutate({ logo_url: path });
  }

  if (loading || tenantQuery.isLoading) return <LoadingBlock />;

  const myRoles = tenant ? roles.filter((r) => r.tenant_id === tenant.id).map((r) => r.role) : [];
  const canEdit = isPlatformOwner || myRoles.some((r) => MANAGER_ROLES.has(r));

  if (!tenant || !canEdit) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title={tenant ? "لا تملكين صلاحية تعديل هوية المقرأة" : "المقرأة غير موجودة"}
          description="هذه الصفحة متاحة للقائدة ونائبتها ومالكة المنصة."
          action={
            <Button asChild>
              <Link to="/dashboard">العودة للوحتي</Link>
            </Button>
          }
        />
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    save.mutate({
      name: String(fd.get("name") ?? "").trim(),
      short_description: String(fd.get("short_description") ?? "").trim() || null,
      contact_email: String(fd.get("contact_email") ?? "").trim() || null,
      contact_phone: String(fd.get("contact_phone") ?? "").trim() || null,
      primary_color: primary,
      accent_color: accent,
      registration_open: registration,
      students_mode: studentsMode,
    });
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="هوية المقرأة"
      logoUrl={logoUrl}
      nav={tenantNav(slug)}
      title="هوية المقرأة"
      crumbs={[{ label: tenant.name }, { label: "هوية المقرأة" }]}
    >
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <section className="surface-panel space-y-4 p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-bold">البيانات الأساسية</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="name">اسم المقرأة</Label>
            <Input id="name" name="name" defaultValue={tenant.name} required maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="short_description">وصف مختصر</Label>
            <Textarea
              id="short_description"
              name="short_description"
              rows={3}
              maxLength={300}
              defaultValue={tenant.short_description ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="contact_email">بريد المقرأة</Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                dir="ltr"
                defaultValue={tenant.contact_email ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact_phone">جوال التواصل</Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                dir="ltr"
                defaultValue={tenant.contact_phone ?? ""}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">فتح التسجيل للطالبات</p>
              <p className="text-xs text-muted-foreground">
                عند التفعيل يظهر زر التسجيل في صفحة المقرأة العامة.
              </p>
            </div>
            <Switch checked={registration} onCheckedChange={setRegistration} />
          </div>
          <div className="space-y-2 rounded-xl border border-border p-4">
            <Label>طريقة إدارة الطالبات</Label>
            <p className="text-xs text-muted-foreground">اختاري ما يناسب مقرأتك.</p>
            <div className="grid gap-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="students_mode"
                  checked={studentsMode === "records"}
                  onChange={() => setStudentsMode("records")}
                  className="mt-1 size-4"
                />
                <span>
                  <span className="block font-medium">سجلات بسيطة</span>
                  <span className="block text-xs text-muted-foreground">
                    الطالبات سجلات يديرها طاقم المقرأة، دون حسابات دخول مستقلة لكل طالبة.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="students_mode"
                  checked={studentsMode === "accounts"}
                  onChange={() => setStudentsMode("accounts")}
                  className="mt-1 size-4"
                />
                <span>
                  <span className="block font-medium">حسابات مستقلة</span>
                  <span className="block text-xs text-muted-foreground">
                    لكل طالبة حساب دخول خاص بها وتتابع إنجازها بنفسها (يتطلب دعوة الطالبات).
                  </span>
                </span>
              </label>
            </div>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            حفظ التغييرات
          </Button>
        </section>

        <aside className="grid gap-6">
          <div className="surface-panel space-y-3 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Upload className="size-4 text-primary" />
              الشعار
            </h2>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={tenant.name}
                loading="lazy"
                className="size-24 rounded-2xl border border-border object-contain p-2"
              />
            ) : (
              <span className="grid size-24 place-items-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground">
                {tenant.name.slice(0, 1)}
              </span>
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleLogo(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              PNG أو SVG بخلفية شفافة، وبحجم أقل من ٢ ميجابايت.
            </p>
          </div>

          <div className="surface-panel space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Palette className="size-4 text-primary" />
              الألوان
            </h2>
            <div className="grid gap-1.5">
              <Label htmlFor="primary">اللون الأساسي</Label>
              <div className="flex items-center gap-2">
                <input
                  id="primary"
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="size-10 cursor-pointer rounded-lg border border-border bg-transparent"
                />
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="accent">اللون المميّز</Label>
              <div className="flex items-center gap-2">
                <input
                  id="accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="size-10 cursor-pointer rounded-lg border border-border bg-transparent"
                />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} dir="ltr" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              تُطبَّق الألوان فورًا على لوحة المقرأة وصفحتها العامة على الرابط{" "}
              <span dir="ltr">/m/{tenant.slug}</span>
            </p>
          </div>
        </aside>
      </form>
    </AppShell>
  );
}
