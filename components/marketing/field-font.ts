import { Inter_Tight } from "next/font/google";

// Headings on the homepage's field look (components/marketing/field.module.css):
// a heavy, tightly set grotesk in place of the serif-with-italic headline
// that read as generated. Self-hosted through next/font like the press fonts.
export const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});
