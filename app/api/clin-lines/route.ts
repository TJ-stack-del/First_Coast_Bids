import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminFor } from "@/lib/wage/server";
import { loadClinContext, priceContext, rateSheetFor, type ClinContext } from "@/lib/clins/server";
import { assignPositions } from "@/lib/clins/parse";
import { lineEdit, sharesEdit } from "@/lib/clins/edit";
import { stageNumber } from "@/components/ui/LifecycleStepper";

export const runtime = "nodejs";

// The CLIN pricing panel's reads and edits, and "Update the Rate sheet"
// (docs/superpowers/specs/2026-09-25-clin-pricing-design.md). Admin only;
// everything goes through the admin's own session (clin_lines RLS).

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function begin(request: Request, submissionId: unknown) {
  if (typeof submissionId !== "string") return { error: NextResponse.json({ error: "Invalid submissionId." }, { status: 400 }) };
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  const ctx = await loadClinContext(supabase, submissionId);
  if (!ctx) return { error: NextResponse.json({ error: "Submission not found." }, { status: 404 }) };
  return { supabase, member, ctx, submissionId };
}

function view(ctx: ClinContext) {
  // The saved Rate sheet no longer matches the table (a later bid price,
  // increase, split or edit): say so (final review I-7).
  const stale = ctx.rateSheet !== null && ctx.lines.length > 0 && ctx.rateSheet !== rateSheetFor(ctx);
  return {
    rateSheetStale: stale,
    rateSheetSaved: ctx.rateSheet !== null,
    lines: ctx.lines,
    priced: priceContext(ctx),
    shares: ctx.shares,
    scan: ctx.submission.clin_scan ?? null,
    bidPrice: ctx.bidPrice,
    increasePct: ctx.increasePct,
    clientName: ctx.clientName,
  };
}

// Positions (and so the split) follow the stored periods after any edit.
async function renumber(supabase: Supabase, submissionId: string) {
  const ctx = await loadClinContext(supabase, submissionId);
  if (!ctx) return;
  for (const l of assignPositions(ctx.lines)) {
    const was = ctx.lines.find((x) => x.id === l.id);
    if (was && (was.position !== l.position || was.sort !== l.sort)) {
      await supabase.from("clin_lines").update({ position: l.position, sort: l.sort }).eq("id", l.id!);
    }
  }
}

async function reply(supabase: Supabase, submissionId: string) {
  const ctx = await loadClinContext(supabase, submissionId);
  return NextResponse.json(view(ctx!));
}

export async function GET(request: Request) {
  const b = await begin(request, new URL(request.url).searchParams.get("submissionId"));
  if ("error" in b) return b.error;
  return NextResponse.json(view(b.ctx));
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const b = await begin(request, body?.submissionId);
  if ("error" in b) return b.error;
  const line = b.ctx.lines.find((l) => l.id === body?.id);
  if (!line) return NextResponse.json({ error: "Line not found." }, { status: 404 });
  const { submissionId: _s, id: _i, ...fields } = body!;
  const edit = lineEdit(fields, { quantity: line.quantity, unit: line.unit, period_months: line.period_months ?? null });
  if (!edit) return NextResponse.json({ error: "That value can't be used." }, { status: 400 });
  if (edit.clin && edit.clin !== line.clin && b.ctx.lines.some((l) => l.clin === edit.clin)) {
    return NextResponse.json({ error: `CLIN ${edit.clin} is already on this bid.` }, { status: 409 });
  }
  // Remember which fields the admin corrected: a re-read keeps them (I-2).
  const edited = [...new Set([...(line.edited ?? []), ...Object.keys(edit).filter((k) => k !== "unit_price_override")])];
  const { error } = await b.supabase.from("clin_lines").update({ ...edit, edited }).eq("id", line.id!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ("period_index" in edit || "clin" in edit) await renumber(b.supabase, b.submissionId);
  return reply(b.supabase, b.submissionId);
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const b = await begin(request, body?.submissionId);
  if ("error" in b) return b.error;
  const line = b.ctx.lines.find((l) => l.id === body?.id);
  if (!line) return NextResponse.json({ error: "Line not found." }, { status: 404 });
  // A line the AI read is hidden, not deleted, so a re-read doesn't bring it
  // back (I-2); a line added by hand is simply deleted.
  const { error } = line.read_clin
    ? await b.supabase.from("clin_lines").update({ dismissed: true }).eq("id", line.id!)
    : await b.supabase.from("clin_lines").delete().eq("id", line.id!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await renumber(b.supabase, b.submissionId);
  return reply(b.supabase, b.submissionId);
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const b = await begin(request, body?.submissionId);
  if ("error" in b) return b.error;
  const { error } = await b.supabase.from("submissions").update({ clin_shares: sharesEdit(body?.shares) }).eq("id", b.submissionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return reply(b.supabase, b.submissionId);
}

// { action: "add" } adds a blank line; { action: "rate_sheet" } writes the
// Rate sheet deliverable (confirming first once the client can see it).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const b = await begin(request, body?.submissionId);
  if ("error" in b) return b.error;
  if (body?.action === "add") {
    let n = 1;
    while (b.ctx.lines.some((l) => l.clin === `NEW-${n}`)) n++;
    const { error } = await b.supabase.from("clin_lines").insert({
      submission_id: b.submissionId,
      org_id: b.ctx.orgId ?? b.member.org_id,
      clin: `NEW-${n}`,
      description: "",
      unit_kind: "other",
      quote_status: "admin",
      sort: b.ctx.lines.length,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await renumber(b.supabase, b.submissionId);
    return reply(b.supabase, b.submissionId);
  }
  if (body?.action === "rate_sheet") {
    if (b.ctx.lines.length === 0) return NextResponse.json({ error: "There are no CLIN lines yet." }, { status: 400 });
    if (stageNumber(b.ctx.submission.stage) > stageNumber("in_review") && body.confirm !== true) {
      return NextResponse.json({ needsConfirm: true });
    }
    const content = rateSheetFor(b.ctx);
    const { data: existing } = await b.supabase
      .from("deliverables")
      .select("id")
      .eq("submission_id", b.submissionId)
      .eq("deliverable_type", "rate_sheet")
      .maybeSingle();
    const payload = { submission_id: b.submissionId, deliverable_type: "rate_sheet", content, file_url: null, prepared_by: b.member.id };
    const { error } = existing
      ? await b.supabase.from("deliverables").update(payload).eq("id", existing.id)
      : await b.supabase.from("deliverables").insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const priced = priceContext(b.ctx);
    await b.supabase.from("audit_log").insert({
      submission_id: b.submissionId,
      org_id: b.member.org_id,
      actor_id: b.member.id,
      event_type: "rate_sheet_updated",
      event_detail: { lines: b.ctx.lines.length, total: priced.total, missing: priced.missing },
    });
    return NextResponse.json({ written: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
