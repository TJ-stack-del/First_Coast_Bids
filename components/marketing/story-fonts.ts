import { Public_Sans, Source_Serif_4 } from "next/font/google";

// The homepage story's type (components/marketing/story.module.css): Source
// Serif for headlines, set upright and plain; Public Sans, the US Web Design
// System's typeface, for everything else -- a deliberate nod to government
// work, and different from the sans every template ships with.
export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-source-serif",
  display: "swap",
});

export const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});
