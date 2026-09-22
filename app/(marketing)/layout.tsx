import { Newsreader, Archivo } from "next/font/google";
import { MarketingShell } from "@/components/ui/MarketingShell";

// Mounts MarketingShell once for the whole public marketing site instead
// of each page doing it individually -- see MarketingShell.tsx's own
// comment. The .theme-press wrapper scopes the 2026-09-22 redesign
// (Braun structure + Stripe Press warmth; see app/globals.css) to these
// pages only. Fonts are self-hosted by next/font and only loaded here, so
// the dashboard/admin never download them.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`theme-press ${newsreader.variable} ${archivo.variable}`}>
      <MarketingShell>{children}</MarketingShell>
    </div>
  );
}
