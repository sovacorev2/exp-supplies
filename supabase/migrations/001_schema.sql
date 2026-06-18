-- ============================================================
-- SupplyPortal — Neon/Postgres Schema
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists forms (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  category    text not null default 'General',
  fields      jsonb not null default '[]',
  is_active   boolean not null default true,
  slug        text unique not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists submissions (
  id          uuid primary key default uuid_generate_v4(),
  form_id     uuid not null references forms(id) on delete cascade,
  data        jsonb not null default '{}',
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists submissions_form_id_idx on submissions(form_id);
create index if not exists submissions_status_idx  on submissions(status);
create index if not exists forms_slug_idx          on forms(slug);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists forms_updated_at on forms;
create trigger forms_updated_at
  before update on forms for each row execute function update_updated_at();

drop trigger if exists submissions_updated_at on submissions;
create trigger submissions_updated_at
  before update on submissions for each row execute function update_updated_at();

-- ── Seed data ──────────────────────────────────────────────────────────

insert into forms (name, description, category, slug, fields) values
(
  'General Supplier Registration',
  'Register your business as an approved supplier. Fill in your company details and the products or services you offer.',
  'General',
  'general-registration',
  '[
    {"id":"f1","label":"Company name","type":"text","required":true,"placeholder":"e.g. Acme Supplies Ltd"},
    {"id":"f2","label":"Contact person","type":"text","required":true,"placeholder":"Full name"},
    {"id":"f3","label":"Email address","type":"email","required":true,"placeholder":"you@company.com"},
    {"id":"f4","label":"Phone number","type":"tel","required":true,"placeholder":"+254 7XX XXX XXX"},
    {"id":"f5","label":"Business registration no.","type":"text","required":false,"placeholder":"Optional"},
    {"id":"f6","label":"Supply category","type":"select","required":true,"options":["Tents & Shelter","Electronics & AV","Food & Catering","Transport & Logistics","Furniture & Decor","Security","Printing","Other"]},
    {"id":"f7","label":"Products / services offered","type":"textarea","required":true,"placeholder":"Describe what you supply in detail..."},
    {"id":"f8","label":"County / location","type":"text","required":true,"placeholder":"e.g. Nairobi, Mombasa, Kisumu"}
  ]'::jsonb
),
(
  'Tent & Shelter Suppliers',
  'For businesses that supply tents, marquees, canopies, and temporary shelters for events.',
  'Tents & Shelter',
  'tent-shelter-suppliers',
  '[
    {"id":"f1","label":"Company name","type":"text","required":true,"placeholder":"e.g. Acme Tents Ltd"},
    {"id":"f2","label":"Contact person","type":"text","required":true,"placeholder":"Full name"},
    {"id":"f3","label":"Email address","type":"email","required":true,"placeholder":"you@company.com"},
    {"id":"f4","label":"Phone number","type":"tel","required":true,"placeholder":"+254 7XX XXX XXX"},
    {"id":"f5","label":"Types of tents supplied","type":"select","required":true,"options":["Frame tents","Marquee","Stretch tents","Dome tents","Canvas tents","All types"]},
    {"id":"f6","label":"Maximum capacity (sqm or pax)","type":"text","required":true,"placeholder":"e.g. 500 sqm or 300 guests"},
    {"id":"f7","label":"Do you offer setup & takedown?","type":"select","required":true,"options":["Yes — included","Yes — at extra cost","No"]},
    {"id":"f8","label":"Counties you operate in","type":"text","required":true,"placeholder":"e.g. Nairobi, Machakos, Kajiado"},
    {"id":"f9","label":"Additional notes","type":"textarea","required":false,"placeholder":"Any other details..."}
  ]'::jsonb
)
on conflict (slug) do nothing;

-- Sample submissions
insert into submissions (form_id, data, status)
select id,
  '{"Company name":"Mama Wanjiku Traders","Contact person":"Grace Wanjiku","Email address":"grace@mwtraders.co.ke","Phone number":"+254 712 345 678","Business registration no.":"BN/2021/45231","Supply category":"Tents & Shelter","Products / services offered":"Canvas tents, frame tents, marquee hire for events up to 500 guests","County / location":"Nairobi"}'::jsonb,
  'pending'
from forms where slug = 'general-registration'
on conflict do nothing;

insert into submissions (form_id, data, status)
select id,
  '{"Company name":"Nairobi Tech Hub","Contact person":"Brian Ochieng","Email address":"brian@nairobitehhub.co.ke","Phone number":"+254 733 211 900","Business registration no.":"BN/2019/12003","Supply category":"Electronics & AV","Products / services offered":"Projectors, PA systems, LED screens, laptops for hire","County / location":"Nairobi"}'::jsonb,
  'approved'
from forms where slug = 'general-registration'
on conflict do nothing;
