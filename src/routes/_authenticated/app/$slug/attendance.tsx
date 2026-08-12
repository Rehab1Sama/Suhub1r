import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CalendarCheck, Save } from "lucide-react";
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
import { ATTENDANCE_LABELS, ATTENDANCE_STATUS_KEYS } from "@/lib/progress";
import type { AttendanceStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/app/$slug/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور — سُحُب" },
      { name: "description", content: "تسجيل الحضور والغياب اليومي لطالبات الحلقات." },
      { property: "og:title", content: "الحضور — سُحُب" },
      { property: "og:description", content: "سجل الحضور اليومي لحلقات المقرأة على منصة سُحُب." },
    ],
  }),
  component: AttendancePage,
});

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
  absent: "data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground",
  excused: "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
};

function AttendancePage() {
  const { tenant, canRead, canRecord, loading } = useTenantContext();
  const qc = useQueryClient();
  const [circleId, setCircleId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

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

  const dayAttendanceQuery = useQuery({
    queryKey: ["attendance-day", tenant?.id, circleId, date],
    enabled: canRead && !!tenant?.id && !!circleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("tenant_id", tenant!.id)
        .eq("circle_id", circleId)
        .eq("record_date", date);
      if (error) throw error;
      return data;
    },
  });

  const enroll = enrollmentsQuery.data ?? {};
  const circleStudents = (studentsQuery.data ?? []).filter((s) =>
    (enroll[s.id] ?? []).includes(circleId),
  );

  // تهيئة الحالة من السجلات المحفوظة (حاضرة افتراضيًا)
  function activeStatuses(): Record<string, AttendanceStatus> {
    const saved: Record<string, AttendanceStatus> = {};
    for (const r of dayAttendanceQuery.data ?? []) saved[r.student_id] = r.status;
    const out: Record<string, AttendanceStatus> = {};
    for (const s of circleStudents) out[s.id] = saved[s.id] ?? "present";
    return out;
  }

  const save = useMutation({
    mutationFn: async () => {
      const st = activeStatuses();
      const rows = circleStudents.map((s) => ({
        tenant_id: tenant!.id,
        circle_id: circleId,
        student_id: s.id,
        record_date: date,
        status: st[s.id] ?? "present",
      }));
      const { error } = await supabase.from("attendance").upsert(rows, {
        onConflict: "circle_id,student_id,record_date",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الحضور");
      setStatuses({});
      void qc.invalidateQueries({ queryKey: ["attendance-day"] });
      void qc.invalidateQueries({ queryKey: ["attendance-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر حفظ الحضور — تأكدي من صلاحياتك"),
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

  const savedMap: Record<string, AttendanceStatus> = {};
  for (const r of dayAttendanceQuery.data ?? []) savedMap[r.student_id] = r.status;

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الحضور"
      logoUrl={tenant.logo_url}
      nav={tenantNav(tenant.slug)}
      title="الحضور"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الحضور" }]}
    >
      <div className="space-y-6">
        <section className="surface-panel grid gap-4 p-6 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>الحلقة</Label>
            <Select value={circleId} onValueChange={setCircleId}>
              <SelectTrigger>
                <SelectValue placeholder="اختاري حلقة" />
              </SelectTrigger>
              <SelectContent>
                {(circlesQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="date">اليوم</Label>
            <Input id="date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {canRecord ? "سجّلي حالة كل طالبة ثم احفظي." : "قراءة فقط — إعداد المقرأة لا يسمح لكِ بالإدخال."}
            </p>
          </div>
        </section>

        {!circleId ? (
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title="اختاري حلقة لتسجيل الحضور"
            description="سجّلي حضور وغياب الطالبات لكل يوم."
          />
        ) : dayAttendanceQuery.isLoading ? (
          <LoadingBlock />
        ) : circleStudents.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title="لا توجد طالبات في هذه الحلقة"
            description="وزّعي الطالبات على الحلقة من صفحة الطالبات ثم عودي لتسجيل الحضور."
          />
        ) : (
          <section className="surface-panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الطالبة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {circleStudents.map((s) => {
                  const st = statuses[s.id] ?? savedMap[s.id] ?? "present";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>
                        {canRecord ? (
                          <div className="inline-flex overflow-hidden rounded-lg border border-border">
                            {ATTENDANCE_STATUS_KEYS.map((k) => (
                              <button
                                key={k}
                                type="button"
                                data-state={st === k ? "on" : "off"}
                                onClick={() => setStatuses({ ...statuses, [s.id]: k })}
                                className={`px-3 py-1 text-xs transition-colors ${STATUS_STYLES[k]}`}
                              >
                                {ATTENDANCE_LABELS[k]}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              st === "present"
                                ? "bg-primary-soft text-primary"
                                : st === "absent"
                                  ? "bg-destructive-soft text-destructive"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {ATTENDANCE_LABELS[st]}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {canRecord ? (
              <div className="flex justify-end p-4">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  حفظ الحضور
                </Button>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </AppShell>
  );
}
