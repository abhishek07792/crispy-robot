import type { RiskTier, Confidence, VerificationStatus } from '../types'

const TIER_CONFIG: Record<RiskTier, { cls: string; label: string; dot: string }> = {
  CRITICAL:           { cls: 'badge-critical', label: 'Critical',          dot: 'bg-critical' },
  HIGH:               { cls: 'badge-high',     label: 'High',              dot: 'bg-high' },
  MEDIUM:             { cls: 'badge-medium',   label: 'Medium',            dot: 'bg-medium' },
  LOW:                { cls: 'badge-low',       label: 'Low',               dot: 'bg-low' },
  INFORMATIONAL:      { cls: 'badge-info',     label: 'Info',              dot: 'bg-info' },
  NEEDS_VERIFICATION: { cls: 'badge-verify',   label: 'Needs Verification', dot: 'bg-verify' },
}

const CONF_CONFIG: Record<Confidence, { cls: string; label: string }> = {
  HIGH:   { cls: 'text-low bg-low/10 border border-low/20 px-2 py-0.5 rounded text-xs font-medium',   label: 'High Conf.' },
  MEDIUM: { cls: 'text-medium bg-medium/10 border border-medium/20 px-2 py-0.5 rounded text-xs font-medium', label: 'Med. Conf.' },
  LOW:    { cls: 'text-verify bg-verify/10 border border-verify/20 px-2 py-0.5 rounded text-xs font-medium', label: 'Low Conf.' },
}

const VER_CONFIG: Record<VerificationStatus, { cls: string; label: string }> = {
  CONFIRMED: { cls: 'text-low',     label: 'Confirmed' },
  LIKELY:     { cls: 'text-medium',  label: 'Likely' },
  POTENTIAL:  { cls: 'text-high',   label: 'Potential' },
  UNVERIFIED: { cls: 'text-verify', label: 'Unverified' },
}

export function RiskBadge({ tier }: { tier: RiskTier }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.INFORMATIONAL
  return (
    <span className={cfg.cls}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const cfg = CONF_CONFIG[level] ?? CONF_CONFIG.LOW
  return <span className={cfg.cls}>{cfg.label}</span>
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const cfg = VER_CONFIG[status] ?? VER_CONFIG.UNVERIFIED
  return <span className={`text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}
