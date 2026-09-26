import Anthropic from "@anthropic-ai/sdk";
import type { Chunk } from "../checklist/chunk.ts";
import type { ClinCandidate } from "./types.ts";

// The AI half of CLIN pricing: lists the priced line items of a
// solicitation's price schedule, each with a verbatim quote. Plain code
// (parse.ts, verify-quote.ts) checks everything afterwards. Chunks are read
// in parallel to stay inside Vercel's 60-second function limit.

const SYSTEM_PROMPT = `You read US federal solicitation documents for a small-business bid-preparation service. List every priced line item (CLIN / ITEM NO.) in the solicitation's price schedule -- the "Schedule of Supplies/Services", "Price Schedule" or CLIN table the offeror must price.

For each line:
- "clin": the item number exactly as printed (e.g. "0001", "10001", "0002AA").
- "description": the line's own description, including words like "Base Year", "Option Year 2", building or site names. Join wrapped lines with spaces. Leave out delivery dates, product/service codes and accounting data.
- "quantity" and "unit": as printed (e.g. 12 and "MO"); null when the line doesn't state them.
- "period_start" and "period_end": the line's own period of performance, copied exactly as printed (e.g. "10/01/2026" and "09/30/2027"), from a "Period of Performance" or "PoP" statement that belongs to this line -- it may be printed just before or just after the line. null when none is stated for it.
- "quote": copied VERBATIM from the document text, under 300 characters, and it MUST include the item number. A program will search for it.
- "page": from the nearest preceding "--- Page N ---" marker; 0 if none.
- "source_file": from the "--- Document: <name> ---" marker; "" if unknown.

Rules:
- Only lines the document actually lists in a price schedule. Never invent a line, number, quantity or unit. Never include prices.
- Do not list sub-line informational items that are not separately priced ("NSP" or "not separately priced") unless they have their own item number.
- If there is no price schedule in this text, return an empty list.`;

const SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clin: { type: "string" },
          description: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          quote: { type: "string" },
          page: { type: "integer" },
          source_file: { type: "string" },
          period_start: { type: ["string", "null"] },
          period_end: { type: ["string", "null"] },
        },
        required: ["clin", "description", "quantity", "unit", "quote", "page", "source_file", "period_start", "period_end"],
        additionalProperties: false,
      },
    },
  },
  required: ["lines"],
  additionalProperties: false,
} as const;

export function coerceClinItems(parsed: unknown): ClinCandidate[] {
  const lines = (parsed as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(lines)) return [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const out: ClinCandidate[] = [];
  for (const raw of lines) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const clin = str(r.clin);
    const quote = str(r.quote);
    if (!clin || !quote) continue;
    out.push({
      clin,
      description: str(r.description) ?? "",
      quantity: typeof r.quantity === "number" && Number.isFinite(r.quantity) && r.quantity >= 0 ? r.quantity : null,
      unit: str(r.unit),
      quote,
      page: typeof r.page === "number" && Number.isInteger(r.page) && r.page > 0 ? r.page : null,
      source_file: str(r.source_file),
      period_start: str(r.period_start),
      period_end: str(r.period_end),
    });
  }
  return out;
}

async function readOne(client: Anthropic, text: string, agency: string): Promise<ClinCandidate[]> {
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "text", text: `Buyer: ${agency}. List the priced line items (CLINs) from the document text above.` },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this part of the document.");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("The AI returned no result.");
  return coerceClinItems(JSON.parse(block.text));
}

// Results grouped by file, in the chunks' (upload) order, for dedupeClins.
export async function runClinPass(i: { chunks: Chunk[]; agency: string }): Promise<{
  byFile: { file: string; items: ClinCandidate[] }[];
  failed: { file: string; message: string }[];
}> {
  const client = new Anthropic();
  const results = await Promise.allSettled(i.chunks.map((c) => readOne(client, c.text, i.agency)));
  const byFileMap = new Map<string, ClinCandidate[]>();
  const failed: { file: string; message: string }[] = [];
  results.forEach((r, k) => {
    const file = i.chunks[k].fileName;
    if (r.status === "fulfilled") {
      byFileMap.set(file, [...(byFileMap.get(file) ?? []), ...r.value.map((v) => ({ ...v, source_file: v.source_file ?? file }))]);
    } else failed.push({ file, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  const order = [...new Set(i.chunks.map((c) => c.fileName))];
  return { byFile: order.filter((f) => byFileMap.has(f)).map((file) => ({ file, items: byFileMap.get(file)! })), failed };
}
