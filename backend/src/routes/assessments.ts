import { Router, Response } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { logger } from '../utils/logger'
import { orchestrateAssessment } from '../services/assessmentOrchestrator'

const router = Router()

const CreateAssessmentSchema = z.object({
  target: z.string().min(1).regex(
    /^(([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|(\d{1,3}\.){3}\d{1,3})$/,
    'Invalid domain or IP address'
  ),
  authorized: z.literal(true, { errorMap: () => ({ message: 'Authorization confirmation required' }) }),
  protocols: z.array(z.string()).min(1),
  notes: z.string().optional(),
})

// POST /api/assessments
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = CreateAssessmentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message })
    return
  }

  const { target, protocols, notes } = parsed.data

  try {
    const { rows } = await query<{ id: string; target: string; status: string; started_at: string }>(
      `INSERT INTO assessments (user_id, target, status, protocols, notes)
       VALUES ($1, $2, 'PENDING', $3, $4)
       RETURNING id, target, status, started_at`,
      [req.userId!, target, protocols, notes ?? null]
    )

    const assessment = rows[0]
    logger.info('Assessment created', { assessmentId: assessment.id, target, userId: req.userId })

    // Kick off async orchestration (non-blocking)
    orchestrateAssessment(assessment.id, target, protocols).catch(err =>
      logger.error('Orchestration failed', { assessmentId: assessment.id, error: err.message })
    )

    res.status(201).json({ assessment: { ...assessment, finding_counts: { critical:0,high:0,medium:0,low:0,info:0,verify:0,total:0 }, asset_count:0 } })
  } catch (err) {
    logger.error('Create assessment error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to create assessment' })
  }
})

// GET /api/assessments
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1')))
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'))))
  const offset = (page - 1) * limit

  try {
    const { rows, rowCount } = await query<{ id: string; target: string; status: string; started_at: string; completed_at: string | null; error_summary: string | null; asset_count: number; finding_counts: Record<string, number> }>(
      `SELECT
         a.id, a.target, a.status, a.started_at, a.completed_at, a.error_summary,
         COALESCE(ast.asset_count, 0) AS asset_count,
         COALESCE(f.finding_counts, '{"critical":0,"high":0,"medium":0,"low":0,"info":0,"verify":0,"total":0}') AS finding_counts
       FROM assessments a
       LEFT JOIN (
         SELECT assessment_id, COUNT(*) AS asset_count FROM assets GROUP BY assessment_id
       ) ast ON ast.assessment_id = a.id
       LEFT JOIN (
         SELECT
           so.assessment_id,
           jsonb_build_object(
             'critical',  COUNT(*) FILTER (WHERE f.risk_tier='CRITICAL'),
             'high',      COUNT(*) FILTER (WHERE f.risk_tier='HIGH'),
             'medium',    COUNT(*) FILTER (WHERE f.risk_tier='MEDIUM'),
             'low',       COUNT(*) FILTER (WHERE f.risk_tier='LOW'),
             'info',      COUNT(*) FILTER (WHERE f.risk_tier='INFORMATIONAL'),
             'verify',    COUNT(*) FILTER (WHERE f.risk_tier='NEEDS_VERIFICATION'),
             'total',     COUNT(*)
           ) AS finding_counts
         FROM service_observations so
         JOIN findings f ON f.observation_id = so.id
         GROUP BY so.assessment_id
       ) f ON f.assessment_id = a.id
       WHERE a.user_id = $1
       ORDER BY a.started_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId!, limit, offset]
    )

    const total = rowCount // approximate; use COUNT(*) over() for exact
    res.json({ assessments: rows, total, page, limit })
  } catch (err) {
    logger.error('List assessments error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to fetch assessments' })
  }
})

// GET /api/assessments/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT
         a.id, a.target, a.status, a.started_at, a.completed_at, a.error_summary, a.notes,
         COALESCE(ast.asset_count, 0) AS asset_count,
         COALESCE(f.finding_counts, '{"critical":0,"high":0,"medium":0,"low":0,"info":0,"verify":0,"total":0}') AS finding_counts
       FROM assessments a
       LEFT JOIN (SELECT assessment_id, COUNT(*) AS asset_count FROM assets GROUP BY assessment_id) ast ON ast.assessment_id = a.id
       LEFT JOIN (
         SELECT so.assessment_id, jsonb_build_object(
           'critical', COUNT(*) FILTER (WHERE f.risk_tier='CRITICAL'),
           'high',     COUNT(*) FILTER (WHERE f.risk_tier='HIGH'),
           'medium',   COUNT(*) FILTER (WHERE f.risk_tier='MEDIUM'),
           'low',      COUNT(*) FILTER (WHERE f.risk_tier='LOW'),
           'info',     COUNT(*) FILTER (WHERE f.risk_tier='INFORMATIONAL'),
           'verify',   COUNT(*) FILTER (WHERE f.risk_tier='NEEDS_VERIFICATION'),
           'total',    COUNT(*)
         ) AS finding_counts
         FROM service_observations so JOIN findings f ON f.observation_id = so.id GROUP BY so.assessment_id
       ) f ON f.assessment_id = a.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.userId!]
    )

    if (rows.length === 0) {
      res.status(404).json({ error: 'Assessment not found' })
      return
    }
    res.json({ assessment: rows[0] })
  } catch (err) {
    logger.error('Get assessment error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to fetch assessment' })
  }
})

// GET /api/assessments/:id/findings
router.get('/:id/findings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  // Ownership check
  const { rows: ownerCheck } = await query('SELECT id FROM assessments WHERE id=$1 AND user_id=$2', [req.params.id, req.userId!])
  if (ownerCheck.length === 0) { res.status(404).json({ error: 'Assessment not found' }); return }

  const page  = Math.max(1, parseInt(String(req.query.page ?? '1')))
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'))))
  const offset = (page - 1) * limit

  const conditions: string[] = ['so.assessment_id = $1']
  const params: (string | number)[] = [req.params.id]
  let idx = 2

  if (req.query.risk_tier)           { conditions.push(`f.risk_tier = $${idx++}`);           params.push(String(req.query.risk_tier)) }
  if (req.query.confidence)          { conditions.push(`f.confidence = $${idx++}`);          params.push(String(req.query.confidence)) }
  if (req.query.verification_status) { conditions.push(`f.verification_status = $${idx++}`); params.push(String(req.query.verification_status)) }
  if (req.query.protocol)            { conditions.push(`so.service_type = $${idx++}`);       params.push(String(req.query.protocol)) }
  if (req.query.search)              { conditions.push(`f.finding_type ILIKE $${idx++}`);    params.push(`%${req.query.search}%`) }

  const where = conditions.join(' AND ')

  try {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT
         f.id, f.finding_type, f.severity, f.confidence, f.risk_tier, f.verification_status,
         f.rule_version, f.created_at,
         so.port, so.service_type, so.product, so.version,
         ast.canonical_identifier AS asset_identifier,
         COALESCE(
           (SELECT jsonb_agg(fc.cve_id) FROM finding_cves fc WHERE fc.finding_id = f.id),
           '[]'
         ) AS cve_ids
       FROM findings f
       JOIN service_observations so ON so.id = f.observation_id
       JOIN assets ast ON ast.id = so.asset_id
       WHERE ${where}
       ORDER BY
         CASE f.risk_tier
           WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3
           WHEN 'LOW' THEN 4 WHEN 'INFORMATIONAL' THEN 5 ELSE 6
         END,
         f.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    const { rows: countRows } = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM findings f JOIN service_observations so ON so.id = f.observation_id WHERE ${where}`,
      params
    )

    res.json({ findings: rows, total: parseInt(countRows[0]?.count ?? '0'), page, limit })
  } catch (err) {
    logger.error('Get findings error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to fetch findings' })
  }
})

