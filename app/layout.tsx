import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  // Required for opengraph-image.tsx's generated image to resolve to an
  // absolute URL in production rather than falling back to localhost.
  // firstcoastbids.com is the new brand domain (acquired 2026-09-19) --
  // do not deploy this change until Vercel/DNS actually serve the app
  // there, or social-preview scrapers will fetch a dead URL for the OG
  // image instead of the real one still live at bidpulse.co.
  metadataBase: new URL("https://firstcoastbids.com"),
  title: {
    default: "First Coast Bids",
    template: "%s — First Coast Bids",
  },
  description: "Done-for-you bid prep for small trade contractors — HVAC, janitorial, and landscaping businesses bidding on local government contracts.",
  // Explicit rather than relying on the app/icon.svg file convention (that
  // file was removed) -- keeps the favicon source visible here instead of
  // silent, and avoids Next.js emitting two competing <link rel="icon">
  // tags if both a convention file and explicit metadata existed at once.
  // logo-icon.png/.svg, not logo-mark.png -- a browser tab favicon is the
  // single smallest real display size this brand mark is ever shown at
  // (often 16-32px), and the detailed mark's fine nested linework turns
  // muddy at that scale -- confirmed true of the unmodified Stitch
  // reference at the same size too, not an artifact of extraction
  // (2026-09-20). logo-icon.svg is a real vector (see
  // components/ui/Logo.tsx for the simplification rationale); listed
  // first so browsers that support SVG favicons get a crisp render at
  // any tab size, with the PNG as a fallback for the ones that don't.
  icons: {
    icon: [
      { url: "/logo-icon.svg", type: "image/svg+xml" },
      { url: "/logo-icon.png", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  // Matches the Stitch "Industrial Precision" dark system's surface color
  // (--color-surface / --color-background in app/globals.css .dark).
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is next-themes' documented requirement: it
    // sets the "dark"/"light" class on <html> via an inline script that
    // runs before React hydrates, specifically to avoid a flash of the
    // wrong theme — which necessarily makes the server-rendered and
    // first-client-render <html> attributes differ. Only suppresses the
    // warning on this one element, not real mismatches elsewhere.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Chivo:wght@600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
