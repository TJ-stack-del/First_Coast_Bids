import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubmissionRfpDocuments } from "@/lib/rfp-documents";
import { parseLlmJson } from "@/lib/llm-json";

// Stage 1 of the bid-estimation pipeline (extraction only, never arithmetic):
// pulls structured, factual sizing data out of a submission's uploaded RFP
// document(s) -- never a dollar total, never a guessed annual value. Stage 3
// (estimateContractValue below) is the only place a number gets computed,
// and it's pure TypeScript over these facts, not an LLM call. This keeps the
// LLM's job narrow (read the document, report what it actually says) and the
// arithmetic deterministic and auditable.
//
// Deliberately its own extraction call rather than folded into
// getOrExtractRfpRequirements's compliance-matrix extraction -- different
// schema, different purpose, and keeping Stage 1 single-responsibility makes
// it easy to swap in a cheaper/faster model later without touching the
// compliance-requirements path. (They do share the same document-fetching
// helper, lib/rfp-documents.ts, so this doesn't re-download/re-encode the
// file a second time within the same request -- see generate-draft/route.ts
// for how both get called together.)
export type BidEstimationFacts = {
  trade_category: string | null;
  cleanable_sqft: number | null;
  facility_count: number | null;
  facility_type: string | null;
  term_years: number | null;
  // Days per week the service is performed, only when the document states a
  // schedule -- pre-fills the wage worksheet's hours.
  service_days_per_week: number | null;
  // The only real dollar figure in this whole module: an actual contract
  // ceiling/value the agency itself stated. Null means "not stated" --
  // never a guess standing in for it.
  stated_ceiling: number | null;
  services_detected: Record<string, boolean>;
};

const KNOWN_SERVICE_KEYS = [
  "night_cleaning",
  "day_porter",
  "vct_maintenance",
  "carpet_extraction",
  "window_washing",
] as const;

const SYSTEM_PROMPT = `You extract structured bid-sizing facts from US government solicitation documents (RFPs, RFQs, sources-sought notices, task orders, etc.) for a small-business bidding platform. This platform never fabricates facts, and it never computes or guesses a dollar total itself -- that happens later in deterministic code, from only the facts you report here. Your only job is faithful extraction.

Read the provided document(s) and respond with ONLY a single JSON object with exactly these keys:
- "trade_category": a short snake_case label for the primary trade (e.g. "commercial_custodial", "hvac", "landscaping", "electrical", "it_support"), or null if it can't be determined.
- "cleanable_sqft": the total cleanable/serviceable square footage stated in the document, as a plain number, or null if not stated. Never estimate this from a facility count or description -- only use it if the document states an actual square-footage figure.
- "facility_count": the number of distinct facilities/sites/buildings covered, as an integer, or null if not stated or not determinable.
- "facility_type": a short label for the facility type (e.g. "public_works", "courthouse", "school", "airport", "medical"), or null.
- "term_years": the total contract term in years, INCLUDING any renewal/option years explicitly offered (e.g. "3-year base plus two 1-year options" is 5), as a number, or null if not stated.
- "service_days_per_week": how many days per week the service is performed, as a number from 1 to 7, ONLY if the document states a schedule (e.g. "Monday through Friday" is 5; "three times per week" is 3); otherwise null.
- "stated_ceiling": the total contract value or ceiling, in dollars, ONLY if the document explicitly states one (a dollar figure, an "not-to-exceed" amount, an estimated total value). Do not calculate, annualize, or infer this from a rate or square footage -- if the document doesn't state an actual total dollar figure, this must be null.
- "services_detected": an object with boolean values for each of these keys, true only if that specific service is explicitly mentioned as in-scope: ${KNOWN_SERVICE_KEYS.join(", ")}. Omit or leave false any key not clearly supported by the document text.

Never invent a plausible-sounding number for any field -- every non-null value must trace back to something the document actually states. When genuinely uncertain, use null (or false for a service) rather than guessing. Respond with nothing but that JSON object -- no markdown code fences, no commentary.`;

