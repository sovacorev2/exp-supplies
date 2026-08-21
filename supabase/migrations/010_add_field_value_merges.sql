-- ============================================================
-- SupplyPortal — manual "merge similar answers" mapping
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

create table if not exists public.field_value_merges (
  id text primary key default gen_random_uuid()::text,
  form_id text not null references public.forms(id) on delete cascade,
  field_label text not null,
  variant_value text not null,
  canonical_value text not null,
  created_at timestamptz not null default now(),
  unique (form_id, field_label, variant_value)
);
