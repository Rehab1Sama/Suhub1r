import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useTenantTheme } from "@/hooks/useTenantTheme";

export const Route = createFileRoute("/m/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `مقرأة ${params.slug} — سُحُب` },
      { name: "description", content: "صفحة المقرأة على منصة سُحُب: التعريف بالمقرأة والتسجيل ودخول المنتسبات." },
      { property: "og:title", content: `مقرأة ${params.slug} — سُحُب` },
      { property: "og:description", content: "صفحة المقرأة على منصة سُحُب للتسجيل ودخول المنتسبات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenantPublicPage,
});

function TenantPublicPage() {
  const { slug } = useParams({ from: "/m/$slug" });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, logo_url, primary_color, accent_color, short_description, status, registration_open")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  if (isLoading) return <LoadingBlock />;

  if (!tenant || tenant.status === "suspended") {
    return (
      <main className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title={tenant ? "هذه المقرأة موقوفة حاليًا" : "لم نجد هذه المقرأة"}
            description="تأكدي من الرابط أو تواصلي مع إدارة المقرأة."
            action={
              <Button asChild variant="outline">
                <Link to="/">الصفحة الرئيسية</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="gradient-sky min-h-screen px-5 py-14">
      <div className="mx-auto max-w-3xl text-center">
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} className="mx-auto size-20 rounded-2xl object-cover" />
        ) : (
          <span className="mx-auto grid size-20 place-items-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground">
            {tenant.name.slice(0, 1)}
          </span>
        )}
        <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">{tenant.name}</h1>
        {tenant.short_description ? (
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{tenant.short_description}</p>
        ) : null}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ next: `/app/${tenant.slug}` }}>
              دخول المنتسبات
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" disabled={!tenant.registration_open}>
            {tenant.registration_open ? "التسجيل في المقرأة" : "التسجيل مغلق حاليًا"}
          </Button>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          مُشغّلة بواسطة{" "}
          <Link to="/" className="text-primary hover:underline">
            منصة سُحُب
          </Link>
        </p>
      </div>
    </main>
  );
}
