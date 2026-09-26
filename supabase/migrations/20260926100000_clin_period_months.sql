-- Whole-period CLINs with no quantity or unit (as Montrose, Crow Agency and
-- Martha's Vineyard print them) are priced as lump sums by their months,
-- from period dates verified in the document.
alter table public.clin_lines add column period_months numeric check (period_months > 0);
alter table public.clin_lines drop constraint clin_lines_unit_kind_check;
alter table public.clin_lines add constraint clin_lines_unit_kind_check check (unit_kind in ('month','year','lump','other'));
