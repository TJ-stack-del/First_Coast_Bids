import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Next's file-convention OG image route -- generated at request time,
// serves as the og:image (and, absent a dedicated twitter-image, the
// Twitter Card image too) for the root layout and every route that
// doesn't override it with its own opengraph-image file.
//
// Real bug fixed 2026-09-19: this used to hand-draw the OLD pre-rebrand
// shield+pulse-line mark in the old amber (#f59e0b) -- a leftover from
// before the navy/gold rebrand that nothing caught since this route
// never renders during normal browsing, only when a social platform
// fetches the link preview. Now embeds the actual current brand PNG as a
// base64 data URI rather than re-deriving the icon geometry a second time
// by hand -- the same mistake (a hand-drawn approximation silently
// drifting from the real mark) is exactly how this file went stale in
// the first place. Uses logo-icon.png (the simplified small-size mark),
// not the detailed logo-mark.png -- rendered at 150px here, inside the
// size range where the detailed mark's fine nested linework goes muddy
// (confirmed 2026-09-20 against the unmodified Stitch reference itself,
// not just this app's extraction). Requires the Node.js runtime (not
// edge) for filesystem access to read the file.
export const runtime = "nodejs";
export const alt = "First Coast Bids — done-for-you bid prep for local government contracts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const iconBuffer = await readFile(path.join(process.cwd(), "public", "logo-icon.png"));
  const iconDataUrl = `data:image/png;base64,${iconBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og's
            ImageResponse renders its own image pipeline, not a browser DOM;
            next/image's <Image> component doesn't apply here. */}
        <img src={iconDataUrl} width={150} height={150} alt="" />
        <div style={{ display: "flex", marginTop: 28, fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>
          <span style={{ color: "#FFFFFF" }}>First Coast&nbsp;</span>
          <span style={{ color: "#C19349" }}>Bids</span>
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
            maxWidth: 820,
          }}
        >
          Done-for-you bid prep for small trade contractors bidding on local
          government contracts
        </div>
      </div>
    ),
    { ...size }
  );
}
