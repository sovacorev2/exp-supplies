import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { getPool } from './pool'

let _db: any = null

function initDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(getPool(), { schema })
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
