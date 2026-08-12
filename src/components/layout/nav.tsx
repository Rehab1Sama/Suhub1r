import type { NavItem } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2, Inbox } from "lucide-react";

export const platformNav: NavItem[] = [
  { label: "لوحة المنصة", to: "/platform", icon: <LayoutDashboard className="size-4" /> },
  { label: "المقارئ", to: "/platform/tenants", icon: <Building2 className="size-4" /> },
  { label: "طلبات الاشتراك", to: "/platform/requests", icon: <Inbox className="size-4" /> },
];

export function tenantNav(slug: string): NavItem[] {
  return [
    { label: "لوحة المقرأة", to: "/app/$slug", params: { slug }, icon: <LayoutDashboard className="size-4" /> },
  ];
}
