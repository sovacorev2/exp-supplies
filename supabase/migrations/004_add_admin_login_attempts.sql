-- ============================================================
-- Exp Forms — rate limiting for /api/admin-login
-- Paste this into Neon Console → SQL Editor → Run
-- ============================================================

create table if not exists public.admin_login_attempts (
  id text primary key default gen_random_uuid()::text,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_ip_created_idx
  on public.admin_login_attempts(ip, created_at);
