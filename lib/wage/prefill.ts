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
export function parseWdReference(text: string): { number: string; revision: number | null } | null {
  const m = text.match(/(\d{4}-\d{4})(?:\s*\(\s*Rev(?:ision)?\.?\s*(\d{1,3})\s*\))?/i);
  return m ? { number: m[1], revision: m[2] ? Number(m[2]) : null } : null;
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
