import { Pool } from 'pg'

// One shared Postgres pool for the whole app (Drizzle, better-auth and the
// share route). The database is the EXP Supabase project, schema exp_forms;
// the exp_forms_app login has search_path = exp_forms, so plain table names
// resolve there. Supabase's pooler certificate is not in Node's CA list, so
// TLS is kept on but the chain is not verified (same as the other EXP apps).
let _pool: Pool | null = null

// sslmode in the URL would override the ssl option below, so drop it.
function withoutSslParams(raw?: string): string | undefined {
  if (!raw) return raw
  try {
    const url = new URL(raw)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('channel_binding')
    return url.toString()
  } catch {
    return raw
  }
}

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: withoutSslParams(process.env.DATABASE_URL),
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
    })
  }
  return _pool
}
