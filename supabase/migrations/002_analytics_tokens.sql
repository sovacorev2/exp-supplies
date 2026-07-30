-- ============================================================
-- SupplyPortal — analytics_tokens table
-- Adds the table backing the shareable-analytics feature
-- (lib/db/schema.ts: analyticsTokens). Missing from the Neon
-- database after the Supabase -> Neon migration; app/actions/
-- forms.ts references this table for creating/reading share links.
-- ============================================================

create table if not exists analytics_tokens (
  id          text primary key default gen_random_uuid()::text,
  form_id     text not null references forms(id) on delete cascade,
  token       text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
