-- ============================================================
-- SupplyPortal — per-invitee tracking
-- Paste this into Neon Console → SQL Editor → Run
-- Each invitee gets a personalized link (token) so an admin can
-- see who has/hasn't opened or submitted a form. Reminder emails
-- are a later phase — this migration only adds tracking.
-- ============================================================

create table if not exists invitees (
  id         text primary key default gen_random_uuid()::text,
  form_id    text not null references forms(id) on delete cascade,
  name       text not null,
  email      text not null,
  token      text not null,
  opened_at  timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists invitees_token_key on invitees(token);
create index if not exists invitees_form_id_idx on invitees(form_id);

alter table submissions add column if not exists invitee_id text references invitees(id) on delete set null;
create index if not exists submissions_invitee_id_idx on submissions(invitee_id);
