import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { assessmentsApi } from '../api/endpoints'
import { RiskBadge } from '../components/RiskBadge'
import type { Assessment, RiskTier } from '../types'
import { Plus, ArrowRight, AlertTriangle, History, Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

function StatusBadge({ status }: { status: Assessment['status'] }) {
  const cls: Record<string, string> = {
    PENDING: 'text-medium bg-medium/10', IN_PROGRESS: 'text-accent-400 bg-accent-500/10',
    COMPLETED: 'text-low bg-low/10', PARTIAL: 'text-high bg-high/10', FAILED: 'text-critical bg-critical/10',
  }
  return <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls[status] ?? ''} border-current/20`}>{status}</span>
}

type SortKey = 'started_at' | 'target' | 'status'

export default function AssessmentHistoryPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('started_at')

  useEffect(() => {
    setLoading(true)
    assessmentsApi.list(page, 20)
      .then(r => { setAssessments(r.data.assessments); setTotal(r.data.total) })
      .catch(() => setError('Failed to load assessments.'))
      .finally(() => setLoading(false))
  }, [page])

  const sorted = [...assessments].sort((a, b) => {
    if (sort === 'started_at') return new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    if (sort === 'target') return a.target.localeCompare(b.target)
    return a.status.localeCompare(b.status)
  })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><History className="w-6 h-6 text-accent-400" /> Assessment History</h1>
          <p className="text-sm text-navy-400 mt-0.5">{total} assessment{total !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/assessments/new" className="btn-primary"><Plus className="w-4 h-4" /> New Assessment</Link>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-navy-400">Sort by:</span>
        {(['started_at', 'target', 'status'] as SortKey[]).map(s => (
          <button key={s} onClick={() => setSort(s)}
            className={`text-xs px-3 py-1 rounded-full transition-all ${sort === s ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30' : 'text-navy-400 hover:text-navy-200'}`}>
            {s === 'started_at' ? 'Date' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center"><div className="animate-spin w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>
      ) : error ? (
        <div className="glass-card p-8 text-center"><AlertTriangle className="w-8 h-8 text-critical mx-auto mb-2" /><p className="text-white">{error}</p></div>
      ) : assessments.length === 0 ? (
        <div className="glass-card p-14 text-center">
          <History className="w-10 h-10 text-navy-600 mx-auto mb-3" />
          <p className="text-navy-300 font-medium">No assessments yet</p>
          <p className="text-navy-500 text-sm mt-1">Start your first assessment to see results here.</p>
          <Link to="/assessments/new" className="btn-primary mt-5 inline-flex"><Plus className="w-4 h-4" /> Start Assessment</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(a => (
            <div key={a.id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="font-mono text-white font-medium">{a.target}</span>
                    <StatusBadge status={a.status} />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-navy-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(a.started_at), { addSuffix: true })}</span>
                    <span>{format(new Date(a.started_at), 'dd MMM yyyy HH:mm')}</span>
                    {a.asset_count > 0 && <span>{a.asset_count} asset{a.asset_count > 1 ? 's' : ''}</span>}
                  </div>

                  {/* Findings breakdown */}
                  {a.finding_counts.total > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {((['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'NEEDS_VERIFICATION'] as RiskTier[])).map(tier => {
                        const cnt = {
                          CRITICAL: a.finding_counts.critical, HIGH: a.finding_counts.high,
                          MEDIUM: a.finding_counts.medium, LOW: a.finding_counts.low,
                          INFORMATIONAL: a.finding_counts.info, NEEDS_VERIFICATION: a.finding_counts.verify
                        }[tier]
                        if (!cnt) return null
                        return <div key={tier} className="flex items-center gap-1"><RiskBadge tier={tier} /><span className="text-xs text-navy-300">{cnt}</span></div>
                      })}
                    </div>
                  )}
                  {a.error_summary && <p className="text-xs text-critical mt-1.5 truncate">{a.error_summary}</p>}
                </div>

                <Link to={`/assessments/${a.id}`} className="flex-shrink-0 flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 transition-colors">
                  Open <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-navy-400">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">Previous</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
