import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isManagerRole, type AppRole } from "@/lib/roles";
import type { TenantProgressMode } from "@/lib/types";

export type TenantContext = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    students_mode: string;
    progress_entry_mode: TenantProgressMode;
  } | null;
  myRoles: AppRole[];
  canRead: boolean;
  canManage: boolean;
  /** هل تستطيع المستخدمة إدخال الأنصبة/التقدم/الحضور وفق إعداد المقرأة؟ */
  canRecord: boolean;
  loading: boolean;
};

/**
 * يُحمّل بيانات المقرأة الحالية ويحدد صلاحيات المستخدمة داخل الرابط /app/$slug.
 * القراءة لكل موظفات المقرأة ومالكة المنصة، والإدارة للقائدة ونائبتها ومالكة المنصة،
 * وإدخال الأنصبة والتقدم والحضور حسب إعداد progress_entry_mode في المقرأة.
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
          "id, name, slug, logo_url, primary_color, accent_color, students_mode, progress_entry_mode",
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

  const mode = tenant?.progress_entry_mode ?? "both";
  const hasAcademicRole = (role: AppRole) =>
    role === "academic_deputy" || role === "tenant_admin" || role === "admin_deputy";
  const isTeacher = myRoles.includes("teacher");
  const isSupervisor = myRoles.includes("supervisor");
  const canRecord =
    isPlatformOwner ||
    myRoles.some(hasAcademicRole) ||
    (isTeacher && (mode === "teacher" || mode === "both")) ||
    (isSupervisor && (mode === "supervisor" || mode === "both"));

  return {
    tenant,
    myRoles,
    canRead: isPlatformOwner || myRoles.length > 0,
    canManage: isPlatformOwner || myRoles.some(isManagerRole),
    canRecord,
    loading: loading || tenantQuery.isLoading,
  };
}
