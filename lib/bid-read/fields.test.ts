import { test } from "node:test";
import assert from "node:assert/strict";
import { readBidFields, toIsoDate } from "./fields.ts";
import { SAMPLE_BID_PAGES } from "./sample-bid.ts";

// Page 1 of test-fixtures/RFP-2026-0847-JANI.pdf as the PDF reader returns it.
const FIXTURE_COVER = `SYNTHETIC TEST DATA — GENERATED FOR SOFTWARE QA — NOT A REAL SOLICITATION, COMPANY, OR CREDENTIAL
MOCK DOCUMENT — TEST FIXTURE
[SPECIMEN SOLICITATION — FICTIONAL AGENCY DATA]
City of Jacksonville — Procurement Division
Request for Proposals (RFP) No. RFP-2026-0847-JANI
Janitorial & Custodial Services — City Hall Annex & Duval County Courthouse Complex
Issuing Agency   City of Jacksonville, Procurement Division (test fixture)
Solicitation Number   RFP-2026-0847-JANI
Pre-Proposal Conference   Sept 15, 2026, 10:00 AM — Procurement Conference Room B (non-mandatory)
Questions Deadline   Sept 22, 2026, 5:00 PM
Proposal Due Date   Oct 6, 2026, 3:00 PM local time
`;

test("a labelled cover sheet fills all three fields", () => {
  assert.deepEqual(readBidFields([FIXTURE_COVER]), {
    agency: "City of Jacksonville, Procurement Division",
    solicitationNumber: "RFP-2026-0847-JANI",
    dueDate: "2026-10-06",
  });
});

test("an unlabelled heading still names the agency", () => {
  assert.deepEqual(readBidFields(["Page 1\nCITY OF ATLANTIC BEACH\nInvitation to Bid No. 26-014\nLawn care"]), {
    agency: "City of Atlantic Beach",
    solicitationNumber: "26-014",
    dueDate: null,
  });
});

test("the sample bid fills the number and due date", () => {
  const fields = readBidFields(SAMPLE_BID_PAGES);
  assert.equal(fields.solicitationNumber, "SAMPLE-0000");
  assert.equal(fields.dueDate, "2026-11-18");
});

test("nothing recognisable leaves every field blank, never a guess", () => {
  assert.deepEqual(readBidFields(["Scope of work: mow the lawn weekly."]), { agency: null, solicitationNumber: null, dueDate: null });
  // "Bid No. TBD" has no digits, so it isn't a number.
  assert.equal(readBidFields(["Bid No. TBD"]).solicitationNumber, null);
});

test("dates convert to the form's yyyy-mm-dd", () => {
  assert.equal(toIsoDate("Oct 6, 2026"), "2026-10-06");
  assert.equal(toIsoDate("November 18, 2026"), "2026-11-18");
  assert.equal(toIsoDate("Sept 22 2026"), "2026-09-22");
  assert.equal(toIsoDate("10/06/2026"), "2026-10-06");
  assert.equal(toIsoDate("10/6/26"), "2026-10-06");
  assert.equal(toIsoDate("13/40/2026"), null);
});
