// One formatter for a bid's deadline on the client dashboard, used by both
// the row summary (server) and the open details (client), so the two can
// never disagree. submissions.due_date is timestamptz: intake stores a bare
// date ("2026-10-01"), which Postgres keeps as midnight UTC. Formatting in
// UTC keeps that calendar day in every browser; formatting in the viewer's
// zone showed it as the day before anywhere west of UTC.
export function formatDue(due: string | null): string | null {
  if (!due) return null;
  return new Date(due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
