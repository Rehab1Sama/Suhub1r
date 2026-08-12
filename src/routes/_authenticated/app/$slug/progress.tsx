import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { trackCategoryLabel } from "@/lib/track-categories";
import {
  AyahRangePicker,
  emptyRange,
  isCompleteRange,
  rangePages,
  toRange,
  type RangeValue,
} from "@/components/AyahRangePicker";
import { normalizeRange } from "@/lib/quran";

export const Route = createFileRoute("/_authenticated/app/$slug/progress")({
  head: () => ({
    meta: [
      { title: "الأنصبة والتقدم — سُحُب" },
      { name: "description", content: "تسجيل أنصبة الطالبات بالسور والآيات وحساب الأوجه تلقائياً وفق مصحف المدينة." },
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

function rangeFrom(row: {
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
}): RangeValue {
  if (!row.from_surah || !row.from_ayah || !row.to_surah || !row.to_ayah) return emptyRange;
  return {
    fromSurah: String(row.from_surah),
    fromAyah: String(row.from_ayah),
    toSurah: String(row.to_surah),
    toAyah: String(row.to_ayah),
  };
}

function rangeColumns(v: RangeValue) {
  const r = toRange(v);
  if (!r) return { from_surah: null, from_ayah: null, to_surah: null, to_ayah: null };
  const n = normalizeRange(r);
  return {
    from_surah: n.fromSurah,
    from_ayah: n.fromAyah,
    to_surah: n.toSurah,
    to_ayah: n.toAyah,
  };
}

function ProgressPage() {
  const { tenant, canRead, canManage, canRecord, loading } = useTenantContext();
  const qc = useQueryClient();
  const [circleId, setCircleId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [targetRanges, setTargetRanges] = useState<Record<string, RangeValue>>({});
  const [dayRanges, setDayRanges] = useState<Record<string, RangeValue>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const meQuery = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const myId = meQuery.data?.id ?? null;

  const circlesQuery = useQuery({
    queryKey: ["circles", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name, track_id, teacher_user_id, tracks(name, category)")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const allCircles = circlesQuery.data ?? [];
  const myCircles = myId ? allCircles.filter((c) => c.teacher_user_id === myId) : [];
  // المعلمة/المشرفة ترى حلقاتها المرتبطة بها فقط؛ القيادة ترى كل الحلقات
  const visibleCircles = canManage ? allCircles : myCircles.length ? myCircles : [];

  useEffect(() => {
    if (!circleId && visibleCircles.length) setCircleId(visibleCircles[0]!.id);
  }, [circleId, visibleCircles]);

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
        .select("student_id, track_id, target_amount, from_surah, from_ayah, to_surah, to_ayah")
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
        .select("student_id, track_id, amount, notes, from_surah, from_ayah, to_surah, to_ayah")
        .eq("tenant_id", tenant!.id)
        .eq("record_date", date);
      if (error) throw error;
      return data;
    },
  });

  const selected = visibleCircles.find((c) => c.id === circleId);
  const trackId = selected?.track_id ?? "";

  const enroll = enrollmentsQuery.data ?? {};
  const circleStudents = (studentsQuery.data ?? []).filter((s) =>
    (enroll[s.id] ?? []).includes(circleId),
  );

  // تعبئة الحالة من قاعدة البيانات عند تغيير الحلقة أو اليوم
  const quotaRows = quotasQuery.data;
  const dayRows = dayProgressQuery.data;
  useEffect(() => {
    if (!trackId) return;
    const t: Record<string, RangeValue> = {};
    for (const q of quotaRows ?? []) if (q.track_id === trackId) t[q.student_id] = rangeFrom(q);
    const d: Record<string, RangeValue> = {};
    const n: Record<string, string> = {};
    for (const r of dayRows ?? []) {
      if (r.track_id === trackId) {
        d[r.student_id] = rangeFrom(r);
        if (r.notes) n[r.student_id] = r.notes;
      }
    }
    setTargetRanges(t);
    setDayRanges(d);
    setNotes(n);
  }, [trackId, date, quotaRows, dayRows]);

  const saveQuotas = useMutation({
    mutationFn: async () => {
      if (!trackId) return;
      const rows = circleStudents
        .filter((s) => isCompleteRange(targetRanges[s.id] ?? emptyRange))
        .map((s) => {
          const v = targetRanges[s.id]!;
          return {
            tenant_id: tenant!.id,
            student_id: s.id,
            track_id: trackId,
            target_amount: rangePages(v) ?? 0,
            ...rangeColumns(v),
          };
        });
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
        .filter((s) => isCompleteRange(dayRanges[s.id] ?? emptyRange))
        .map((s) => {
          const v = dayRanges[s.id]!;
          return {
            tenant_id: tenant!.id,
            student_id: s.id,
            track_id: trackId,
            circle_id: circleId,
            record_date: date,
            amount: rangePages(v) ?? 0,
            notes: (notes[s.id] ?? "").trim() || null,
            ...rangeColumns(v),
          };
        });
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

  const categoryLabel = selected?.tracks?.category
    ? trackCategoryLabel(selected.tracks.category)
    : null;

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
            <Label>حلقتي</Label>
            {visibleCircles.length > 1 ? (
              <Select value={circleId} onValueChange={setCircleId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختاري حلقة" />
                </SelectTrigger>
                <SelectContent>
                  {visibleCircles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.tracks?.name ? ` — ${c.tracks.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-base font-semibold">
                {selected ? selected.name : "لم تُسنَد إليكِ حلقة بعد"}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {selected
                ? `المسار: ${selected.tracks?.name ?? "—"}${categoryLabel ? ` — ${categoryLabel}` : ""}`
                : "تواصلي مع قائدة المقرأة لربط حلقتك بكِ."}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="date">اليوم</Label>
            <Input id="date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {canRecord
                ? "اختاري السورة والآية، ويُحسب عدد الأوجه تلقائياً وفق مصحف المدينة."
                : "قراءة فقط — إعداد المقرأة لا يسمح لكِ بالإدخال."}
            </p>
          </div>
        </section>

        {!selected ? (
          <EmptyState
            icon={<BookOpenText className="size-6" />}
            title="لا توجد حلقة مرتبطة بكِ"
            description="بعد أن تربط القائدة الحلقة بحسابك ستظهر طالباتك ومسارهن هنا مباشرة."
          />
        ) : circleStudents.length === 0 ? (
          <EmptyState
            icon={<BookOpenText className="size-6" />}
            title="لا توجد طالبات في هذه الحلقة"
            description="تُضاف الطالبات إلى الحلقة من صفحة الطالبات."
          />
        ) : (
          <>
            <div className="space-y-4">
              {circleStudents.map((s) => {
                const t = targetRanges[s.id] ?? emptyRange;
                const d = dayRanges[s.id] ?? emptyRange;
                const done = rangePages(d);
                const target = rangePages(t);
                return (
                  <section key={s.id} className="surface-panel space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">{s.full_name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {done !== null && target !== null
                          ? `${done} من ${target} أوجه`
                          : categoryLabel ?? ""}
                      </span>
                    </div>
                    <AyahRangePicker
                      label="النصاب المستهدف"
                      value={t}
                      disabled={!canRecord}
                      onChange={(v) => setTargetRanges({ ...targetRanges, [s.id]: v })}
                    />
                    <AyahRangePicker
                      label="منجز اليوم"
                      value={d}
                      disabled={!canRecord}
                      onChange={(v) => setDayRanges({ ...dayRanges, [s.id]: v })}
                    />
                    {canRecord ? (
                      <div className="grid gap-1.5">
                        <Label className="text-sm">ملاحظات</Label>
                        <Input
                          dir="rtl"
                          value={notes[s.id] ?? ""}
                          onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
                          placeholder="ملاحظة اختيارية"
                        />
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            {canRecord ? (
              <div className="flex flex-wrap justify-end gap-2">
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
          </>
        )}
      </div>
    </AppShell>
  );
}
