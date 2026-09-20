"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { isEmail, normalizePhone } from "@/lib/phone";
import { onSignedInElsewhere } from "@/lib/auth-broadcast";

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "passwordless" | "forgot">("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Passwordless: a magic link for an email contact, a texted code for a
  // phone one — Supabase's own signInWithOtp/verifyOtp, not a custom code
  // system. shouldCreateUser stays false here (unlike the intake wizard's
  // signUp) since this is sign-IN — a mistyped contact on this page should
  // fail, not quietly create a new, empty account.
  const [contact, setContact] = useState("");
  const [otpChannel, setOtpChannel] = useState<"email" | "sms" | null>(null);
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  const [signedInElsewhere, setSignedInElsewhere] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // A tab sitting on "check your email" (the passwordless email-sent
  // screen, or the reset-link-sent screen below) has no way to know the
  // link was already clicked in another tab or device -- there's no
  // session change to observe here, since the session lives in that
  // *other* tab's cookies. AppShell announces once it mounts (which only
  // happens for a signed-in user), so this tab learns about it and shows
  // a "continue here" banner -- deliberately not an auto-navigate: two
  // tabs both silently landing on the dashboard was more surprising than
  // useful, so this tab now just waits for an explicit click.
  useEffect(() => onSignedInElsewhere(() => setSignedInElsewhere(true)), []);

  function continueSignedIn() {
    router.push("/");
    router.refresh();
  }

  const signedInBanner = signedInElsewhere ? (
    <div className="flex items-center justify-between gap-3 bg-primary-container text-on-primary-container rounded-xl px-4 py-3">
      <p className="text-body-md">You're signed in on another tab.</p>
      <button
        type="button"
        onClick={continueSignedIn}
        className="text-label-md font-bold underline shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container rounded-sm"
      >
        Continue here
      </button>
    </div>
  ) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Unable to sign in.");
      setSubmitting(false);
      return;
    }

    // Deliberately no org/membership setup here. Admin memberships are
    // security-sensitive and must be provisioned through a trusted
    // service-role process, never by a browser session.
    router.push("/");
    router.refresh();
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpSubmitting(true);

    const trimmedContact = contact.trim();

    if (isEmail(trimmedContact)) {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmedContact,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setOtpSubmitting(false);
      if (otpErr) {
        setOtpError(otpErr.message);
        return;
      }
      setOtpChannel("email");
      return;
    }

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      phone: normalizePhone(trimmedContact),
      options: { shouldCreateUser: false },
    });
    setOtpSubmitting(false);
    if (otpErr) {
      setOtpError(otpErr.message);
      return;
    }
    setOtpChannel("sms");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpSubmitting(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalizePhone(contact.trim()),
      token: code,
      type: "sms",
    });

    setOtpSubmitting(false);
    if (verifyError || !data.user) {
      setOtpError(verifyError?.message ?? "That code didn't work. Check it and try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  function resetPasswordless() {
    setOtpChannel(null);
    setOtpError(null);
    setCode("");
  }

  async function handleSendResetLink(e: FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotSubmitting(true);

    // redirectTo lands on /auth/callback (this project's existing PKCE code
    // exchange route — same one the passwordless email link already uses)
    // with next=/reset-password, so the recovery code gets exchanged for a
    // real session before the client ever sees the reset-password form.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setForgotSubmitting(false);
    if (resetError) {
      setForgotError(resetError.message);
      return;
    }
    setForgotSent(true);
  }

  if (mode === "forgot") {
    return (
      <div className="flex flex-col gap-5">
        {signedInBanner}
        {forgotSent ? (
          <div className="flex flex-col gap-4 text-center" role="status" aria-live="polite">
            <p className="text-body-md text-on-surface-variant">
              If an account exists for {forgotEmail}, we emailed a link to reset the password.
              Open it on this device to continue.
            </p>
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setForgotSent(false);
                setForgotEmail("");
              }}
              className="text-body-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendResetLink} className="flex flex-col gap-5">
            {forgotError && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-body-md text-error bg-error-container/20 border border-error/30 rounded px-3 py-2"
              >
                {forgotError}
              </p>
            )}
            <p className="text-body-md text-on-surface-variant">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <Field
              label="Email"
              type="email"
              value={forgotEmail}
              onChange={setForgotEmail}
              autoComplete="email"
              icon="mail"
              required
            />
            <button
              type="submit"
              disabled={forgotSubmitting}
              className="w-full h-14 bg-primary text-on-primary font-headline text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {forgotSubmitting && <Spinner />}
              {forgotSubmitting ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className="text-body-md text-primary hover:underline text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    );
  }

  if (mode === "passwordless") {
    return (
      <div className="flex flex-col gap-5">
        {signedInBanner}
        {otpError && (
          <p
            role="alert"
            aria-live="assertive"
            className="text-body-md text-error bg-error-container/20 border border-error/30 rounded px-3 py-2"
          >
            {otpError}
          </p>
        )}

        {otpChannel === "sms" ? (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-5">
            <p className="text-body-md text-on-surface-variant">
              We texted a code to {contact}. Enter it below.
            </p>
            <Field label="Code" type="text" value={code} onChange={setCode} icon="pin" required />
            <button
              type="submit"
              disabled={otpSubmitting}
              className="w-full h-14 bg-primary text-on-primary font-headline text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {otpSubmitting && <Spinner />}
              {otpSubmitting ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={resetPasswordless}
              className="text-body-md text-primary hover:underline text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
            >
              Use a different email or phone
            </button>
          </form>
        ) : otpChannel === "email" ? (
          <div className="flex flex-col gap-4 text-center" role="status" aria-live="polite">
            <p className="text-body-md text-on-surface-variant">
              We emailed a sign-in link to {contact}. Open it on this device to finish signing in.
            </p>
            <button
              type="button"
              onClick={resetPasswordless}
              className="text-body-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
            >
              Use a different email or phone
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendCode} className="flex flex-col gap-5">
            <Field
              label="Email or phone"
              type="text"
              value={contact}
              onChange={setContact}
              autoComplete="email"
              icon="sms"
              required
            />
            <button
              type="submit"
              disabled={otpSubmitting}
              className="w-full h-14 bg-primary text-on-primary font-headline text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {otpSubmitting && <Spinner />}
              {otpSubmitting ? "Sending…" : "Send me a code or link"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setMode("password");
            resetPasswordless();
          }}
          className="text-body-md text-primary hover:underline text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
        >
          Use my password instead
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {signedInBanner}
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-body-md text-error bg-error-container/20 border border-error/30 rounded px-3 py-2"
        >
          {error}
        </p>
      )}

      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        icon="mail"
        required
      />
      <div>
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          icon="lock"
          required
        />
        <button
          type="button"
          onClick={() => setMode("forgot")}
          className="text-label-md text-primary hover:underline mt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-14 bg-primary text-on-primary font-headline text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {submitting && <Spinner />}
        {submitting ? "Signing in…" : "Sign In"}
        {!submitting && <span className="material-symbols-outlined font-bold">arrow_forward</span>}
      </button>

      <button
        type="button"
        onClick={() => setMode("passwordless")}
        className="text-body-md text-primary hover:underline text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
      >
        Sign in without a password
      </button>
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  icon,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  icon?: string;
  required?: boolean;
}) {
  // Only the password field gets a reveal toggle -- a masked-only field
  // with no way to confirm what was typed is a real failure point for
  // someone typing one-handed under screen glare (or on a job site,
  // gloves-off, checking their own paste). Other fields (email, OTP code)
  // are never masked so there's nothing to reveal.
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && revealed ? "text" : type;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
      <div className="relative flex items-center">
        {icon && (
          <span className="material-symbols-outlined absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant text-xl">
            {icon}
          </span>
        )}
        <input
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          className={`w-full h-14 border-0 bg-surface-container text-on-surface placeholder:text-outline text-body-lg rounded-xl outline-none focus:bg-surface-container-high transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
            icon ? "pl-12" : "pl-4"
          } ${isPassword ? "pr-12" : "pr-4"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="material-symbols-outlined absolute right-3.5 flex items-center text-on-surface-variant text-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary rounded-sm"
          >
            {revealed ? "visibility_off" : "visibility"}
          </button>
        )}
      </div>
    </label>
  );
}
