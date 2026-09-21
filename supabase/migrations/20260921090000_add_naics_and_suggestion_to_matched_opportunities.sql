-- SAM.gov opportunity-sourcing columns, added for the SAM.gov adoption
-- initiative (docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md).
-- naics_code is the opportunity's own NAICS code, populated only by the
-- SAM.gov producer (lib/scrapers/sam-gov.ts) -- existing JAA/COJ scrapers
-- have no equivalent and leave this null. suggested_client_id is a
-- computed best-guess match (NAICS overlap against actively-registered
-- clients only), kept separate from the existing assigned_client_id
-- column, which remains the admin's own confirmed assignment -- a
-- suggestion is never auto-assigned.
--
-- LANDMINE: this is matched_opportunities' SECOND foreign key to clients
-- (the first is the existing assigned_client_id_fkey). Verified this
-- migration itself introduces no live bug -- app/admin/matches/page.tsx's
-- query on this table selects assigned_client_id as a plain scalar column
-- and joins clients in a separate query client-side, never a PostgREST
-- relational embed. But per CLAUDE.md's own documented incident (the
-- 2026-09-04 attestation-tracking migration silently broke 9 files' worth
-- of `clients(...)` embeds this exact way): if anyone ever adds a bare
-- `clients(...)` embed to a query on this table going forward, it MUST be
-- disambiguated as `clients!matched_opportunities_assigned_client_id_fkey(...)`
-- or `clients!matched_opportunities_suggested_client_id_fkey(...)` -- a
-- bare embed will fail at request time (PGRST201), not build time.
alter table "public"."matched_opportunities"
  add column if not exists "naics_code" text,
  add column if not exists "suggested_client_id" uuid references "public"."clients"("id");
