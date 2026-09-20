import type { MetadataRoute } from "next";

// Next's file-convention manifest route -- serves at /manifest.webmanifest.
// Icon uses public/logo-icon.png, not the detailed logo-mark.png -- a
// home-screen PWA icon renders at small sizes (commonly 48-192px), where
// the detailed mark's fine nested linework goes muddy, confirmed true of
// the unmodified Stitch reference itself at that scale, not an artifact
// of this app's extraction (see components/ui/Logo.tsx). logo-icon.png is
// a real vector source (public/logo-icon.svg) rasterized to 512, so it
// holds up cleanly at every size this manifest gets downscaled to.
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
        src: "/logo-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
