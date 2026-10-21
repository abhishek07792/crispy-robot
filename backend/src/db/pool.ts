import dotenv from 'dotenv'
import path from 'path'
// Load .env from the monorepo root (vapt/.env), works regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
import { Pool } from 'pg'
import { logger } from '../utils/logger'

const connectionString = process.env.DATABASE_URL


if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message })
})

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: (string | number | boolean | null | object)[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  logger.debug('DB query', { text: text.slice(0, 80), duration, rows: res.rowCount })
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 }
}

export async function getClient() {
  return pool.connect()
}
