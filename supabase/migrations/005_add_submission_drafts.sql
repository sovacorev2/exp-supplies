-- ============================================================
-- SupplyPortal — save & resume later (draft submissions)
-- Paste this into Neon Console → SQL Editor → Run
-- A draft is a submissions row with status='draft', a
-- resume_token, and a sliding 30-day expiry (extended on every
-- autosave). Converting a draft to a real response updates the
-- same row in place instead of inserting a second one.
-- ============================================================

alter table submissions add column if not exists resume_token text;
alter table submissions add column if not exists expires_at timestamptz;

create unique index if not exists submissions_resume_token_key on submissions(resume_token);

-- Widen the status check constraint from 001_schema.sql to allow 'draft'.
-- Safe to re-run: drops and recreates the constraint, touches no rows.
alter table submissions drop constraint if exists submissions_status_check;
alter table submissions add constraint submissions_status_check
  check (status in ('pending','approved','rejected','draft'));
