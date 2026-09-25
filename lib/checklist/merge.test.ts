import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateKey, mergeCandidates, allowFederalItems, finalizeCandidates } from "./merge.ts";
import type { Candidate } from "./types.ts";

function c(p: Partial<Candidate>): Candidate {
  return {
    kind: "other", federal: false, label: "x", detail: null, quote: "q", page: 1, source_file: "a.pdf",
    found_by: "ai", key: null, suggested_owner: "client", ...p,
  };
}

test("key comes from the identifier, else kind + normalised label", () => {
  assert.equal(candidateKey(c({ kind: "form", label: "Sign the SF-1449, block 30" })), "form:sf-1449");
  assert.equal(candidateKey(c({ kind: "bond", label: "Bid Bond: 5%!" })), "bond:bid bond 5");
  assert.equal(candidateKey(c({ key: "sworn:e-verify", label: "anything" })), "sworn:e-verify");
});

test("a detector item wins over the AI item for the same identifier", () => {
  const det = c({ kind: "form", key: "form:sf-1449", found_by: "detector", quote: "detector line" });
  const ai = c({ kind: "form", label: "Complete SF 1449", quote: "ai line", detail: "blocks 12, 17a" });
  const merged = mergeCandidates([det], [ai]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].quote, "detector line");
  assert.equal(merged[0].detail, "blocks 12, 17a", "keeps the AI's detail when the detector has none");
});

test("duplicate AI items from different chunks collapse to one", () => {
  const merged = mergeCandidates([], [c({ kind: "bond", label: "Bid bond" }), c({ kind: "bond", label: "bid bond" })]);
  assert.equal(merged.length, 1);
});

test("federal items are allowed for federal agencies or when the documents show federal forms", () => {
  assert.equal(allowFederalItems("DEPT OF DEFENSE.DEPT OF THE NAVY", []), true);
  assert.equal(allowFederalItems("City of Jacksonville", []), false);
  assert.equal(allowFederalItems("City of Jacksonville", [c({ key: "far:52.212-3", federal: true, found_by: "detector" })]), true);
  assert.equal(allowFederalItems("Florida Department of Transportation", []), false);
});

test("finalize drops federal items on local bids and keys that already exist", () => {
  const items = [
    c({ kind: "wage_determination", federal: true, key: "wd:2015-4523" }),
    c({ kind: "bond", label: "Bid bond" }),
    c({ kind: "sworn_statement", key: "sworn:e-verify" }),
  ];
  const out = finalizeCandidates(items, { agency: "City of Jacksonville", detected: [], existingKeys: new Set(["sworn:e-verify"]) });
  assert.deepEqual(out.map((o) => o.key), ["bond:bid bond"]);
});

// Real duplicates from the 2026-09-25 dev run on Jacksonville Beach RFQ 03-2526
// and Air Force FA252126QB143: same requirement, different wording per chunk.
test("numbered local forms are one item however they're worded", () => {
  const merged = mergeCandidates([], [
    c({ kind: "form", label: "FORM 10: Qualifications (Page 46)" }),
    c({ kind: "form", label: "FORM 10: Qualifications" }),
    c({ kind: "form", label: "Form 10: Qualifications & Experience" }),
    c({ kind: "sworn_statement", label: "FORM 5: Non-Collusion Affidavit (Page 41)" }),
    c({ kind: "sworn_statement", label: "Form 5: Non-Collusion Affidavit" }),
  ]);
  assert.deepEqual(merged.map((m) => m.key).sort(), ["localform:10", "localform:5"]);
});

test("any FAR number identifies the item, not just the ones detectors act on", () => {
  const merged = mergeCandidates([], [
    c({ kind: "far_provision", label: "52.212-1 minimum offer contents" }),
    c({ kind: "far_provision", label: "FAR 52.212-1 minimum offer contents" }),
    c({ kind: "far_provision", label: "52.209-11 Representation" }),
    c({ kind: "far_provision", label: "52.209-11 Representation regarding delinquent tax liability/felony conviction" }),
  ]);
  assert.deepEqual(merged.map((m) => m.key).sort(), ["far:52.209-11", "far:52.212-1"]);
});

test("parentheticals and page notes don't make a new item", () => {
  const merged = mergeCandidates([], [
    c({ kind: "other", label: "Three project references" }),
    c({ kind: "other", label: "Three (3) project references" }),
  ]);
  assert.equal(merged.length, 1);
});

// Final review, Important 8: distinct requirements must not be merged away.
test("different items that cite the same FAR number in their detail stay separate", () => {
  const merged = mergeCandidates([], [
    c({ kind: "submission_rule", label: "Quote due date/time", detail: "Per 52.212-1, quotes are due 24 Sep" }),
    c({ kind: "submission_rule", label: "No .zip files", detail: "Per 52.212-1, no .zip attachments" }),
  ]);
  assert.equal(merged.length, 2);
});

test("a form count isn't mistaken for a numbered form", () => {
  assert.equal(candidateKey(c({ kind: "form", label: "W-9 form 2 copies" })), "form:w 9 form 2 copies");
  assert.equal(candidateKey(c({ kind: "form", label: "Form 1 \u2013 Response Form / Turn-In Checklist" })), "localform:1");
});
