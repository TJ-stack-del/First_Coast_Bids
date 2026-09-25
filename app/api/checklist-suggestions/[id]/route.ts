import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveSuggestion } from "@/lib/checklist/approve";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : null;
  const ownerRaw = body && typeof body === "object" ? (body as { owner?: unknown }).owner : null;
  const owner = ownerRaw === "client" || ownerRaw === "admin" ? ownerRaw : null;
  if (action !== "approve" && action !== "reject" && action !== "restore") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
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

  if (action === "approve") {
    const result = await approveSuggestion(supabase, id, owner, member.id);
    return result.ok
      ? NextResponse.json({ ok: true, checklistItemId: result.checklistItemId })
      : NextResponse.json({ error: result.error }, { status: result.status });
  }

  const from = action === "reject" ? "pending" : "rejected";
  const update =
    action === "reject"
      ? { status: "rejected", decided_at: new Date().toISOString(), decided_by: member.id }
      : { status: "pending", decided_at: null, decided_by: null };
  const { data, error } = await supabase.from("checklist_suggestions").update(update).eq("id", id).eq("status", from).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length !== 1) return NextResponse.json({ error: "This suggestion was already changed." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
