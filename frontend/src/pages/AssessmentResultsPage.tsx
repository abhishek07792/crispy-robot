import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { assessmentsApi } from '../api/endpoints'
import { RiskBadge, ConfidenceBadge, VerificationBadge } from '../components/RiskBadge'
import type { Assessment, Finding, RiskTier, Confidence, VerificationStatus } from '../types'
import { ArrowLeft, FileText, RefreshCw, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

type FilterState = { protocol: string; tier: string; confidence: string; verification: string; search: string }

const RISK_TIERS: RiskTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'NEEDS_VERIFICATION']
const CONFIDENCES: Confidence[] = ['HIGH', 'MEDIUM', 'LOW']
const VERIFICATIONS: VerificationStatus[] = ['CONFIRMED', 'LIKELY', 'POTENTIAL', 'UNVERIFIED']

function StatusBadge({ status }: { status: Assessment['status'] }) {
  const cls: Record<string, string> = {
    PENDING: 'text-medium bg-medium/10', IN_PROGRESS: 'text-accent-400 bg-accent-500/10',
    COMPLETED: 'text-low bg-low/10', PARTIAL: 'text-high bg-high/10', FAILED: 'text-critical bg-critical/10',
  }
  return <span className={`text-xs px-2.5 py-1 rounded font-medium ${cls[status] ?? ''}`}>{status}</span>
}

