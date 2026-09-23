import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { loadActiveTrades } from "@/lib/trades/server";
import { offeredNaicsCodes } from "@/lib/trades/classify";
import { detectDocumentKind, buildDocumentContent, UNSUPPORTED_FILE_TYPE_MESSAGE } from "@/lib/document-parsing";
import { parseLlmJson } from "@/lib/llm-json";

export const runtime = "nodejs";
// See extract-from-document/route.ts's identical comment -- Vercel's
// default 10s serverless timeout was silently clipping real-world uploads.
export const maxDuration = 60;

// Called from the Company Profile page and (optionally) the intake wizard's
// "About you" step — a client uploads a company-profile-type document
// (capability statement, business license packet, insurance certificates,
// certification letters, etc.) instead of hand-typing every Company Profile
// field. Separate route from extract-from-document/route.ts: that one reads
// an agency's RFP for bid-specific fields; this one reads the CLIENT's own
// paperwork for company facts. Different documents, different schemas,
// different consumers — kept as two routes rather than one branching on a
// "document type" flag.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Matches CertificationsSection.tsx's actual list, not just the six federal
// SBA program types — JSEB and DBE/SDB are real first-class values already
// in use there (added for the JSEB/DBE-SDB funding-source hardening work),
// so extracted rows need to line up with what a client can already pick by
// hand rather than introducing a second, parallel vocabulary.
const CERT_TYPES = ["8(a)", "WOSB", "EDWOSB", "HUBZone", "SDVOSB", "VOSB", "JSEB", "DBE/SDB", "Other"] as const;

// The license_number/business_registration_number distinction is the one
// real fabrication risk here: a document that only states a Sunbiz Document
// Number could tempt a model into filling license_number with it just
// because "some number" was found. The prompt is deliberately explicit
// about the two being different things, not just differently named.
// Built per request: the NAICS codes listed are the offered trades' codes
// (public.trades), which an admin can change at any time.
function systemPrompt(knownNaics: string[]): string {
  return `You extract structured company-profile information from documents a small-business government contractor provides about their OWN company (capability statements, business license packets, insurance certificates, certification letters, corporate filings) — not from an agency's solicitation.

Read the provided document and respond with ONLY a single JSON object with exactly these keys:
- "companyName": the company's legal/business name, or null if not found
- "contactName": the name of a person associated with the business (owner, principal, authorized representative), or null if not found
- "businessPhone": the business phone number, or null if not found
- "businessAddress": the full business address, or null if not found
- "yearsInBusiness": a number, or null if not stated or not calculable from a founding date
- "naicsCodes": an array of JSON strings (e.g. "561720", not the bare number) for each NAICS code explicitly stated that exactly matches one of these codes: ${knownNaics.join(", ") || "(none)"}. Empty array if none match.
- "naicsOther": if the document states a NAICS code NOT in that list, that one code as a string, otherwise null.
- "licenseNumber": the company's TRADE or OCCUPATIONAL license number (e.g. a contractor's license, a specialty trade license) — this is DIFFERENT from a state business-registration/incorporation number. Only fill this if the document explicitly labels a number as a trade/occupational/contractor license. Null if not found — do NOT put a Sunbiz Document Number, corporate filing number, or any other kind of registration number here.
- "businessRegistrationNumber": the company's STATE business-registration or corporate-filing number (e.g. a Florida Sunbiz Document Number, a Secretary of State filing number) — this is DIFFERENT from a trade license. Null if not found — do NOT put a trade/occupational license number here.
- "insuranceProvider": the insurance carrier/underwriter name, or null if not found.
- "insurancePolicyNumber": an insurance policy number, or null if not found.
- "generalLiabilityCoverage": the General Liability coverage amount as written in the document (e.g. "$1,000,000 per occurrence / $2,000,000 aggregate"), or null if not found.
- "workersCompCoverage": the Workers' Compensation coverage description as written, or null if not found.
- "commercialAutoCoverage": the Commercial Auto coverage description as written, or null if not found.
- "certifications": an array of objects, one per state trade license, small-business/socioeconomic certification, or field certification (e.g. OSHA 30, EPA Section 608) actually stated in the document, each with:
  - "recordType": exactly one of "trade_license" (a state-issued trade/occupational license like a Master Electrician or Low Voltage Contractor license), "small_business_cert" (a small-business or socioeconomic program certification), or "field_certification" (a safety/technical card like OSHA 30 or EPA Section 608).
  - "certType": if recordType is "small_business_cert", exactly one of ${CERT_TYPES.join(", ")} (use "JSEB" for a local/regional Jacksonville-area small or emerging business certification; use "DBE/SDB" when the document states a Disadvantaged Business Enterprise and/or Small Disadvantaged Business certification, either term or both; use "Other" for anything else, e.g. a state MBE/WBE). If recordType is "trade_license" or "field_certification", certType is instead the license/certification's actual name exactly as stated (e.g. "Master Electrician License", "Low Voltage Contractor License", "OSHA 30", "EPA Section 608 Universal") — do NOT force it into the small-business list.
  - "otherLabel": required when recordType is "small_business_cert" and certType is "Other" — the certification's actual name/abbreviation (e.g. "MBE", "CIMS-GB"), otherwise null
  - "certificationNumber": the license or certification number if stated, otherwise null
  - "jurisdictionState": only for recordType "trade_license" — the two-letter state that issued the license if stated, otherwise null
  - "licensingBoard": only for recordType "trade_license" — the issuing board/authority name if stated (e.g. "State DBPR Div. 4"), otherwise null
  - "expirationDate": the expiration date in YYYY-MM-DD format if stated, otherwise null
  Empty array if none are mentioned. Include EVERY license/certification actually stated — a document commonly lists more than one.

Only fill a field if the document actually states it — never guess or infer from context. Respond with nothing but that JSON object — no markdown code fences, no commentary.`;
}

