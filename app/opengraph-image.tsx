import { ImageResponse } from "next/og";

// Next's file-convention OG image route -- generated at request time,
// serves as the og:image (and, absent a dedicated twitter-image, the
// Twitter Card image too) for the root layout and every route that
// doesn't override it with its own opengraph-image file. Icon paths are
// the same shield+pulse mark as app/icon.svg, just re-centered around
// (0,0) so they drop into a plain <svg viewBox> here without re-deriving
// the geometry.
export const alt = "First Coast Bids — done-for-you bid prep for local government contracts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
        <svg width="150" height="150" viewBox="-50 -50 100 100" fill="none">
          <path
            d="M0 -34 L28 -20 C28 10 0 32 0 35 C0 32 -28 10 -28 -20 Z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M0 -26 L20 -16 C20 6 0 24 0 26 C0 24 -20 6 -20 -16 Z"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.25}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <path
            d="M-38 0 L-19 0 L-11 -18 L-3 20 L5 -12 L13 8 L21 0 L38 0"
            fill="none"
            stroke="#f59e0b"
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ display: "flex", marginTop: 28, fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>
          <span style={{ color: "#FFFFFF" }}>First Coast&nbsp;</span>
          <span style={{ color: "#f59e0b" }}>Bids</span>
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
