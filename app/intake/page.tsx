import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { IntakeWizard } from "./IntakeWizard";

// Public route — a client doesn't need an account before starting.
// Their account gets created as part of step 1 ("About you"). Replaces
// the old self-serve app/(app)/intake — this one is NOT wrapped in
// AppShell since the visitor isn't logged into the app yet.

export const metadata: Metadata = {
  title: "Get Started",
  description: "Tell us about your bid. We'll take it from there.",
};

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          {/* Links to /pricing, not "/" — root routing bounces a signed-in
              user (this flow creates an account partway through step 1)
              straight back into the app, same reason AppShell's logo does
              the same thing. */}
          <Link
            href="/pricing"
            className="flex items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Logo priority />
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop py-space-2xl">
        <IntakeWizard />
      </main>
    </div>
  );
}
