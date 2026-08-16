import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHeading } from "@/components/site/Sections";
import { PricingSection } from "@/components/site/PricingSection";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "الباقات والأسعار — سُحُب" },
      {
        name: "description",
        content:
          "باقات سُحُب لإدارة المقارئ القرآنية: الانطلاقة والنماء والسحاب، بدفع شهري أو سنوي أو شراء كامل دفعة واحدة.",
      },
      { property: "og:title", content: "الباقات والأسعار — سُحُب" },
      {
        property: "og:description",
        content: "ادفعي شهريًا أو سنويًا أو اشتري النظام بالكامل — وترقّي في أي وقت.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading
          eyebrow="الأسعار"
          title="خطة تنمو مع مقرأتك"
          subtitle="اختاري نوع الدفع المناسب: شهري، سنوي بخصم، أو شراء كامل دفعة واحدة. والترقية متاحة في أي وقت."
        />
        <PricingSection />

        <p className="mt-8 text-center text-sm text-muted-foreground">
          تبغين مقارنة تفصيلية بين الباقات؟{" "}
          <Link to="/compare" className="font-medium text-primary hover:underline">
            جدول مقارنة الباقات
          </Link>
        </p>


        <div className="mt-20">
          <SectionHeading eyebrow="أسئلة متكررة" title="قبل أن تبدئي" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                q: "ما الفرق بين الدفع السنوي والشراء الكامل؟",
                a: "الدفع السنوي اشتراك يُجدَّد كل عام بخصم شهرين، أما الشراء الكامل فدفعة واحدة تمنحك النظام بدون تجديد.",
              },
              {
                q: "هل يمكن الترقية لاحقًا؟",
                a: "نعم، يمكن الترقية في أي وقت ويُحسب الفرق فقط عن المدة المتبقية.",
              },
              {
                q: "هل لكل مقرأة رابط خاص؟",
                a: "نعم، لكل مقرأة رابطها المستقل وبياناتها وحساباتها المنفصلة تمامًا.",
              },
              {
                q: "كيف يتم الدفع؟",
                a: "بعد إرسال الطلب نتواصل معك لتأكيد التفاصيل وإتمام الدفع وتجهيز حساب المقرأة.",
              },
            ].map((item) => (
              <article key={item.q} className="surface-panel p-6">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
