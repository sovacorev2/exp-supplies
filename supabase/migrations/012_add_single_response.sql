-- ============================================================
-- SupplyPortal: per-form "one response per person" setting
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

alter table public.forms
  add column if not exists single_response boolean not null default false;
