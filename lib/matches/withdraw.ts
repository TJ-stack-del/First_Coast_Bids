// Withdrawing a bid an admin assigned from Matches (the agency closed or
// cancelled it, or it wasn't biddable after all). The route does the work;
// this turns its response into what the admin sees, so a withdrawal whose
// email failed is never reported as a clean success -- the admin then
// knows to tell the client some other way.

// `complete` is true only when nothing is left for the admin to do: the
// client was emailed, or it's a test submission that needs no email.
export type WithdrawResult = { withdrawn: boolean; complete: boolean; message: string };

type RouteBody = {
  withdrawn?: boolean;
  emailed?: boolean;
  reason?: string;
  emailError?: string;
  error?: string;
} | null;

export function describeWithdrawResult(status: number, body: RouteBody): WithdrawResult {
  if (!(status >= 200 && status < 300) || body?.withdrawn !== true) {
    const detail = body?.error ? ` (${body.error})` : status ? ` (HTTP ${status})` : "";
    return { withdrawn: false, complete: false, message: `Couldn't withdraw the bid${detail}. Refresh to check whether it's still listed.` };
  }
  if (body.emailed === true) {
    return { withdrawn: true, complete: true, message: "Withdrawn. The client was emailed that it's no longer open." };
  }
  if (body.reason === "test_submission") {
    return { withdrawn: true, complete: true, message: "Withdrawn. This is a test submission, so no email was sent." };
  }
  if (body.reason === "no_client_email") {
    return { withdrawn: true, complete: false, message: "Withdrawn, but the client has no email on file. Let them know directly." };
  }
  const detail = body.emailError ? ` (${body.emailError})` : "";
  return { withdrawn: true, complete: false, message: `Withdrawn, but the email didn't send${detail}. Let the client know directly.` };
}

export async function withdrawAssignedMatch(submissionId: string): Promise<WithdrawResult> {
  try {
    const res = await fetch("/api/withdraw-assigned-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    });
    const body = (await res.json().catch(() => null)) as RouteBody;
    return describeWithdrawResult(res.status, body);
  } catch {
    return describeWithdrawResult(0, null);
  }
}
