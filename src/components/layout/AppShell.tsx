import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  to: string;
  params?: Record<string, string>;
  icon: ReactNode;
};

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

type Props = {
  brandName: string;
  brandSubtitle?: string;
  logoUrl?: string | null;
  nav: NavItem[];
  title: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  brandName,
  brandSubtitle,
  logoUrl,
  nav,
  title,
  crumbs = [],
  actions,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        {logoUrl ? (
          <img src={logoUrl} alt={brandName} className="size-10 rounded-xl object-cover" />
        ) : (
          <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground">
            {brandName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{brandName}</p>
          {brandSubtitle ? (
            <p className="truncate text-xs text-sidebar-foreground/70">{brandSubtitle}</p>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            params={item.params as never}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
            activeOptions={{ exact: true }}
          >
            <span className="text-sidebar-primary">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium">{profile?.full_name ?? "مستخدمة"}</p>
          <p className="truncate text-xs text-sidebar-foreground/70">{profile?.email ?? user?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 hidden w-72 lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-72 shadow-lifted">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:mr-72">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div className="min-w-0 flex-1">
              {crumbs.length > 0 ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {crumbs.map((c, i) => (
                    <span key={c.label} className="flex items-center gap-1">
                      {c.to ? (
                        <Link to={c.to} params={c.params as never} className="hover:text-foreground">
                          {c.label}
                        </Link>
                      ) : (
                        <span>{c.label}</span>
                      )}
                      {i < crumbs.length - 1 ? <ChevronLeft className="size-3" /> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
            </div>
            {actions}
          </div>
        </header>

        <main className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6")}>{children}</main>
      </div>
    </div>
  );
}
