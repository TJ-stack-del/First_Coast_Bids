import type { MetadataRoute } from "next";

// Next's file-convention manifest route -- serves at /manifest.webmanifest.
// Icon uses public/logo-mark.png, a raster crop of the real Stitch
// reference image (a hand-traced SVG version was tried first but its
// vectorization introduced boundary defects that weren't worth continuing
// to chase -- see git history on public/logo-mark.svg, now removed).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "First Coast Bids",
    short_name: "First Coast Bids",
    description:
      "Done-for-you bid prep for small trade contractors bidding on local government contracts.",
    start_url: "/",
    display: "standalone",
    // Matches app/globals.css's .dark surface/background token (the
    // Stitch "Industrial Precision" dark system's --color-surface).
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/logo-mark.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
