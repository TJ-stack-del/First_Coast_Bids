import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getMatchWithdrawnEmail } from "@/lib/email/templates";

// "Withdraw" on the inbox's Waiting on client list: the agency closed or
// cancelled a bid an admin assigned from Matches, or it wasn't biddable
// after all (2026-09-23: a Jacksonville Beach RFP was assigned a week after
// its deadline, and the client's dashboard kept asking them to complete a
// bid file for it). Removes the draft from the client's dashboard, marks
// the match dismissed so the scraper's title+agency dedup keeps it from
// coming back, and tells the client nothing is needed.
//
// Only ever acts on one submission, and only on an unfinished draft that
// was created by assigning a match -- never a client's own intake draft or
// a real submitted bid (those have their own Delete on the detail page).
// Same auth pattern as notify-matched-opportunity: admin re-verified
// server-side, everything but the id read from the DB.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  if (typeof submissionId !== "string") {
    return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, agency, solicitation_number, draft, is_test, clients!submissions_client_id_fkey(company_name, email)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const { data: assignment } = await supabase
    .from("audit_log")
    .select("event_detail")
    .eq("submission_id", submission.id)
    .eq("event_type", "submission_created_from_match")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!submission.draft || !assignment) {
    return NextResponse.json(
      { error: "Only an unfinished bid assigned from Matches can be withdrawn." },
      { status: 409 }
    );
  }
  const opportunityId = (assignment.event_detail as { opportunity_id?: string } | null)?.opportunity_id ?? null;
  const client = submission.clients as unknown as { company_name: string; email: string | null } | null;

  // Written before the delete, like DeleteSubmissionButton: audit_log's
  // submission_id is ON DELETE SET NULL, so event_detail carries the
  // identifying info that outlives the submission.
  const detail = {
    submission_id: submission.id,
    opportunity_id: opportunityId,
    agency: submission.agency,
    solicitation_number: submission.solicitation_number,
    company_name: client?.company_name ?? null,
  };
  const { error: auditError } = await supabase.from("audit_log").insert({
    submission_id: submission.id,
    org_id: member.org_id,
    actor_id: member.id,
    event_type: "matched_opportunity_withdrawn",
    event_detail: detail,
  });
  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  // Checked by count: a delete RLS doesn't allow "succeeds" on zero rows.
  const { data: deleted, error: deleteError } = await supabase
    .from("submissions")
    .delete()
    .eq("id", submission.id)
    .eq("draft", true)
    .select("id");
  if (deleteError || deleted?.length !== 1) {
    return NextResponse.json(
      { error: deleteError?.message ?? "The draft wasn't removed." },
      { status: 500 }
    );
  }

  // After the delete, so a failed delete never leaves the match dismissed
  // while the client still sees the draft. A failure here only means the
  // match still reads "assigned" on the Matches page.
  if (opportunityId) {
    const { error: matchError } = await supabase
      .from("matched_opportunities")
      .update({ status: "dismissed" })
      .eq("id", opportunityId);
    if (matchError) {
      console.error("[withdraw-assigned-match] match not dismissed", { opportunityId, error: matchError.message });
    }
  }

  if (submission.is_test) {
    return NextResponse.json({ withdrawn: true, emailed: false, reason: "test_submission" });
  }
  if (!client?.email) {
    return NextResponse.json({ withdrawn: true, emailed: false, reason: "no_client_email" });
  }

  const email = getMatchWithdrawnEmail(submission.agency, client.company_name, submission.solicitation_number);
  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed.";
    console.error("[withdraw-assigned-match] send failed", { submissionId: submission.id, error: message });
    return NextResponse.json({ withdrawn: true, emailed: false, emailError: message });
  }

  await supabase.from("audit_log").insert({
    submission_id: null,
    org_id: member.org_id,
    actor_id: member.id,
    event_type: "matched_opportunity_withdrawn_email_sent",
    event_detail: { ...detail, to: client.email },
  });

  return NextResponse.json({ withdrawn: true, emailed: true });
}