// GET /api/assessments/:id/report
router.get('/:id/report', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { rows: ownerCheck } = await query(
    `SELECT a.id, a.target, a.status, a.started_at, a.completed_at, a.error_summary,
     COALESCE('{"critical":0,"high":0,"medium":0,"low":0,"info":0,"verify":0,"total":0}'::jsonb) AS finding_counts,
     0 AS asset_count
     FROM assessments a WHERE a.id=$1 AND a.user_id=$2`,
    [req.params.id, req.userId!]
  )
  if (ownerCheck.length === 0) { res.status(404).json({ error: 'Assessment not found' }); return }

  try {
    const [obsResult, findingsResult] = await Promise.all([
      query(`SELECT so.* FROM service_observations so WHERE so.assessment_id = $1 ORDER BY so.port`, [req.params.id]),
      query(`SELECT f.*, so.port, so.service_type, so.product, so.version, ast.canonical_identifier AS asset_identifier
             FROM findings f
             JOIN service_observations so ON so.id = f.observation_id
             JOIN assets ast ON ast.id = so.asset_id
             WHERE so.assessment_id = $1
             ORDER BY f.risk_tier`, [req.params.id]),
    ])

    // Attach CVEs to each finding
    const findingsWithCVEs = await Promise.all(
      (findingsResult.rows as Record<string, unknown>[]).map(async (f) => {
        const { rows: cveRows } = await query(
          `SELECT c.* FROM cve_records c JOIN finding_cves fc ON fc.cve_id = c.cve_id WHERE fc.finding_id = $1`,
          [f.id as string]
        )
        return { ...f, cves: cveRows, match_rationale: {} }
      })
    )

    res.json({
      assessment: ownerCheck[0],
      assets: [],
      service_observations: obsResult.rows,
      findings: findingsWithCVEs,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('Get report error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// GET /api/assessments/:id/report/pdf  (returns HTML-based PDF placeholder)
router.get('/:id/report/pdf', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { rows } = await query('SELECT id FROM assessments WHERE id=$1 AND user_id=$2', [req.params.id, req.userId!])
  if (rows.length === 0) { res.status(404).json({ error: 'Assessment not found' }); return }

  // Return HTML that browsers can print-to-PDF. A headless browser (puppeteer) can be added for true PDF.
  res.setHeader('Content-Type', 'text/html')
  res.send(`<!DOCTYPE html><html><head><title>VAPT Report</title></head><body>
    <h1>Assessment Report</h1>
    <p>Assessment ID: ${req.params.id}</p>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Use the JSON report endpoint for full data. PDF generation via headless browser is a planned enhancement.</p>
    <script>window.print()</script>
  </body></html>`)
})

export default router
