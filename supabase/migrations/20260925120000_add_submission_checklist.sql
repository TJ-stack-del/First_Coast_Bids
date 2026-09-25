-- Submission checklist (docs/superpowers/specs/2026-09-25-submission-checklist-design.md):
-- items read from a bid's solicitation are suggested to an admin, and
-- approved ones join the shared checklist with an owner. Clients only ever
-- see their own items.

create table public.checklist_suggestions (
  id uuid primary key default extensions.uuid_generate_v4(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('form','amendment','bond','sworn_statement','license_insurance',
    'submission_rule','wage_determination','far_provision','sam_registration','evaluation_method','other')),
  federal boolean not null default false,
  label text not null,
  detail text,
  quote text not null,
  page integer,
  source_file text,
  quote_status text not null check (quote_status in ('verified','not_found','unreadable')),
  found_by text not null check (found_by in ('ai','detector')),
  suggested_owner text not null check (suggested_owner in ('client','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  dedupe_key text not null,
  checklist_item_id uuid references public.checklist_items(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.team_members(id) on delete set null,
  constraint checklist_suggestions_submission_key_unique unique (submission_id, dedupe_key)
);

create index checklist_suggestions_submission_status_idx on public.checklist_suggestions (submission_id, status);

alter table public.checklist_suggestions enable row level security;

create policy "admins manage checklist_suggestions" on public.checklist_suggestions
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));

grant select, insert, update on public.checklist_suggestions to authenticated;

alter table public.checklist_items
  add column owner text not null default 'client' check (owner in ('client','admin')),
  add column source_quote text,
  add column source_page integer,
  add column source_file text,
  add column client_notified_at timestamptz;

-- Clients see only the items that are theirs to do.
drop policy "clients read their own checklist_items" on public.checklist_items;
create policy "clients read their own checklist_items" on public.checklist_items
  for select using (
    owner = 'client'
    and exists (
      select 1 from public.submissions s
      where s.id = checklist_items.submission_id and public.is_own_client_record(s.client_id)
    )
  );

-- {status: running|done|failed, started_at, finished_at, files_fingerprint,
--  error, pages_read: [{file, total, read}], ai_failed_chunks}
alter table public.submissions add column checklist_scan jsonb;
