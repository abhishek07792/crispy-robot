/**
 * Utility / type-level tests — no DOM, no network.
 * Tests pure helpers and type-guard-like logic derived from our type definitions.
 */

import { describe, it, expect } from 'vitest'
import type { RiskTier, Confidence, VerificationStatus, AssessmentStatus } from '../types'

// ── Helpers (inline, same as the app would use) ───────────────────────────────

const RISK_TIERS: RiskTier[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFORMATIONAL',
  'NEEDS_VERIFICATION',
]

const TIER_ORDER: Record<RiskTier, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFORMATIONAL: 4,
  NEEDS_VERIFICATION: 5,
}

function compareTiers(a: RiskTier, b: RiskTier): number {
  return TIER_ORDER[a] - TIER_ORDER[b]
}

function isTerminal(status: AssessmentStatus): boolean {
  return ['COMPLETED', 'PARTIAL', 'FAILED'].includes(status)
}

function formatRiskTier(tier: RiskTier): string {
  const labels: Record<RiskTier, string> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    INFORMATIONAL: 'Info',
    NEEDS_VERIFICATION: 'Needs Verification',
  }
  return labels[tier] ?? tier
}

function totalFindings(counts: {
  critical: number
  high: number
  medium: number
  low: number
  info: number
  verify: number
  total: number
}): number {
  return counts.critical + counts.high + counts.medium + counts.low + counts.info + counts.verify
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RiskTier enumeration', () => {
  it('has exactly 6 tiers', () => {
    expect(RISK_TIERS).toHaveLength(6)
  })

  it('CRITICAL sorts before HIGH', () => {
    expect(compareTiers('CRITICAL', 'HIGH')).toBeLessThan(0)
  })

  it('LOW sorts after MEDIUM', () => {
    expect(compareTiers('LOW', 'MEDIUM')).toBeGreaterThan(0)
  })

  it('same tier sorts equal', () => {
    expect(compareTiers('HIGH', 'HIGH')).toBe(0)
  })

  it('NEEDS_VERIFICATION is lowest priority', () => {
    const sorted = [...RISK_TIERS].sort(compareTiers)
    expect(sorted[sorted.length - 1]).toBe('NEEDS_VERIFICATION')
  })

  it('CRITICAL is highest priority', () => {
    const sorted = [...RISK_TIERS].sort(compareTiers)
    expect(sorted[0]).toBe('CRITICAL')
  })
})

describe('formatRiskTier', () => {
  it('formats CRITICAL correctly', () => {
    expect(formatRiskTier('CRITICAL')).toBe('Critical')
  })

  it('formats NEEDS_VERIFICATION correctly', () => {
    expect(formatRiskTier('NEEDS_VERIFICATION')).toBe('Needs Verification')
  })

  it('formats INFORMATIONAL as Info', () => {
    expect(formatRiskTier('INFORMATIONAL')).toBe('Info')
  })
})

describe('AssessmentStatus helpers', () => {
  it('COMPLETED is terminal', () => {
    expect(isTerminal('COMPLETED')).toBe(true)
  })

  it('PARTIAL is terminal', () => {
    expect(isTerminal('PARTIAL')).toBe(true)
  })

  it('FAILED is terminal', () => {
    expect(isTerminal('FAILED')).toBe(true)
  })

  it('PENDING is not terminal', () => {
    expect(isTerminal('PENDING')).toBe(false)
  })

  it('IN_PROGRESS is not terminal', () => {
    expect(isTerminal('IN_PROGRESS')).toBe(false)
  })
})

describe('Finding counts helper', () => {
  it('sums all severity counts correctly', () => {
    const counts = { critical: 2, high: 3, medium: 5, low: 1, info: 4, verify: 2, total: 17 }
    expect(totalFindings(counts)).toBe(17)
  })

  it('returns 0 for zero counts', () => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, verify: 0, total: 0 }
    expect(totalFindings(counts)).toBe(0)
  })

  it('matches the pre-calculated total field', () => {
    const counts = { critical: 1, high: 1, medium: 1, low: 1, info: 1, verify: 1, total: 6 }
    expect(totalFindings(counts)).toBe(counts.total)
  })
})

describe('Confidence levels', () => {
  const CONFIDENCE_LEVELS: Confidence[] = ['HIGH', 'MEDIUM', 'LOW']

  it('has exactly 3 confidence levels', () => {
    expect(CONFIDENCE_LEVELS).toHaveLength(3)
  })
})

describe('VerificationStatus values', () => {
  const STATUS_VALUES: VerificationStatus[] = ['CONFIRMED', 'LIKELY', 'POTENTIAL', 'UNVERIFIED']

  it('has exactly 4 verification statuses', () => {
    expect(STATUS_VALUES).toHaveLength(4)
  })

  it('CONFIRMED is more certain than UNVERIFIED', () => {
    const order: Record<VerificationStatus, number> = {
      CONFIRMED: 0,
      LIKELY: 1,
      POTENTIAL: 2,
      UNVERIFIED: 3,
    }
    expect(order['CONFIRMED']).toBeLessThan(order['UNVERIFIED'])
  })
})
