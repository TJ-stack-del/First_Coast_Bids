-- One admin-managed list of the trades First Coast Bids offers
-- (docs/superpowers/specs/2026-09-23-trade-list-design.md). Replaces the
-- hardcoded SAM_NAICS_CODES / COMMON_NAICS_CODES lists: scrapers search and
-- sort by it, and the client NAICS checkboxes are built from it.

create table public.trades (
  id uuid primary key default extensions.uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  -- [{"code": "561720", "label": "Janitorial Services"}, ...]
  naics jsonb not null default '[]'::jsonb,
  nigp_codes text[] not null default '{}',
  keywords text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trades_label_not_blank check (btrim(label) <> ''),
  constraint trades_naics_is_array check (jsonb_typeof(naics) = 'array')
);

create unique index trades_org_label_unique on public.trades (org_id, lower(label));

alter table public.trades enable row level security;

create policy "admins manage trades" on public.trades
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));

-- Public on purpose: the intake wizard's NAICS checkboxes render before the
-- visitor has an account, and active trades are just the codes the business
-- offers. Inactive trades stay admin-only.
create policy "anyone reads active trades" on public.trades
  for select using (active);

grant select on public.trades to anon, authenticated;
grant insert, update on public.trades to authenticated;

-- The trade each match was sorted into (null = "Other trades"). Explicitly
-- named so any future embed can use trades!matched_opportunities_trade_id_fkey
-- (CLAUDE.md: PostgREST embeds break when a second FK appears).
alter table public.matched_opportunities
  add column trade_id uuid,
  add column nigp_codes text[] not null default '{}';

alter table public.matched_opportunities
  add constraint matched_opportunities_trade_id_fkey
  foreign key (trade_id) references public.trades(id) on delete set null;

create index matched_opportunities_org_trade_status_idx
  on public.matched_opportunities (org_id, trade_id, status);
