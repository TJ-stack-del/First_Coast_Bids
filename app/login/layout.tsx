import { pressThemeClass } from "@/app/press-theme";

// Same look as the marketing site (app/press-theme.ts): this page is part
// of the sign-up path a visitor reaches from "Start a pilot bid", so it
// shouldn't switch to the app's own styling mid-flow.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${pressThemeClass} min-h-screen`}>{children}</div>;
}
