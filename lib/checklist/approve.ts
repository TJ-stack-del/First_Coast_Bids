import type { SupabaseClient } from "@supabase/supabase-js";

// Approving a suggestion: claim it (only while still pending, so a double
// click or two admins approving at once create ONE checklist item), then
// add the checklist item with its owner and source, then link them. If the
// insert fails, the claim is released so the admin can retry.
// One flat shape (not an {ok: true} | {ok: false} union): the repo compiles
// with strict: false, where such a union can't be narrowed.
export type ApproveResult = { ok: boolean; status: 200 | 409 | 500; checklistItemId: string | null; error: string | null };

export async function approveSuggestion(
  supabase: SupabaseClient,
  suggestionId: string,
  owner: "client" | "admin" | null,
  actorId: string
): Promise<ApproveResult> {
  const { data: claimed, error: claimError } = await supabase
    .from("checklist_suggestions")
    .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: actorId, ...(owner ? { suggested_owner: owner } : {}) })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .select("id, submission_id, label, detail, quote, page, source_file, suggested_owner");
  if (claimError) return { ok: false, status: 500, checklistItemId: null, error: claimError.message };
  if (!claimed || claimed.length !== 1) return { ok: false, status: 409, checklistItemId: null, error: "This suggestion was already decided." };
  const s = claimed[0];

  const { data: item, error: insertError } = await supabase
    .from("checklist_items")
    .insert({
      submission_id: s.submission_id,
      label: s.label,
      notes: s.detail,
      owner: s.suggested_owner,
      source_quote: s.quote,
      source_page: s.page,
      source_file: s.source_file,
    })
    .select("id")
    .single();
  if (insertError || !item) {
    await supabase.from("checklist_suggestions").update({ status: "pending", decided_at: null, decided_by: null }).eq("id", suggestionId);
    return { ok: false, status: 500, checklistItemId: null, error: insertError?.message ?? "Couldn't add the checklist item." };
  }
  await supabase.from("checklist_suggestions").update({ checklist_item_id: item.id }).eq("id", suggestionId);
  return { ok: true, status: 200, checklistItemId: item.id, error: null };
}
