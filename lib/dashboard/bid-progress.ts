// Where a client's bid stands on the journey the homepage promises (RFP in,
// package back, you submit): five steps from the submission's own draft flag
// and stage, plus the days left to its due date. Read by the dashboard's bid
// rows and its "Coming up" strip. Plain code over fields the app already
// keeps; a bid with no due date just has no countdown.

export const STEPS = ["Bid file", "With us", "Ready to preview", "Your review", "Done"] as const;

// Index into STEPS of the step the bid is on now.
export function progressStep(b: { draft: boolean; stage: string }): number {
  if (b.draft) return 0;
  switch (b.stage) {
    case "submitted":
    case "in_review":
      return 1;
    case "deliverables_ready":
      return 2;
    case "client_review":
      return 3;
    case "closed":
      return 4;
    default:
      return 1;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar days from `today` to the due date, read the way formatDue reads it
// (lib/dashboard/format-due.ts): a bare date keeps its UTC calendar day, a
// real time is read in Eastern time.
export function daysUntil(due: string | null, today: Date): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  const dueDay = dateOnly
    ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : (() => {
        const [m, day, y] = d
          .toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" })
          .split("/")
          .map(Number);
        return Date.UTC(y, m - 1, day);
      })();
  const [tm, td, ty] = today
    .toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" })
    .split("/")
    .map(Number);
  return Math.round((dueDay - Date.UTC(ty, tm - 1, td)) / DAY_MS);
}

export type Urgency = "past" | "soon" | "week" | "ok";

export function urgency(days: number | null): Urgency | null {
  if (days === null) return null;
  if (days < 0) return "past";
  if (days <= 3) return "soon";
  if (days <= 7) return "week";
  return "ok";
}

export function countdownLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return days === -1 ? "Due yesterday" : `Due ${-days} days ago`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

// The "Coming up" strip: open bids with a due date from today on, soonest
// first, at most `limit`.
export function comingUp<T extends { days: number | null; completed: boolean }>(rows: T[], limit = 4): T[] {
  return rows
    .filter((r) => !r.completed && r.days !== null && r.days >= 0)
    .sort((a, b) => (a.days as number) - (b.days as number))
    .slice(0, limit);
}
