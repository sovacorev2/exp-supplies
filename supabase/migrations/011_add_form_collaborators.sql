-- ============================================================
-- SupplyPortal — per-form collaborator access (Google Forms-style Share)
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

create table if not exists public.form_collaborators (
  id text primary key default gen_random_uuid()::text,
  form_id text not null references public.forms(id) on delete cascade,
  email text not null,
  invited_by text references public.user(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (form_id, email)
);

create index if not exists form_collaborators_email_idx on public.form_collaborators(email);
