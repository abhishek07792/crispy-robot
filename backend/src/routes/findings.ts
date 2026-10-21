import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query } from '../db/pool'
import { logger } from '../utils/logger'

const router = Router()

// GET /api/findings/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Fetch finding + observation + ownership via user_id chain
    const { rows } = await query<Record<string, unknown>>(
      `SELECT
         f.id, f.finding_type, f.severity, f.confidence, f.risk_tier,
         f.verification_status, f.evidence, f.rationale, f.remediation,
         f.rule_version, f.created_at,
         so.id AS observation_id, so.assessment_id, so.port, so.service_type,
         so.product, so.version, so.observed_at,
         ast.canonical_identifier AS asset_identifier,
         ast.id AS asset_id
       FROM findings f
       JOIN service_observations so ON so.id = f.observation_id
       JOIN assets ast ON ast.id = so.asset_id
       JOIN assessments a ON a.id = so.assessment_id
       WHERE f.id = $1 AND a.user_id = $2`,
      [req.params.id, req.userId!]
    )

    if (rows.length === 0) {
      res.status(404).json({ error: 'Finding not found' })
      return
    }

    const finding = rows[0]

    // Fetch related CVEs
    const { rows: cveRows } = await query(
      `SELECT c.cve_id, c.description, c.cvss_score, c.cvss_vector, c.cvss_version,
              c.affected_criteria, c.source_updated_at, fc.match_rationale
       FROM cve_records c
       JOIN finding_cves fc ON fc.cve_id = c.cve_id
       WHERE fc.finding_id = $1`,
      [req.params.id]
    )

    const match_rationale: Record<string, string> = {}
    for (const c of cveRows as { cve_id: string; match_rationale: string }[]) {
      match_rationale[c.cve_id] = c.match_rationale
    }

    // Reconstruct observation sub-object expected by frontend
    const observation = {
      id: finding.observation_id,
      assessment_id: finding.assessment_id,
      asset_id: finding.asset_id,
      port: finding.port,
      service_type: finding.service_type,
      product: finding.product,
      version: finding.version,
      observed_at: finding.observed_at,
    }

    res.json({
      finding: {
        ...finding,
        observation,
        cves: cveRows,
        match_rationale,
      },
    })
  } catch (err) {
    logger.error('Get finding error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to fetch finding' })
  }
})

export default router
