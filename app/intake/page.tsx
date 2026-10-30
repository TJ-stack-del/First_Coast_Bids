import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { IntakeWizard } from "./IntakeWizard";
import { SignupRail } from "./SignupRail";
import { createClient } from "@/lib/supabase/server";
import { loadActiveTrades } from "@/lib/trades/server";
import { offeredNaicsOptions, type NaicsOption } from "@/lib/trades/naics-options";

// Public route — a client doesn't need an account before starting.
// Their account gets created as part of step 1 ("About you"). Replaces
// the old self-serve app/(app)/intake — this one is NOT wrapped in
// AppShell since the visitor isn't logged into the app yet.

export const metadata: Metadata = {
  title: "Get Started",
  description: "Tell us about your bid. We'll take it from there.",
};

export default async function IntakePage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  const pkg = (await searchParams).package;
  // Public read (RLS: anyone reads active trades). If it fails, the wizard
  // still works; the NAICS checkboxes are empty and the free-text "Other"
  // field still takes codes.
  let offeredNaics: NaicsOption[] = [];
  try {
    offeredNaics = offeredNaicsOptions(await loadActiveTrades(await createClient()));
  } catch (err) {
    console.error("[intake] failed to load trades", { message: err instanceof Error ? err.message : err });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/70">
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
      {/* Form and a side panel of what they're getting (2026-10-30): the panel
          sits beside the form on desktop and after it on phones. */}
      <main className="max-w-[1120px] mx-auto px-margin-mobile md:px-margin-desktop py-10 md:py-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14 items-start">
        <IntakeWizard offeredNaics={offeredNaics} />
        <SignupRail pkg={pkg === "one_off" || pkg === "retainer" ? pkg : "pilot"} />
      </main>
    </div>
  );
}
