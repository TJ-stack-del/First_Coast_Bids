import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ParsedWd } from "@/lib/wage/parse-wd";
import { normalizeClientPricing, hasAnyPricing } from "@/lib/wage/client-pricing";
import { applyPrefilledHours } from "@/lib/wage/prefill";
import { adminFor, prefillContext, guidanceFor } from "@/lib/wage/server";
import type { WorksheetLine } from "@/lib/wage/floor";

export const runtime = "nodejs";
export const maxDuration = 60;

// PUT: save the bid's client's usual numbers (clients.pricing). The FIRST
// save for a client also fills this worksheet's blank pricing boxes and
// re-computes pre-filled/blank hours; later saves only change the client
// record (and future bids) -- "Re-fill" applies them to a worksheet.
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const ctx = await prefillContext(supabase, member.org_id, submissionId);
  if (!ctx) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  const pricing = normalizeClientPricing(body?.pricing);
  const firstTime = !hasAnyPricing(ctx.client.pricing);

  const { error } = await supabase.from("clients").update({ pricing }).eq("id", ctx.client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!firstTime) return NextResponse.json({ pricing, applied: false });

  const { data: ws } = await supabase
    .from("wage_worksheets")
    .select("wd_parsed, lines, supplies_mode, supplies_value, overhead_pct, profit_pct")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (!ws) return NextResponse.json({ pricing, applied: false });
  const next = { ...ctx, client: { ...ctx.client, pricing } };
  const { pre } = guidanceFor(next, ws.wd_parsed as ParsedWd, pricing);
  const blank = ws.supplies_value === null && ws.overhead_pct === null && ws.profit_pct === null;
  const { error: wsError } = await supabase
    .from("wage_worksheets")
    .update({
      lines: applyPrefilledHours(ws.lines as WorksheetLine[], pre.lines),
      ...(blank ? { supplies_mode: pricing.suppliesMode } : {}),
      supplies_value: ws.supplies_value ?? pricing.suppliesValue,
      overhead_pct: ws.overhead_pct ?? pricing.overheadPct,
      profit_pct: ws.profit_pct ?? pricing.profitPct,
      updated_by: member.id,
      updated_at: new Date().toISOString(),
    })
    .eq("submission_id", submissionId);
  if (wsError) return NextResponse.json({ error: wsError.message }, { status: 500 });
  return NextResponse.json({ pricing, applied: true });
}
