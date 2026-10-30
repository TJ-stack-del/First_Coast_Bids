import { SAMPLE_BIDS, type SampleBid } from "./sample-bids.ts";

// The three deliverables for each made-up bid in sample-bids.ts, written the
// way the real packet builder (lib/pdf/deliverables-packet.ts) expects them,
// for the Gallery's "See the package you'd get" viewer. Synthetic throughout
// and labelled so on every page. Facts a real client would supply (license
// numbers, past projects, crew sizes) stay [bracketed], the same visible
// blank a real packet shows until the client fills it (PRODUCT.md: never
// fabricate a fact).

export type SamplePackage = {
  tradeId: string; // a KNOWN_TRADES id
  bid: SampleBid;
  submission: {
    agency: string;
    solicitation_number: string | null;
    due_date: string | null;
    scope: string | null;
    clients: { company_name: string } | null;
  };
  deliverables: { deliverable_type: string; content: string | null; file_url: string | null }[];
};

type TradeCopy = {
  id: string;
  company: string;
  competencies: string[];
  credential: string;
  approach: string;
  staffing: string;
  quality: string;
};

const COPY: Record<string, TradeCopy> = {
  HVAC: {
    id: "hvac",
    company: "Sample Co. HVAC (synthetic)",
    competencies: ["Preventive maintenance of rooftop units, split systems and chillers", "Filter, belt and coil service on a fixed schedule", "Emergency repair response for occupied buildings"],
    credential: "EPA Section 608 certification for every technician: [card numbers]",
    approach: "Each site gets a quarterly preventive-maintenance visit on a published schedule, with filters, belts and coils serviced and every unit's readings logged.",
    staffing: "[Number] certified technicians, led by [Lead technician name], with one technician named as backup for each site.",
    quality: "A checklist per unit, signed by the technician and reviewed by the lead within one business day; findings reported to the facility contact.",
  },
  Janitorial: {
    id: "janitorial",
    company: "Sample Clean Services (synthetic)",
    competencies: ["Nightly custodial service for occupied public buildings", "Restroom care, floor care and trash removal to a written schedule", "Day porter coverage for lobbies and high-traffic areas"],
    credential: "Level 2 background screening for every assigned staff member: [screening records]",
    approach: "A written cleaning schedule per area, by frequency (nightly, weekly, monthly), agreed with the facility contact in the first week.",
    staffing: "[Number] custodians on the night shift and [Number] day porters, supervised by [Supervisor name].",
    quality: "Weekly walk-throughs with the facility contact, scored on a shared checklist, with any miss corrected within 24 hours.",
  },
  Landscaping: {
    id: "landscaping",
    company: "Sample Grounds Co. (synthetic)",
    competencies: ["Mowing, edging and trimming on a fixed park rotation", "Irrigation inspection and repair", "Storm cleanup and debris removal"],
    credential: "Florida pesticide applicator license: [license number]",
    approach: "Parks grouped into weekly routes so every site is visited on the same day each week, with irrigation checked monthly.",
    staffing: "[Number] crews of [Number], each led by a crew lead, with [Applicator name] holding the applicator license.",
    quality: "Before-and-after photos for each visit and a monthly report to the parks department.",
  },
  "IT support": {
    id: "it-computer-support",
    company: "Sample IT Solutions (synthetic)",
    competencies: ["Help desk support by phone, email and ticket", "Network monitoring and maintenance", "Workstation setup, patching and replacement"],
    credential: "Technician certifications: [certification names and numbers]",
    approach: "A single ticket queue with priorities agreed up front, and network monitoring with alerts to the on-call technician.",
    staffing: "[Number] help desk technicians and one network engineer, with [Project lead name] as project lead and [Backup name] as backup.",
    quality: "Response and resolution times measured per ticket and reported monthly against the agreed targets.",
  },
  Electrical: {
    id: "electrical",
    company: "Sample Electric Co. (synthetic)",
    competencies: ["Lighting retrofits in occupied facilities", "Panel upgrades and circuit work", "After-hours work to keep facilities open"],
    credential: "State electrical contractor license: [license number]; NFPA 70E training: [training dates]",
    approach: "Work phased by area and scheduled after hours, with each area's fixtures, circuits and labels checked before it's handed back.",
    staffing: "[Number] licensed electricians led by [Foreman name], with NFPA 70E training current for every crew member.",
    quality: "A punch list per area, walked with the facility contact before sign-off.",
  },
};

function isoDue(bid: SampleBid): string {
  // "Tue, Nov 18 · 2:00 p.m." -> 2026-11-18 (the samples are all November 2026)
  const day = Number(/(\d{1,2})\s*·/.exec(bid.due)?.[1] ?? "18");
  return `2026-11-${String(day).padStart(2, "0")}T12:00:00`;
}

function capability(bid: SampleBid, c: TradeCopy): string {
  return [
    `${c.company}`,
    `Prepared for ${bid.agency}, ${bid.number} (sample)`,
    "",
    "Core competencies",
    ...c.competencies.map((x) => `- ${x}`),
    "",
    "Past performance",
    "- [Past project 1: agency, scope, contract value, year]",
    "- [Past project 2: agency, scope, contract value, year]",
    "",
    "Licenses and certifications",
    `- ${c.credential}`,
    "- Business registration (Sunbiz): [document number]",
    "",
    "Company data",
    "- Years in business: [number]",
    "- Point of contact: [name, phone, email]",
  ].join("\n");
}

function matrix(bid: SampleBid): string {
  const rows = [
    ...bid.you.map((t) => `${t.text} (p. ${t.page}) | NEEDS VERIFICATION | [Client to confirm and supply proof before submission]`),
    ...bid.we.map((t) => `${t.text} (p. ${t.page}) | IN PACKAGE | Prepared by First Coast Bids; quoted from page ${t.page} of the solicitation`),
    "Signed bid form | NEEDS VERIFICATION | [Authorized signer to sign before submission]",
    "Certificate of insurance | NEEDS VERIFICATION | [Current certificate meeting the stated minimums]",
  ];
  return [
    "Sample compliance matrix with made-up requirements. Every row of a real matrix cites the page it came from.",
    "",
    ...rows,
  ].join("\n");
}

function narrative(bid: SampleBid, c: TradeCopy): string {
  return [
    `Technical approach for ${bid.title} (sample)`,
    "",
    "Approach",
    c.approach,
    "",
    "Staffing",
    c.staffing,
    "",
    "Schedule",
    `- Mobilize within [number] days of notice to proceed`,
    `- Full service from [start date]`,
    "",
    "Quality control",
    c.quality,
  ].join("\n");
}

export const SAMPLE_PACKAGES: SamplePackage[] = SAMPLE_BIDS.map((bid) => {
  const c = COPY[bid.trade];
  return {
    tradeId: c.id,
    bid,
    submission: {
      agency: `${bid.agency} (synthetic)`,
      solicitation_number: bid.number,
      due_date: isoDue(bid),
      scope: `${bid.title}. Sample bid with made-up details, for illustration only.`,
      clients: { company_name: c.company },
    },
    deliverables: [
      { deliverable_type: "capability_statement", content: capability(bid, c), file_url: null },
      { deliverable_type: "compliance_matrix", content: matrix(bid), file_url: null },
      { deliverable_type: "technical_narrative", content: narrative(bid, c), file_url: null },
    ],
  };
});
