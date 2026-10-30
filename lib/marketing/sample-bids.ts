// Made-up bids for the homepage's product screen ("Your whole bid, on one
// screen"), one per trade the visitor can switch to. Synthetic throughout and
// labelled as such wherever shown (PRODUCT.md: never present sample content
// as a real agency's or client's). Each one is shaped the way the real client
// area and bid read show a bid: the deadline, what we handle, what only the
// client can do, and how far along the three documents are.

export type SampleTask = { text: string; page: number };
export type DocState = "ready" | "review" | "drafting";

export type SampleBid = {
  trade: string;
  agency: string;
  title: string;
  number: string;
  due: string; // as the screen shows it
  daysLeft: number;
  we: SampleTask[];
  you: SampleTask[];
  docs: { name: string; state: DocState; detail: string }[];
};

export const SAMPLE_BIDS: SampleBid[] = [
  {
    trade: "HVAC",
    agency: "Sample County Schools",
    title: "HVAC preventive maintenance, 14 sites",
    number: "ITB SAMPLE-0412",
    due: "Tue, Nov 18 · 2:00 p.m.",
    daysLeft: 19,
    we: [
      { text: "Fill in 4 sworn forms for you to sign", page: 31 },
      { text: "Check your labor rates against the wage rules", page: 12 },
      { text: "Acknowledge Addenda 1 and 2", page: 2 },
    ],
    you: [
      { text: "Attend the mandatory site visit, Nov 4", page: 3 },
      { text: "Send EPA 608 cards for each tech", page: 18 },
    ],
    docs: [
      { name: "Capability statement", state: "ready", detail: "Ready to preview" },
      { name: "Compliance matrix", state: "review", detail: "23 of 26 rows checked" },
      { name: "Technical narrative", state: "drafting", detail: "Staffing plan next" },
    ],
  },
  {
    trade: "Janitorial",
    agency: "City of Sampleton",
    title: "Custodial services, City Hall annex",
    number: "RFP SAMPLE-0847",
    due: "Mon, Nov 10 · 3:00 p.m.",
    daysLeft: 11,
    we: [
      { text: "Fill in the E-Verify affidavit for you to sign", page: 22 },
      { text: "Price the CLIN sheet from your numbers", page: 40 },
      { text: "Track the questions deadline, Oct 31", page: 1 },
    ],
    you: [
      { text: "Screen staff: Level 2 background checks", page: 9 },
      { text: "Send your $2M liability certificate", page: 14 },
    ],
    docs: [
      { name: "Capability statement", state: "ready", detail: "Ready to preview" },
      { name: "Compliance matrix", state: "ready", detail: "All 19 rows checked" },
      { name: "Technical narrative", state: "review", detail: "Your edits, 2 notes" },
    ],
  },
  {
    trade: "Landscaping",
    agency: "Sample Parks Department",
    title: "Grounds maintenance, 22 parks",
    number: "ITB SAMPLE-2210",
    due: "Fri, Nov 21 · 11:00 a.m.",
    daysLeft: 22,
    we: [
      { text: "Map every park to your crew schedule", page: 6 },
      { text: "Fill in the drug-free workplace form", page: 27 },
      { text: "Acknowledge Addendum 1", page: 2 },
    ],
    you: [
      { text: "Send your pesticide applicator license", page: 15 },
      { text: "Get the 5% bid bond from your surety", page: 4 },
    ],
    docs: [
      { name: "Capability statement", state: "review", detail: "Your edits, 1 note" },
      { name: "Compliance matrix", state: "drafting", detail: "14 of 31 rows" },
      { name: "Technical narrative", state: "drafting", detail: "Equipment list next" },
    ],
  },
  {
    trade: "IT support",
    agency: "Sample Port Authority",
    title: "Help desk and network support",
    number: "RFQ SAMPLE-0093",
    due: "Wed, Nov 12 · 5:00 p.m.",
    daysLeft: 13,
    we: [
      { text: "Flag the data-security clauses before you spend time", page: 33 },
      { text: "Fill in the conflict-of-interest form", page: 25 },
      { text: "Check your SAM registration is active", page: 8 },
    ],
    you: [
      { text: "Send your tech certifications", page: 17 },
      { text: "Name a project lead and a backup", page: 20 },
    ],
    docs: [
      { name: "Capability statement", state: "ready", detail: "Ready to preview" },
      { name: "Compliance matrix", state: "review", detail: "28 of 30 rows checked" },
      { name: "Technical narrative", state: "ready", detail: "Ready to preview" },
    ],
  },
  {
    trade: "Electrical",
    agency: "Sample Utilities Authority",
    title: "Lighting retrofit, 3 facilities",
    number: "IFB SAMPLE-1175",
    due: "Thu, Nov 20 · 2:00 p.m.",
    daysLeft: 21,
    we: [
      { text: "Check your labor against the prevailing wage", page: 11 },
      { text: "Fill in 3 sworn forms for you to sign", page: 29 },
      { text: "Acknowledge Addenda 1 to 3", page: 2 },
    ],
    you: [
      { text: "Send your electrical contractor license", page: 16 },
      { text: "Confirm NFPA 70E training for the crew", page: 19 },
    ],
    docs: [
      { name: "Capability statement", state: "ready", detail: "Ready to preview" },
      { name: "Compliance matrix", state: "drafting", detail: "9 of 24 rows" },
      { name: "Technical narrative", state: "drafting", detail: "Schedule next" },
    ],
  },
];
