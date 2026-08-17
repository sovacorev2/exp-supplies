-- ============================================================
-- SupplyPortal — rate limiting for new public form submissions
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

create table if not exists public.submission_attempts (
  id text primary key default gen_random_uuid()::text,
  ip text not null,
  form_id text not null references public.forms(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists submission_attempts_ip_form_created_idx
  on public.submission_attempts(ip, form_id, created_at);
