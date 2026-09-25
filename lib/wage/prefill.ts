import type { ParsedWd } from "./parse-wd.ts";
import type { WorksheetLine } from "./floor.ts";

// Opening the worksheet already filled in (the user's hard constraint: one
// person, 48-hour turnaround). Every value comes from the solicitation's
// facts, the WD, or the admin's own standing settings -- never a guess.

export type PricingDefaults = {
  suppliesMode?: "percent" | "flat";
  suppliesValue?: number;
  overheadPct?: number;
  profitPct?: number;
  includeVacation?: boolean;
  serviceDaysPerWeek?: number;
};

// "Wage Determination 2015-4523 (Rev. 27)", "WD 2015-4539".
// "Wage Determination 2015-4523 (Rev. 27)", "2015-4539 Rev 32",
// "WD 2015-4539, Revision No. 32", "2015-4539 (Rev.-27)", "WD 2015-4539".
export function parseWdReference(text: string): { number: string; revision: number | null } | null {
  const m = text.match(/(\d{4}-\d{4})(?:[\s,]*\(?\s*Rev(?:ision)?\.?\s*(?:No\.?\s*)?-?\s*(\d{1,3})\s*\)?)?/i);
  return m ? { number: m[1], revision: m[2] ? Number(m[2]) : null } : null;
}

// The bid's WD from its checklist suggestions -- one rule for the page and
// the route: the NEWEST non-rejected wage-determination suggestion (an
// amendment's WD supersedes the original), number from its dedupe key
// (wd:NNNN-NNNN or wd:NNNN-NNNN:rN), revision from its label.
export function pickWdSuggestion(
  suggestions: { kind: string; dedupe_key: string; label: string; status: string; created_at: string }[]
): { number: string; revision: number | null } | null {
  const pick = suggestions
    .filter((s) => s.status !== "rejected" && s.dedupe_key.startsWith("wd:"))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!pick) return null;
  const number = pick.dedupe_key.slice(3).split(":")[0];
  return { number, revision: parseWdReference(pick.label)?.revision ?? null };
}

// Did the solicitation's WD change since the worksheet was made? A stated
// revision that differs, or a different WD number. No stated revision isn't
// a change (the worksheet may already be on the latest).
export function wdRefChanged(
  saved: { number: string; revision: number },
  current: { number: string; revision: number | null } | null
): boolean {
  if (!current) return false;
  if (current.number !== saved.number) return true;
  return current.revision !== null && current.revision !== saved.revision;
}

// Switching WD keeps the admin's positions and hours where the new WD has
// the same code, with the new WD's rates; positions it lacks are dropped.
export function rerateLines(lines: WorksheetLine[], wd: ParsedWd): WorksheetLine[] {
  return sanitizeLines(lines, wd);
}

// Exactly which default is missing, so an empty or half-filled worksheet says
// what to set (final review, 2026-09-25) instead of just showing $0.
export function prefillGuidance(input: {
  tradeLabel: string | null;
  positionCode: string | null;
  productionRate: number | null;
  cleanableSqft: number | null;
  missingCode: string | null;
}): string[] {
  if (!input.tradeLabel) return ["No trade matched this bid, so no position was pre-filled. Add a position below."];
  if (input.missingCode) {
    return [`Position ${input.missingCode} (the ${input.tradeLabel} default) isn't in this wage determination. Add a position below.`];
  }
  if (!input.positionCode) {
    return [`Set a wage worksheet position code for ${input.tradeLabel} in Settings → Trades to pre-fill positions.`];
  }
  const out: string[] = [];
  if (!input.productionRate) out.push(`Set a production rate for ${input.tradeLabel} in Settings → Trades to pre-fill hours.`);
  if (!input.cleanableSqft) out.push("The solicitation didn't state square footage, so enter hours per week.");
  return out;
}

export function sanitizeNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function prefillLines(input: {
  wd: ParsedWd;
  positionCode: string | null;
  productionRate: number | null;
  cleanableSqft: number | null;
  serviceDaysPerWeek: number | null;
  defaults: PricingDefaults;
}): { lines: WorksheetLine[]; missingCode: string | null; hoursNeeded: boolean } {
  const code = input.positionCode;
  const position = code ? input.wd.positions.find((p) => p.code === code) : undefined;
  if (code && !position) return { lines: [], missingCode: code, hoursNeeded: true };
  if (!position) return { lines: [], missingCode: null, hoursNeeded: true };

  const days = input.serviceDaysPerWeek ?? input.defaults.serviceDaysPerWeek ?? 5;
  if (!input.cleanableSqft || !input.productionRate) {
    return {
      lines: [{ code: position.code, title: position.title, rate: position.rate, workers: 1, hoursPerWeek: 0, hoursSource: null }],
      missingCode: null,
      hoursNeeded: true,
    };
  }
  const totalHours = (input.cleanableSqft / input.productionRate) * days;
  const workers = Math.max(1, Math.ceil(totalHours / 40));
  return {
    lines: [
      {
        code: position.code,
        title: position.title,
        rate: position.rate,
        workers,
        hoursPerWeek: Math.round((totalHours / workers) * 100) / 100,
        hoursSource: `from ${fmt(input.cleanableSqft)} sq ft at ${fmt(input.productionRate)} sq ft/hr × ${days} days`,
      },
    ],
    missingCode: null,
    hoursNeeded: false,
  };
}

// Lines as sent by the browser: rates always come from the WD (never the
// client), unknown codes are dropped, and numbers are finite and >= 0.
export function sanitizeLines(raw: unknown, wd: ParsedWd): WorksheetLine[] {
  if (!Array.isArray(raw)) return [];
  const out: WorksheetLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const position = wd.positions.find((p) => p.code === o.code);
    if (!position) continue;
    out.push({
      code: position.code,
      title: position.title,
      rate: position.rate,
      workers: sanitizeNumber(o.workers, 0),
      hoursPerWeek: sanitizeNumber(o.hoursPerWeek, 0),
      hoursSource: typeof o.hoursSource === "string" ? o.hoursSource : null,
    });
  }
  return out;
}

// The worksheet re-checks itself when the checklist's WD changes: it fills
// in from "enter the wage determination" (upload -> reading -> WD found), and
// an open worksheet picks up an amendment's newer WD as a banner (the load
// saves pending edits first and returns the saved worksheet unchanged).
export function shouldAutoLoad(state: string, previousRef: string | null, currentRef: string | null): boolean {
  return (state === "no_wd" || state === "ready") && currentRef !== null && currentRef !== previousRef;
}

// Reads what's typed in a worksheet number box. The box keeps the text as
// typed (so "35." keeps its point while "35.5" is being entered -- found in
// the dev run, where "35.5" saved as 355); this turns it into a number for
// the math. Empty or a lone "." is 0; anything else unreadable or negative
// is null, meaning "keep the previous value".
export function readNumberText(text: string): number | null {
  const t = text.replace(/[,$\s]/g, "");
  if (t === "" || t === ".") return 0;
  if (!/^\d*\.?\d*$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
