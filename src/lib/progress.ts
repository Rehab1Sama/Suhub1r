import * as ExcelJS from "exceljs";
import type { AttendanceStatus, TenantProgressMode } from "@/lib/types";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضرة",
  absent: "غائبة",
  excused: "معذورة",
};

export const ATTENDANCE_STATUS_KEYS: AttendanceStatus[] = ["present", "absent", "excused"];

export const PROGRESS_MODE_LABELS: Record<TenantProgressMode, string> = {
  teacher: "المعلمة فقط",
  supervisor: "المشرفة فقط",
  both: "المعلمة والمشرفة",
};

export const PROGRESS_MODE_OPTIONS: { value: TenantProgressMode; title: string; hint: string }[] = [
  { value: "teacher", title: "المعلمة", hint: "كل معلمة تُدخل الأنصبة والتقدم والحضور لطالبات حلقاتها." },
  { value: "supervisor", title: "المشرفة", hint: "المشرفة فقط تُدخل الأنصبة والتقدم والحضور على مستوى المقرأة." },
  { value: "both", title: "المعلمة والمشرفة", hint: "كلتاهما قادرتان على الإدخال." },
];

/** تصدير ملف إكسل وتنزيله من المتصفح */
async function downloadWorkbook(filename: string, build: (wb: ExcelJS.Workbook) => void) {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function wbSheet(wb: ExcelJS.Workbook, name: string) {
  const ws = wb.addWorksheet(name);
  ws.views = [{ rightToLeft: true } as ExcelJS.WorksheetViewNormal];
  return ws;
}

function styleHeader(ws: ExcelJS.Worksheet, row: number) {
  const header = ws.getRow(row);
  header.font = { bold: true };
  header.eachCell((c: ExcelJS.Cell) => {
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D8F" } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
}

export type TrackExport = { name: string; category: string; oruj: number; absences: number };

export async function exportReportExcel(opts: {
  madrasa: string;
  periodLabel: string;
  students: number;
  staff: number;
  volunteers: number;
  totalOruj: number;
  totalAbsences: number;
  attendanceRatio: number | null;
  quotaStudents: number;
  metQuota: number;
  tracks: TrackExport[];
}) {
  await downloadWorkbook(`تقرير-${opts.madrasa}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "الإحصائيات");
    ws.addRow(["تقرير إحصائيات — " + opts.madrasa]);
    ws.addRow(["الفترة: " + opts.periodLabel]);
    ws.addRow([]);
    const rows: [string, string | number][] = [
      ["عدد الطالبات", opts.students],
      ["عدد الموظفات/المتطوعات", opts.staff],
      ["عدد المتطوعات", opts.volunteers],
      ["إجمالي الأوجه المنجزة", opts.totalOruj],
      ["طالبات لديهن نصاب", opts.quotaStudents],
      ["أنجزن نصابهن في الفترة", opts.metQuota],
      ["إجمالي الغياب", opts.totalAbsences],
      ["نسبة الغياب", opts.attendanceRatio === null ? "—" : Math.round(opts.attendanceRatio * 100) + "%"],
    ];
    for (const [k, v] of rows) ws.addRow([k, v]);
    ws.addRow([]);
    ws.addRow(["التفاصيل حسب المسار"]);
    ws.addRow(["المسار", "الفئة", "الأوجه المنجزة", "الغياب"]);
    for (const t of opts.tracks) ws.addRow([t.name, t.category, t.oruj, t.absences]);
    ws.columns.forEach((c) => (c.width = 24));
    styleHeader(ws, 1);
  });
}

export async function exportStudentsExcel(opts: {
  madrasa: string;
  rows: { name: string; guardian: string; phone: string; dob: string; circles: string; status: string }[];
}) {
  await downloadWorkbook(`طالبات-${opts.madrasa}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "الطالبات");
    ws.addRow(["اسم الطالبة", "ولي الأمر", "جوال ولي الأمر", "تاريخ الميلاد", "الحلقات", "الحالة"]);
    for (const r of opts.rows) ws.addRow([r.name, r.guardian, r.phone, r.dob, r.circles, r.status]);
    ws.columns.forEach((c) => (c.width = 22));
    styleHeader(ws, 1);
  });
}

export async function exportVolunteersExcel(opts: {
  madrasa: string;
  rows: { name: string; email: string; role: string; volunteer: boolean }[];
}) {
  await downloadWorkbook(`طاقم-${opts.madrasa}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "الطاقم");
    ws.addRow(["الاسم", "البريد", "الدور", "متطوعة"]);
    for (const r of opts.rows) ws.addRow([r.name, r.email, r.role, r.volunteer ? "نعم" : "لا"]);
    ws.columns.forEach((c) => (c.width = 22));
    styleHeader(ws, 1);
  });
}
