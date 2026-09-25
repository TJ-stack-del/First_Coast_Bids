-- Wage worksheet (docs/superpowers/specs/2026-09-25-wage-worksheet-design.md):
-- the labor-cost floor for a federal service bid, from its Service Contract
-- Act wage determination, pre-filled from per-trade and business defaults.

create table public.wage_worksheets (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  wd_number text not null,
  wd_revision integer not null,
  wd_revision_source text not null check (wd_revision_source in ('solicitation','latest','manual')),
  wd_text text not null,
  wd_parsed jsonb not null,
  lines jsonb not null default '[]'::jsonb,
  options jsonb not null default '{"includeVacation": true, "eo13658": false}'::jsonb,
  supplies_mode text not null default 'percent' check (supplies_mode in ('percent','flat')),
  supplies_value numeric not null default 0,
  overhead_pct numeric not null default 0,
  profit_pct numeric not null default 0,
  bid_price numeric,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.team_members(id) on delete set null
);

alter table public.wage_worksheets enable row level security;
create policy "admins manage wage_worksheets" on public.wage_worksheets
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));
grant select, insert, update on public.wage_worksheets to authenticated;

-- Per-trade defaults that pre-fill the worksheet (set once in Settings).
alter table public.trades
  add column wd_position_code text,
  add column production_rate_sqft_per_hour numeric;

-- Business-wide pricing defaults (set once in Settings).
-- {suppliesMode, suppliesValue, overheadPct, profitPct, includeVacation, serviceDaysPerWeek}
alter table public.organizations
  add column pricing_defaults jsonb not null default '{}'::jsonb;
