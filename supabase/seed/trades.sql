-- Starting trades, approved by the user 2026-09-23
-- (docs/superpowers/specs/2026-09-23-trade-list-design.md, "Starting trades").
-- Idempotent: skips any trade whose label already exists. One org per database.
with org as (select id from public.organizations limit 1),
seed(label, sort_order, naics, keywords) as (values
  ('Janitorial', 1,
   '[{"code":"561720","label":"Janitorial Services"},{"code":"561740","label":"Carpet and Upholstery Cleaning Services"},{"code":"561790","label":"Other Services to Buildings and Dwellings"},{"code":"561210","label":"Facilities Support Services"}]'::jsonb,
   array['janitorial','custodial','day porter','building cleaning','office cleaning','carpet cleaning','floor care','window cleaning','pressure washing']),
  ('Landscaping / Grounds', 2,
   '[{"code":"561730","label":"Landscaping Services"}]'::jsonb,
   array['landscap','lawn care','lawn maintenance','grounds maintenance','mowing','tree trimming','irrigation maintenance','irrigation repair','turf maintenance']),
  ('HVAC / Plumbing', 3,
   '[{"code":"238220","label":"Plumbing, Heating, and Air-Conditioning Contractors"},{"code":"238290","label":"Other Building Equipment Contractors"}]'::jsonb,
   array['hvac','air condition','refrigerant','chiller','heat pump','ductwork','heating and cooling','plumbing','plumber','backflow','water heater','boiler']),
  ('Electrical', 4,
   '[{"code":"238210","label":"Electrical Contractors"}]'::jsonb,
   array['electrician','electrical contractor','electrical services','electrical repair','electrical maintenance','electrical installation','switchgear','panel upgrade','lighting retrofit']),
  ('IT / Computer Support', 5,
   '[{"code":"541512","label":"Computer Systems Design Services"},{"code":"541519","label":"Other Computer Related Services"},{"code":"518210","label":"Data Processing, Hosting, and Related Services"}]'::jsonb,
   array['computer support','it services','it support','information technology','network administration','help desk','desktop support','cybersecurity','software development','web application'])
)
insert into public.trades (org_id, label, sort_order, naics, keywords)
select org.id, seed.label, seed.sort_order, seed.naics, seed.keywords
from seed cross join org
where not exists (
  select 1 from public.trades t where t.org_id = org.id and lower(t.label) = lower(seed.label)
);
