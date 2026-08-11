import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHeading } from "@/components/site/Sections";
import { CONTACT_EMAIL } from "@/lib/site-content";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصلي مع فريق سُحُب" },
      {
        name: "description",
        content:
          "أرسلي استفسارك أو اطلبي تجهيز مقرأتك على سُحُب، ويردّ الفريق خلال يوم عمل واحد.",
      },
      { property: "og:title", content: "تواصلي مع فريق سُحُب" },
      {
        property: "og:description",
        content: "اطلبي تجهيز مقرأتك أو استفسري عن الباقات — الرد خلال يوم عمل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(120),
  email: z.string().trim().email("البريد الإلكتروني غير صحيح").max(255),
  subject: z.string().trim().min(2, "اكتبي عنوانًا للرسالة").max(160),
  message: z.string().trim().min(10, "الرسالة قصيرة جدًا").max(2000),
});

function ContactPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      subject: fd.get("subject"),
      message: fd.get("message"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      message: `${parsed.data.subject}\n\n${parsed.data.message}`,
    });
    setBusy(false);

    if (error) {
      toast.error("تعذّر إرسال الرسالة، حاولي مرة أخرى.");
      return;
    }
    form.reset();
    setSent(true);
    toast.success("وصلتنا رسالتك — سنردّ عليك قريبًا.");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading
          eyebrow="تواصل"
          title="نسعد بخدمتك"
          subtitle="أرسلي استفسارك أو طلب تجهيز مقرأتك، ويردّ الفريق خلال يوم عمل واحد."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <form onSubmit={handleSubmit} className="surface-panel grid gap-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="name">الاسم</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" name="email" type="email" dir="ltr" required />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="subject">عنوان الرسالة</Label>
              <Input id="subject" name="subject" required placeholder="استفسار عن باقة النماء" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="message">الرسالة</Label>
              <Textarea id="message" name="message" rows={6} required />
            </div>
            <Button type="submit" disabled={busy} className="justify-self-start">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              إرسال الرسالة
            </Button>
            {sent ? (
              <p className="text-sm text-success">تم إرسال رسالتك بنجاح، شكرًا لك.</p>
            ) : null}
          </form>

          <aside className="grid gap-4">
            <div className="surface-panel p-6">
              <Mail className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">البريد الإلكتروني</h2>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                dir="ltr"
                className="mt-1 block text-sm text-muted-foreground hover:text-foreground"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
            <div className="surface-panel p-6">
              <Clock className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">وقت الرد</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                من الأحد إلى الخميس، والرد خلال يوم عمل واحد.
              </p>
            </div>
            <div className="surface-panel p-6">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">خصوصية بياناتك</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                بيانات كل مقرأة معزولة تمامًا ولا تُستخدم إلا لخدمتها.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
