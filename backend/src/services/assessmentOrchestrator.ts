import axios from 'axios'
import { query, getClient } from '../db/pool'
import { logger } from '../utils/logger'
import { queryShodan, NormalizedObservation } from './shodanService'
import { fetchCVEsForProduct } from './nvdService'

const ANALYSIS_URL  = process.env.ANALYSIS_SERVICE_URL  ?? 'http://localhost:5001'
const ANALYSIS_SECRET = process.env.ANALYSIS_SERVICE_SECRET ?? ''

/**
 * Main orchestration function called after assessment record is created.
 * Steps: PENDING → IN_PROGRESS → (run analysis) → COMPLETED / PARTIAL / FAILED
 */
export async function orchestrateAssessment(
  assessmentId: string,
  target: string,
  protocols: string[]
): Promise<void> {
  logger.info('Orchestration started', { assessmentId, target })

  await query(
    `UPDATE assessments SET status='IN_PROGRESS' WHERE id=$1`,
    [assessmentId]
  )

  let observations: NormalizedObservation[] = []
  let partialError: string | null = null

  // ── Step 1: Shodan query ──────────────────────────────────────────────────
  try {
    observations = await queryShodan(target)
    if (observations.length === 0) {
      logger.warn('No Shodan observations returned', { assessmentId, target })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('Shodan query failed', { assessmentId, error: msg })
    partialError = `Shodan: ${msg}`
    // Continue — we may still be able to run with empty observations
  }

  // ── Step 2: Persist assets + service_observations ─────────────────────────
  const observationIds: string[] = []
  if (observations.length > 0) {
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Upsert single asset for the target
      const assetRes = await client.query(
        `INSERT INTO assets (assessment_id, canonical_identifier, first_seen_at, last_seen_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [assessmentId, target]
      )

      let assetId: string
      if (assetRes.rows.length > 0) {
        assetId = assetRes.rows[0].id
      } else {
        const sel = await client.query(
          `SELECT id FROM assets WHERE assessment_id=$1 AND canonical_identifier=$2`,
          [assessmentId, target]
        )
        assetId = sel.rows[0]?.id
      }

      if (!assetId) throw new Error('Failed to resolve asset ID')

      for (const obs of observations) {
        const soRes = await client.query(
          `INSERT INTO service_observations
             (assessment_id, asset_id, port, service_type, product, version, source, observed_at, raw_metadata)
           VALUES ($1,$2,$3,$4,$5,$6,'shodan',$7,$8)
           RETURNING id`,
          [
            assessmentId, assetId, obs.port, obs.service_type,
            obs.product, obs.version, obs.observed_at,
            JSON.stringify(obs.raw),
          ]
        )
        observationIds.push(soRes.rows[0].id)
      }

      await client.query('COMMIT')
      logger.info('Observations persisted', { assessmentId, count: observationIds.length })
    } catch (err) {
      await client.query('ROLLBACK')
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('Observation persistence failed', { assessmentId, error: msg })
      partialError = (partialError ? partialError + '; ' : '') + `Persistence: ${msg}`
    } finally {
      client.release()
    }
  }

  // ── Step 3: NVD prefetch for products found ───────────────────────────────
  const products = [...new Set(observations.map(o => o.product).filter(Boolean) as string[])]
  await Promise.allSettled(
    products.map(product => fetchCVEsForProduct(product))
  )

  // ── Step 4: Call Python analysis engine ───────────────────────────────────
  if (observationIds.length > 0) {
    try {
      const analysisPayload = {
        assessment_id: assessmentId,
        target,
        protocols,
        observations: observations.map((obs, i) => ({
          observation_id: observationIds[i],
          port: obs.port,
          service_type: obs.service_type,
          product: obs.product,
          version: obs.version,
          banner: obs.banner,
          observed_at: obs.observed_at,
          extra: obs.extra,
        })),
      }

      const analysisRes = await axios.post(
        `${ANALYSIS_URL}/internal/analyze`,
        analysisPayload,
        {
          headers: {
            'X-Analysis-Secret': ANALYSIS_SECRET,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      )

      const { findings } = analysisRes.data as { findings: AnalysisEngineEntry[] }
      logger.info('Analysis engine returned findings', { assessmentId, count: findings?.length ?? 0 })

      // Persist findings
      if (findings && findings.length > 0) {
        await persistFindings(assessmentId, findings)
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('Analysis engine call failed', { assessmentId, error: msg })
      partialError = (partialError ? partialError + '; ' : '') + `Analysis: ${msg}`
    }
  }

  // ── Step 5: Mark complete ─────────────────────────────────────────────────
  const finalStatus = partialError
    ? (observationIds.length > 0 ? 'PARTIAL' : 'FAILED')
    : 'COMPLETED'

  await query(
    `UPDATE assessments SET status=$1, completed_at=NOW(), error_summary=$2 WHERE id=$3`,
    [finalStatus, partialError, assessmentId]
  )

  logger.info('Orchestration complete', { assessmentId, status: finalStatus })
}

interface AnalysisEngineEntry {
  observation_id: string
  finding_type: string
  severity: string
  confidence: string
  risk_tier: string
  verification_status: string
  evidence: Record<string, unknown>
  rationale: string
  remediation: string
  rule_version: string
  cves: {
    cve_id: string
    match_rationale: string
    cvss_score?: number
    cvss_vector?: string
    description?: string
  }[]
}

async function persistFindings(assessmentId: string, findings: AnalysisEngineEntry[]): Promise<void> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    for (const f of findings) {
      // Upsert CVE records first
      for (const cve of (f.cves ?? [])) {
        if (cve.cve_id && cve.description) {
          await client.query(
            `INSERT INTO cve_records (cve_id, description, cvss_score, cvss_vector, source_updated_at)
             VALUES ($1,$2,$3,$4,NOW())
             ON CONFLICT (cve_id) DO NOTHING`,
            [cve.cve_id, cve.description, cve.cvss_score ?? null, cve.cvss_vector ?? null]
          )
        }
      }

      // Insert finding
      const fRes = await client.query(
        `INSERT INTO findings
           (observation_id, finding_type, severity, confidence, risk_tier,
            verification_status, evidence, rationale, remediation, rule_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          f.observation_id, f.finding_type, f.severity, f.confidence, f.risk_tier,
          f.verification_status, JSON.stringify(f.evidence),
          f.rationale, f.remediation, f.rule_version,
        ]
      )

      const findingId = fRes.rows[0].id

      // Link CVEs
      for (const cve of (f.cves ?? [])) {
        if (cve.cve_id) {
          await client.query(
            `INSERT INTO finding_cves (finding_id, cve_id, match_rationale)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [findingId, cve.cve_id, cve.match_rationale ?? '']
          )
        }
      }
    }

    await client.query('COMMIT')
    logger.info('Findings persisted', { assessmentId, count: findings.length })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
