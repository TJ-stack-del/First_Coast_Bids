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
