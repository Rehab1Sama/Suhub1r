import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const approveSchema = z.object({
  requestId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  planId: z.string().uuid(),
  months: z.number().int().min(0).max(120).default(12),
});

/** اعتماد طلب باقة: إنشاء المقرأة + الاشتراك + دعوة القائدة */
export const approvePlanRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => approveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isOwner } = await supabase.rpc("is_platform_owner", { _user_id: userId });
    if (!isOwner) throw new Error("غير مصرح");

    const { data: req, error: reqError } = await supabase
      .from("plan_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqError) throw reqError;
    if (!req) throw new Error("الطلب غير موجود");
    if (req.tenant_id) throw new Error("هذا الطلب معتمد مسبقًا");

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: req.tenant_name,
        slug: data.slug,
        contact_email: req.email,
        contact_phone: req.phone,
        status: "active",
      })
      .select("id, name, slug")
      .single();
    if (tenantError) {
      throw new Error(
        tenantError.message.includes("duplicate") ? "هذا الرابط مستخدم لمقرأة أخرى" : tenantError.message,
      );
    }

    const expires = new Date();
    if (data.months > 0) expires.setMonth(expires.getMonth() + data.months);

    const { error: subError } = await supabase.from("subscriptions").insert({
      tenant_id: tenant.id,
      plan_id: data.planId,
      status: "active",
      expires_at: data.months > 0 ? expires.toISOString() : null,
    });
    if (subError) throw subError;

    const { data: invite, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        tenant_id: tenant.id,
        email: req.email.trim().toLowerCase(),
        role: "tenant_admin",
        invited_by: userId,
      })
      .select("token")
      .single();
    if (inviteError) throw inviteError;

    await supabase
      .from("plan_requests")
      .update({ status: "approved", tenant_id: tenant.id })
      .eq("id", data.requestId);

    return { tenantId: tenant.id, slug: tenant.slug, token: invite.token };
  });

/** قراءة بيانات دعوة عبر رمزها (الرمز نفسه هو الإثبات) */
export const getInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("invitations")
      .select("email, role, status, expires_at, tenants(name, slug)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { ok: false as const, reason: "notfound" as const };
    if (invite.status !== "pending") return { ok: false as const, reason: "used" as const };
    if (new Date(invite.expires_at) < new Date()) return { ok: false as const, reason: "expired" as const };
    return {
      ok: true as const,
      email: invite.email,
      role: invite.role,
      tenantName: invite.tenants?.name ?? "",
      tenantSlug: invite.tenants?.slug ?? "",
    };
  });

/** قبول الدعوة ومنح الدور للمستخدمة الحالية */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const userEmail = String((claims as { email?: string }).email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, tenant_id, status, expires_at, tenants(slug)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("رابط الدعوة غير صحيح");
    if (invite.status !== "pending") throw new Error("هذه الدعوة استُخدمت مسبقًا");
    if (new Date(invite.expires_at) < new Date()) throw new Error("انتهت صلاحية الدعوة");
    if (invite.email.toLowerCase() !== userEmail) {
      throw new Error("هذه الدعوة مرسلة إلى بريد آخر، سجّلي الدخول بالبريد المدعو");
    }
    if (!invite.tenant_id) throw new Error("الدعوة غير مرتبطة بمقرأة");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, tenant_id: invite.tenant_id, role: invite.role });
    if (roleError && !roleError.message.includes("duplicate")) throw roleError;

    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { slug: invite.tenants?.slug ?? "" };
  });
