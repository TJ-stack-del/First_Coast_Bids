// Server-only. Uses RESEND_API_KEY — never expose this to the browser.
// During testing (no verified custom domain), Resend only allows sending
// TO the email address you signed up with, FROM their shared test domain
// — this is Resend's own safety default, not something we configure.

export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}) {
  // Email local-parts are case-insensitive everywhere that matters (Gmail
  // included), but Resend's sandbox allow-list check is a case-sensitive
  // string compare against the account owner's address — a client record
  // saved as "Name@gmail.com" instead of "name@gmail.com" fails with the
  // same "can only send to your own address" error even though it's the
  // same inbox. Normalize here so casing from an intake form never matters.
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({
        // firstcoastbids.com is the brand domain, confirmed verified
        // (SPF/DKIM) in Resend. bidpulse.co is being fully decommissioned
        // (30-day sunset as of 2026-09-22) -- do not send from it again.
        from: "First Coast Bids <notifications@firstcoastbids.com>",
        to: to.trim().toLowerCase(),
        subject,
        html,
      }),
    });
  } catch (cause) {
    throw new EmailSendError(
      `Resend request outcome is unknown: ${
        cause instanceof Error ? cause.message : "network failure"
      }`,
      false
    );
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new EmailSendError(
      `Resend send failed (${res.status}): ${errText}`,
      res.status === 408 || res.status === 429 || res.status >= 500
    );
  }

  return res.json();
}
