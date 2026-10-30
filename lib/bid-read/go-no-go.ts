import type { ReadItem } from "./read.ts";
import { toIsoDate } from "./fields.ts";

// "Should you bid this?": the bid read's things only the client can do,
// turned into yes / not sure / no questions, plus the time left, into one
// plain verdict. Plain code over the client's own answers -- the verdict is
// only ever as strong as what they told us, and it never predicts a win.

export type Answer = "yes" | "unsure" | "no";
export type Severity = "blocker" | "lineup"; // what a "no" means

export type Question = {
  key: string; // the read item's key, or "ins" for all insurance minimums
  ask: string;
  severity: Severity;
  // What to do about a "no" or "not sure", in plain words.
  fix: string;
  page: number;
};

export type Verdict =
  | { kind: "closed"; title: string; detail: string }
  | { kind: "hold"; title: string; detail: string; reasons: Question[] }
  | { kind: "lineup"; title: string; detail: string; todo: Question[] }
  | { kind: "go"; title: string; detail: string }
  | { kind: "unanswered"; title: string; detail: string };

const DAY_MS = 24 * 60 * 60 * 1000;
// Days a contractor should allow before the deadline for us to prepare the
// package (the site's 48-hour aim) and for them to review and sign it.
const MIN_DAYS = 3;
// A bid bond usually needs a few working days with a surety.
const BOND_DAYS = 5;

export function questionsFor(items: Pick<ReadItem, "key" | "label" | "page">[]): Question[] {
  const qs: Question[] = [];
  const insurance = items.filter((i) => i.key.startsWith("ins:"));
  for (const item of items) {
    if (item.key === "deal:site-visit") {
      qs.push({
        key: item.key,
        ask: "Can someone from your company attend the mandatory site visit?",
        severity: "blocker",
        fix: "Skipping a mandatory site visit usually gets a bid thrown out unopened. If nobody can go, this one isn't worth the work.",
        page: item.page,
      });
    } else if (item.key === "ref:bid-bond") {
      qs.push({
        key: item.key,
        ask: "Can you get a bid bond from a surety?",
        severity: "blocker",
        fix: "Call your insurance agent or a surety this week. A first bond usually takes a few days, so don't leave it to the end.",
        page: item.page,
      });
    } else if (item.key === "ref:performance-payment-bond") {
      qs.push({
        key: item.key,
        ask: "If you win, could you get a performance and payment bond?",
        severity: "lineup",
        fix: "Ask your surety now what it would take. You won't need it until award, but you need to know you can get it.",
        page: item.page,
      });
    } else if (item.key === "ref:background-check") {
      qs.push({
        key: item.key,
        ask: "Can the crew on this job pass the background checks it asks for?",
        severity: "lineup",
        fix: "Find out what the screening costs and how long it takes, and who on your crew would go.",
        page: item.page,
      });
    } else if (item.key === "ref:cui-nist-800-171-cmmc") {
      qs.push({
        key: item.key,
        ask: "Do you already meet the bid's data-security rules (NIST 800-171 / CMMC)?",
        severity: "blocker",
        fix: "These take months and usually a paid assessment. Unless you're already set up, this bid isn't the place to start.",
        page: item.page,
      });
    } else if (item === insurance[0]) {
      const limits = insurance.map((i) => i.label.replace(/ insurance/, "")).join("; ");
      qs.push({
        key: "ins",
        ask: `Do you carry the insurance it asks for? (${limits})`,
        severity: "lineup",
        fix: "Ask your agent what it costs to raise your limits or add the coverage, and how fast they can send a certificate.",
        page: item.page,
      });
    }
  }
  return qs;
}

// Calendar days from `today` to the deadline in the read's "Deadline: ..." label.
export function daysLeft(items: Pick<ReadItem, "key" | "label">[], today: Date): number | null {
  const deadline = items.find((i) => i.key === "deal:deadline");
  const iso = deadline ? toIsoDate(deadline.label.replace(/^Deadline:\s*/, "")) : null;
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const due = new Date(y, m - 1, d).getTime();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((due - start) / DAY_MS);
}

export function verdict(questions: Question[], answers: Record<string, Answer | undefined>, left: number | null): Verdict {
  if (left !== null && left < 0) {
    return { kind: "closed", title: "This deadline has passed", detail: "Unless the agency has extended it, this bid is closed. Send us the next one." };
  }
  if (questions.some((q) => !answers[q.key])) {
    return { kind: "unanswered", title: "Answer the questions above", detail: "Your verdict shows here as you go." };
  }

  const holds = questions.filter((q) => q.severity === "blocker" && answers[q.key] === "no");
  if (holds.length > 0) {
    return {
      kind: "hold",
      title: "Hold off on this one",
      detail: holds.length === 1 ? "One thing you can't get around:" : `${holds.length} things you can't get around:`,
      reasons: holds,
    };
  }

  const todo = questions.filter((q) => answers[q.key] !== "yes");
  const needsBond = todo.some((q) => q.key === "ref:bid-bond");
  const tooTight = left !== null && (left < MIN_DAYS || (needsBond && left < BOND_DAYS));
  if (tooTight) {
    return {
      kind: "hold",
      title: "It's very tight",
      detail:
        left === 0
          ? "It's due today. Unless your package is already ready, this one is too close."
          : `${left} day${left === 1 ? "" : "s"} left${needsBond ? ", and a bid bond usually needs more than that" : ""}. Talk to us today if you still want to try.`,
      reasons: needsBond ? todo.filter((q) => q.key === "ref:bid-bond") : [],
    };
  }

  const time = left === null ? "Check the due date on the cover page." : `${left} days left, enough time for us to prepare it.`;
  if (todo.length > 0) {
    return {
      kind: "lineup",
      title: `Go, with ${todo.length === 1 ? "one thing" : `${todo.length} things`} to line up`,
      detail: time,
      todo,
    };
  }
  return { kind: "go", title: "Good to go", detail: `${time} You have what only you can bring; we'll do the rest.` };
}
