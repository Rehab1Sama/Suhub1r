import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureRow = {
  key: string;
  name_ar: string;
  description_ar: string | null;
  default_enabled: boolean;
  sort_order: number;
};

/** دليل الميزات المتاحة في المنصة */
export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["features"],
    queryFn: async (): Promise<FeatureRow[]> => {
      const { data, error } = await supabase
        .from("features")
        .select("key, name_ar, description_ar, default_enabled, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** الميزات المفعّلة لمقرأة محددة (مع القيم الافتراضية) */
export function useTenantFeatures(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["tenant-features", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const [catalog, overrides] = await Promise.all([
        supabase.from("features").select("key, default_enabled").order("sort_order"),
        supabase.from("tenant_features").select("feature_key, enabled").eq("tenant_id", tenantId!),
      ]);
      if (catalog.error) throw catalog.error;
      if (overrides.error) throw overrides.error;

      const map: Record<string, boolean> = {};
      for (const f of catalog.data ?? []) map[f.key] = f.default_enabled;
      for (const o of overrides.data ?? []) map[o.feature_key] = o.enabled;
      return map;
    },
  });
}
