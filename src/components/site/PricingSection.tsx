import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui-blocks";
import { cn } from "@/lib/utils";
import {
  BILLING_OPTIONS,
  planPriceLabel,
  type BillingPeriod,
  type PlanRow,
} from "@/lib/pricing";
import { PlanRequestDialog } from "@/components/site/PlanRequestDialog";

export function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selected, setSelected] = useState<PlanRow | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as PlanRow[];
    },
  });

  return (
    <div>
      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {BILLING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm transition-colors",
                period === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
              {opt.hint ? (
                <span
                  className={cn(
                    "ms-1.5 text-[11px]",
                    period === opt.value ? "opacity-80" : "text-gold-foreground",
                  )}
                >
                  {opt.hint}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {plans?.map((plan) => {
            const price = planPriceLabel(plan, period);
            const features = (plan.features as string[] | null) ?? [];
            return (
              <article
                key={plan.id}
                className={cn(
                  "surface-panel relative flex flex-col p-6",
                  plan.is_featured && "ring-2 ring-primary",
                )}
              >
                {plan.is_featured ? (
                  <span className="absolute -top-3 start-6 rounded-full bg-gold px-3 py-1 text-xs font-medium text-gold-foreground">
                    الأكثر اختيارًا
                  </span>
                ) : null}
                <h3 className="text-xl font-semibold">{plan.name_ar}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{plan.description_ar}</p>
                <p className="mt-5 font-display text-3xl font-bold tabular-nums">
                  {price.amount}
                  {price.suffix ? (
                    <span className="ms-2 text-sm font-normal text-muted-foreground">
                      {price.suffix}
                    </span>
                  ) : null}
                </p>
                {plan.is_custom_priced ? (
                  <p className="mt-1 text-xs text-muted-foreground">اتفاق سنوي أو شراء كامل</p>
                ) : null}
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6"
                  variant={plan.is_featured ? "default" : "outline"}
                  onClick={() => setSelected(plan)}
                >
                  اطلبي هذه الخطة
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <PlanRequestDialog
        open={selected !== null}
        onOpenChange={(v) => !v && setSelected(null)}
        planId={selected?.id ?? null}
        planName={selected?.name_ar ?? ""}
        period={period}
      />
    </div>
  );
}
