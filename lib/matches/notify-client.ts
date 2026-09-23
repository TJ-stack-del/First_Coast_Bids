// Sending the "a bid is waiting for you" email after an admin assigns a
// matched opportunity. This used to be a fire-and-forget fetch whose result
// was ignored (`.catch(() => {})`), so the admin saw "Assigned" even when
// the client was never emailed (a real case on 2026-09-23: a production
// assignment left no matched_opportunity_email_sent audit row). Now the
// caller waits for the result and shows it; the same helper backs the
// inbox's "Resend email" button.

export type NotifyResult = { sent: boolean; message: string };

type RouteBody = { sent?: boolean; reason?: string; error?: string } | null;

// Pure: turns the route's HTTP status + JSON body into what the admin sees.
// Anything not explicitly `sent: true` is reported as not sent.
export function describeNotifyResult(status: number, body: RouteBody): NotifyResult {
  if (status >= 200 && status < 300 && body?.sent === true) {
    return { sent: true, message: "Email sent to the client." };
  }
  if (body?.reason === "test_submission") {
    return { sent: false, message: "This is a test submission, so no email was sent." };
  }
  if (body?.reason === "no_client_email") {
    return { sent: false, message: "The client has no email address on file, so no email was sent." };
  }
  const detail = body?.error ? ` (${body.error})` : status ? ` (HTTP ${status})` : "";
  return { sent: false, message: `The email to the client didn't send${detail}.` };
}

export async function notifyClientOfMatch(submissionId: string): Promise<NotifyResult> {
  try {
    const res = await fetch("/api/notify-matched-opportunity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    });
    const body = (await res.json().catch(() => null)) as RouteBody;
    return describeNotifyResult(res.status, body);
  } catch {
    return describeNotifyResult(0, null);
  }
}
