// Reference data for the compliance-matrix generator (app/api/generate-draft/route.ts,
// compliance_matrix branch). Three tiers:
//
//   ALWAYS_MANDATORY        — appears on every compliance matrix regardless of scope text.
//                              Standard paperwork almost every FL local/state/federal bid
//                              requires from a small trade contractor.
//   CONDITIONAL_REQUIREMENTS — only appears when its trigger phrase is actually present in
//                              the bid's own scope text. Never defaulted to required.
//   TRADE_SPECIFIC_CERTIFICATIONS — same trigger-gated rule as conditional, scoped to
//                              trade/facility-type keywords (landscaping/pesticide, HVAC
//                              refrigerant handling, detention/medical facility).
//
// None of this asserts a requirement is confirmed or that the client meets it — every row
// this produces stays "NEEDS VERIFICATION" with a bracketed instruction to confirm against
// the real RFP, same fabrication safeguard as the rest of buildDraft().

import { assessWageRisk } from "./wage-risk";
import { detectMandatorySiteVisit } from "./mandatory-site-visit";

export type RequirementCategory = "mandatory" | "conditional" | "trade_specific";

type RequirementDefinition = {
  id: string;
  label: string;
  verificationNote: string;
};

type TriggeredRequirementDefinition = RequirementDefinition & {
  triggerKeywords: string[];
};

export const ALWAYS_MANDATORY: RequirementDefinition[] = [
  {
    id: "general-liability-insurance",
    label: "General Liability Insurance Certificate",
    verificationNote: "[Confirm a current certificate of insurance meets the agency's minimum coverage amount before submission]",
  },
  {
    id: "workers-comp-insurance",
    label: "Workers' Compensation Insurance Certificate (or exemption)",
    verificationNote: "[Confirm current workers' comp coverage or a valid FL exemption is on file before submission]",
  },
  {
    id: "w9",
    label: "W-9 / Taxpayer ID Certification",
    verificationNote: "[Confirm a current signed W-9 is on file before submission]",
  },
  {
    id: "local-business-tax-receipt",
    label: "Local Business Tax Receipt / Occupational License",
    verificationNote: "[Confirm the business tax receipt is current and covers the jurisdiction where work will be performed]",
  },
  // Distinct from the item above: this is the state-level corporate filing
  // (Sunbiz Document Number in Florida), not the trade/occupational license —
  // a bid can require proof of both, and a client can genuinely have one
  // without the other.
  {
    id: "business-registration",
    label: "Business Registration (Sunbiz / State Filing)",
    verificationNote: "[Confirm the business's state registration (e.g. Florida Sunbiz Document Number) is active and current before submission]",
  },
  {
    id: "signed-bid-form",
    label: "Signed Bid/Proposal Form",
    verificationNote: "[Confirm the agency's own bid/proposal form is signed by an authorized representative before submission]",
  },
  {
    id: "addenda-acknowledgment",
    label: "Acknowledgment of All Addenda",
    verificationNote: "[Confirm every addendum issued for this solicitation has been acknowledged in writing before submission]",
  },
  {
    id: "references",
    label: "References / Past Performance",
    verificationNote: "[Confirm the agency's required number of references are gathered and formatted per the RFP's instructions]",
  },
];

export const CONDITIONAL_REQUIREMENTS: TriggeredRequirementDefinition[] = [
  {
    id: "bid-bond",
    label: "Bid Bond",
    triggerKeywords: ["bid bond"],
    verificationNote: "[Confirm the required bid bond amount/percentage and arrange it with a surety before submission]",
  },
  {
    id: "performance-payment-bond",
    label: "Performance & Payment Bond",
    triggerKeywords: ["performance bond", "payment bond", "performance and payment bond"],
    verificationNote: "[Confirm performance and payment bond amounts and arrange them with a surety before contract award]",
  },
  {
    id: "e-verify",
    label: "E-Verify Enrollment / Affidavit",
    triggerKeywords: ["e-verify", "e verify", "everify"],
    verificationNote: "[Confirm E-Verify enrollment and complete the required affidavit before submission]",
  },
  {
    id: "background-check",
    label: "Employee Background Check",
    triggerKeywords: ["background check", "background screening"],
    verificationNote: "[Confirm the specific background-check standard required (e.g. Level 2) and screen assigned staff before work begins]",
  },
];

