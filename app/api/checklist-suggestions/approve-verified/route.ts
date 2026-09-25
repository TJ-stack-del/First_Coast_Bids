import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveSuggestion } from "@/lib/checklist/approve";

// "Approve all verified": approves every pending suggestion with a verified
// quote, but only if the count still matches what the admin confirmed.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body && typeof body === "object" ? (body as { submissionId?: unknown }).submissionId : null;
  const expected = body && typeof body === "object" ? (body as { expected?: unknown }).expected : null;
  if (typeof submissionId !== "string" || typeof expected !== "number") {
    return NextResponse.json({ error: "Missing submissionId or expected." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: pending, error } = await supabase
    .from("checklist_suggestions")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("status", "pending")
    .eq("quote_status", "verified");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((pending ?? []).length !== expected) {
    return NextResponse.json(
      { error: `The list changed: ${(pending ?? []).length} verified suggestions are waiting now, not ${expected}. Check and confirm again.`, count: (pending ?? []).length },
      { status: 409 }
    );
  }

  let approved = 0;
  const errors: string[] = [];
  for (const s of pending ?? []) {
    const result = await approveSuggestion(supabase, s.id, null, member.id);
    if (result.ok) approved++;
    else errors.push(result.error);
  }
  return NextResponse.json({ approved, failed: errors.length, errors });
}
