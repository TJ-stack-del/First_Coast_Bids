import type { NextConfig } from "next";

// This file didn't exist before -- added specifically for lib/scrapers/coj.ts's
// headless-browser dependencies. playwright-core and @sparticuz/chromium
// both rely on relative-path resolution to locate their own binary/native
// files at runtime; letting webpack bundle them (the default for anything
// imported by server code) breaks that resolution and is the root cause of
// the "libnspr4.so"-style missing-shared-library failures this combo is
// known for on Vercel. serverExternalPackages tells Next to require() them
// normally from node_modules instead.
const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // The blog was replaced by the evergreen "New to bidding?" guide on
  // 2026-09-26; old links and bookmarks land on the guide, not a 404.
  async redirects() {
    return [{ source: "/blog", destination: "/guide", permanent: true }];
  },
};

export default nextConfig;
