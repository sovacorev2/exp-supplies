-- ============================================================
-- Exp Forms — add role + form ownership
-- Paste this into Neon Console → SQL Editor → Run
-- (Already applied to production during the rollout of this feature —
-- kept here so schema history matches the codebase.)
-- ============================================================

alter table public."user" add column if not exists "role" text not null default 'user';

alter table public.forms add column if not exists user_id text references public."user"(id) on delete set null;
create index if not exists forms_user_id_idx on public.forms(user_id);
