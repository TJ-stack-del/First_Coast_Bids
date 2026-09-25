import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getChecklistItemsEmail } from "@/lib/email/templates";

// Emails the client every approved client-owned item they haven't been told
// about yet, once, then marks exactly those items notified.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body && typeof body === "object" ? (body as { submissionId?: unknown }).submissionId : null;
  if (typeof submissionId !== "string") return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, agency, is_test, clients!submissions_client_id_fkey(company_name, email)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const { data: items } = await supabase
    .from("checklist_items")
    .select("id, label, notes")
    .eq("submission_id", submissionId)
    .eq("owner", "client")
    .is("client_notified_at", null)
    .not("status", "in", "(done,waived)");
  if (!items || items.length === 0) return NextResponse.json({ sent: false, reason: "nothing_new" });
  if (submission.is_test) return NextResponse.json({ sent: false, reason: "test_submission" });
  const client = submission.clients as unknown as { company_name: string; email: string | null } | null;
  if (!client?.email) return NextResponse.json({ sent: false, reason: "no_client_email" });

  const email = getChecklistItemsEmail(
    submission.agency,
    client.company_name,
    items.map((i) => ({ label: i.label, detail: i.notes }))
  );
  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
  } catch (err) {
    return NextResponse.json({ sent: false, error: err instanceof Error ? err.message : "Send failed." }, { status: 502 });
  }

  const ids = items.map((i) => i.id);
  await supabase.from("checklist_items").update({ client_notified_at: new Date().toISOString() }).in("id", ids);
  await supabase.from("audit_log").insert({
    submission_id: submissionId,
    org_id: member.org_id,
    actor_id: member.id,
    event_type: "checklist_items_sent_to_client",
    event_detail: { to: client.email, checklist_item_ids: ids },
  });
  return NextResponse.json({ sent: true, count: ids.length });
}
