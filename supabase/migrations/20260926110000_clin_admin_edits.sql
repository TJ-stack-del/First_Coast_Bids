-- Keep the admin's CLIN corrections across re-reads (final review I-2):
-- the number as the AI read it (null for lines added by hand), the fields the
-- admin corrected, and whether the admin removed the line.
alter table public.clin_lines
  add column read_clin text,
  add column edited text[] not null default '{}',
  add column dismissed boolean not null default false;
update public.clin_lines set read_clin = clin where quote_status <> 'admin';
