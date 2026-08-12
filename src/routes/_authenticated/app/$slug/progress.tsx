import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Target, BookOpenText, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { tenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";

export const Route = createFileRoute("/_authenticated/app/$slug/progress")({
  head: () => ({
    meta: [
      { title: "الأنصبة والتقدم — سُحُب" },
      { name: "description", content: "تحديد الأنصبة للطالبات وتسجيل تقدمهن اليومي في الحفظ والمراجعة والتلاوة." },
      { property: "og:title", content: "الأنصبة والتقدم — سُحُب" },
      { property: "og:description", content: "متابعة أنصبة الطالبات وإنجازهن اليومي على منصة سُحُب." },
    ],
  }),
  component: ProgressPage,
});

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function ProgressPage() {
  const { tenant, canRead, canRecord, loading } = useTenantContext();
  const qc = useQueryClient();
  const [circleId, setCircleId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  // الهدف لكل طالبة (نصاب) والتقدم المسجل لذلك اليوم
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const circlesQuery = useQuery({
    queryKey: ["circles", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name, track_id, tracks(name, category)")
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
        .select("id, full_name")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("circle_students").select("student_id, circle_id");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) (map[row.student_id] ??= []).push(row.circle_id);
      return map;
    },
  });

  const quotasQuery = useQuery({
    queryKey: ["quotas", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotas")
        .select("student_id, track_id, target_amount")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data;
    },
  });

  const dayProgressQuery = useQuery({
    queryKey: ["progress-day", tenant?.id, date],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_records")
        .select("student_id, track_id, amount, notes")
        .eq("tenant_id", tenant!.id)
        .eq("record_date", date);
      if (error) throw error;
      return data;
    },
  });

  const selected = (circlesQuery.data ?? []).find((c) => c.id === circleId);
  const trackId = selected?.track_id ?? "";

  // قائمة الطالبات في الحلقة المختارة
  const enroll = enrollmentsQuery.data ?? {};
  const circleStudents = (studentsQuery.data ?? []).filter((s) =>
    (enroll[s.id] ?? []).includes(circleId),
  );

  function syncState() {
    if (!trackId) return;
    const nextTargets: Record<string, string> = {};
    const nextAmounts: Record<string, string> = {};
    const nextNotes: Record<string, string> = {};
    for (const q of quotasQuery.data ?? []) {
      if (q.track_id === trackId) nextTargets[q.student_id] = String(q.target_amount);
    }
    for (const r of dayProgressQuery.data ?? []) {
      if (r.track_id === trackId) {
        nextAmounts[r.student_id] = String(r.amount);
        if (r.notes) nextNotes[r.student_id] = r.notes;
      }
    }
    setTargets(nextTargets);
    setAmounts(nextAmounts);
    setNotes(nextNotes);
  }

  const saveQuotas = useMutation({
    mutationFn: async () => {
      if (!trackId) return;
      const rows = circleStudents
        .filter((s) => (targets[s.id] ?? "").trim() !== "")
        .map((s) => ({
          tenant_id: tenant!.id,
          student_id: s.id,
          track_id: trackId,
          target_amount: Number(targets[s.id] ?? "0"),
        }));
      if (!rows.length) return;
      const { error } = await supabase
        .from("quotas")
        .upsert(rows, { onConflict: "student_id,track_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الأنصبة");
      void qc.invalidateQueries({ queryKey: ["quotas"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر حفظ الأنصبة — تأكدي من صلاحياتك"),
  });

  const saveProgress = useMutation({
    mutationFn: async () => {
      if (!trackId) return;
      const rows = circleStudents
        .filter((s) => (amounts[s.id] ?? "").trim() !== "")
        .map((s) => ({
          tenant_id: tenant!.id,
          student_id: s.id,
          track_id: trackId,
          record_date: date,
          amount: Number(amounts[s.id] ?? "0"),
          notes: (notes[s.id] ?? "").trim() || null,
        }));
      if (!rows.length) return;
      const { error } = await supabase.from("progress_records").upsert(rows, {
        onConflict: "student_id,track_id,record_date",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل تقدم اليوم");
      void qc.invalidateQueries({ queryKey: ["progress-day"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر تسجيل التقدم — تأكدي من صلاحياتك"),
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

  const activeCircles = circlesQuery.data ?? [];

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الأنصبة والتقدم"
      logoUrl={tenant.logo_url}
      nav={tenantNav(tenant.slug)}
      title="الأنصبة والتقدم"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الأنصبة والتقدم" }]}
    >
      <div className="space-y-6">
        <section className="surface-panel grid gap-4 p-6 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>الحلقة</Label>
            <Select value={circleId} onValueChange={(v) => { setCircleId(v); }}>
              <SelectTrigger>
                <SelectValue placeholder="اختاري حلقة" />
              </SelectTrigger>
              <SelectContent>
                {activeCircles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.tracks?.name ? ` — ${c.tracks.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selected?.tracks?.category ? `الفئة: ${selected.tracks.category}` : ""}
              {!selected ? "اختاري حلقة لعرض طالباتها ومسارها." : ""}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="date">اليوم</Label>
            <Input id="date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {canRecord ? "أدخلي الأنصبة وسجّلي تقدم اليوم للطالبات." : "قراءة فقط — إعداد المقرأة لا يسمح لكِ بالإدخال."}
            </p>
          </div>
        </section>

        {!circleId ? (
          <EmptyState
            icon={<BookOpenText className="size-6" />}
            title="اختاري حلقة للمتابعة"
            description="حدّدي النصاب المستهدف لكل طالبة وسجّلي ما أتمّته اليوم من أوجه."
          />
        ) : (
          <>
            <div className="flex items-center justify-end gap-2">
              {canRecord ? (
                <Button variant="outline" onClick={() => { syncState(); }}>
                  تحميل الحالة الحالية
                </Button>
              ) : null}
            </div>

            {circleStudents.length === 0 ? (
              <EmptyState
                icon={<BookOpenText className="size-6" />}
                title="لا توجد طالبات في هذه الحلقة"
                description="وزّعي الطالبات على الحلقة من صفحة الطالبات ثم عودي لتحديد الأنصبة والتقدم."
              />
            ) : (
              <section className="surface-panel overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الطالبة</TableHead>
                      <TableHead className="text-right">النصاب المستهدف (أوجه)</TableHead>
                      <TableHead className="text-right">منجز اليوم (أوجه)</TableHead>
                      {canRecord ? <TableHead className="text-right">ملاحظات</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {circleStudents.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell>
                          {canRecord ? (
                            <Input
                              type="number"
                              min={0}
                              dir="ltr"
                              className="w-24"
                              value={targets[s.id] ?? ""}
                              onChange={(e) => setTargets({ ...targets, [s.id]: e.target.value })}
                            />
                          ) : (
                            <span className="tabular-nums">{targets[s.id] ?? "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {canRecord ? (
                            <Input
                              type="number"
                              min={0}
                              dir="ltr"
                              className="w-24"
                              value={amounts[s.id] ?? ""}
                              onChange={(e) => setAmounts({ ...amounts, [s.id]: e.target.value })}
                            />
                          ) : (
                            <span className="tabular-nums">{amounts[s.id] ?? "—"}</span>
                          )}
                        </TableCell>
                        {canRecord ? (
                          <TableCell>
                            <Input
                              dir="rtl"
                              value={notes[s.id] ?? ""}
                              onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
                              placeholder="ملاحظة اختيارية"
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {canRecord ? (
                  <div className="flex flex-wrap justify-end gap-2 p-4">
                    <Button variant="outline" onClick={() => saveQuotas.mutate()} disabled={saveQuotas.isPending}>
                      {saveQuotas.isPending ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />}
                      حفظ الأنصبة
                    </Button>
                    <Button onClick={() => saveProgress.mutate()} disabled={saveProgress.isPending}>
                      {saveProgress.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      تسجيل تقدم اليوم
                    </Button>
                  </div>
                ) : null}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
