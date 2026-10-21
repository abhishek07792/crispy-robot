import axios from 'axios'
import { logger } from '../utils/logger'

interface ShodanHostResult {
  ip_str: string
  ports: number[]
  data: ShodanServiceEntry[]
  hostnames: string[]
  org?: string
  isp?: string
  country_code?: string
  last_update?: string
}

interface ShodanServiceEntry {
  port: number
  transport: string
  product?: string
  version?: string
  info?: string
  data?: string   // banner string
  timestamp: string
  _shodan?: { module: string }
  ftp?: { anonymous?: boolean; features?: Record<string, string> }
  redis?: { auth_required?: boolean; version?: string; mode?: string }
  mongodb?: { authentication?: boolean; listDatabases?: { databases?: { name: string }[] } }
}

interface NormalizedObservation {
  port: number
  service_type: string
  product: string | null
  version: string | null
  banner: string | null
  observed_at: string | null
  raw: ShodanServiceEntry
  extra: {
    ftp_anonymous?: boolean
    redis_auth_required?: boolean
    mongodb_auth?: boolean
    banner_raw?: string
  }
}

const SHODAN_BASE = 'https://api.shodan.io'

function resolveShodanKey(): string | null {
  return process.env.SHODAN_API_KEY || null
}

/**
 * Query Shodan for a domain using the host search API.
 * Falls back to IP lookup if query returns results.
 */
export async function queryShodan(target: string): Promise<NormalizedObservation[]> {
  const key = resolveShodanKey()

  if (!key) {
    logger.warn('SHODAN_API_KEY not set — returning empty observations (demo mode)')
    return []
  }

  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(target)

  try {
    let entries: ShodanServiceEntry[] = []

    if (isIP) {
      // Direct host lookup
      const res = await axios.get<ShodanHostResult>(
        `${SHODAN_BASE}/shodan/host/${target}`,
        { params: { key }, timeout: 15000 }
      )
      entries = res.data.data ?? []
    } else {
      // Search by hostname — use the /shodan/host/search endpoint
      const res = await axios.get<{ matches: ShodanServiceEntry[] }>(
        `${SHODAN_BASE}/shodan/host/search`,
        { params: { key, query: `hostname:${target}` }, timeout: 15000 }
      )
      entries = res.data.matches ?? []
    }

    logger.info('Shodan returned results', { target, count: entries.length })
    return entries.map(normalizeEntry)

  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      if (status === 401) throw new Error('Shodan API key is invalid or not authorized')
      if (status === 402) throw new Error('Shodan API quota exhausted')
      if (status === 404) { logger.info('Shodan: no results for target', { target }); return [] }
      if (status === 429) throw new Error('Shodan rate limit reached — try again later')
      throw new Error(`Shodan API error: ${status ?? 'network error'} — ${err.message}`)
    }
    throw err
  }
}

function normalizeEntry(e: ShodanServiceEntry): NormalizedObservation {
  const service_type = e._shodan?.module ?? inferServiceType(e.port)
  const extra: NormalizedObservation['extra'] = {}

  if (e.ftp) extra.ftp_anonymous = e.ftp.anonymous ?? false
  if (e.redis) extra.redis_auth_required = e.redis.auth_required
  if (e.mongodb) extra.mongodb_auth = e.mongodb.authentication
  if (e.data) extra.banner_raw = e.data.slice(0, 500)

  return {
    port: e.port,
    service_type,
    product: e.product ?? null,
    version: e.version ?? null,
    banner: e.data?.slice(0, 500) ?? null,
    observed_at: e.timestamp ?? null,
    raw: e,
    extra,
  }
}

function inferServiceType(port: number): string {
  const map: Record<number, string> = {
    21: 'ftp', 22: 'ssh', 25: 'smtp', 53: 'dns',
    80: 'http', 110: 'pop3', 143: 'imap', 443: 'https',
    445: 'smb', 3306: 'mysql', 5432: 'postgresql',
    6379: 'redis', 27017: 'mongodb', 3389: 'rdp',
  }
  return map[port] ?? 'unknown'
}

export type { NormalizedObservation }
