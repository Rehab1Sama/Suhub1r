import type { NavItem } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2, Inbox, Layers, CircleDot, GraduationCap, Heart, BookOpenText, CalendarCheck, FileBarChart2, Wallet, CreditCard } from "lucide-react";

export const platformNav: NavItem[] = [
  { label: "لوحة المنصة", to: "/platform", icon: <LayoutDashboard className="size-4" /> },
  { label: "المقارئ", to: "/platform/tenants", icon: <Building2 className="size-4" /> },
  { label: "طلبات الاشتراك", to: "/platform/requests", icon: <Inbox className="size-4" /> },
  { label: "الفواتير والإيرادات", to: "/platform/billing", icon: <Wallet className="size-4" /> },
];

export function tenantNav(slug: string): NavItem[] {
  return [
    { label: "لوحة المقرأة", to: "/app/$slug", params: { slug }, icon: <LayoutDashboard className="size-4" /> },
    { label: "المسارات", to: "/app/$slug/tracks", params: { slug }, icon: <Layers className="size-4" /> },
    { label: "الحلقات", to: "/app/$slug/circles", params: { slug }, icon: <CircleDot className="size-4" /> },
    { label: "الطالبات", to: "/app/$slug/students", params: { slug }, icon: <GraduationCap className="size-4" /> },
    { label: "الأنصبة والتقدم", to: "/app/$slug/progress", params: { slug }, icon: <BookOpenText className="size-4" /> },
    { label: "الحضور", to: "/app/$slug/attendance", params: { slug }, icon: <CalendarCheck className="size-4" /> },
    { label: "التقارير", to: "/app/$slug/reports", params: { slug }, icon: <FileBarChart2 className="size-4" /> },
    { label: "المتطوعات", to: "/app/$slug/volunteers", params: { slug }, icon: <Heart className="size-4" /> },
    { label: "الاشتراك والفواتير", to: "/app/$slug/subscription", params: { slug }, icon: <CreditCard className="size-4" /> },
  ];
}
