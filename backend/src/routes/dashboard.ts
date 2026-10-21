import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query } from '../db/pool'
import { logger } from '../utils/logger'
import { getDemoDashboard } from '../services/demoData'

const router = Router()

// GET /api/dashboard/summary
router.get('/summary', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const demoMode = process.env.DEMO_MODE === 'true' && !process.env.SHODAN_API_KEY

  if (demoMode) {
    res.json(getDemoDashboard())
    return
  }

  try {
    const userId = req.userId!

    const [totalsRes, tierRes, protocolRes, cveRes, verifyRes, recentRes, trendRes] = await Promise.all([
      // Total assets + assessments
      query<{ total_assets: string; total_assessments: string; total_findings: string }>(
        `SELECT
           (SELECT COUNT(DISTINCT ast.id) FROM assets ast JOIN assessments a ON a.id=ast.assessment_id WHERE a.user_id=$1) AS total_assets,
           (SELECT COUNT(*) FROM assessments WHERE user_id=$1) AS total_assessments,
           (SELECT COUNT(*) FROM findings f JOIN service_observations so ON so.id=f.observation_id JOIN assessments a ON a.id=so.assessment_id WHERE a.user_id=$1) AS total_findings`,
        [userId]
      ),
      // Findings by tier
      query<{ risk_tier: string; count: string }>(
        `SELECT f.risk_tier, COUNT(*) AS count
         FROM findings f JOIN service_observations so ON so.id=f.observation_id JOIN assessments a ON a.id=so.assessment_id
         WHERE a.user_id=$1 GROUP BY f.risk_tier`,
        [userId]
      ),
      // Findings by protocol
      query<{ service_type: string; count: string }>(
        `SELECT so.service_type, COUNT(*) AS count
         FROM findings f JOIN service_observations so ON so.id=f.observation_id JOIN assessments a ON a.id=so.assessment_id
         WHERE a.user_id=$1 GROUP BY so.service_type`,
        [userId]
      ),
      // CVE findings count
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT f.id) AS count
         FROM findings f JOIN finding_cves fc ON fc.finding_id=f.id JOIN service_observations so ON so.id=f.observation_id JOIN assessments a ON a.id=so.assessment_id
         WHERE a.user_id=$1`,
        [userId]
      ),
      // Needs verification count
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM findings f JOIN service_observations so ON so.id=f.observation_id JOIN assessments a ON a.id=so.assessment_id
         WHERE a.user_id=$1 AND f.verification_status='UNVERIFIED'`,
        [userId]
      ),
      // Recent assessments
      query(
        `SELECT a.id, a.target, a.status, a.started_at, a.completed_at, a.error_summary,
         COALESCE(f.finding_counts, '{"critical":0,"high":0,"medium":0,"low":0,"info":0,"verify":0,"total":0}') AS finding_counts,
         COALESCE(ast.asset_count, 0) AS asset_count
         FROM assessments a
         LEFT JOIN (SELECT assessment_id, COUNT(*) AS asset_count FROM assets GROUP BY assessment_id) ast ON ast.assessment_id=a.id
         LEFT JOIN (
           SELECT so.assessment_id, jsonb_build_object(
             'critical', COUNT(*) FILTER (WHERE f.risk_tier='CRITICAL'),
             'high',     COUNT(*) FILTER (WHERE f.risk_tier='HIGH'),
             'medium',   COUNT(*) FILTER (WHERE f.risk_tier='MEDIUM'),
             'low',      COUNT(*) FILTER (WHERE f.risk_tier='LOW'),
             'info',     COUNT(*) FILTER (WHERE f.risk_tier='INFORMATIONAL'),
             'verify',   COUNT(*) FILTER (WHERE f.risk_tier='NEEDS_VERIFICATION'),
             'total',    COUNT(*)
           ) AS finding_counts FROM service_observations so JOIN findings f ON f.observation_id=so.id GROUP BY so.assessment_id
         ) f ON f.assessment_id=a.id
         WHERE a.user_id=$1 ORDER BY a.started_at DESC LIMIT 5`,
        [userId]
      ),
      // 30-day trend
      query<{ date: string; total: string }>(
        `SELECT DATE(f.created_at)::text AS date, COUNT(*) AS total
         FROM findings f JOIN service_observations so ON so.id=f.observation_id JOIN assessments a ON a.id=so.assessment_id
         WHERE a.user_id=$1 AND f.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(f.created_at) ORDER BY date`,
        [userId]
      ),
    ])

    const totals = totalsRes.rows[0]
    const findings_by_tier: Record<string, number> = {}
    for (const r of tierRes.rows) findings_by_tier[r.risk_tier] = parseInt(r.count)

    const findings_by_protocol: Record<string, number> = {}
    for (const r of protocolRes.rows) findings_by_protocol[r.service_type ?? 'unknown'] = parseInt(r.count)

    res.json({
      demo_mode: false,
      total_assets: parseInt(totals.total_assets),
      total_assessments: parseInt(totals.total_assessments),
      total_findings: parseInt(totals.total_findings),
      findings_by_tier,
      findings_by_protocol,
      cve_findings: parseInt(cveRes.rows[0]?.count ?? '0'),
      needs_verification: parseInt(verifyRes.rows[0]?.count ?? '0'),
      recent_assessments: recentRes.rows,
      trend: trendRes.rows.map(r => ({ date: r.date, total: parseInt(r.total) })),
    })
  } catch (err) {
    logger.error('Dashboard summary error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to fetch dashboard summary' })
  }
})

export default router
