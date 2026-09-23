import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { parseLlmJson } from "@/lib/llm-json";
import { loadTrades } from "@/lib/trades/server";
import { tradeFieldsForInsert } from "@/lib/trades/classify";
import type { Trade } from "@/lib/trades/types";

export const runtime = "nodejs";
// See extract-from-document/route.ts's identical comment -- Vercel's
// default 10s serverless timeout was silently clipping real-world uploads;
// this route makes the same Claude extraction call, so it needs the same
// override.
export const maxDuration = 60;

// Second opportunity-ingestion path alongside lib/scrapers/* + app/api/scrape:
// DemandStar/PublicPurchase/JTA don't offer a scrapable listings page, only
// email notifications, so a Gmail Apps Script trigger (see
// scripts/gmail-inbound-bid-trigger.gs) forwards each new message here as a
// webhook instead. Same destination as the scraper (matched_opportunities,
// assigned_client_id left null, reviewed manually in app/admin/matches),
// so no new admin UI is needed -- just a second producer into the same
// queue.

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.INBOUND_BID_EMAIL_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

// Uses the service_role key, not the publishable/anon key: this route is
// called by an Apps Script trigger, not a browser, so there's no user
// session for RLS's is_admin() to check against. service_role bypasses RLS
// entirely and must only ever be used server-side, in a route like this
// one -- never in client.ts.
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Deliberately narrower than extract-from-document's schema (naics/small-
// business-status/set-asides): those get filled in later, during a real
// client's own intake, once someone has actually decided to pursue this
// opportunity. This extraction only needs to fill matched_opportunities'
// own columns.
const SYSTEM_PROMPT = `You extract structured bid-opportunity information from a notification EMAIL (e.g. a DemandStar, PublicPurchase, or agency-portal alert) forwarded to a small-business bidding platform's inbound bids address.

Read the provided email subject and body and respond with ONLY a single JSON object with exactly these keys:
- "title": a short, human-readable name for the opportunity/project (e.g. "Janitorial Services for City Hall Annex"), or null if the email doesn't clearly name one
- "agency": the contracting agency or department name, or null if not found
- "solicitationNumber": the solicitation/RFP/RFQ/bid number, or null if not found
- "dueDate": the proposal/quote/response due date in YYYY-MM-DD format, or null if not found or ambiguous
- "scope": a concise 2-4 sentence plain-English summary of the work being requested, or null if the email doesn't describe one

Only fill a field if the email actually states it -- never guess or infer from context, and never invent a title, agency, or date that isn't actually written in the email (a generic notification-service subject line like "New Bid Posted" is NOT a title). Respond with nothing but that JSON object -- no markdown code fences, no commentary.`;

type ExtractedEmailFields = {
  title: string | null;
  agency: string | null;
  solicitationNumber: string | null;
  dueDate: string | null;
  scope: string | null;
};

function coerceFields(parsed: unknown): ExtractedEmailFields {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    title: asString(obj.title),
    agency: asString(obj.agency),
    solicitationNumber: asString(obj.solicitationNumber),
    dueDate: asString(obj.dueDate),
    scope: asString(obj.scope),
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const subject = typeof payload?.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  const from = typeof payload?.from === "string" ? payload.from.trim() : null;

  if (!subject && !body) {
    return NextResponse.json({ error: "No subject or body provided." }, { status: 400 });
  }

  const anthropic = new Anthropic();
  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Subject: ${subject || "(no subject)"}\n\n${body || "(no body)"}`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Extraction is busy right now — try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[inbound-bid-email] APIError", err.status, err.message, "from:", from);
      return NextResponse.json({ error: "Extraction failed." }, { status: 502 });
    }
    throw err;
  }

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    return NextResponse.json({ error: "Couldn't extract anything from that email." }, { status: 502 });
  }

  // See lib/llm-json.ts -- tolerates a literal newline inside a JSON string
  // value, which a plain JSON.parse would reject outright.
  const parsed = parseLlmJson<unknown>(textBlock.text);
  if (parsed === null) {
    return NextResponse.json({ error: "Couldn't parse the extraction result." }, { status: 502 });
  }

  const extracted = coerceFields(parsed);

  // Neither column allows null, but this route runs unattended (no admin
  // present to fill in a gap the way intake's own extraction UI lets a
  // client do) -- fall back to the raw subject / a flagged placeholder so
  // a genuinely under-described email still lands in the review queue
  // instead of being silently dropped.
  const sourceTitle = extracted.title ?? (subject || "Untitled opportunity (see scope)");
  const sourceAgency = extracted.agency ?? "Unspecified agency (see scope)";

  const supabase = serviceClient();

  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();
  if (orgError || !org) {
    return NextResponse.json({ error: "No organization set up yet." }, { status: 500 });
  }

  // Sorted into a trade like a scraped bid. Same rule as the scrape: if
  // the trade list can't be loaded, fail visibly rather than guess.
  let trades: Trade[];
  try {
    trades = await loadTrades(supabase, org.id);
  } catch (err) {
    console.error("[inbound-bid-email] failed to load trades", err, "from:", from);
    return NextResponse.json({ error: "Could not load the trade list." }, { status: 500 });
  }

  // Same duplicate guard as the scraper: an Apps Script trigger re-scanning
  // the same labeled thread (e.g. after a script error mid-run) shouldn't
  // create a second row for the same opportunity.
  const { data: existing } = await supabase
    .from("matched_opportunities")
    .select("id")
    .eq("org_id", org.id)
    .eq("source_title", sourceTitle)
    .eq("source_agency", sourceAgency)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, inserted: false, skipped: "duplicate", id: existing.id });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("matched_opportunities")
    .insert({
      org_id: org.id,
      assigned_client_id: null,
      source_title: sourceTitle,
      source_agency: sourceAgency,
      due_date: extracted.dueDate,
      scope: extracted.scope,
      solicitation_number: extracted.solicitationNumber,
      status: "new",
      ...tradeFieldsForInsert({ title: sourceTitle }, trades),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[inbound-bid-email] insert failed", insertError, "from:", from);
    return NextResponse.json({ error: "Could not log the opportunity." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: true, id: inserted.id });
}
