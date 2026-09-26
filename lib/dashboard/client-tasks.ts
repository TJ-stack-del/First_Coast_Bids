// The client dashboard's "Needs you" list and plain-words standings
// (docs/superpowers/specs/2026-09-26-client-area-redesign-design.md). Only
// signals the app already has: a draft without its bid file, open
// checklist items, a package ready to review. One task per bid, most
// urgent first. Messages aren't tracked read/unread, so they aren't a task.

export type BidForTasks = { id: string; draft: boolean; stage: string; isRetainerPlaceholder: boolean; pendingCount: number };
export type ClientTask = { bidId: string; kind: "bid_file" | "items" | "review" | "profile"; label: string };

const REVIEW_STAGES = new Set(["deliverables_ready", "client_review"]);

// Today's rule, unchanged from the old dashboard: drafts, open checklist
// items, or a package waiting on the client. Closed bids never need you.
export function needsAction(b: BidForTasks): boolean {
  if (b.draft) return true;
  if (b.stage === "closed") return false;
  return b.pendingCount > 0 || REVIEW_STAGES.has(b.stage);
}

export function clientTasks(bids: BidForTasks[], profilePercent: number): ClientTask[] {
  const out: ClientTask[] = [];
  for (const b of bids) {
    // The Retainer placeholder has no bid file to add; the only thing it
    // can need is a complete profile to match bids against.
    if (b.isRetainerPlaceholder) {
      if (profilePercent < 100) out.push({ bidId: b.id, kind: "profile", label: "Complete your profile" });
      continue;
    }
    if (!needsAction(b)) continue;
    if (b.draft) out.push({ bidId: b.id, kind: "bid_file", label: "Add your bid file" });
    else if (b.pendingCount > 0)
      out.push({ bidId: b.id, kind: "items", label: `Answer ${b.pendingCount} item${b.pendingCount === 1 ? "" : "s"}` });
    else out.push({ bidId: b.id, kind: "review", label: "Review your package" });
  }
  return out;
}

const STANDING: Record<string, string> = {
  submitted: "Received",
  in_review: "In review with us",
  deliverables_ready: "Ready for your review",
  client_review: "With you for review",
  closed: "Closed",
};

export function standingLabel(b: { draft: boolean; stage: string; isRetainerPlaceholder: boolean }): string {
  if (b.isRetainerPlaceholder) return "Watching for a good fit";
  if (b.draft) return "Waiting for your bid file";
  return STANDING[b.stage] ?? "In progress";
}
