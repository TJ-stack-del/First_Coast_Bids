-- The wage worksheet's pricing numbers are the client's, not ours
-- (docs/superpowers/specs/2026-09-25-client-pricing-design.md).

-- Each client's usual numbers, entered once by the admin on a worksheet.
-- {suppliesMode: 'percent'|'flat', suppliesValue, overheadPct, profitPct,
--  productionRate (sq ft per hour)}; a missing number is absent or null.
alter table public.clients
  add column pricing jsonb not null default '{}'::jsonb;

-- The one read-only line the client sees on their bid (set when the admin
-- enters a bid price, cleared when it's cleared):
-- {floor, bidPrice, staffing, wdNumber, wdRevision, updatedAt}.
alter table public.submissions
  add column wage_check jsonb;

-- null = "not given yet" (shown blank and highlighted), never 0.
alter table public.wage_worksheets
  alter column supplies_value drop not null,
  alter column supplies_value drop default,
  alter column overhead_pct drop not null,
  alter column overhead_pct drop default,
  alter column profit_pct drop not null,
  alter column profit_pct drop default;
