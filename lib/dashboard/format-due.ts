// One formatter for a bid's deadline on the client dashboard, used by both
// the row summary (server) and the open details (client), so the two can
// never disagree, whatever the viewer's time zone. submissions.due_date is
// timestamptz and comes in two shapes:
// - intake stores a bare date ("2026-10-01"), which Postgres keeps as
//   midnight UTC: read in UTC so it keeps its calendar day;
// - SAM.gov matches carry a real time (responseDeadLine): read in Eastern
//   time (every client is in Florida), so 9pm ET on Oct 1 stays Oct 1.
export function formatDue(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "America/New_York",
  });
}
