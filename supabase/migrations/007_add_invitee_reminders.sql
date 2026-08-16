-- ============================================================
-- SupplyPortal — invite/reminder email tracking
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

alter table invitees add column if not exists last_reminded_at timestamptz;
