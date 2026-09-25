import type { ParsedWd } from "./parse-wd.ts";

// The legal labor-cost floor for a Service Contract Act bid: plain-code
// arithmetic over the wage determination (spec:
// docs/superpowers/specs/2026-09-25-wage-worksheet-design.md). 52 weeks;
// full precision throughout, rounded to cents only for display/storage.

export type WorksheetLine = {
  code: string;
  title: string;
  rate: number;
  workers: number;
  hoursPerWeek: number;
  hoursSource: string | null;
};
export type WorksheetOptions = { includeVacation: boolean; eo13658: boolean };
export type FloorBreakdown = {
  wages: number;
  hw: number;
  holidays: number;
  vacation: number;
  sick: number;
  fica: number;
  floor: number;
  annualHours: number;
  wage: number;
};
export type PricingInputs = { suppliesMode: "percent" | "flat"; suppliesValue: number; overheadPct: number; profitPct: number };

const WEEKS = 52;
const FICA = 0.0765;
const SICK_HOURS_PER_WORKED = 1 / 30;
const SICK_CAP_PER_WORKER = 56;

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLine(line: WorksheetLine, wd: ParsedWd, options: WorksheetOptions): FloorBreakdown {
  const wage = options.eo13658 && wd.eo13658Min !== null ? Math.max(line.rate, wd.eo13658Min) : line.rate;
  const capped = Math.min(line.hoursPerWeek, 40);
  const annualHours = line.workers * line.hoursPerWeek * WEEKS;
  const wages = annualHours * wage;
  const hw = line.workers * capped * WEEKS * wd.hwPerHour;
  const holidays = line.workers * (wd.holidays ?? 0) * 8 * (capped / 40) * wage;
  const vacation = options.includeVacation ? line.workers * (wd.vacationWeeks ?? 0) * capped * wage : 0;
  const sick = wd.paidSickLeave ? Math.min(annualHours * SICK_HOURS_PER_WORKED, SICK_CAP_PER_WORKER * line.workers) * wage : 0;
  const fica = FICA * (wages + holidays + vacation + sick);
  return { wages, hw, holidays, vacation, sick, fica, floor: wages + hw + holidays + vacation + sick + fica, annualHours, wage };
}

export function computeFloor(
  lines: WorksheetLine[],
  wd: ParsedWd,
  options: WorksheetOptions
): { lines: FloorBreakdown[]; total: FloorBreakdown } {
  const each = lines.map((l) => computeLine(l, wd, options));
  const total = each.reduce(
    (t, r) => ({
      wages: t.wages + r.wages,
      hw: t.hw + r.hw,
      holidays: t.holidays + r.holidays,
      vacation: t.vacation + r.vacation,
      sick: t.sick + r.sick,
      fica: t.fica + r.fica,
      floor: t.floor + r.floor,
      annualHours: t.annualHours + r.annualHours,
      wage: 0,
    }),
    { wages: 0, hw: 0, holidays: 0, vacation: 0, sick: 0, fica: 0, floor: 0, annualHours: 0, wage: 0 }
  );
  return { lines: each, total };
}

export function computePrice(floor: number, p: PricingInputs): { supplies: number; price: number } {
  const supplies = p.suppliesMode === "percent" ? (floor * p.suppliesValue) / 100 : p.suppliesValue;
  const price = (floor + supplies) * (1 + p.overheadPct / 100) * (1 + p.profitPct / 100);
  return { supplies, price };
}

// How far a bid price is below the floor (per year), or null if it isn't.
export function belowFloor(bidPrice: number | null, floor: number): number | null {
  if (bidPrice === null || !Number.isFinite(bidPrice)) return null;
  const gap = roundCents(floor) - roundCents(bidPrice);
  return gap > 0 ? roundCents(gap) : null;
}
