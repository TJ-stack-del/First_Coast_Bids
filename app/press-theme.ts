import { Source_Serif_4, Public_Sans } from "next/font/google";

// The site's theme (see DESIGN.md, "Marketing theme") as one class string:
// the .theme-press token remap from app/globals.css plus its two fonts.
// Applied by the marketing layout, the sign-up path (intake, log in,
// password reset) and the client area (app/dashboard/layout.tsx).
//
// 2026-10-30 (round 15): the fonts are now the homepage's pair -- Source
// Serif for headings, Public Sans for text -- loaded under the theme's
// original variable names (--font-newsreader, --font-archivo) so every page
// and module that reads those names switches with this one file. The names
// are historical; the faces are not Newsreader and Archivo any more.
const headingSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

const textSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

export const pressThemeClass = `theme-press ${headingSerif.variable} ${textSans.variable}`;
