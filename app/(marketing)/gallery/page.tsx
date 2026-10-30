import type { Metadata } from "next";
import { assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import { SAMPLE_PACKAGES } from "@/lib/marketing/sample-packages";
import { PackageViewer } from "@/components/marketing/PackageViewer";
import { sourceSerif, publicSans } from "@/components/marketing/story-fonts";

export const metadata: Metadata = {
  title: "See the package you'd get",
  description:
    "A sample bid package for your trade, built by the same tool that makes a client's real one: cover, capability statement, compliance matrix and technical narrative. Synthetic, labelled as a sample.",
};

// Every trade on the site gets a sample package, the same check the
// homepage's trade list uses: a new trade in known-trades.ts without a
// sample here fails the build instead of quietly missing from this page.
assertNoMissingTradeCards(
  SAMPLE_PACKAGES.map((p) => p.tradeId),
  '"See the package you\'d get" (app/(marketing)/gallery/page.tsx)'
);

// 2026-10-30 (round 11): the Gallery was a photo and one made-up sentence
// per trade. It's now the package itself -- built in the browser by the real
// packet builder from synthetic content, page by page, downloadable. Every
// page says sample and synthetic (PRODUCT.md: never present sample content as
// a real client's work).
export default function GalleryPage() {
  return (
    <div className={`${sourceSerif.variable} ${publicSans.variable}`} style={{ fontFamily: "var(--font-public-sans), system-ui, sans-serif" }}>
      <header style={{ display: "grid", gap: 14, maxWidth: 920, marginBottom: 28 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgb(12 45 82)" }}>
          Sample work
        </p>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontWeight: 600,
            fontSize: "clamp(2.4rem, 1.6rem + 3vw, 4rem)",
            lineHeight: 1.03,
            letterSpacing: "-0.02em",
          }}
        >
          See the package you&apos;d get.
        </h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "rgb(96 90 80)" }}>
          Pick your trade. The page builds a sample package with the same tool that makes a client&apos;s real one:
          cover, capability statement, compliance matrix and technical narrative. The company, agency and bid are made
          up, and every page says so.
        </p>
      </header>
      <PackageViewer />
    </div>
  );
}
