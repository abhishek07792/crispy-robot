import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query } from '../db/pool'
import { logger } from '../utils/logger'

const router = Router()

// GET /api/cves/:cveId
router.get('/:cveId', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await query(
      `SELECT cve_id, description, cvss_score, cvss_vector, cvss_version,
              affected_criteria, source_updated_at, fetched_at
       FROM cve_records WHERE cve_id = $1`,
      [_req.params.cveId]
    )
    if (rows.length === 0) {
      res.status(404).json({ error: 'CVE record not found' })
      return
    }
    res.json({ cve: rows[0] })
  } catch (err) {
    logger.error('Get CVE error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to fetch CVE record' })
  }
})

export default router
