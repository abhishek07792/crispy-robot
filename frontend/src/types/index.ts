// ---- Enums ----
export type RiskTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' | 'NEEDS_VERIFICATION'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type VerificationStatus = 'CONFIRMED' | 'LIKELY' | 'POTENTIAL' | 'UNVERIFIED'
export type AssessmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'FAILED'

// ---- Entities ----
export interface Assessment {
  id: string
  user_id: string
  target: string
  status: AssessmentStatus
  started_at: string
  completed_at: string | null
  error_summary: string | null
  finding_counts: { critical: number; high: number; medium: number; low: number; info: number; verify: number; total: number }
  asset_count: number
  created_at: string
}

export interface Asset {
  id: string
  canonical_identifier: string
  first_seen_at: string
  last_seen_at: string
}

export interface ServiceObservation {
  id: string
  assessment_id: string
  asset_id: string
  port: number
  service_type: string
  product: string | null
  version: string | null
  source: string
  observed_at: string
}

export interface Finding {
  id: string
  observation_id: string
  finding_type: string
  severity: RiskTier
  confidence: Confidence
  risk_tier: RiskTier
  verification_status: VerificationStatus
  rule_version: string
  created_at: string
  // joined fields
  asset_identifier?: string
  port?: number
  service_type?: string
  product?: string
  version?: string
  cve_ids?: string[]
}

export interface FindingDetail extends Finding {
  evidence: Record<string, unknown>
  rationale: string
  remediation: string
  cves: CVERecord[]
  match_rationale: Record<string, string>
  observation: ServiceObservation
}

export interface CVERecord {
  cve_id: string
  description: string
  cvss_score: number | null
  cvss_vector: string | null
  cvss_version: string | null
  affected_criteria: unknown[]
  source_updated_at: string
}

// ---- Dashboard ----
export interface DashboardSummary {
  demo_mode: boolean
  total_assets: number
  total_assessments: number
  total_findings: number
  findings_by_tier: Record<RiskTier, number>
  findings_by_protocol: Record<string, number>
  cve_findings: number
  needs_verification: number
  recent_assessments: Assessment[]
  trend: { date: string; total: number }[]
}

export interface AssessmentSummary {
  assessment: Assessment
  assets: Asset[]
  service_observations: ServiceObservation[]
  findings: FindingDetail[]
  generated_at: string
}
