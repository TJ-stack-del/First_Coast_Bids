// Which suggestions need a human look before approving -- the rest can go
// through one "Approve all". Built for one person on a 48-hour turnaround
// (2026-09-25): a quote the app couldn't verify, a federal item (pricing and
// compliance stakes), or anything that would land on the admin's own list.
export type AttentionFields = {
  id: string;
  kind: string;
  quote_status: "verified" | "not_found" | "unreadable";
  federal: boolean;
  suggested_owner: "client" | "admin";
  found_by: "ai" | "detector";
};

// On a federal bid the AI marks nearly everything federal, so the flag alone
// would put almost every item under "Needs a look" (12 of 13 on a real Air
// Force RFQ). Only the federal kinds carry the pricing/compliance stakes.
const FEDERAL_KINDS = ["far_provision", "wage_determination", "sam_registration"];

export function needsAttention(s: AttentionFields): boolean {
  return s.quote_status !== "verified" || (s.federal && FEDERAL_KINDS.includes(s.kind)) || s.suggested_owner === "admin";
}

export function splitForReview<T extends AttentionFields>(items: T[]): { attention: T[]; routine: T[] } {
  const attention: T[] = [];
  const routine: T[] = [];
  for (const item of items) (needsAttention(item) ? attention : routine).push(item);
  return { attention, routine };
}
