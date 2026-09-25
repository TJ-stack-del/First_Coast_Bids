import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planTradeChange, TradeValidationError, type TradeChangePlan } from "@/lib/trades/server";
import { summarizeMoves, describeSummary, resortConflict } from "@/lib/trades/resort";

// Step 2 of saving a trade: re-plans the change, refuses if the number of
// matches that would move differs from what the admin confirmed (a scrape
// landed in between), then saves the trade and re-sorts. Only
// status='new' rows are touched, by id, and nothing is deleted
// (CLAUDE.md: bulk changes are counted and confirmed first).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !("trade" in body) || typeof body.expectedMoves !== "number") {
    return NextResponse.json({ error: "Missing trade or expectedMoves." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  let plan: TradeChangePlan;
  try {
    plan = await planTradeChange(supabase, member.org_id, body.trade);
  } catch (err) {
    if (err instanceof TradeValidationError) return NextResponse.json({ errors: err.errors }, { status: 400 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't plan the change." }, { status: 500 });
  }

  const conflict = resortConflict(plan.moves.length, body.expectedMoves);
  if (conflict) {
    const summary = summarizeMoves(plan.moves, plan.tradesAfter);
    return NextResponse.json(
      { error: conflict, moves: plan.moves.length, message: describeSummary(summary), summary },
      { status: 409 }
    );
  }

  // Save the trade itself first; a failed save changes nothing else.
  const { change, isNew } = plan;
  if (change) {
    const saved = plan.tradesAfter.find((t) => t.id === change.id)!;
    const before = plan.trades.find((t) => t.id === change.id) ?? null;
    const row = {
      label: saved.label,
      naics: saved.naics,
      nigp_codes: saved.nigpCodes,
      keywords: saved.keywords,
      active: saved.active,
      sort_order: saved.sortOrder,
      wd_position_code: saved.wdPositionCode,
      updated_at: new Date().toISOString(),
    };
    const { error } = isNew
      ? await supabase.from("trades").insert({ id: saved.id, org_id: member.org_id, ...row })
      : await supabase.from("trades").update(row).eq("id", saved.id).eq("org_id", member.org_id);
    if (error) return NextResponse.json({ error: `Couldn't save the trade: ${error.message}` }, { status: 500 });

    const onlyActiveChanged =
      before !== null &&
      before.active !== saved.active &&
      JSON.stringify({ ...before, active: saved.active }) === JSON.stringify(saved);
    await supabase.from("audit_log").insert({
      org_id: member.org_id,
      actor_id: member.id,
      event_type: isNew
        ? "trade_created"
        : onlyActiveChanged
          ? saved.active
            ? "trade_activated"
            : "trade_deactivated"
          : "trade_updated",
      event_detail: { trade_id: saved.id, before, after: saved },
    });
  }

  // Re-sort: one update per destination trade, in chunks, each checked by
  // the number of rows it actually changed.
  const byTarget = new Map<string | null, string[]>();
  for (const m of plan.moves) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), m.id]);
  let moved = 0;
  const errors: string[] = [];
  for (const [to, ids] of byTarget) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from("matched_opportunities")
        .update({ trade_id: to })
        .in("id", chunk)
        .eq("org_id", member.org_id)
        .eq("status", "new")
        .select("id");
      if (error) errors.push(error.message);
      moved += data?.length ?? 0;
    }
  }
  const failed = plan.moves.length - moved;

  if (plan.moves.length > 0) {
    await supabase.from("audit_log").insert({
      org_id: member.org_id,
      actor_id: member.id,
      event_type: "trades_resorted",
      event_detail: { trade_id: change?.id ?? null, expected: plan.moves.length, moved, failed, errors },
    });
  }

  const summary = summarizeMoves(plan.moves, plan.tradesAfter);
  const message =
    failed === 0
      ? `${change ? "Saved. " : ""}${plan.moves.length === 0 ? "No open matches changed trade." : describeSummary(summary).replace("This moves", "Moved")}`
      : `${change ? "Saved, but " : ""}${failed} of ${plan.moves.length} matches didn't move${errors[0] ? ` (${errors[0]})` : ""}. Run "Re-sort open matches" to retry.`;

  return NextResponse.json({
    saved: change !== null,
    tradeId: change?.id ?? null,
    moved,
    expected: plan.moves.length,
    failed,
    message,
  });
}
