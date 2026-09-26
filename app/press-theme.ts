import { Newsreader, Archivo } from "next/font/google";

// The Braun + Press theme (see DESIGN.md, "Marketing theme") as one class
// string: the .theme-press token remap from app/globals.css plus the two
// self-hosted fonts it uses. Applied by the marketing layout and by the
// sign-up path a visitor goes through next (intake, log in, password
// reset), so the site doesn't change look at the moment someone signs up,
// and by the client area (app/dashboard/layout.tsx). The admin still uses
// the app's own system.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export const pressThemeClass = `theme-press ${newsreader.variable} ${archivo.variable}`;
