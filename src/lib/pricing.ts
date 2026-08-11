import type { Database } from "@/integrations/supabase/types";

export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
export type BillingPeriod = Database["public"]["Enums"]["billing_period"];

export const BILLING_OPTIONS: { value: BillingPeriod; label: string; hint?: string }[] = [
  { value: "monthly", label: "شهري" },
  { value: "yearly", label: "سنوي", hint: "شهرين مجانًا" },
  { value: "lifetime", label: "شراء كامل", hint: "دفعة واحدة" },
];

export const BILLING_LABELS: Record<BillingPeriod, string> = {
  monthly: "شهري",
  yearly: "سنوي",
  lifetime: "شراء كامل",
};

const SUFFIX: Record<BillingPeriod, string> = {
  monthly: "/ شهريًا",
  yearly: "/ سنويًا",
  lifetime: "دفعة واحدة",
};

export function planPrice(plan: PlanRow, period: BillingPeriod): number {
  if (period === "yearly") return Number(plan.price_yearly);
  if (period === "lifetime") return Number(plan.price_lifetime);
  return Number(plan.price_monthly);
}

/** نص السعر المعروض للباقة حسب نوع الدفع */
export function planPriceLabel(
  plan: PlanRow,
  period: BillingPeriod,
): { amount: string; suffix: string | null } {
  if (plan.is_custom_priced) return { amount: "بحسب الحاجة", suffix: null };
  const value = planPrice(plan, period);
  if (value === 0) return { amount: "مجانًا", suffix: null };
  return { amount: `${value.toLocaleString("ar-EG")} ${plan.currency}`, suffix: SUFFIX[period] };
}
