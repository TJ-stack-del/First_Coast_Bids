import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PACKAGES } from "./sample-packages.ts";
import { SAMPLE_BIDS } from "./sample-bids.ts";

test("every sample bid has a package with all three documents", () => {
  assert.equal(SAMPLE_PACKAGES.length, SAMPLE_BIDS.length);
  for (const p of SAMPLE_PACKAGES) {
    assert.deepEqual(
      p.deliverables.map((d) => d.deliverable_type),
      ["capability_statement", "compliance_matrix", "technical_narrative"]
    );
    assert.ok(p.deliverables.every((d) => d.content && d.content.length > 100), p.tradeId);
  }
});

test("every package is labelled synthetic and keeps client facts as visible blanks", () => {
  for (const p of SAMPLE_PACKAGES) {
    assert.match(p.submission.clients!.company_name, /\(synthetic\)/);
    assert.match(p.submission.agency, /\(synthetic\)/);
    const all = p.deliverables.map((d) => d.content).join("\n");
    assert.match(all, /\[License number\]|\[license number\]|\[card numbers\]|\[certification names and numbers\]|\[screening records\]/);
    assert.match(all, /\[Past project 1/);
  }
});

test("compliance matrix rows are the packet builder's pipe-delimited shape, each citing a page", () => {
  for (const p of SAMPLE_PACKAGES) {
    const rows = p.deliverables[1].content!.split("\n").filter((l) => l.includes("|"));
    assert.ok(rows.length >= 4);
    assert.ok(rows.every((r) => r.split("|").length === 3), p.tradeId);
    const bidRows = rows.filter((r) => /\(p\. \d+\)/.test(r));
    assert.equal(bidRows.length, p.bid.we.length + p.bid.you.length);
  }
});

test("due dates parse from the sample bid", () => {
  assert.equal(SAMPLE_PACKAGES[0].submission.due_date, "2026-11-18T12:00:00");
});
