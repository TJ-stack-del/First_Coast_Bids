import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planTradeChange, TradeValidationError } from "@/lib/trades/server";
import { summarizeMoves, describeSummary } from "@/lib/trades/resort";

// Step 1 of saving a trade: shows how many open matches would change trade,
// before anything is written. Read-only.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !("trade" in body)) {
    return NextResponse.json({ error: "Missing trade." }, { status: 400 });
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

  try {
    const plan = await planTradeChange(supabase, member.org_id, body.trade);
    const summary = summarizeMoves(plan.moves, plan.tradesAfter);
    return NextResponse.json({ moves: plan.moves.length, message: describeSummary(summary), summary });
  } catch (err) {
    if (err instanceof TradeValidationError) return NextResponse.json({ errors: err.errors }, { status: 400 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Preview failed." }, { status: 500 });
  }
}
