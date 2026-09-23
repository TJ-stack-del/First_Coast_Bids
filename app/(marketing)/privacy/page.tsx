import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/marketing/press.module.css";

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
    <div className={s.prose}>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Privacy</h1>
        <p>
          Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
        </p>
      </header>

      <div className={s.panel}>
        <p className={s.panelLabel}>This is a plain-language summary, not a final policy</p>
        <p>
          We&apos;re finalizing a formal, attorney-reviewed Privacy Policy. In the meantime, this page describes how
          First Coast Bids actually handles your information today, in plain English. If you have questions or a specific
          request about your data, <Link href="/contact">contact us</Link> directly.
        </p>
      </div>

      <section className={s.proseSection}>
        <h2>What we collect</h2>
        <p>
          Your company and contact information, your business credentials (license numbers, insurance details,
          certifications, and the documents that support them), the RFP and bid materials you upload, and basic
          account information needed to sign you in.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>How it&apos;s stored and who can see it</h2>
        <p>
          Your data lives in a secured cloud database and file storage (Supabase). Access is restricted so only
          your own account and the First Coast Bids team members preparing your submissions can see it: access rules are
          enforced at the database level, not just hidden by the interface. Documents are kept in a private
          storage bucket and served through short-lived links (about an hour) rather than public URLs.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>Cookies</h2>
        <p>
          We use a session cookie to keep you signed in. We don&apos;t currently use third-party advertising or
          analytics tracking cookies.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>Payment information</h2>
        <p>
          We invoice you directly for work we&apos;ve done. This app itself doesn&apos;t collect or store your
          credit card number.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>Sharing</h2>
        <p>
          We don&apos;t sell your data. We don&apos;t share it with third parties beyond what&apos;s genuinely needed
          to prepare your bid package.
        </p>
      </section>

      <section className={s.proseSection}>
        <h2>Questions or requests</h2>
        <p>
          Want a copy of your data, or want something deleted?{" "}
          <Link href="/contact">
            Reach out
          </Link>{" "}
          and we&apos;ll help.
        </p>
      </section>
    </div>
  );
}
