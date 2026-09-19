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
  // PNG rather than SVG: logo-mark.png is a raster crop of the real Stitch
  // reference image (not a hand-traced vector) -- see public/logo-mark.png.
  // Two variants keyed on the OS-level prefers-color-scheme media query
  // (the browser's own tab-bar chrome, not this app's .dark class/theme
  // toggle -- a favicon can't read next-themes) so the icon doesn't show
  // light-background matting fringe in a dark browser tab bar or vice
  // versa. logo-mark-dark.png was matted against a dark reference image,
  // not derived from logo-mark.png with a filter.
  icons: {
    icon: [
      { url: "/logo-mark.png", media: "(prefers-color-scheme: light)" },
      { url: "/logo-mark-dark.png", media: "(prefers-color-scheme: dark)" },
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
