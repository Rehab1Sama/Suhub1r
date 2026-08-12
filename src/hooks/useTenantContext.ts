import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isManagerRole, type AppRole } from "@/lib/roles";

export type TenantContext = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    students_mode: string;
  } | null;
  myRoles: AppRole[];
  canRead: boolean;
  canManage: boolean;
  loading: boolean;
};

/**
 * يُحمّل بيانات المقرأة الحالية ويحدد صلاحيات المستخدمة داخل الرابط /app/$slug.
 * القراءة لكل موظفات المقرأة ومالكة المنصة، والإدارة للقائدة ونائبتها ومالكة المنصة.
 */
export function useTenantContext(): TenantContext {
  const params = useParams({ strict: false });
  const slug = String(params.slug ?? "");
  const { roles, isPlatformOwner, loading } = useAuth();

  const tenantQuery = useQuery({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, accent_color, students_mode",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tenant = tenantQuery.data ?? null;
  const myRoles = tenant
    ? roles.filter((r) => r.tenant_id === tenant.id).map((r) => r.role)
    : [];

  return {
    tenant,
    myRoles,
    canRead: isPlatformOwner || myRoles.length > 0,
    canManage: isPlatformOwner || myRoles.some(isManagerRole),
    loading: loading || tenantQuery.isLoading,
  };
}
