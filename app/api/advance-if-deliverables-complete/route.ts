import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasUnresolvedPlaceholders } from "@/lib/pdf/placeholder-check";
import { transitionSubmissionStage } from "@/lib/submissions/transition-stage";
import { getRequiredDeliverableTypes } from "@/lib/deliverables/package-routing";

// Called by DeliverablesPanel right after every deliverable save (text or
// file) — checks a fact the system can verify directly (all three full
// deliverables have real content or a file) rather than requiring an admin
// to remember to click "Move to stage" once they're done. Re-verifies
// against the DB itself rather than trusting whatever the client component
// believes just got saved. The transition helper atomically updates the
// stage, writes its audit record, and enqueues the client notification.

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
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, stage")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  if (
    submission.stage !== "in_review" &&
    submission.stage !== "deliverables_ready"
  ) {
    return NextResponse.json({ advanced: false, reason: "wrong_stage" });
  }

  // A federal bid with a CLIN price table isn't complete without its Rate sheet.
  const { count: clinCount } = await supabase
    .from("clin_lines")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId);
  const REQUIRED_TYPES = getRequiredDeliverableTypes("full", (clinCount ?? 0) > 0);

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("deliverable_type, content, file_url")
    .eq("submission_id", submissionId);

  const complete = REQUIRED_TYPES.every((type) => {
    const d = (deliverables ?? []).find((x) => x.deliverable_type === type);
    return !!d && (!!d.file_url || !!d.content?.trim());
  });

  if (!complete) {
    return NextResponse.json({ advanced: false, reason: "incomplete" });
  }

  // A file-uploaded deliverable skips this check entirely -- its content
  // isn't text this app generated, so there's nothing to have left
  // unresolved. A text deliverable that still has an auto-draft's
  // [bracketed placeholder] in it is NOT actually complete, even though it
  // has non-empty content -- see placeholder-check.ts's header comment.
  // NOTE: transition_submission_stage_with_outbox's own completeness check
  // (p_require_complete_deliverables) only verifies non-empty content/file_url
  // -- it does not check for placeholders. This pre-check is the only guard
  // for that; do not remove it when touching this file.
  const hasPlaceholders = REQUIRED_TYPES.some((type) => {
    const d = (deliverables ?? []).find((x) => x.deliverable_type === type);
    return !d?.file_url && hasUnresolvedPlaceholders(d?.content);
  });

  if (hasPlaceholders) {
    return NextResponse.json({ advanced: false, reason: "has_placeholders" });
  }

  try {
    const { transition, delivery } = await transitionSubmissionStage({
      submissionId,
      expectedStage: "in_review",
      newStage: "deliverables_ready",
      actorId: member.id,
      eventType: "stage_auto_advanced",
      trigger: "deliverables_complete",
      requireCompleteDeliverables: true,
    });

    if (
      transition.outcome === "conflict" ||
      transition.outcome === "not_found" ||
      transition.outcome === "ineligible"
    ) {
      return NextResponse.json({
        advanced: false,
        reason: transition.outcome,
        currentStage: transition.current_stage,
      });
    }

    const status = delivery?.status ?? transition.notification_status;
    return NextResponse.json({
      advanced: transition.current_stage === "deliverables_ready",
      sent: status === "sent",
      reason:
        delivery?.reason ??
        transition.notification_skip_reason ??
        (status === "sent" ? undefined : "queued_for_retry"),
    });
  } catch (error) {
    console.error("[advance-if-deliverables-complete] transition failed", error);
    return NextResponse.json(
      { error: "Couldn't advance the submission." },
      { status: 500 }
    );
  }
}