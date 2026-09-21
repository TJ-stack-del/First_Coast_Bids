import { test } from "node:test";
import assert from "node:assert/strict";
import { findBestMatchingClient, type MatchCandidate } from "./match-scoring.ts";

test("findBestMatchingClient returns null when no client is actively registered", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["238210"], sam_registration_status: "not_registered" },
    { id: "c2", naics_codes: ["238210"], sam_registration_status: "inactive" },
  ];
  assert.equal(findBestMatchingClient("238210", clients), null);
});

test("findBestMatchingClient returns the matching active client", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["561720"], sam_registration_status: "active" },
    { id: "c2", naics_codes: ["238210"], sam_registration_status: "active" },
  ];
  assert.deepEqual(findBestMatchingClient("238210", clients), { clientId: "c2", score: 1 });
});

test("findBestMatchingClient returns null when no client's naics_codes overlap", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["561720"], sam_registration_status: "active" },
  ];
  assert.equal(findBestMatchingClient("238210", clients), null);
});

test("findBestMatchingClient ignores an active client whose codes don't match, even if an inactive client's codes do", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["238210"], sam_registration_status: "inactive" },
    { id: "c2", naics_codes: ["561720"], sam_registration_status: "active" },
  ];
  assert.equal(findBestMatchingClient("238210", clients), null);
});

test("findBestMatchingClient matches a client with multiple naics_codes on any one of them", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["561720", "238220"], sam_registration_status: "active" },
  ];
  assert.deepEqual(findBestMatchingClient("238220", clients), { clientId: "c1", score: 1 });
});
