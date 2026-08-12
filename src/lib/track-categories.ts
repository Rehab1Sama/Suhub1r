/** فئات المسارات (المناهج) — ثابتة، تختار منها كل مقرأة ما يناسبها */
export const TRACK_CATEGORY_LABELS: Record<string, string> = {
  hifz_new: "حفظ جديد",
  thabit_new: "تثبيت جديد",
  review_general: "مراجعة عامة",
  review_recent: "مراجعة قريبة",
  review_distant: "مراجعة بعيدة",
  tilawa: "تلاوة",
} as const;

export const TRACK_CATEGORY_KEYS = Object.keys(TRACK_CATEGORY_LABELS);

export function trackCategoryLabel(category: string | null | undefined): string {
  return TRACK_CATEGORY_LABELS[category ?? ""] ?? "—";
}
