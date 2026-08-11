import { Link } from "@tanstack/react-router";
import { BookOpen, Mail } from "lucide-react";
import { SITE_NAV, CONTACT_EMAIL } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl gradient-primary text-primary-foreground">
              <BookOpen className="size-4" />
            </span>
            <span className="font-display text-xl font-bold">سُحُب</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            منصة هادئة لإدارة المقارئ: حضور وغياب، مسارات، وإحصائيات دقيقة — كل مقرأة ببياناتها
            ورابطها وحساباتها الخاصة.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold">تنقّل</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {SITE_NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">تواصل</h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-3 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mail className="size-4" />
            {CONTACT_EMAIL}
          </a>
          <p className="mt-2 text-sm text-muted-foreground">الرد خلال يوم عمل واحد</p>
        </div>
      </div>

      <p className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        جميع الحقوق محفوظة — سُحُب ٢٠٢٦
      </p>
    </footer>
  );
}