export const TRADE_SPECIFIC_CERTIFICATIONS: TriggeredRequirementDefinition[] = [
  {
    id: "pesticide-applicator-license",
    label: "Florida Pesticide Applicator License (Limited Landscape/Ornamental & Turf)",
    triggerKeywords: ["pesticide", "herbicide", "fertiliz", "landscap", "turf", "lawn care", "ornamental", "weed control"],
    verificationNote: "[Confirm the assigned applicator holds a current FDACS Limited Landscape/Ornamental & Turf license before treatments begin]",
  },
  {
    id: "irrigation-contractor-registration",
    label: "Irrigation Contractor Registration",
    triggerKeywords: ["irrigation"],
    verificationNote: "[Confirm irrigation work is performed by a registered/licensed irrigation contractor per local requirements]",
  },
  {
    id: "epa-608-refrigerant",
    label: "EPA Section 608 Refrigerant Handling Certification",
    triggerKeywords: ["hvac", "refrigerant", "air condition", "chiller"],
    verificationNote: "[Confirm assigned technicians hold current EPA Section 608 certification before servicing refrigerant equipment]",
  },
  {
    id: "electrical-contractor-license",
    label: "State/Local Electrical Contractor License",
    triggerKeywords: ["electrical", "electrician", "wiring", "switchgear", "panel upgrade", "lighting retrofit", "conduit"],
    verificationNote: "[Confirm the assigned electrician holds a current state or local electrical contractor license covering the jurisdiction where work will be performed]",
  },
  {
    id: "nfpa-70e-arc-flash",
    label: "NFPA 70E Arc-Flash Electrical Safety Training",
    triggerKeywords: ["electrical", "switchgear", "energized", "arc flash", "high voltage", "panel upgrade"],
    verificationNote: "[Confirm assigned electricians have current NFPA 70E arc-flash safety training before performing energized electrical work]",
  },
  {
    id: "bloodborne-pathogen-training",
    label: "Bloodborne Pathogen Exposure Control Training",
    triggerKeywords: ["detention", "correctional", "jail", "inmate", "medical facility", "healthcare", "clinic", "hospital"],
    verificationNote: "[Confirm assigned staff complete bloodborne pathogen exposure control training before entering the facility]",
  },
  {
    id: "prea-compliance",
    label: "PREA (Prison Rape Elimination Act) Compliance Acknowledgment",
    triggerKeywords: ["detention", "correctional", "jail", "inmate"],
    verificationNote: "[Confirm PREA training/acknowledgment requirements for contractor staff with facility access before work begins]",
  },
  {
    id: "hipaa-awareness",
    label: "HIPAA Privacy/Security Awareness",
    triggerKeywords: ["medical facility", "healthcare", "hipaa", "clinic", "hospital", "patient"],
    verificationNote: "[Confirm assigned staff complete HIPAA privacy/security awareness training before servicing areas with patient information]",
  },
  // IT/Computer Support — three tiers of increasing severity, deliberately
  // NOT collapsed into one generic "IT compliance" line since each has a
  // different real trigger and a different real consequence. Trigger
  // keywords are full VAAR/DFARS clause citations and multi-word phrases,
  // verified against real VA Acquisition Regulation and DFARS clause text
  // (VAAR 852.239-70, 852.239-75, DFARS 252.204-7012/7019/7020/7021) rather
  // than generic terms — "veteran" or "computer" alone must NEVER trigger
  // any of these three, since a bid can mention veterans/computers with
  // zero actual VA-system, CUI, or accessibility obligation (see the real
  // "Computer support for Veterans" scope text that surfaced this gap:
  // that phrase alone correctly triggers none of these three tiers, since
  // it contains no confirmed system-access, CUI, or Section 508 language —
  // under-triggering here is the SAFE failure mode, not a bug). Deliberately
  // scope-text-only (no agency-type AND-gate): agency-name data is often too
  // thin/wrong to rely on (that same real submission has agency = "Agency"),
  // so precision comes entirely from these phrases being specific enough to
  // never appear outside a genuine VA-system/CUI/Section 508 context.
  {
    id: "va-handbook-6500-contract-security",
    label: "VA Handbook 6500.6 (Contract Security) Compliance",
    triggerKeywords: [
      "va handbook 6500",
      "6500.6",
      "852.239-70",
      "va information system",
      "va information systems",
      "access to va information",
      "access to va data",
      "va network",
      "va sensitive information",
      "veterans affairs information system",
    ],
    verificationNote:
      '[Confirm whether this contract requires contractor access to VA information systems or VA sensitive data — if so, VA Handbook 6500.6 (Contract Security, VAAR clause 852.239-70) governs data protection, destruction/sanitization procedures, and self-certification to the VA contracting officer. Do NOT assume this applies just because "veteran" or "VA" appears in the bid title or agency name — confirm actual system/data access is required, not just a topical mention]',
  },
  {
    id: "va-section-508-checklist",
    label: "VA Section 508 Checklist (ICT Accessibility)",
    triggerKeywords: [
      "section 508",
      "852.239-75",
      "ict accessibility",
      "information and communication technology accessibility",
      "va section 508",
      "wcag",
    ],
    verificationNote:
      "[Confirm whether this solicitation requires a completed VA Section 508 Checklist (VAAR clause 852.239-75) for software, website, or other digital/ICT deliverables — required on essentially all VA IT/ICT solicitations involving a digital product. Confirm the actual bid text requires this rather than assuming from agency type alone]",
  },
  {
    id: "cui-nist-800-171-cmmc",
    label: "NIST SP 800-171 / CMMC 2.0 Compliance (Controlled Unclassified Information)",
    triggerKeywords: [
      "controlled unclassified information",
      "nist 800-171",
      "nist sp 800-171",
      "cmmc",
      "dfars 252.204-7012",
      "252.204-7012",
      "252.204-7019",
      "252.204-7020",
      "252.204-7021",
    ],
    verificationNote:
      "[SERIOUS, HIGH-COST COMPLIANCE FLAG, NOT a routine checklist item — this bid's own text references Controlled Unclassified Information (CUI), NIST SP 800-171, CMMC, or a related DFARS clause. Real scope: 110 security controls, a self-assessment reported to SPRS, and for many contracts a mandatory third-party (C3PAO) CMMC Level 2 assessment before award. Flag this to the client immediately — this should almost never be silently treated as a simple item to tick off like the other requirements above, and likely requires specialist cybersecurity compliance help beyond what First Coast Bids provides]",
  },
];

