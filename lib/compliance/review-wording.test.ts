import { test } from "node:test";
import assert from "node:assert/strict";
import { computePreflightSummary } from "./preflight-summary.ts";
import { buildClientInfoRequestDraft } from "../client-info-request.ts";

// Admin review checks a client's uploaded document against what they
// typed; it never confirms anything with the insurer or issuing agency.
// The wording must say "reviewed", never "verified".
const certLabel = (certs: { verified: boolean }[]) =>
  computePreflightSummary({ deliverables: [], certifications: certs }).find((c) => c.key === "certifications_verified")!.label;

test("pre-flight badge says reviewed, not verified", () => {
  assert.equal(certLabel([{ verified: true }]), "1 certification reviewed");
  assert.equal(certLabel([{ verified: true }, { verified: false }]), "1 reviewed, 1 not yet reviewed");
});

test("no certifications reads as nothing to review, not as an achievement", () => {
  assert.equal(certLabel([]), "No certifications to review");
});

test("the info request asks for a document to review, not to verify", () => {
  const draft = buildClientInfoRequestDraft({ naicsCodes: ["561720"], scope: "x".repeat(50), hasLicense: true, hasInsurance: true, hasVerifiedCertification: false });
  assert.doesNotMatch(draft, /verif/i);
  assert.match(draft, /so our team can review the document/);
});
