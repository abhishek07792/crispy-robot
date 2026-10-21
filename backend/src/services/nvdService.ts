import axios from 'axios'
import { logger } from '../utils/logger'
import { query } from '../db/pool'

interface NVDCVEItem {
  cve: {
    id: string
    descriptions: { lang: string; value: string }[]
    metrics?: {
      cvssMetricV31?: { cvssData: { baseScore: number; vectorString: string; version: string } }[]
      cvssMetricV2?: { cvssData: { baseScore: number; vectorString: string; version: string } }[]
    }
    configurations?: unknown[]
    published: string
    lastModified: string
  }
}

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0'
const NVD_CACHE_TTL_HOURS = 24

function nvdKey(): string | undefined {
  return process.env.NVD_API_KEY || undefined
}

/**
 * Fetch CVEs relevant to a product keyword from NVD.
 * Results are cached in cve_records table.
 * Returns list of CVE IDs that were upserted.
 */
export async function fetchCVEsForProduct(
  keyword: string,
  version?: string | null
): Promise<string[]> {
  if (!keyword || keyword.trim().length === 0) return []

  try {
    const headers: Record<string, string> = {}
    const key = nvdKey()
    if (key) headers['apiKey'] = key

    // NVD public rate limit: 5 req/30s without key, 50 req/30s with key
    const params: Record<string, string | number> = {
      keywordSearch: keyword,
      resultsPerPage: 20,
    }
    if (version) params.keywordSearch = `${keyword} ${version}`

    const res = await axios.get<{ vulnerabilities: NVDCVEItem[] }>(NVD_BASE, {
      params,
      headers,
      timeout: 20000,
    })

    const items = res.data.vulnerabilities ?? []
    const cveIds: string[] = []

    for (const item of items) {
      const c = item.cve
      const desc = c.descriptions.find(d => d.lang === 'en')?.value ?? ''
      const v31 = c.metrics?.cvssMetricV31?.[0]?.cvssData
      const v2  = c.metrics?.cvssMetricV2?.[0]?.cvssData
      const cvss = v31 ?? v2
      const cvss_score  = cvss?.baseScore ?? null
      const cvss_vector = cvss?.vectorString ?? null
      const cvss_version = cvss?.version ?? null

      await query(
        `INSERT INTO cve_records (cve_id, description, cvss_score, cvss_vector, cvss_version, affected_criteria, source_updated_at, fetched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (cve_id) DO UPDATE SET
           description=EXCLUDED.description, cvss_score=EXCLUDED.cvss_score,
           cvss_vector=EXCLUDED.cvss_vector, cvss_version=EXCLUDED.cvss_version,
           affected_criteria=EXCLUDED.affected_criteria, source_updated_at=EXCLUDED.source_updated_at,
           fetched_at=NOW()`,
        [c.id, desc, cvss_score, cvss_vector, cvss_version, JSON.stringify(c.configurations ?? []), c.lastModified]
      )

      cveIds.push(c.id)
    }

    logger.info('NVD fetch complete', { keyword, cveCount: cveIds.length })
    return cveIds
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      if (status === 403) { logger.warn('NVD API key rejected'); return [] }
      if (status === 429) { logger.warn('NVD rate limit hit'); return [] }
      if (status === 503) { logger.warn('NVD service unavailable'); return [] }
      logger.warn('NVD API error', { status, message: err.message })
      return []
    }
    logger.warn('NVD fetch failed', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

/**
 * Get cached CVE record from DB. Returns null if not cached or stale.
 */
export async function getCachedCVE(cveId: string): Promise<Record<string, unknown> | null> {
  const { rows } = await query<{ fetched_at: string }>(
    `SELECT *, fetched_at FROM cve_records WHERE cve_id = $1`,
    [cveId]
  )
  if (rows.length === 0) return null

  const fetched = new Date((rows[0] as { fetched_at: string }).fetched_at)
  const ageHours = (Date.now() - fetched.getTime()) / 3600000
  if (ageHours > NVD_CACHE_TTL_HOURS) return null // stale

  return rows[0] as Record<string, unknown>
}
