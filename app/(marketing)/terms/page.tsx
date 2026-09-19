import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Terms",
  description: "A plain-language summary of how using First Coast Bids works.",
};

// Same disclaimer/discipline as app/(marketing)/privacy/page.tsx -- an
// honest placeholder grounded in real, verified product facts (the real
// pricing tiers from PRICING_PREVIEW in app/(marketing)/page.tsx, the
// real "you submit it yourself" model from the FAQ), not fabricated
// enforceable legal language (no liability limitation, indemnification,
// governing-law, or arbitration clauses -- those need real counsel).
export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-8">
      <Reveal mode="mount" className="flex flex-col gap-2">
        <h1 className="text-headline-lg text-primary">Terms</h1>
        <p className="text-body-md text-on-surface-variant">
          Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
        </p>
      </Reveal>

      <Reveal delay={0.06} className="bg-tertiary-container text-on-tertiary-container rounded-xl p-5 flex flex-col gap-2">
        <p className="text-label-md font-bold uppercase tracking-wider">This is a plain-language summary, not a final policy</p>
        <p className="text-body-md">
          We&apos;re finalizing formal, attorney-reviewed Terms of Service. In the meantime, this page describes how
          working with First Coast Bids actually works today, in plain English.{" "}
          <Link href="/contact" className="font-bold underline">Contact us</Link> with any questions.
        </p>
      </Reveal>

      <Reveal delay={0.12} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">What First Coast Bids does</h2>
        <p className="text-body-md text-on-surface-variant">
          You send us a government RFP or solicitation. Our team prepares a capability statement, compliance
          matrix, and technical narrative for you to review, sign, and submit yourself.
        </p>
      </Reveal>

      <Reveal delay={0.18} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">You submit it, not us</h2>
        <p className="text-body-md text-on-surface-variant">
          Government procurement portals tie a submission to your own registered vendor credentials, so you&apos;re
          the one who uploads it and hits submit. We prepare the package; you stay in control of your own agency
          portal account.
        </p>
      </Reveal>

      <Reveal delay={0.24} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">No guarantee of winning</h2>
        <p className="text-body-md text-on-surface-variant">
          No one can guarantee an award; that decision is up to the agency. What we aim for is a complete,
          compliant submission prepared by people who&apos;ve done this before.
        </p>
      </Reveal>

      <Reveal delay={0.3} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">Pricing and billing</h2>
        <p className="text-body-md text-on-surface-variant">
          No card is required to get started, and every deliverable is free to preview before anything&apos;s due.
          We confirm exact pricing with you directly before any work starts. See the{" "}
          <Link href="/pricing" className="text-primary font-bold hover:underline">Pricing page</Link> for the
          current one-off, retainer, and pilot options. We invoice you after the work is done.
        </p>
      </Reveal>

      <Reveal delay={0.36} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">Your responsibilities</h2>
        <p className="text-body-md text-on-surface-variant">
          Keep the company and credential information you give us accurate: we use it as real facts in the
          documents we prepare. You&apos;re responsible for reviewing every deliverable before you sign and submit
          it, and for your own agency portal account and submission.
        </p>
      </Reveal>

      <Reveal delay={0.42} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">Questions</h2>
        <p className="text-body-md text-on-surface-variant">
          <Link href="/contact" className="text-primary font-bold hover:underline">Reach out</Link> any time.
        </p>
      </Reveal>
    </div>
  );
}
