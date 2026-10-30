import { pressThemeClass } from "@/app/press-theme";
import { sourceSerif, publicSans } from "@/components/marketing/story-fonts";
import s from "./signup.module.css";

// Same look as the marketing site: this page is part of the sign-up path a
// visitor reaches from "Start a pilot bid", so it carries the homepage's
// type (Source Serif headings, Public Sans text) rather than switching to
// the app's own styling mid-flow. The press theme stays underneath for the
// colour tokens the form's Tailwind classes use.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${pressThemeClass} ${sourceSerif.variable} ${publicSans.variable} ${s.signup} min-h-screen`}>{children}</div>
  );
}
