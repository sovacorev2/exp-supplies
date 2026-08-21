-- ============================================================
-- SupplyPortal — cached AI-generated report narratives
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

create table if not exists public.ai_report_narratives (
  id text primary key default gen_random_uuid()::text,
  form_id text not null unique references public.forms(id) on delete cascade,
  submission_count integer not null,
  narrative jsonb not null,
  generated_at timestamptz not null default now()
);