const RECORD_TYPES = ["trade_license", "small_business_cert", "field_certification"] as const;

type ExtractedCertification = {
  recordType: (typeof RECORD_TYPES)[number];
  // Constrained to CERT_TYPES only when recordType is "small_business_cert"
  // (enforced in coerceFields below); a free-text name for the other two
  // record types, since a trade license's "type" is whatever it's actually
  // called, not a fixed federal/local program list.
  certType: string;
  otherLabel: string | null;
  certificationNumber: string | null;
  jurisdictionState: string | null;
  licensingBoard: string | null;
  expirationDate: string | null;
};

type ExtractedProfile = {
  companyName: string | null;
  contactName: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  yearsInBusiness: number | null;
  naicsCodes: string[];
  naicsOther: string | null;
  licenseNumber: string | null;
  businessRegistrationNumber: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  generalLiabilityCoverage: string | null;
  workersCompCoverage: string | null;
  commercialAutoCoverage: string | null;
  certifications: ExtractedCertification[];
};

function coerceFields(parsed: unknown, knownNaics: string[]): ExtractedProfile {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const asString = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null;
  const asNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const asKnownArray = (v: unknown, known: readonly string[]) =>
    Array.isArray(v)
      ? v
          .map((x) => (typeof x === "string" ? x : typeof x === "number" ? String(x) : null))
          .filter((x): x is string => x !== null && known.includes(x))
      : [];

  const certifications: ExtractedCertification[] = Array.isArray(obj.certifications)
    ? obj.certifications
        .map((c): ExtractedCertification | null => {
          if (typeof c !== "object" || c === null) return null;
          const cc = c as Record<string, unknown>;
          const recordType =
            typeof cc.recordType === "string" && (RECORD_TYPES as readonly string[]).includes(cc.recordType)
              ? (cc.recordType as ExtractedCertification["recordType"])
              : "small_business_cert"; // matches the DB column's own default

          // Only small_business_cert is constrained to the fixed program
          // list -- a trade_license/field_certification with a certType the
          // model didn't format as expected still has a real, useful name,
          // so it's kept as free text rather than dropping the whole entry.
          const rawCertType = asString(cc.certType);
          if (recordType === "small_business_cert") {
            if (!rawCertType || !(CERT_TYPES as readonly string[]).includes(rawCertType)) return null;
          } else if (!rawCertType) {
            return null;
          }

          return {
            recordType,
            certType: rawCertType as string,
            otherLabel: recordType === "small_business_cert" ? asString(cc.otherLabel) : null,
            certificationNumber: asString(cc.certificationNumber),
            jurisdictionState: recordType === "trade_license" ? asString(cc.jurisdictionState) : null,
            licensingBoard: recordType === "trade_license" ? asString(cc.licensingBoard) : null,
            expirationDate: asString(cc.expirationDate),
          };
        })
        .filter((c): c is ExtractedCertification => c !== null)
    : [];

  return {
    companyName: asString(obj.companyName),
    contactName: asString(obj.contactName),
    businessPhone: asString(obj.businessPhone),
    businessAddress: asString(obj.businessAddress),
    yearsInBusiness: asNumber(obj.yearsInBusiness),
    naicsCodes: asKnownArray(obj.naicsCodes, knownNaics),
    naicsOther: asString(obj.naicsOther),
    licenseNumber: asString(obj.licenseNumber),
    businessRegistrationNumber: asString(obj.businessRegistrationNumber),
    insuranceProvider: asString(obj.insuranceProvider),
    insurancePolicyNumber: asString(obj.insurancePolicyNumber),
    generalLiabilityCoverage: asString(obj.generalLiabilityCoverage),
    workersCompCoverage: asString(obj.workersCompCoverage),
    commercialAutoCoverage: asString(obj.commercialAutoCoverage),
    certifications,
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
    console.error("[extract-company-profile] failed to load trades", { message: err instanceof Error ? err.message : err });
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

  const anthropic = new Anthropic();
  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1536,
      output_config: { effort: "low" },
      system: systemPrompt(knownNaics),
      messages: [{ role: "user", content: built.content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Extraction is busy right now — try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[extract-company-profile] APIError", err.status, err.message);
      return NextResponse.json({ error: "Extraction failed." }, { status: 502 });
    }
    throw err;
  }

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    return NextResponse.json({ error: "Couldn't extract anything from that document." }, { status: 502 });
  }

  // See lib/llm-json.ts -- tolerates a literal newline inside a JSON string
  // value, which a plain JSON.parse would reject outright.
  const parsed = parseLlmJson<unknown>(textBlock.text);
  if (parsed === null) {
    return NextResponse.json({ error: "Couldn't parse the extraction result." }, { status: 502 });
  }

  return NextResponse.json(coerceFields(parsed, knownNaics));
}