export type MatchedRequirement = {
  id: string;
  label: string;
  category: RequirementCategory;
  matchedKeyword: string | null;
  verificationNote: string;
};

function findKeywordMatch(text: string, keywords: string[]): string | null {
  return keywords.find((keyword) => text.includes(keyword)) ?? null;
}

// Matches strictly against the client's own scope text — same rule as the
// rest of buildDraft(): never invents a requirement, only surfaces one that
// the bid text (mandatory tier) or the client's own words (conditional/trade
// tiers) actually support.
export function matchRequirements(bidText: string): MatchedRequirement[] {
  const text = bidText.toLowerCase();
  const matched: MatchedRequirement[] = ALWAYS_MANDATORY.map((req) => ({
    id: req.id,
    label: req.label,
    category: "mandatory" as const,
    matchedKeyword: null,
    verificationNote: req.verificationNote,
  }));

  for (const req of CONDITIONAL_REQUIREMENTS) {
    const hit = findKeywordMatch(text, req.triggerKeywords);
    if (hit) {
      matched.push({ id: req.id, label: req.label, category: "conditional", matchedKeyword: hit, verificationNote: req.verificationNote });
    }
  }

  for (const req of TRADE_SPECIFIC_CERTIFICATIONS) {
    const hit = findKeywordMatch(text, req.triggerKeywords);
    if (hit) {
      matched.push({ id: req.id, label: req.label, category: "trade_specific", matchedKeyword: hit, verificationNote: req.verificationNote });
    }
  }

  // These two need proximity-aware regex detection (a bare keyword match is
  // either too false-positive-prone — see mandatory-site-visit.ts's header
  // comment — or would need an unsafe short acronym like "SCA" under this
  // file's plain substring matching, see wage-risk.ts). Same detectors used
  // by generate-fit-check/route.ts's more prominent flags, so the matrix row
  // and the fit-check flag always agree.
  const wageRisk = assessWageRisk(bidText);
  if (wageRisk.concern) {
    matched.push({
      id: "prevailing-wage",
      label: "Prevailing Wage / Davis-Bacon Wage Certification",
      category: "conditional",
      matchedKeyword: "prevailing/living wage language",
      verificationNote: "[Confirm the applicable wage determination and certified payroll requirements before submission]",
    });
  }

  const siteVisit = detectMandatorySiteVisit(bidText);
  if (siteVisit.flagged) {
    matched.push({
      id: "mandatory-site-visit",
      label: "Mandatory Pre-Bid Site Visit Acknowledgment",
      category: "conditional",
      matchedKeyword: "mandatory site visit language",
      verificationNote: "[Confirm attendance at the mandatory site visit/pre-bid conference is documented — missing it can disqualify the bid]",
    });
  }

  return matched;
}

const CATEGORY_STATUS_LABEL: Record<RequirementCategory, string> = {
  mandatory: "MANDATORY — NEEDS VERIFICATION",
  conditional: "CONDITIONAL — NEEDS VERIFICATION",
  trade_specific: "TRADE-SPECIFIC — NEEDS VERIFICATION",
};

// Formats matchRequirements() output as the same strict pipe-delimited rows
// (Requirement | Status | Methodology & Verification) the rest of buildDraft()
// produces, so the packet PDF's autoTable parser (lib/pdf/deliverables-packet.ts)
// renders these identically to every other row in the matrix. The category
// goes in the Status column so mandatory items read distinctly from
// conditional/trade-specific ones instead of being lumped together.
export function referenceRequirementRows(bidText: string): string[] {
  return matchRequirements(bidText).map((req) => {
    const status = CATEGORY_STATUS_LABEL[req.category];
    const note =
      req.category === "mandatory"
        ? req.verificationNote
        : `${req.verificationNote} (flagged because the scope text mentions "${req.matchedKeyword}")`;
    return `${req.label} | ${status} | ${note}`;
  });
}
