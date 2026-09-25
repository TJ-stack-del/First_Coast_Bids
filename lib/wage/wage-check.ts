import { computeFloor, roundCents, type WorksheetLine, type WorksheetOptions } from "./floor.ts";
import type { ParsedWd } from "./parse-wd.ts";

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

// The client's line from a saved worksheet row -- one rule for every path
// that changes the floor (autosave, Re-fill, switching WD), so the client
// never sees a stale floor or misses a below-floor warning (final review I2).
export function wageCheckForWorksheet(
  ws: { wd_parsed: unknown; wd_number: string; wd_revision: number; lines: unknown; options: unknown; bid_price: unknown },
  now: string
): WageCheck | null {
  const lines = ws.lines as WorksheetLine[];
  const { total } = computeFloor(lines, ws.wd_parsed as ParsedWd, ws.options as WorksheetOptions);
  const bid = ws.bid_price === null || ws.bid_price === undefined ? null : Number(ws.bid_price);
  return wageCheckFor({
    floor: roundCents(total.floor),
    bidPrice: bid !== null && Number.isFinite(bid) ? bid : null,
    lines,
    wdNumber: ws.wd_number,
    wdRevision: ws.wd_revision,
    now,
  });
}

export function wageCheckLines(c: WageCheck): { main: string; warning: string | null } {
  return {
    main:
      `Federal wage law requires at least ${dollars(c.floor)}/year in labor for this contract ` +
      `(${c.staffing}, WD ${c.wdNumber} Rev. ${c.wdRevision}). Your price: ${dollars(c.bidPrice)}/year.`,
    warning: c.bidPrice < c.floor ? "This price is below the legal minimum. We'll go over it with you before you submit." : null,
  };
}
