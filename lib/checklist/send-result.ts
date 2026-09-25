// What the admin sees after "Send the client their list". Anything not
// explicitly sent is reported as not sent.
type Body = { sent?: boolean; count?: number; reason?: string; error?: string } | null;

export function describeSendResult(status: number, body: Body): { sent: boolean; message: string } {
  if (status >= 200 && status < 300 && body?.sent === true) {
    const n = body.count ?? 0;
    return { sent: true, message: `Sent the client their list (${n} ${n === 1 ? "item" : "items"}).` };
  }
  if (body?.reason === "nothing_new") return { sent: false, message: "There's nothing new to send the client." };
  if (body?.reason === "no_client_email") return { sent: false, message: "The client has no email address on file, so nothing was sent." };
  if (body?.reason === "test_submission") return { sent: false, message: "This is a test submission, so no email was sent." };
  const detail = body?.error ? ` (${body.error})` : status ? ` (HTTP ${status})` : "";
  return { sent: false, message: `The email didn't send${detail}.` };
}
