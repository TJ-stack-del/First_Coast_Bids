import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SMALL_BUSINESS_STATUSES, COMMON_SET_ASIDES } from "@/lib/business-options";
import { loadActiveTrades } from "@/lib/trades/server";
import { offeredNaicsCodes } from "@/lib/trades/classify";
import { detectDocumentKind, buildDocumentContent, UNSUPPORTED_FILE_TYPE_MESSAGE } from "@/lib/document-parsing";
import { parseLlmJson } from "@/lib/llm-json";

export const runtime = "nodejs";
// Vercel's default serverless timeout (10s) is real and was silently
// clipping this route for larger/more complex real-world PDFs -- extraction
// calls to Claude routinely take well past 10s even for small test files.
// A killed function returns a platform error page instead of JSON, which
// breaks the client's res.json() and surfaces as a generic "Couldn't read
// that document" with no indication it was actually a timeout.
export const maxDuration = 60;

// Called from the intake wizard's "About the bid" step: a client uploads the
// agency's RFP/solicitation file and we prefill agency/solicitationNumber/
// dueDate/scope/naicsCodes/smallBusinessStatuses/setAsides from it instead of
// making them retype it. Runs before a submission row exists, so this only
// ever reads the upload in-memory — it never touches submission_documents/
// Storage (that's SubmissionDocuments' job, once a file is worth permanently
// attaching to a submission).
const MAX_FILE_BYTES = 20 * 1024 * 1024; // comfortably under Claude's 32MB PDF request limit

// The checkbox/array fields return values that match the same option lists
// the UI renders (lib/business-options.ts) so the caller can pre-check
// checkboxes directly instead of pattern-matching free text itself. Anything
// the document mentions that isn't on those lists goes in the matching
// "Other" field, one value each — same shape as what a person would type by
// hand into that field.
// Built per request: the NAICS codes listed are the offered trades' codes
// (public.trades), which an admin can change at any time.
function systemPrompt(knownNaics: string[]): string {
  return `You extract structured bid information from US government solicitation documents (RFPs, RFQs, sources-sought notices, task orders, etc.) for a small-business bidding platform.

Read the provided document and respond with ONLY a single JSON object with exactly these keys:
- "agency": the contracting agency or department name, or null if not found
- "solicitationNumber": the solicitation/RFP/RFQ number, or null if not found
- "dueDate": the FINAL PROPOSAL/QUOTE/BID SUBMISSION due date — the actual deadline by which the bid itself must be submitted — in YYYY-MM-DD format. Real solicitations often list several other dates that are NOT this one: a site-visit date, a question-submission/Q&A deadline, a pre-bid or pre-proposal conference date, an amendment-acknowledgment deadline. Do not use any of those. If the document lists multiple dates and you cannot clearly identify which one is specifically the final bid/proposal submission deadline, return null rather than guessing — a wrong date here is worse than no date.
- "scope": a concise 2-4 sentence plain-English summary of the work being requested, or null if the document doesn't describe one
- "naicsCodes": an array of JSON strings (e.g. "561720", not the bare number 561720) for each NAICS code explicitly stated in the document that exactly matches one of these codes: ${knownNaics.join(", ") || "(none)"}. Empty array if none match.
- "naicsOther": if the document states a NAICS code that is NOT in that list, put that one code as a JSON string (e.g. "238160", not 238160) here, otherwise null.
- "smallBusinessStatuses": an array of small-business statuses explicitly required or referenced as eligibility for this solicitation, only from this exact list: ${SMALL_BUSINESS_STATUSES.join(", ")}. Empty array if none are mentioned.
- "setAsides": an array of set-aside types explicitly stated in the document, only from this exact list: ${COMMON_SET_ASIDES.join(", ")}. Empty array if none match.
- "setAsideOther": if the document states a specific set-aside type (e.g. a local/regional category) that is NOT in that list, put that one set-aside name here as a string, otherwise null.

Only include a NAICS code, status, or set-aside if the document actually states it applies to or is required for this solicitation — do not guess from the general subject matter. Respond with nothing but that JSON object — no markdown code fences, no commentary.`;
}

type ExtractedFields = {
  agency: string | null;
  solicitationNumber: string | null;
  dueDate: string | null;
  scope: string | null;
  naicsCodes: string[];
  naicsOther: string | null;
  smallBusinessStatuses: string[];
  setAsides: string[];
  setAsideOther: string | null;
};

function coerceFields(parsed: unknown, knownNaics: string[]): ExtractedFields {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const asString = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null;
  // Defensive against model drift — only pass through array entries that
  // actually match a known checkbox value, since the caller pre-checks
  // checkboxes directly off these arrays with no further validation. NAICS
  // codes look like numbers, so the model occasionally emits an unquoted
  // JSON number despite the prompt asking for a string — normalize before
  // matching rather than silently dropping a correctly-identified code.
  const asKnownArray = (v: unknown, known: readonly string[]) =>
    Array.isArray(v)
      ? v
          .map((x) => (typeof x === "string" ? x : typeof x === "number" ? String(x) : null))
          .filter((x): x is string => x !== null && known.includes(x))
      : [];

  return {
    agency: asString(obj.agency),
    solicitationNumber: asString(obj.solicitationNumber),
    dueDate: asString(obj.dueDate),
    scope: asString(obj.scope),
    naicsCodes: asKnownArray(
      obj.naicsCodes,
      knownNaics
    ),
    naicsOther: asString(obj.naicsOther),
    smallBusinessStatuses: asKnownArray(obj.smallBusinessStatuses, SMALL_BUSINESS_STATUSES),
    setAsides: asKnownArray(obj.setAsides, COMMON_SET_ASIDES),
    setAsideOther: asString(obj.setAsideOther),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Codes the reader may return: the offered trades' codes. If the list
  // can't be loaded, no codes are prefilled (the client can still tick
  // them), rather than accepting anything the model says.
  let knownNaics: string[] = [];
  try {
    knownNaics = offeredNaicsCodes(await loadActiveTrades(supabase));
  } catch (err) {
    console.error("[extract-from-document] failed to load trades", { message: err instanceof Error ? err.message : err });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (20MB max)." }, { status: 400 });
  }

  const kind = detectDocumentKind(file.type, file.name);
  if (!kind) {
    return NextResponse.json({ error: UNSUPPORTED_FILE_TYPE_MESSAGE }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const built = await buildDocumentContent(kind, buffer, "Extract the fields described in the system prompt from this document.");
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const userContent = built.content;

  const anthropic = new Anthropic();
  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: systemPrompt(knownNaics),
      messages: [{ role: "user", content: userContent }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Extraction is busy right now — try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "Extraction failed." }, { status: 502 });
    }
    throw err;
  }

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    return NextResponse.json({ error: "Couldn't extract anything from that document." }, { status: 502 });
  }

  // See lib/llm-json.ts -- tolerates a literal newline inside a JSON string
  // value (common when a quote is copied verbatim from a wrapped PDF
  // label), which a plain JSON.parse would reject outright.
  const parsed = parseLlmJson<unknown>(textBlock.text);
  if (parsed === null) {
    return NextResponse.json({ error: "Couldn't parse the extraction result." }, { status: 502 });
  }

  return NextResponse.json(coerceFields(parsed, knownNaics));
}
