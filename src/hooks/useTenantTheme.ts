import { useEffect } from "react";

/** يطبّق هوية المقرأة اللونية على مستوى الصفحة عبر متغيرات التصميم */
export function useTenantTheme(primary?: string | null, accent?: string | null) {
  useEffect(() => {
    const root = document.documentElement;
    const applied: string[] = [];
    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--ring", primary);
      applied.push("--primary", "--ring");
    }
    if (accent) {
      root.style.setProperty("--gold", accent);
      applied.push("--gold");
    }
    return () => applied.forEach((prop) => root.style.removeProperty(prop));
  }, [primary, accent]);
}