export default function AssessmentResultsPage() {
  const { id } = useParams<{ id: string }>()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [findingsLoading, setFindingsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({ protocol: '', tier: '', confidence: '', verification: '', search: '' })

  const PER_PAGE = 20

  const loadAssessment = useCallback(() => {
    if (!id) return
    assessmentsApi.get(id).then(r => setAssessment(r.data.assessment)).catch(() => setError('Assessment not found or access denied.'))
  }, [id])

  const loadFindings = useCallback(() => {
    if (!id) return
    setFindingsLoading(true)
    const params: Record<string, string> = { page: String(page), limit: String(PER_PAGE) }
    if (filters.protocol) params.protocol = filters.protocol
    if (filters.tier) params.risk_tier = filters.tier
    if (filters.confidence) params.confidence = filters.confidence
    if (filters.verification) params.verification_status = filters.verification
    if (filters.search) params.search = filters.search
    assessmentsApi.getFindings(id, params)
      .then(r => { setFindings(r.data.findings); setTotal(r.data.total) })
      .catch(() => setError('Failed to load findings.'))
      .finally(() => setFindingsLoading(false))
  }, [id, page, filters])

  useEffect(() => { setLoading(true); loadAssessment(); setLoading(false) }, [loadAssessment])
  useEffect(() => { loadFindings() }, [loadFindings])

  // Auto-refresh for in-progress
  useEffect(() => {
    if (!assessment || !['PENDING', 'IN_PROGRESS'].includes(assessment.status)) return
    const t = setInterval(() => { loadAssessment(); loadFindings() }, 4000)
    return () => clearInterval(t)
  }, [assessment, loadAssessment, loadFindings])

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>
  if (error) return <div className="glass-card p-8 text-center max-w-md mx-auto"><AlertTriangle className="w-8 h-8 text-critical mx-auto mb-2" /><p className="text-white font-semibold">{error}</p></div>

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link to="/assessments" className="p-2 rounded-lg hover:bg-navy-800 text-navy-400 hover:text-white transition-all mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono">{assessment?.target}</h1>
            {assessment && <StatusBadge status={assessment.status} />}
            {['PENDING', 'IN_PROGRESS'].includes(assessment?.status ?? '') && (
              <span className="flex items-center gap-1.5 text-xs text-accent-400"><RefreshCw className="w-3 h-3 animate-spin" /> Live</span>
            )}
          </div>
          {assessment && (
            <p className="text-xs text-navy-400 mt-1">
              Started {format(new Date(assessment.started_at), 'dd MMM yyyy HH:mm')}
              {assessment.completed_at && ` · Completed ${format(new Date(assessment.completed_at), 'HH:mm')}`}
            </p>
          )}
        </div>
        {assessment?.status === 'COMPLETED' && (
          <Link to={`/assessments/${id}/report`} className="btn-secondary text-sm py-2">
            <FileText className="w-4 h-4" /> Report
          </Link>
        )}
      </div>

      {/* Summary tiles */}
      {assessment && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { tier: 'CRITICAL' as RiskTier, count: assessment.finding_counts.critical },
            { tier: 'HIGH' as RiskTier, count: assessment.finding_counts.high },
            { tier: 'MEDIUM' as RiskTier, count: assessment.finding_counts.medium },
            { tier: 'LOW' as RiskTier, count: assessment.finding_counts.low },
            { tier: 'INFORMATIONAL' as RiskTier, count: assessment.finding_counts.info },
            { tier: 'NEEDS_VERIFICATION' as RiskTier, count: assessment.finding_counts.verify },
          ].map(({ tier, count }) => (
            <div key={tier} className="glass-card p-3 text-center">
              <p className="text-2xl font-bold text-white">{count}</p>
              <RiskBadge tier={tier} />
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {assessment?.error_summary && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-critical/10 border border-critical/20 text-sm text-critical">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {assessment.error_summary}
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <input placeholder="Search findings…" value={filters.search}
          onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
          className="input-field max-w-xs text-sm py-2" />
        {[
          { key: 'tier', label: 'Risk Tier', opts: RISK_TIERS.map(t => ({ v: t, l: t.replace('_', ' ') })) },
          { key: 'protocol', label: 'Protocol', opts: ['ftp', 'redis', 'mongodb', 'smb', 'smtp'].map(t => ({ v: t, l: t.toUpperCase() })) },
          { key: 'confidence', label: 'Confidence', opts: CONFIDENCES.map(c => ({ v: c, l: c })) },
          { key: 'verification', label: 'Status', opts: VERIFICATIONS.map(v => ({ v, l: v })) },
        ].map(f => (
          <select key={f.key} value={(filters as Record<string, string>)[f.key]}
            onChange={e => { setFilters(prev => ({ ...prev, [f.key]: e.target.value })); setPage(1) }}
            className="input-field max-w-[160px] text-sm py-2">
            <option value="">{f.label}: All</option>
            {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
      </div>

      {/* Findings table */}
      <div className="glass-card overflow-hidden">
        {findingsLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full" /></div>
        ) : findings.length === 0 ? (
          <div className="text-center py-14 text-navy-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-navy-600" />
            <p className="text-sm">{assessment?.status === 'COMPLETED' ? 'No findings match the current filters.' : 'Analysis in progress…'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Finding</th><th>Asset / Port</th><th>Protocol</th><th>Risk</th><th>Confidence</th><th>Verification</th><th>CVEs</th><th /></tr></thead>
            <tbody>
              {findings.map(f => (
                <tr key={f.id}>
                  <td className="max-w-xs"><span className="block truncate text-sm text-white">{f.finding_type.replace(/_/g, ' ')}</span></td>
                  <td><span className="font-mono text-xs">{f.asset_identifier ?? '—'}:{f.port}</span></td>
                  <td><span className="text-xs text-navy-300">{f.service_type?.toUpperCase()}</span></td>
                  <td><RiskBadge tier={f.risk_tier} /></td>
                  <td><ConfidenceBadge level={f.confidence} /></td>
                  <td><VerificationBadge status={f.verification_status} /></td>
                  <td>{f.cve_ids?.length ? <span className="badge-critical">{f.cve_ids.length} CVE{f.cve_ids.length > 1 ? 's' : ''}</span> : <span className="text-navy-500 text-xs">—</span>}</td>
                  <td><Link to={`/findings/${f.id}`} className="text-accent-400 hover:text-accent-300 text-xs transition-colors">Details →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Pagination */}
        {total > PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-navy-700/30">
            <p className="text-xs text-navy-400">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">Prev</button>
              <button disabled={page * PER_PAGE >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
