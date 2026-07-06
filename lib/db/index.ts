import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

let _db: any = null

function initDb() {
  if (!_db && process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL)
    _db = drizzle(sql, { schema })
  }
  return _db
}

export const db = new Proxy({}, {
  get(_, prop) {
    const db = initDb()
    if (!db) return undefined
    return (db as any)[prop]
  }
}) as any
