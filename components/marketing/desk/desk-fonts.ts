import { Red_Hat_Display, Red_Hat_Mono, Red_Hat_Text } from "next/font/google";

// The desk homepage's type (desk.module.css, Hallmark theme "Furrow"): Red Hat
// Display for headings, Red Hat Text for everything else, Red Hat Mono for
// numbers. Exposed as variables so the module's tokens can name them.
export const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-rh-display",
  display: "swap",
});

export const redHatText = Red_Hat_Text({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-rh-text",
  display: "swap",
});

export const redHatMono = Red_Hat_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-rh-mono",
  display: "swap",
});
