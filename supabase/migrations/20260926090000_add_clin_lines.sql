-- CLIN pricing (docs/superpowers/specs/2026-09-25-clin-pricing-design.md):
-- the solicitation's own price table, read with verified quotes and priced
-- from the wage worksheet's bid price and the client's yearly increase.

create table public.clin_lines (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  clin text not null,
  description text not null default '',
  quantity numeric,
  unit text,
  unit_kind text not null default 'other' check (unit_kind in ('month','year','other')),
  period_index integer check (period_index between 0 and 9),
  position integer not null default 1,
  quote text,
  page integer,
  source_file text,
  quote_status text not null check (quote_status in ('verified','not_found','unreadable','admin')),
  revised_by text,
  unit_price_override numeric check (unit_price_override >= 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (submission_id, clin)
);
alter table public.clin_lines enable row level security;
create policy "admins manage clin_lines" on public.clin_lines
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));
grant select, insert, update, delete on public.clin_lines to authenticated;

-- {status, started_at, finished_at, files_fingerprint, error, excel_attachments: [names]}
alter table public.submissions add column clin_scan jsonb;
-- The split between CLINs sharing a period, entered once per bid: {"<position>": pct}.
alter table public.submissions add column clin_shares jsonb not null default '{}'::jsonb;
