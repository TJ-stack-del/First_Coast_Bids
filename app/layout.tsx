import type { Metadata, Viewport } from "next";
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
  // PNG rather than SVG: logo-mark.png is a raster crop of the real
  // Stitch reference image (not a hand-traced vector) -- see
  // public/logo-mark.png. A simplified small-size variant was tried and
  // then reverted (2026-09-20, see components/ui/Logo.tsx) -- explicit
  // call to keep one consistent detailed mark everywhere, even at
  // favicon scale, rather than a different-looking icon depending on size.
  icons: {
    icon: "/logo-mark.png",
  },
};

export const viewport: Viewport = {
  // Matches the Stitch "Industrial Precision Light" system's surface color
  // (--color-surface / --color-background in app/globals.css :root).
  // Dark mode was removed site-wide 2026-09-20 (explicit user call, after
  // repeated real friction keeping the brand icon and color tokens
  // faithful across both themes) -- this app is light-only now.
  themeColor: "#f8f9ff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
      <body>{children}</body>
    </html>
  );
}
