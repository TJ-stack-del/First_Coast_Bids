import { NextResponse } from "next/server";
import { loadClinContext, rateSheetFor } from "@/lib/clins/server";
import { createClient } from "@/lib/supabase/server";
import { isFederalAgency } from "@/lib/federal-agency";
import { detectAgencyTypes } from "@/lib/agency-type";
import { referenceRequirementRows } from "@/lib/compliance/requirements-reference";
import { isKnownTrade } from "@/lib/compliance/known-trades";
import { getOrExtractRfpRequirements, type RfpRequirement } from "@/lib/rfp-requirements";

export const runtime = "nodejs";
// Same reasoning as extract-from-document/route.ts: the compliance-matrix
// path below can now trigger a real Claude document-extraction call against
// the submission's uploaded RFP file(s), which routinely takes past
// Vercel's default 10s serverless timeout.
export const maxDuration = 60;

// Admin-only "auto-draft" helper for DeliverablesPanel — removes the
// blank-page problem by returning a structured starting draft built from
// the submission's own intake data (agency, scope, client NAICS/status
// info) and, for the compliance matrix, real requirements extracted from
// the submission's own uploaded RFP file(s) (see lib/rfp-requirements.ts) --
// not a fully-written deliverable. Everything else here is still a
// template fill-in, not a model call.

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability statement",
  compliance_matrix: "Compliance matrix",
  technical_narrative: "Technical narrative",
  rate_sheet: "Rate sheet",
  executive_cover: "Executive cover",
  certificate_of_insurance: "Certificate of insurance",
};

type ClientInfo = {
  company_name: string | null;
  naics_codes: string[] | null;
  set_asides: string[] | null;
  license_number: string | null;
  business_registration_number: string | null;
  years_in_business: number | null;
  business_address: string | null;
  business_phone: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  general_liability_coverage: string | null;
  workers_comp_coverage: string | null;
  differentiators: string | null;
};

type SubmissionInfo = {
  id: string;
  agency: string;
  solicitation_number: string | null;
  scope: string | null;
  clients: ClientInfo | null;
  rfp_requirements: RfpRequirement[] | null;
  rfp_requirements_extracted_at: string | null;
};

function certificationLabel(cert: { cert_type: string; other_label: string | null }): string {
  return cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type;
}

