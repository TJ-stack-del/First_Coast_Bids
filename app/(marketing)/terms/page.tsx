import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/marketing/press.module.css";

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
    <div className={s.prose}>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Terms</h1>
        <p>
          Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
        </p>
      </header>

      <div className={s.panel}>
        <p className={s.panelLabel}>This is a plain-language summary, not a final policy</p>
        <p>
          We&apos;re finalizing formal, attorney-reviewed Terms of Service. In the meantime, this page describes how
          working with First Coast Bids actually works today, in plain English.{" "}
          <Link href="/contact">Contact us</Link> with any questions.
        </p>
      </div>

      <section className={s.proseSection}>
        <h2>What First Coast Bids does</h2>
        <p>
          You send us a government RFP or solicitation. Our team prepares a capability statement, compliance
          matrix, and technical narrative for you to review, sign, and submit yourself.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>You submit it, not us</h2>
        <p>
          Government procurement portals tie a submission to your own registered vendor credentials, so you&apos;re
          the one who uploads it and hits submit. We prepare the package; you stay in control of your own agency
          portal account.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>No guarantee of winning</h2>
        <p>
          No one can guarantee an award; that decision is up to the agency. What we aim for is a complete,
          compliant submission prepared by people who&apos;ve done this before.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>Pricing and billing</h2>
        <p>
          No card is required to get started, and every deliverable is free to preview before anything&apos;s due.
          We confirm exact pricing with you directly before any work starts. See the{" "}
          <Link href="/pricing">Pricing page</Link> for the
          current one-off, retainer, and pilot options. We invoice you after the work is done.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>Your responsibilities</h2>
        <p>
          Keep the company and credential information you give us accurate: we use it as real facts in the
          documents we prepare. You&apos;re responsible for reviewing every deliverable before you sign and submit
          it, and for your own agency portal account and submission.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>Questions</h2>
        <p>
          <Link href="/contact">Reach out</Link> any time.
        </p>
      </section>
    </div>
  );
}
