import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
import fs from 'fs'
import { pool, query } from './pool'
import { logger } from '../utils/logger'

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

async function migrate() {
  // Ensure the migration table exists
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const { rows: applied } = await query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version')
  const appliedSet = new Set(applied.map(r => r.version))

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (appliedSet.has(file)) {
      logger.info(`Migration already applied: ${file}`)
      continue
    }

    logger.info(`Applying migration: ${file}`)
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
      await client.query('COMMIT')
      logger.info(`Migration applied: ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      logger.error(`Migration failed: ${file}`, { error: err instanceof Error ? err.message : String(err) })
      throw err
    } finally {
      client.release()
    }
  }

  logger.info('All migrations complete.')
  await pool.end()
}

migrate().catch(err => {
  logger.error('Migration process failed', { error: err.message })
  process.exit(1)
})
