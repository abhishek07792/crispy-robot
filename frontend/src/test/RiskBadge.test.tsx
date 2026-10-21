/**
 * Component tests for RiskBadge, ConfidenceBadge, VerificationBadge.
 * Uses @testing-library/react + jsdom (configured in vite.config.ts).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskBadge, ConfidenceBadge, VerificationBadge } from '../components/RiskBadge'
import type { RiskTier, Confidence, VerificationStatus } from '../types'

// ── RiskBadge ─────────────────────────────────────────────────────────────────

describe('RiskBadge', () => {
  const cases: { tier: RiskTier; expectedLabel: string }[] = [
    { tier: 'CRITICAL',           expectedLabel: 'Critical' },
    { tier: 'HIGH',               expectedLabel: 'High' },
    { tier: 'MEDIUM',             expectedLabel: 'Medium' },
    { tier: 'LOW',                expectedLabel: 'Low' },
    { tier: 'INFORMATIONAL',      expectedLabel: 'Info' },
    { tier: 'NEEDS_VERIFICATION', expectedLabel: 'Needs Verification' },
  ]

  it.each(cases)('renders "$expectedLabel" for tier $tier', ({ tier, expectedLabel }) => {
    render(<RiskBadge tier={tier} />)
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  it('renders a span element', () => {
    const { container } = render(<RiskBadge tier="CRITICAL" />)
    expect(container.querySelector('span')).toBeInTheDocument()
  })

  it('includes a colored dot inside the badge', () => {
    const { container } = render(<RiskBadge tier="HIGH" />)
    // The inner dot span should have a rounded-full class
    const dot = container.querySelector('span > span')
    expect(dot).toBeInTheDocument()
    expect(dot?.className).toContain('rounded-full')
  })
})

// ── ConfidenceBadge ───────────────────────────────────────────────────────────

describe('ConfidenceBadge', () => {
  const cases: { level: Confidence; expectedLabel: string }[] = [
    { level: 'HIGH',   expectedLabel: 'High Conf.' },
    { level: 'MEDIUM', expectedLabel: 'Med. Conf.' },
    { level: 'LOW',    expectedLabel: 'Low Conf.' },
  ]

  it.each(cases)('renders "$expectedLabel" for level $level', ({ level, expectedLabel }) => {
    render(<ConfidenceBadge level={level} />)
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  it('renders as a span', () => {
    const { container } = render(<ConfidenceBadge level="HIGH" />)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })
})

// ── VerificationBadge ─────────────────────────────────────────────────────────

describe('VerificationBadge', () => {
  const cases: { status: VerificationStatus; expectedLabel: string }[] = [
    { status: 'CONFIRMED',  expectedLabel: 'Confirmed' },
    { status: 'LIKELY',     expectedLabel: 'Likely' },
    { status: 'POTENTIAL',  expectedLabel: 'Potential' },
    { status: 'UNVERIFIED', expectedLabel: 'Unverified' },
  ]

  it.each(cases)('renders "$expectedLabel" for status $status', ({ status, expectedLabel }) => {
    render(<VerificationBadge status={status} />)
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  it('applies text-xs class for small display', () => {
    const { container } = render(<VerificationBadge status="CONFIRMED" />)
    expect(container.firstChild).toHaveClass('text-xs')
  })

  it('applies font-medium class', () => {
    const { container } = render(<VerificationBadge status="UNVERIFIED" />)
    expect(container.firstChild).toHaveClass('font-medium')
  })
})
