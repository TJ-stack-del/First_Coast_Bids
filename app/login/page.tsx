import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log In",
};

// Same three real steps as the homepage's "How it works" section
// (app/page.tsx's HOW_IT_WORKS) — trimmed to one line each for the sign-in
// marketing panel. Duplicated here rather than imported since it's just
// three short strings and app/page.tsx's array isn't exported.
const PANEL_STEPS = [
  { icon: "search", title: "Tell us about the bid", body: "A three-step form: your company, the agency, and the bid file." },
  { icon: "fact_check", title: "We do the work", body: "We write the paperwork and check it against the agency's rules." },
  { icon: "task", title: "You review and send it", body: "You check everything over before it goes to the agency." },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  const { reason } = await searchParams;

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-surface">
      {/* Marketing panel -- desktop only, matches the Stitch sign-in
          screen's split layout. Mobile collapses to just the auth card
          below, same as Stitch's dedicated mobile sign-in screen. */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative flex-col justify-center gap-10 px-16 py-12 bg-surface-container-low overflow-hidden">
        <div className="relative flex flex-col gap-6 max-w-lg">
          {/* h2, not h1 -- the auth panel's "First Coast Bids" below is
              this page's one true h1 (present at every viewport width,
              including mobile where this whole panel is hidden). This
              headline used to also be an h1, producing two h1s on desktop
              simultaneously and, combined with the PANEL_STEPS titles
              being h3, a skipped heading level (h1->h3, no h2) --  a real
              WCAG heading-hierarchy defect found via critique 2026-09-20.
              Font size is controlled by the className, not the tag, so
              this carries no visual change. */}
          <h2 className="font-headline text-headline-lg text-primary font-bold">
            You run the crew. We handle the paperwork.
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Upload the RFP. We turn complex solicitations into a ready-to-submit capability
            statement, compliance matrix, and technical narrative, ready for you to review
            and send.
          </p>
        </div>
        <div className="relative flex flex-col gap-5 max-w-lg">
          {PANEL_STEPS.map((step) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
              </div>
              <div>
                <h3 className="text-label-md text-on-surface font-bold">{step.title}</h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 relative flex items-center justify-center px-margin-mobile py-12 overflow-hidden">
        <div className="w-full max-w-md relative">
          <div className="text-center mb-6">
            <Link
              href="/"
              className="relative flex items-center justify-center mb-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* logo-mark.png, the detailed mark -- see
                  components/ui/Logo.tsx for why a simplified small-size
                  variant was tried and then reverted (2026-09-20, explicit
                  call to keep one consistent icon everywhere). The soft
                  drop-shadow glow this used to carry was removed
                  separately (same issue found on
                  components/ui/PipelineArrow.tsx): at this size the
                  blurred halo read as fuzzy/pixelated rather than
                  atmospheric, especially against a dark page background. */}
              <Image
                src="/logo-mark.png"
                alt="First Coast Bids"
                width={512}
                height={512}
                className="w-24 h-24 object-contain"
                priority
              />
            </Link>
            {/* bg-primary/text-primary, not bg-secondary/text-secondary --
                secondary (verified-green) is reserved sitewide for
                verified/complete states (DESIGN.md's No-Green-Drift Rule);
                this dot verifies nothing, it's a plain status indicator,
                so it belongs on the brand's one general-purpose accent
                instead (found via critique 2026-09-20). */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high mb-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-label-sm uppercase tracking-wider text-primary">Client Portal</span>
            </div>
            <h1 className="font-headline text-headline-lg-mobile text-on-surface tracking-tight font-bold">
              First Coast <span className="text-primary">Bids</span>
            </h1>
            <p className="text-body-md text-on-surface-variant mt-1">Sign in to your account.</p>
            {/* Mobile-only echo of the desktop marketing panel's headline
                (hidden md:flex above) -- found via critique 2026-09-20:
                that panel is the one genuinely on-brand, reassuring
                element on this page, and it was invisible on mobile,
                exactly the device this trade-contractor audience most
                plausibly logs in from. */}
            <p className="text-body-md text-on-surface-variant mt-2 md:hidden">
              You run the crew. We handle the paperwork.
            </p>
          </div>

          {reason === "inactive" && (
            <p className="text-body-md text-on-surface bg-surface-container-low rounded-xl px-4 py-3 mb-6 text-center">
              You were signed out after 14 days of inactivity. Sign back in to continue.
            </p>
          )}

          <div className="bg-surface-container-low rounded-2xl p-5 shadow-xl">
            <LoginForm />
          </div>

          <p className="text-body-md text-on-surface-variant text-center mt-6">
            Submitting a bid for the first time?{" "}
            <Link
              href="/intake"
              className="text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
            >
              Start here
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
