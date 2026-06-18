import { drizzle } from 'drizzle-orm/node-postgres'
// @ts-ignore - pg types will be installed
import { Pool } from 'pg'
import * as schema from './schema'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })
