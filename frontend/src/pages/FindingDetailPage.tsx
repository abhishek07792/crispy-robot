import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { findingsApi } from '../api/endpoints'
import { RiskBadge, ConfidenceBadge, VerificationBadge } from '../components/RiskBadge'
import type { FindingDetail } from '../types'
import { ArrowLeft, AlertTriangle, ShieldAlert, Info, Wrench, BookOpen } from 'lucide-react'
import { format } from 'date-fns'

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-navy-700/40">
        <Icon className="w-4 h-4 text-accent-400" />
        <h2 className="font-semibold text-white text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [finding, setFinding] = useState<FindingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    findingsApi.get(id)
      .then(r => setFinding(r.data.finding))
      .catch(() => setError('Finding not found or access denied.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>
  if (error || !finding) return <div className="glass-card p-8 text-center max-w-md mx-auto"><AlertTriangle className="w-8 h-8 text-critical mx-auto mb-2" /><p className="text-white font-semibold">{error ?? 'Not found'}</p></div>

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Back */}
      <Link to={`/assessments/${finding.observation?.assessment_id}`} className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to assessment
      </Link>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-critical/15 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-critical" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white mb-1">{finding.finding_type.replace(/_/g, ' ')}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <RiskBadge tier={finding.risk_tier} />
              <ConfidenceBadge level={finding.confidence} />
              <VerificationBadge status={finding.verification_status} />
              <span className="text-xs text-navy-500">Rule: {finding.rule_version}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-navy-400">Asset</span><p className="font-mono text-white">{finding.observation?.asset_id ?? '—'}</p></div>
              <div><span className="text-navy-400">Port / Service</span><p className="font-mono text-white">{finding.observation?.port} / {finding.service_type}</p></div>
              {finding.product && <div><span className="text-navy-400">Product</span><p className="font-mono text-white">{finding.product} {finding.version}</p></div>}
              <div><span className="text-navy-400">Observed</span><p className="text-white">{finding.observation?.observed_at ? format(new Date(finding.observation.observed_at), 'dd MMM yyyy HH:mm') : '—'}</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence */}
      <Section icon={BookOpen} title="Supporting Evidence">
        <pre className="bg-navy-900/80 rounded-lg p-4 text-xs font-mono text-navy-200 overflow-auto max-h-48 whitespace-pre-wrap break-all">
          {JSON.stringify(finding.evidence, null, 2)}
        </pre>
        <p className="mt-3 text-sm text-navy-300 leading-relaxed">{finding.rationale}</p>
      </Section>

      {/* What this does NOT prove */}
      <Section icon={Info} title="Limitations — What This Finding Does NOT Prove">
        <div className="space-y-2 text-sm text-navy-300">
          <div className="flex items-start gap-2"><span className="text-medium mt-0.5">⚠</span><span>This finding is based on passively observed Shodan data. It does not represent a live active scan of the target.</span></div>
          <div className="flex items-start gap-2"><span className="text-medium mt-0.5">⚠</span><span>A matched CVE does not confirm the service is unpatched, exploitable, or successfully compromised.</span></div>
          {finding.verification_status !== 'CONFIRMED' && (
            <div className="flex items-start gap-2"><span className="text-medium mt-0.5">⚠</span><span>This finding is classified as <strong className="text-white">{finding.verification_status}</strong> — it requires independent verification before being treated as confirmed.</span></div>
          )}
          <div className="flex items-start gap-2"><span className="text-medium mt-0.5">⚠</span><span>Shodan observations may be stale. The service configuration may have changed since the index was recorded.</span></div>
        </div>
      </Section>

      {/* CVEs */}
      {finding.cves.length > 0 && (
        <Section icon={AlertTriangle} title={`Matched CVEs (${finding.cves.length})`}>
          <div className="space-y-3">
            {finding.cves.map(cve => (
              <div key={cve.cve_id} className="p-3 rounded-lg bg-navy-900/60 border border-navy-700/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="badge-critical font-mono">{cve.cve_id}</span>
                  {cve.cvss_score && <span className="text-sm font-bold text-critical">CVSS {cve.cvss_score.toFixed(1)}</span>}
                </div>
                <p className="text-xs text-navy-300 mb-1.5">{cve.description}</p>
                {finding.match_rationale[cve.cve_id] && (
                  <p className="text-xs text-accent-400 italic">Match rationale: {finding.match_rationale[cve.cve_id]}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Remediation */}
      <Section icon={Wrench} title="Recommended Remediation">
        <div className="text-sm text-navy-200 leading-relaxed whitespace-pre-line">{finding.remediation}</div>
      </Section>

      <p className="text-xs text-navy-500 text-center pb-4">Finding ID: {finding.id} · Created {format(new Date(finding.created_at), 'dd MMM yyyy HH:mm')}</p>
    </div>
  )
}
