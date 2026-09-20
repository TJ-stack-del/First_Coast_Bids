import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { Reveal } from "@/components/ui/Reveal";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Reset Password",
};

// No signed-in redirect here (unlike app/login/page.tsx) — reaching this
// page via the emailed recovery link means being signed in is the whole
// point, not a reason to bounce away.
export default function ResetPasswordPage() {
  return (
    <main className="animate-fade-in min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="block w-fit mx-auto mb-4 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Logo variant="stacked" priority iconClassName="h-[var(--auth-logo-height)] w-auto" />
          </Link>
          <Reveal mode="mount" as="div">
            <span className="font-bold text-headline-lg text-primary">Reset your password</span>
            <p className="text-body-md text-on-surface-variant mt-2">Choose a new password below.</p>
          </Reveal>
        </div>

        <Reveal mode="mount" delay={0.08} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <ResetPasswordForm />
        </Reveal>
      </div>
    </main>
  );
}
