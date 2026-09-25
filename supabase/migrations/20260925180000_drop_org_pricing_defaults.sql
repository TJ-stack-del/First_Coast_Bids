-- Settings' pricing defaults and the per-trade production rate moved to each
-- client (clients.pricing, 20260925170000). Dropped only after the code that
-- read them was gone from production. Stops if either still holds data.
do $$
begin
  if exists (select 1 from public.organizations where pricing_defaults <> '{}'::jsonb) then
    raise exception 'organizations.pricing_defaults still has values; clear them first';
  end if;
  if exists (select 1 from public.trades where production_rate_sqft_per_hour is not null) then
    raise exception 'trades.production_rate_sqft_per_hour still has values; clear them first';
  end if;
end $$;

alter table public.organizations drop column pricing_defaults;
alter table public.trades drop column production_rate_sqft_per_hour;
