import Anthropic from "@anthropic-ai/sdk";
import { KINDS, defaultOwner, type Candidate, type Kind } from "./types.ts";
import type { Chunk } from "./chunk.ts";

// The AI half of the checklist: lists every item a bidder must submit or do,
// each with a verbatim quote. Quotes are verified afterwards against the
// document text (verify-quote.ts); fixed identifiers are also found by plain
// code (detectors.ts). Chunks are read in parallel to stay inside Vercel's
// 60-second function limit.

const SYSTEM_PROMPT = `You read US government solicitation documents (federal, state, county, city, school district, authority) for a small-business bid-preparation service. List every item the bidder must SUBMIT or DO to have a complete, compliant bid.

Include:
- Required forms and attachments by name, and which parts must be filled in or signed (e.g. "Complete and sign SF 1449, blocks 12, 17a, 23, 24 and 30").
- Every amendment or addendum to acknowledge, and how.
- Bid bond / bid guarantee requirements.
- Required sworn statements, affidavits and certifications (e.g. public entity crimes, drug-free workplace, E-Verify, conflict of interest, FAR representations).
- Licenses, registrations and insurance certificates that must be included with the bid.
- Submission rules: deadline, method (email, portal, sealed envelope), address, number of copies, page limits, file formats, labelling.
- For federal solicitations: the wage determination number and revision, FAR provisions that require a representation or certification from the offeror, SAM registration, and the evaluation method (lowest price technically acceptable, best value, etc.).

Rules:
- Only list items the document actually states. Never invent a requirement, number, form, date or address.
- "quote" must be copied VERBATIM from the document text, character for character, under 300 characters. A program will search for it; a paraphrased quote is treated as invalid.
- "page" is the number from the nearest preceding "--- Page N ---" marker; use 0 if there is none.
- "source_file" is copied from the "--- Document: <name> ---" marker; use "" if unknown.
- "suggested_owner": "client" for things the bidder signs, completes, attaches or certifies; "admin" for rules to check (deadline, method, format, evaluation, wage determination, SAM check).
- "federal": true only for items that exist because the buyer is a federal agency (SF forms, FAR provisions, wage determinations, SAM).
- Do not list background, scope of work, or contract performance terms that need nothing at bid time.`;

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...KINDS] },
          federal: { type: "boolean" },
          label: { type: "string" },
          detail: { type: "string" },
          quote: { type: "string" },
          page: { type: "integer" },
          source_file: { type: "string" },
          suggested_owner: { type: "string", enum: ["client", "admin"] },
        },
        required: ["kind", "federal", "label", "detail", "quote", "page", "source_file", "suggested_owner"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export function coerceAiItems(parsed: unknown): Candidate[] {
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const out: Candidate[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const kind = KINDS.includes(r.kind as Kind) ? (r.kind as Kind) : null;
    const label = str(r.label);
    const quote = str(r.quote);
    if (!kind || !label || !quote) continue;
    const page = typeof r.page === "number" && Number.isInteger(r.page) && r.page > 0 ? r.page : null;
    const owner = r.suggested_owner === "client" || r.suggested_owner === "admin" ? r.suggested_owner : defaultOwner(kind);
    out.push({
      kind,
      federal: r.federal === true,
      label,
      detail: str(r.detail),
      quote,
      page,
      source_file: str(r.source_file),
      found_by: "ai",
      key: null,
      suggested_owner: owner,
    });
  }
  return out;
}

async function readOne(
  client: Anthropic,
  content: Anthropic.Beta.BetaContentBlockParam[],
  agency: string
): Promise<Candidate[]> {
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ITEM_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [...content, { type: "text", text: `Buyer: ${agency}. List the required submission items from the document text above.` }],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this part of the document.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI returned no result.");
  return coerceAiItems(JSON.parse(text.text));
}

export async function runAiPass(input: {
  chunks: Chunk[];
  scannedPdfs: { fileName: string; buffer: Buffer }[];
  agency: string;
}): Promise<{ items: Candidate[]; failed: { file: string; message: string }[] }> {
  const client = new Anthropic();
  const jobs: { file: string; label: string; run: () => Promise<Candidate[]> }[] = [
    ...input.chunks.map((c) => ({
      file: c.fileName,
      label: `pages ${c.startPage}-${c.endPage}`,
      run: () => readOne(client, [{ type: "text", text: c.text }], input.agency),
    })),
    ...input.scannedPdfs.map((f) => ({
      file: f.fileName,
      label: "scanned document",
      run: () =>
        readOne(
          client,
          [
            { type: "text", text: `--- Document: ${f.fileName} ---` },
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.buffer.toString("base64") } },
          ],
          input.agency
        ),
    })),
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const items: Candidate[] = [];
  const failed: { file: string; message: string }[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") items.push(...s.value);
    else failed.push({ file: jobs[i].file, message: `${jobs[i].label}: ${s.reason instanceof Error ? s.reason.message : "failed"}` });
  });
  return { items, failed };
}
