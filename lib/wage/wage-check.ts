import type { WorksheetLine } from "./floor.ts";

// The one read-only line the client sees on their bid (submissions.wage_check).
// Only once the admin has entered a bid price -- never a half-finished number.

export type WageCheck = {
  floor: number;
  bidPrice: number;
  staffing: string;
  wdNumber: string;
  wdRevision: number;
  updatedAt: string;
};

const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export function staffingText(lines: WorksheetLine[]): string {
  return lines
    .filter((l) => l.workers > 0 && l.hoursPerWeek > 0)
    .map((l) => `${num(l.workers)} × ${l.title} at ${num(l.hoursPerWeek)} hours/week each`)
    .join("; ");
}

export function wageCheckFor(i: {
  floor: number;
  bidPrice: number | null;
  lines: WorksheetLine[];
  wdNumber: string;
  wdRevision: number;
  now: string;
}): WageCheck | null {
  if (i.bidPrice === null || !(i.floor > 0)) return null;
  return {
    floor: i.floor,
    bidPrice: i.bidPrice,
    staffing: staffingText(i.lines),
    wdNumber: i.wdNumber,
    wdRevision: i.wdRevision,
    updatedAt: i.now,
  };
}

export function wageCheckLines(c: WageCheck): { main: string; warning: string | null } {
  return {
    main:
      `Federal wage law requires at least ${dollars(c.floor)}/year in labor for this contract ` +
      `(${c.staffing}, WD ${c.wdNumber} Rev. ${c.wdRevision}). Your price: ${dollars(c.bidPrice)}/year.`,
    warning: c.bidPrice < c.floor ? "This price is below the legal minimum. We'll go over it with you before you submit." : null,
  };
}
