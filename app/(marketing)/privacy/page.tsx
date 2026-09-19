import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "A plain-language summary of how First Coast Bids handles your data.",
};

// A real gap a design review surfaced: the footer had no privacy/terms
// links at all, because these pages never existed. This is deliberately
// NOT a final, attorney-reviewed policy -- per explicit user direction, an
// honest plain-language placeholder describing how the app actually
// operates today, grounded in the real code (Supabase RLS, the private
// rfp-documents storage bucket, no card-storage anywhere in the app),
// not invented legal boilerplate (no liability/arbitration/GDPR-specific
// language, since drafting that requires real counsel, not a guess).
export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-8">
      <Reveal mode="mount" className="flex flex-col gap-2">
        <h1 className="text-headline-lg text-primary">Privacy</h1>
        <p className="text-body-md text-on-surface-variant">
          Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
        </p>
      </Reveal>

      <Reveal delay={0.06} className="bg-tertiary-container text-on-tertiary-container rounded-xl p-5 flex flex-col gap-2">
        <p className="text-label-md font-bold uppercase tracking-wider">This is a plain-language summary, not a final policy</p>
        <p className="text-body-md">
          We&apos;re finalizing a formal, attorney-reviewed Privacy Policy. In the meantime, this page describes how
          First Coast Bids actually handles your information today, in plain English. If you have questions or a specific
          request about your data, <Link href="/contact" className="font-bold underline">contact us</Link> directly.
        </p>
      </Reveal>

      <Reveal delay={0.12} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">What we collect</h2>
        <p className="text-body-md text-on-surface-variant">
          Your company and contact information, your business credentials (license numbers, insurance details,
          certifications, and the documents that support them), the RFP and bid materials you upload, and basic
          account information needed to sign you in.
        </p>
      </Reveal>

      <Reveal delay={0.18} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">How it&apos;s stored and who can see it</h2>
        <p className="text-body-md text-on-surface-variant">
          Your data lives in a secured cloud database and file storage (Supabase). Access is restricted so only
          your own account and the First Coast Bids team members preparing your submissions can see it — access rules are
          enforced at the database level, not just hidden by the interface. Documents are kept in a private
          storage bucket and served through short-lived links (about an hour) rather than public URLs.
        </p>
      </Reveal>

      <Reveal delay={0.24} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">Cookies</h2>
        <p className="text-body-md text-on-surface-variant">
          We use a session cookie to keep you signed in. We don&apos;t currently use third-party advertising or
          analytics tracking cookies.
        </p>
      </Reveal>

      <Reveal delay={0.3} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">Payment information</h2>
        <p className="text-body-md text-on-surface-variant">
          We invoice you directly for work we&apos;ve done — this app itself doesn&apos;t collect or store your
          credit card number.
        </p>
      </Reveal>

      <Reveal delay={0.36} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">Sharing</h2>
        <p className="text-body-md text-on-surface-variant">
          We don&apos;t sell your data. We don&apos;t share it with third parties beyond what&apos;s genuinely needed
          to prepare your bid package.
        </p>
      </Reveal>

      <Reveal delay={0.42} className="flex flex-col gap-3">
        <h2 className="text-headline-md text-primary">Questions or requests</h2>
        <p className="text-body-md text-on-surface-variant">
          Want a copy of your data, or want something deleted?{" "}
          <Link href="/contact" className="text-primary font-bold hover:underline">
            Reach out
          </Link>{" "}
          and we&apos;ll help.
        </p>
      </Reveal>
    </div>
  );
}