function coerceFacts(parsed: unknown): BidEstimationFacts {
  const empty: BidEstimationFacts = {
    trade_category: null,
    cleanable_sqft: null,
    facility_count: null,
    facility_type: null,
    term_years: null,
    service_days_per_week: null,
    stated_ceiling: null,
    services_detected: {},
  };
  if (typeof parsed !== "object" || parsed === null) return empty;
  const record = parsed as Record<string, unknown>;

  const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const asPositiveNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const asPositiveInt = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;

  const servicesRaw =
    typeof record.services_detected === "object" && record.services_detected !== null
      ? (record.services_detected as Record<string, unknown>)
      : {};
  const services_detected: Record<string, boolean> = {};
  for (const key of KNOWN_SERVICE_KEYS) {
    services_detected[key] = servicesRaw[key] === true;
  }

  return {
    trade_category: asString(record.trade_category),
    cleanable_sqft: asPositiveNumber(record.cleanable_sqft),
    facility_count: asPositiveInt(record.facility_count),
    facility_type: asString(record.facility_type),
    term_years: asPositiveNumber(record.term_years),
    service_days_per_week: (() => {
      const n = asPositiveNumber(record.service_days_per_week);
      return n !== null && n <= 7 ? n : null;
    })(),
    stated_ceiling: asPositiveNumber(record.stated_ceiling),
    services_detected,
  };
}

// Same cache-and-invalidate pattern as getOrExtractRfpRequirements: a
// second call for the same, unchanged RFP file(s) returns the cached facts
// instead of re-running a real LLM call. Best-effort throughout -- any
// failure just means no facts (and therefore no computed estimate), never a
// broken request.
export async function getOrExtractBidEstimationFacts(
  supabase: SupabaseClient,
  submission: {
    id: string;
    bid_estimation_facts: BidEstimationFacts | null;
    bid_estimation_facts_extracted_at: string | null;
  }
): Promise<BidEstimationFacts | null> {
  const { blocks: content, newestDocAt } = await getSubmissionRfpDocuments(supabase, submission.id);
  if (newestDocAt === null) return null;

  if (
    submission.bid_estimation_facts &&
    submission.bid_estimation_facts_extracted_at &&
    submission.bid_estimation_facts_extracted_at > newestDocAt
  ) {
    return submission.bid_estimation_facts;
  }

  if (content.length === 0) return null;
  content.push({
    type: "text",
    text: "Extract the bid-sizing facts described in the system prompt from the document(s) above.",
  });

  const anthropic = new Anthropic();
  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });
  } catch {
    return null;
  }

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) return null;

  // See lib/llm-json.ts -- a plain JSON.parse throws on a literal newline
  // inside a string value, which a verbatim multi-line quote from the
  // source PDF can easily produce; that used to silently discard the whole
  // extraction.
  const parsed = parseLlmJson<unknown>(textBlock.text);
  if (parsed === null) return null;

  const facts = coerceFacts(parsed);

  // Best-effort cache write -- a failure here shouldn't fail the request
  // that's already got a perfectly good result to return.
  await supabase
    .from("submissions")
    .update({ bid_estimation_facts: facts, bid_estimation_facts_extracted_at: new Date().toISOString() })
    .eq("id", submission.id);

  return facts;
}

// Stage 3 -- the deterministic math engine. Pure function, no I/O, no LLM.
// Today this only ever surfaces a real, agency-stated ceiling: there is no
// benchmark rate table yet (no verified $/sqft/year multipliers per trade
// exist in this codebase), so a sqft-derived estimate would just be a
// plausible-sounding invented number -- exactly what this whole pipeline
// exists to avoid. Once real benchmark data is supplied (see
// BidEstimationBenchmarks below), extend this function to fall back to a
// sqft x rate x term calculation when stated_ceiling is null, instead of
// adding an LLM call to guess it.
export function estimateContractValue(facts: BidEstimationFacts | null): number | null {
  if (!facts) return null;
  return facts.stated_ceiling ?? null;
}

// Placeholder for the future benchmark lookup (Stage 2). Intentionally
// unpopulated and unused until real rate data is supplied -- see
// estimateContractValue's comment. Keeping the shape here (rather than
// inventing it later ad hoc) so the eventual real table has an obvious home.
export type BidEstimationBenchmarks = Record<
  string, // trade_category
  { ratePerSqftPerYear: number; facilityTypeMultipliers?: Record<string, number> }
>;
