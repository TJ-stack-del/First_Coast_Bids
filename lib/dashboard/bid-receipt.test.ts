import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBidReceipt } from "./bid-receipt.ts";

const received = new Date(2026, 9, 30, 14, 15); // Thu Oct 30, 2:15 PM local
const field = (key: string) => ({ key, label: key, complete: false });

test("the aim is 48 hours after we got it", () => {
  const r = buildBidReceipt({ receivedAt: received, dueDate: null, readItems: [], missingProfile: [] });
  assert.equal(r.aimAt.getTime(), new Date(2026, 10, 1, 14, 15).getTime());
  assert.equal(r.daysLeft, null);
  assert.equal(r.tight, false);
});

test("days left counts calendar days to the due date", () => {
  const r = buildBidReceipt({ receivedAt: received, dueDate: "2026-11-18", readItems: [], missingProfile: [] });
  assert.equal(r.daysLeft, 19);
  assert.equal(r.tight, false);
  assert.equal(r.pastDue, false);
});

test("a due date on or before the aim's day is tight; one already gone is past due", () => {
  assert.equal(buildBidReceipt({ receivedAt: received, dueDate: "2026-11-01", readItems: [], missingProfile: [] }).tight, true);
  assert.equal(buildBidReceipt({ receivedAt: received, dueDate: "2026-11-02", readItems: [], missingProfile: [] }).tight, false);
  const gone = buildBidReceipt({ receivedAt: received, dueDate: "2026-10-29", readItems: [], missingProfile: [] });
  assert.equal(gone.pastDue, true);
  assert.equal(gone.tight, false);
});

test("tasks are the bid's You items, then the profile gaps, each said once", () => {
  const r = buildBidReceipt({
    receivedAt: received,
    dueDate: null,
    readItems: [
      { key: "deal:deadline", label: "Deadline: Nov 18", page: 1 },
      { key: "deal:site-visit", label: "Mandatory site visit or pre-bid meeting", page: 1 },
      { key: "ins:general-liability", label: "General liability insurance: $1,000,000", page: 2 },
      { key: "sworn:e-verify", label: "E-Verify affidavit", page: 3 },
    ],
    missingProfile: [field("license_number"), field("insurance"), field("workers_comp"), field("certification")],
  });
  assert.deepEqual(
    r.tasks.map((t) => [t.text, t.detail, t.href]),
    [
      ["Attend and sign in", "Mandatory site visit or pre-bid meeting · p. 1", null],
      ["Send us your insurance certificate", "General liability insurance: $1,000,000 · p. 2", null],
      ["Add your trade license number", null, "/dashboard/profile"],
      ["Upload a certification, if you have one", null, "/dashboard/compliance"],
    ]
  );
});

test("without a bid read, the list is the profile gaps", () => {
  const r = buildBidReceipt({ receivedAt: received, dueDate: null, readItems: [], missingProfile: [field("insurance"), field("business_phone")] });
  assert.deepEqual(r.tasks.map((t) => t.text), ["Add your insurance details", "Add your business phone"]);
});

test("several insurance minimums are one task listing each", () => {
  const r = buildBidReceipt({
    receivedAt: received,
    dueDate: null,
    readItems: [
      { key: "ins:general-liability", label: "General liability insurance: $2,000,000", page: 2 },
      { key: "ref:background-check", label: "Employee Background Check", page: 2 },
      { key: "ins:auto-liability", label: "Auto liability insurance: $1,000,000", page: 2 },
    ],
    missingProfile: [],
  });
  assert.deepEqual(r.tasks.map((t) => t.text), ["Send us your insurance certificates", "Screen the staff who'll be on site"]);
  assert.equal(r.tasks[0].detail, "General liability insurance: $2,000,000 · p. 2; Auto liability insurance: $1,000,000 · p. 2");
});