// Capitalizes each word's first letter without touching the rest, so an
// existing acronym (HEPA, OSHA, VCT) survives instead of getting mangled.
function titleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => (word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

// The client's scope field is free text, not a parsed RFP — this only
// reorganizes what's already there into checklist-sized labels, it never
// adds a requirement the scope didn't mention. Paragraphs (the client's own
// line breaks) are the first choice since intake naturally separates one
// service line per paragraph (see the RFP-0182-26 example: "Day porter
// operations: ...", "Nightly custodial: ...", one per line); a single dense
// paragraph falls back to sentence splitting so it doesn't collapse into
// one catch-all row.
function scopeSegments(scopeText: string): string[] {
  const paragraphs = scopeText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  return scopeText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A label is the segment's own lead-in ("Day porter operations:") when it
// has one, since that's already the client's chosen name for that line
// item; otherwise the segment's first few words stand in for it. Either
// way the label is text lifted from the scope, never invented.
const MAX_REQUIREMENT_ROWS = 6;
const MAX_LABEL_WORDS = 6;

// Local Jacksonville-area bodies whose default set-aside program is JSEB —
// overridden below for the ones (JAA, JTA) whose projects commonly carry
// federal funding despite being locally administered.
const LOCAL_JACKSONVILLE_AGENCY_PATTERN = /\b(city of jacksonville|jea|jaa|jta)\b/i;

// One extra compliance-matrix row per agency-type signal, appended after
// the scope-derived requirement rows. Same "NEEDS VERIFICATION" rule as
// everything else in this matrix: these note a category of requirement
// that agency type typically carries, never a specific number, badge ID,
// or percentage — that still has to come from the real RFP.
function agencyTypeRequirementRows(agency: string): string[] {
  const rows: string[] = [];
  const agencyTypes = detectAgencyTypes(agency);
  const isAirport = agencyTypes.includes("airport");
  const isSchool = agencyTypes.includes("school");
  const isTransit = agencyTypes.includes("transit");
  const isVA = agencyTypes.includes("va");
  const isLocalJacksonville = LOCAL_JACKSONVILLE_AGENCY_PATTERN.test(agency);

  if (isAirport) {
    rows.push(
      "SIDA badging / airport security clearance | NEEDS VERIFICATION | [Confirm SIDA badging and airport security clearance requirements with the agency before submission]"
    );
  }
  if (isSchool) {
    rows.push(
      "Level 2 background checks / school district badge requirements | NEEDS VERIFICATION | [Confirm Level 2 background check and district badging requirements before submission]"
    );
  }
  if (isTransit) {
    rows.push(
      "DBE (Disadvantaged Business Enterprise) participation goals | NEEDS VERIFICATION | [Confirm DBE participation goals with the agency before submission]"
    );
  }
  // Named by agency (VA facility name), separate from the scope-text-keyword
  // tiers in requirements-reference.ts — this is a categorical nudge for
  // when the agency itself is clearly VA but the client's own scope text is
  // too thin to have triggered any of the three specific tiers there. Never
  // asserts which (if any) tier actually applies — that still needs the
  // real RFP.
  if (isVA) {
    rows.push(
      "VA/federal IT security, accessibility, and CUI requirements | NEEDS VERIFICATION | [This is a VA engagement — confirm with the contracting officer whether VA Handbook 6500.6 (contractor system/data access), a Section 508 accessibility checklist, or CUI/NIST 800-171/CMMC handling requirements apply to this specific scope]"
    );
  }

  // Transit projects commonly carry federal (FTA) funding and aviation
  // projects commonly carry federal (FAA/AIP) funding even when the
  // authority is locally administered — that funding source is what
  // determines whether DBE/SDB or the local JSEB program applies, so it
  // takes priority over the local-Jacksonville default below. The transit
  // row above already names DBE by requirement type, so it isn't repeated
  // here as a separate set-aside row.
  if (isAirport) {
    rows.push(
      "Set-aside participation (DBE/SDB) | NEEDS VERIFICATION | [Confirm whether this project carries federal (FAA/AIP) funding and, if so, DBE/SDB set-aside participation requirements — federal funding is common on airport projects even when the authority is locally administered]"
    );
  } else if (!isTransit && isLocalJacksonville) {
    rows.push(
      "Local set-aside program (JSEB) | NEEDS VERIFICATION | [Confirm JSEB (Jacksonville Small/Emerging Business) eligibility and participation requirements with the agency before submission]"
    );
  }

  return rows;
}

// Core Competencies used to jam the whole scope string into a single
// bracketed placeholder plus a literal leftover "[Add one short bullet...]"
// instruction line -- indistinguishable from a broken generation to an
// admin who has no way to know this deliverable is a template fill-in, not
// a model call. Reuses scopeSegments (already relied on for the compliance
// matrix) so a real client's own scope text becomes one bullet per service
// line instead of one unreadable blob. Never invents a bullet: only reorders
// text the client actually wrote.
function coreCompetencyLines(scopeText: string): string[] {
  if (scopeText === "[scope of work — see the RFP]") {
    return ["- [Core service line — no scope on file for this submission yet]"];
  }
  const segments = scopeSegments(scopeText).slice(0, 6);
  return segments.length > 0 ? segments.map((s) => `- ${s}`) : [`- ${scopeText}`];
}

function deriveRequirementLabels(scopeText: string): string[] {
  const labels: string[] = [];
  for (const segment of scopeSegments(scopeText)) {
    const colonIdx = segment.indexOf(":");
    const hasColonLeadIn = colonIdx > 0 && colonIdx <= 60;
    const lead = hasColonLeadIn ? segment.slice(0, colonIdx) : segment;
    const words = lead.split(" ").filter(Boolean);
    // A colon lead-in ("Day porter operations: ...") is the client's own
    // chosen name for that line item, so it's always safe to use. Without
    // one, only use the segment as a label when it's already short enough
    // to stand alone -- truncating a long run-on sentence to its first few
    // words produces a mid-sentence fragment ("The City Of Jacksonville
    // Seeks A") that reads as a fabricated, meaningless "requirement," not
    // a real one reorganized from the scope. Skip it instead and let the
    // existing zero-labels fallback below take over.
    if (!hasColonLeadIn && words.length > MAX_LABEL_WORDS) continue;
    const label = words
      .slice(0, MAX_LABEL_WORDS)
      .join(" ")
      .replace(/[.,;:]+$/, "")
      .trim();
    if (label) labels.push(titleCase(label));
    if (labels.length >= MAX_REQUIREMENT_ROWS) break;
  }
  return labels;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  const deliverableType = body?.deliverableType;

  if (typeof submissionId !== "string" || typeof deliverableType !== "string" || !(deliverableType in DELIVERABLE_LABELS)) {
    return NextResponse.json({ error: "Invalid submissionId or deliverableType." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Admin-only: a client authenticated to their own submission would still
  // pass the RLS-scoped select below (their own row), so team_members
  // membership is checked explicitly rather than relying on RLS alone.
  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, agency, solicitation_number, scope, client_id, rfp_requirements, rfp_requirements_extracted_at, clients!submissions_client_id_fkey(company_name, naics_codes, set_asides, license_number, business_registration_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, differentiators)"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  // Only a certification an admin has actually looked at and marked
  // Verified counts as fact in anything this route generates — an
  // unverified upload is a claim, not something to put in front of an
  // agency. Same rule the final PDF (lib/pdf/deliverables-packet.ts)
  // follows for consistency between the draft and the delivered document.
  const { data: verifiedCerts } = await supabase
    .from("client_certifications")
    .select("cert_type, other_label")
    .eq("client_id", submission.client_id)
    .eq("verified", true);

  // Self-reported, used as-is — see client_past_performance's own migration
  // comment for why this doesn't need the same admin-verification gate a
  // certification file does. Capped at 3: a capability statement lists a
  // few representative projects, not a full history.
  const { data: pastPerformance } = await supabase
    .from("client_past_performance")
    .select("reference_client_name, scope_of_work, contract_value, outcome")
    .eq("client_id", submission.client_id)
    .order("created_at", { ascending: false })
    .limit(3);

  const submissionInfo = submission as unknown as SubmissionInfo;

  // A federal bid with a CLIN price table: the Rate sheet is that table,
  // priced (docs/superpowers/specs/2026-09-25-clin-pricing-design.md) --
  // never the empty template, which would overwrite the priced table.
  if (deliverableType === "rate_sheet") {
    const clins = await loadClinContext(supabase, submissionId);
    if (clins && clins.lines.length > 0) return NextResponse.json({ content: rateSheetFor(clins) });
  }

  // Only the compliance matrix uses this today -- skip the extraction
  // entirely (and its real latency/cost) for every other deliverable type.
  const rfpRequirements =
    deliverableType === "compliance_matrix" ? await getOrExtractRfpRequirements(supabase, submissionInfo) : [];

  const content = buildDraft(
    deliverableType,
    submissionInfo,
    (verifiedCerts ?? []).map(certificationLabel),
    pastPerformance ?? [],
    rfpRequirements
  );
  return NextResponse.json({ content });
}

type PastPerformanceEntry = {
  reference_client_name: string;
  scope_of_work: string;
  contract_value: string | null;
  outcome: string | null;
};

function buildDraft(
  deliverableType: string,
  submission: SubmissionInfo,
  verifiedCertLabels: string[],
  pastPerformanceEntries: PastPerformanceEntry[],
  rfpRequirements: RfpRequirement[]
): string {
  const client = submission.clients ?? {
    company_name: null,
    naics_codes: null,
    set_asides: null,
    license_number: null,
    business_registration_number: null,
    years_in_business: null,
    business_address: null,
    business_phone: null,
    insurance_provider: null,
    insurance_policy_number: null,
    general_liability_coverage: null,
    workers_comp_coverage: null,
    differentiators: null,
  };
  const company = client.company_name ?? "the contractor";
  const agency = submission.agency;
  const solicitationLine = submission.solicitation_number ? ` — Solicitation ${submission.solicitation_number}` : "";
  const scope = submission.scope ?? "[scope of work — see the RFP]";
  const naics = client.naics_codes && client.naics_codes.length > 0 ? client.naics_codes.join(", ") : "[NAICS codes]";
  const statuses =
    verifiedCertLabels.length > 0 ? verifiedCertLabels.join(", ") : "[no reviewed certifications on file yet]";
  const setAsides = client.set_asides && client.set_asides.length > 0 ? client.set_asides.join(", ") : null;

  if (deliverableType === "capability_statement") {
    const licenseNumber = client.license_number ?? "[license #]";
    const registrationNumber = client.business_registration_number ?? "[registration #]";
    const entityLine = isFederalAgency(agency)
      ? `Entity Identifiers: UEI: [UEI] | CAGE Code: [CAGE code] | State registration: ${registrationNumber}`
      : `Entity Identifiers: State registration: ${registrationNumber} | Local business license: ${licenseNumber}`;

    const yearsInBusiness =
      client.years_in_business !== null && client.years_in_business !== undefined
        ? `${client.years_in_business} years`
        : "[years in business]";
    const companyInfoLine = `Years in Business: ${yearsInBusiness} | Business Address: ${
      client.business_address ?? "[business address]"
    } | Business Phone: ${client.business_phone ?? "[business phone]"}`;

    const insuranceLine = `Insurance: ${client.insurance_provider ?? "[insurance provider]"}${
      client.insurance_policy_number ? ` (Policy #${client.insurance_policy_number})` : ""
    } | General Liability: ${client.general_liability_coverage ?? "[GL coverage amount]"} | Workers' Comp: ${
      client.workers_comp_coverage ?? "[workers' comp coverage]"
    }`;

    // Real client-provided differentiators are an actual fact to use as-is,
    // not something to fabricate — only falls back to a placeholder when
    // the client hasn't filled in that Company Profile field yet.
    const differentiators =
      client.differentiators?.trim() ||
      `[What sets ${company} apart for this agency and scope — certifications, track record, capacity.]`;

    // Real capability statement convention — one line per project, not a
    // paragraph: client, scope, dollar value, outcome. Real entries from
    // Company Profile (client_past_performance) are used as-is, never
    // invented; only falls back to placeholder rows when the client
    // hasn't added any past projects yet.
    const pastPerformanceLines =
      pastPerformanceEntries.length > 0
        ? pastPerformanceEntries.map(
            (p) =>
              `- ${p.reference_client_name} — ${p.scope_of_work}${
                p.contract_value ? ` — ${p.contract_value}` : ""
              }${p.outcome ? ` — ${p.outcome}` : ""}`
          )
        : [
            "- [Client name] — [scope of work] — $[contract value] — [outcome/result]",
            "- [Client name] — [scope of work] — $[contract value] — [outcome/result]",
          ];

    return [
      `CAPABILITY STATEMENT: ${company.toUpperCase()}`,
      "",
      `Prepared for: ${agency}${solicitationLine}`,
      "",
      "[DRAFT — replace every bracketed placeholder before sending]",
      "",
      entityLine,
      "",
      companyInfoLine,
      "",
      insuranceLine,
      "",
      `Socioeconomic Certifications: ${statuses}${setAsides ? ` | Set-asides: ${setAsides}` : ""}`,
      "",
      `Primary NAICS Codes: ${naics}`,
      "",
      "Core Competencies:",
      ...coreCompetencyLines(scope),
      "",
      "Past Performance:",
      ...pastPerformanceLines,
      "",
      "Differentiators:",
      differentiators,
    ].join("\n");
  }

  if (deliverableType === "compliance_matrix") {
    // This is a checklist of what to verify, not a completed matrix — never
    // generate a status that implies a requirement is already met (no
    // "Compliant" / "Fully Compliant" / anything like it), and never invent
    // a plausible-looking number, certification, registration ID, or
    // coverage amount. Requirement rows come from two real sources, never
    // invented: rfpRequirements (lib/rfp-requirements.ts, extracted straight
    // from the submission's own uploaded RFP file when one exists) and the
    // client's own scope text (deriveRequirementLabels only reorders words
    // already there). Status and verification stay an explicit,
    // unmistakable gap either way — even an RFP-sourced row can misread the
    // document, so nothing here is asserted as already confirmed.
    // Strict pipe-delimited rows, one requirement per line, nothing else on
    // the line (no numbering, no bullets) — this is what lets the packet PDF
    // (lib/pdf/deliverables-packet.ts) parse it into a real autoTable grid
    // instead of flowing text. Never put a column header or any other
    // pipe-containing line in with the rows below: the PDF's row filter
    // only excludes lines starting with "[", so a stray "|" anywhere else
    // gets rendered as a bogus table row.
    //
    // RFP-sourced rows (real requirements extracted from the submission's
    // own uploaded RFP file, see lib/rfp-requirements.ts) go first -- they're
    // the most concrete and specific rows this matrix can produce, since
    // they're grounded in the agency's actual document rather than reordered
    // client scope text. Status still stays NEEDS VERIFICATION, same rule as
    // every other row: extraction can misread a document, so nothing here is
    // asserted as already confirmed.
    const requirementRows = rfpRequirements.map((r) => {
      // Page number was already being extracted (lib/rfp-requirements.ts)
      // but never made it into the row text itself -- it only showed up in
      // the separate, collapsed "RFP source references" panel below the
      // matrix, easy to miss. Citing it inline is what actually answers
      // "where do I find this in the document."
      const pageLabel = r.page != null ? `p.${r.page}` : "page not determined";
      return `${r.requirement} | NEEDS VERIFICATION | [From the uploaded RFP (${pageLabel}): ${r.detail} — confirm this is still accurate before submission]`;
    });
    const requirementLabels = submission.scope ? deriveRequirementLabels(submission.scope) : [];
    if (requirementLabels.length > 0) {
      requirementRows.push(
        ...requirementLabels.map(
          (label) =>
            `${label} | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]`
        )
      );
    } else if (requirementRows.length === 0) {
      requirementRows.push(
        "[Requirement from RFP — not yet identified] | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]",
        "[Requirement from RFP — not yet identified] | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]",
        "[Requirement from RFP — not yet identified] | NOT YET PROVIDED | [Not yet provided — confirm with the client before writing anything here]"
      );
    }
    requirementRows.push(...agencyTypeRequirementRows(agency));
    // Reference-library rows (lib/compliance/requirements-reference.ts): the
    // ALWAYS_MANDATORY tier always appears; CONDITIONAL_REQUIREMENTS and
    // TRADE_SPECIFIC_CERTIFICATIONS only appear when their trigger keyword is
    // actually present in the client's own scope text — never defaulted to
    // required. Appended after the scope-derived and agency-type rows above,
    // which stay untouched.
    requirementRows.push(...referenceRequirementRows(submission.scope ?? ""));

    // Safety net for trades this app has no real TRADE_SPECIFIC_CERTIFICATIONS
    // coverage for yet (lib/compliance/known-trades.ts) — plain-language,
    // 8th-grade-level note so the client themselves (this deliverable is
    // client-readable, not admin-only) sees the gap instead of the matrix
    // silently looking complete. Placed right after the admin disclaimer,
    // before the requirement rows, so it isn't buried under the table.
    const tradeKnown = isKnownTrade({ naicsCodes: client.naics_codes ?? [], scopeText: submission.scope ?? "" });
    const tradeCoverageNote = tradeKnown
      ? []
      : [
          "This checklist covers the rules every government bid needs. We've also built",
          "in extra rules for HVAC, janitorial, landscaping, and IT/computer support bids.",
          "Your trade isn't on that list yet. Some rules just for your industry might be",
          "missing here. Please check the real bid documents yourself, or ask us, before",
          "you count on this checklist alone.",
          "",
        ];

    return [
      `COMPLIANCE MATRIX — ${agency}${solicitationLine}`,
      "",
      "[DRAFT — this is a checklist of requirements to VERIFY, not a completed matrix.",
      "Nothing below has been confirmed. Every status is NEEDS VERIFICATION or NOT YET",
      "PROVIDED until you check the actual RFP and the client's real documentation —",
      "never change a status to \"Compliant\" without confirming it first, and never",
      "fill in a number, certification, registration ID, or coverage amount unless it's",
      "a real, verified value. Leave a field blank rather than guess.",
      "",
      "Each row below is strict pipe-delimited: Requirement, then Status, then",
      "Methodology & Verification, separated by pipes, one requirement per line —",
      "nothing else on the line. Don't add numbering, bullets, or a header row.]",
      "",
      ...tradeCoverageNote,
      ...requirementRows,
      "",
      `Scope reference: ${scope}`,
    ].join("\n");
  }

  if (deliverableType === "rate_sheet") {
    // No pricing/rate data exists anywhere in the schema — this is
    // deliberately placeholder-only, never a guessed number, same
    // fabrication rule as every other deliverable here.
    return [
      `RATE SHEET — ${agency}${solicitationLine}`,
      "",
      "[DRAFT — no pricing data is on file for this bid. Every rate, quantity, and",
      "extended price below must come from the contractor's real cost basis —",
      "never invent a number. Add one row per distinct service/line item.]",
      "",
      "Item | Unit | Rate | Estimated Quantity | Extended Price",
      "[Service line item — e.g. \"Janitorial labor, hourly\"] | [unit, e.g. \"hr\"] | [$ rate] | [qty] | [calculate]",
      "",
      `Scope reference: ${scope}`,
      "",
      "Total estimated price: [sum of extended prices above]",
    ].join("\n");
  }

  if (deliverableType === "executive_cover") {
    const yearsLine =
      client.years_in_business !== null && client.years_in_business !== undefined
        ? ` ${company} has been in business for ${client.years_in_business} years.`
        : "";
    const differentiatorLine = client.differentiators ? ` ${client.differentiators}` : "";

    return [
      `EXECUTIVE COVER LETTER — ${agency}${solicitationLine}`,
      "",
      "[DRAFT — replace bracketed placeholders; keep this to one page.]",
      "",
      "[Date]",
      "",
      agency,
      `Re: ${agency}${solicitationLine}`,
      "",
      "Dear Procurement Officer,",
      "",
      `${company} is pleased to submit this proposal for ${scope}.${yearsLine}${differentiatorLine}`,
      "",
      `[One short paragraph: why ${company} is well-suited for this specific scope]`,
      "",
      "We appreciate your consideration and are available to answer any questions through the agency's official channels.",
      "",
      "Sincerely,",
      "[Authorized signer name and title]",
      company,
    ].join("\n");
  }

  if (deliverableType === "certificate_of_insurance") {
    // A summary of what's on file, NOT a substitute for the real COI
    // document (ACORD 25 or equivalent) — the actual file gets attached
    // via "Upload file instead" in DeliverablesPanel, same as any other
    // deliverable type.
    return [
      `CERTIFICATE OF INSURANCE — SUMMARY — ${agency}${solicitationLine}`,
      "",
      `[This is a summary of what ${company} has on file — it is NOT the actual`,
      "Certificate of Insurance (ACORD 25 or equivalent) the agency requires.",
      "Attach the client's real, current COI document using \"Upload file instead\"",
      "below before including this in the bid package.]",
      "",
      `Insurance provider: ${client.insurance_provider ?? "[NEEDS VERIFICATION]"}`,
      `Policy number: ${client.insurance_policy_number ?? "[NEEDS VERIFICATION]"}`,
      `General liability coverage: ${client.general_liability_coverage ?? "[NEEDS VERIFICATION]"}`,
      `Workers' compensation coverage: ${client.workers_comp_coverage ?? "[NEEDS VERIFICATION]"}`,
      "",
      "[Confirm these coverage amounts meet the agency's minimum requirements before submission]",
    ].join("\n");
  }

  // technical_narrative
  return [
    `TECHNICAL APPROACH & OPERATIONAL PLAN — ${agency}${solicitationLine}`,
    "",
    `[DRAFT — replace each bullet below with specifics for: ${scope}. Keep each`,
    "point to one short line — no dense paragraphs.]",
    "",
    "1. Work Execution & Operational Cadence",
    `- [Day-to-day operational approach ${company} proposes for this scope]`,
    "- [Staffing / scheduling approach]",
    "- [Add one bullet per additional operational point]",
    "",
    "2. Quality Assurance & Compliance Controls",
    `- [QA process that verifies compliance with the ${naics} scope requirements]`,
    "- [Inspection / reporting cadence]",
    "",
    "3. Management Oversight",
    "- [Supervision structure]",
    "- [Reporting cadence]",
    "- [Issue-resolution SLA]",
  ].join("\n");
}
