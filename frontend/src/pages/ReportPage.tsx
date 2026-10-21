import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { assessmentsApi } from '../api/endpoints'
import { RiskBadge, ConfidenceBadge } from '../components/RiskBadge'
import type { AssessmentSummary } from '../types'
import { ArrowLeft, Download, FileText, AlertTriangle, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

export default function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<AssessmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    assessmentsApi.getReport(id)
      .then(r => setReport(r.data))
      .catch(() => setError('Failed to load report. The assessment may not be complete.'))
      .finally(() => setLoading(false))
  }, [id])

  const downloadPDF = async () => {
    if (!id) return
    setDownloading(true)
    try {
      const res = await assessmentsApi.downloadReport(id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `vapt-report-${id.slice(0,8)}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('PDF download failed. Try saving the page or exporting manually.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>
  if (error || !report) return <div className="glass-card p-8 text-center max-w-md mx-auto"><AlertTriangle className="w-8 h-8 text-critical mx-auto mb-2" /><p className="text-white font-semibold">{error ?? 'Report unavailable'}</p></div>

  const a = report.assessment
  const cveFindings = report.findings.filter(f => f.cves?.length > 0)
  const configFindings = report.findings.filter(f => !f.cves || f.cves.length === 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to={`/assessments/${id}`} className="p-2 rounded-lg hover:bg-navy-800 text-navy-400 hover:text-white transition-all mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <FileText className="w-5 h-5 text-accent-400" />
              <h1 className="text-2xl font-bold text-white">Assessment Report</h1>
            </div>
            <p className="text-sm text-navy-400">Generated {format(new Date(report.generated_at), 'dd MMM yyyy HH:mm')}</p>
          </div>
        </div>
        <button onClick={downloadPDF} disabled={downloading} className="btn-primary">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {/* Cover */}
      <div className="glass-card p-7">
        <h2 className="text-xl font-bold text-white mb-4">Executive Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
          <div><p className="text-xs text-navy-400 mb-0.5">Target</p><p className="font-mono text-white font-medium">{a.target}</p></div>
          <div><p className="text-xs text-navy-400 mb-0.5">Assessment ID</p><p className="font-mono text-white text-xs">{a.id}</p></div>
          <div><p className="text-xs text-navy-400 mb-0.5">Started</p><p className="text-white text-sm">{format(new Date(a.started_at), 'dd MMM yyyy')}</p></div>
          <div><p className="text-xs text-navy-400 mb-0.5">Status</p><p className="text-white font-medium">{a.status}</p></div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Critical', val: a.finding_counts.critical, cls: 'text-critical' },
            { label: 'High', val: a.finding_counts.high, cls: 'text-high' },
            { label: 'Medium', val: a.finding_counts.medium, cls: 'text-medium' },
            { label: 'Low', val: a.finding_counts.low, cls: 'text-low' },
            { label: 'Info', val: a.finding_counts.info, cls: 'text-info' },
            { label: 'Verify', val: a.finding_counts.verify, cls: 'text-verify' },
          ].map(t => (
            <div key={t.label} className="text-center p-3 rounded-lg bg-navy-800/50">
              <p className={`text-2xl font-bold ${t.cls}`}>{t.val}</p>
              <p className="text-xs text-navy-400">{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-3">Data Sources</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {['Shodan (indexed observations)', 'NVD CVE API', 'Rule-based protocol detectors'].map(s => (
            <span key={s} className="px-2.5 py-1 rounded bg-navy-800 border border-navy-600/50 text-navy-300">{s}</span>
          ))}
        </div>
        <p className="text-xs text-navy-500 mt-3 italic">Note: Shodan data reflects previously indexed observations and may not reflect the current live state of the target.</p>
      </div>

      {/* Assets / services */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-3">Service Inventory ({report.service_observations.length})</h2>
        <table className="data-table">
          <thead><tr><th>Port</th><th>Service</th><th>Product / Version</th><th>Observed</th></tr></thead>
          <tbody>
            {report.service_observations.map(s => (
              <tr key={s.id}>
                <td className="font-mono">{s.port}</td>
                <td className="text-xs">{s.service_type?.toUpperCase()}</td>
                <td className="font-mono text-xs">{s.product ?? '—'} {s.version ?? ''}</td>
                <td className="text-xs text-navy-400">{s.observed_at ? format(new Date(s.observed_at), 'dd MMM yyyy') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CVE findings */}
      {cveFindings.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-3">CVE-Related Findings ({cveFindings.length})</h2>
          <div className="space-y-3">
            {cveFindings.map(f => (
              <div key={f.id} className="p-4 rounded-lg bg-navy-900/50 border border-navy-700/40">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <RiskBadge tier={f.risk_tier} />
                  <ConfidenceBadge level={f.confidence} />
                  <span className="text-sm font-medium text-white">{f.finding_type.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-navy-400 mb-2">Port {f.port} · {f.service_type?.toUpperCase()} · {f.product} {f.version}</p>
                {f.cves?.map(c => (
                  <div key={c.cve_id} className="text-xs flex items-start gap-2">
                    <span className="badge-critical shrink-0">{c.cve_id}</span>
                    <span className="text-navy-300">{c.description?.slice(0, 120)}…</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config findings */}
      {configFindings.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-3">Configuration Findings ({configFindings.length})</h2>
          <table className="data-table">
            <thead><tr><th>Finding</th><th>Risk</th><th>Confidence</th><th>Remediation</th></tr></thead>
            <tbody>
              {configFindings.map(f => (
                <tr key={f.id}>
                  <td className="text-sm">{f.finding_type.replace(/_/g, ' ')}</td>
                  <td><RiskBadge tier={f.risk_tier} /></td>
                  <td><ConfidenceBadge level={f.confidence} /></td>
                  <td className="text-xs text-navy-300 max-w-xs truncate">{f.remediation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Limitations */}
      <div className="glass-card p-5 border-l-4 border-l-medium">
        <h2 className="font-semibold text-white mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-medium" /> Report Limitations</h2>
        <ul className="space-y-1.5 text-xs text-navy-300 list-disc list-inside">
          <li>All data sourced from Shodan's indexed observations — not live active scans.</li>
          <li>CVE matches indicate potential applicability; patch status must be confirmed via authorized testing.</li>
          <li>Findings marked as POTENTIAL or UNVERIFIED require additional evidence before remediation prioritization.</li>
          <li>This report does not constitute proof of exploitation or system compromise.</li>
          <li>Service configurations may have changed since the observations were indexed.</li>
        </ul>
      </div>
    </div>
  )
}
