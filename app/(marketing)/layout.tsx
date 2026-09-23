import { MarketingShell } from "@/components/ui/MarketingShell";
import { pressThemeClass } from "@/app/press-theme";

// Mounts MarketingShell once for the whole public marketing site instead
// of each page doing it individually -- see MarketingShell.tsx's own
// comment. The press theme wrapper scopes the 2026-09-22 redesign (Braun
// structure + Stripe Press warmth; see app/press-theme.ts) to these pages
// and the sign-up path only.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={pressThemeClass}>
      <MarketingShell>{children}</MarketingShell>
    </div>
  );
}
