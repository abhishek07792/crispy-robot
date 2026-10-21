import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts'
import { dashboardApi } from '../api/endpoints'
import { RiskBadge } from '../components/RiskBadge'
import type { DashboardSummary, Assessment, RiskTier } from '../types'
import {
  Shield, Activity, Search, AlertTriangle, Plus, ArrowRight, Server
} from 'lucide-react'
import { format } from 'date-fns'

const TIER_COLORS: Record<string, string> = {
  CRITICAL: '#FF2D55', HIGH: '#FF6B35', MEDIUM: '#FFB800',
  LOW: '#34C759', INFORMATIONAL: '#007AFF', NEEDS_VERIFICATION: '#AF52DE',
}

function StatCard({ icon: Icon, label, value, accent = false }: { icon: React.ElementType; label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="stat-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-accent-500/20' : 'bg-navy-700/60'}`}>
        <Icon className={`w-4 h-4 ${accent ? 'text-accent-400' : 'text-navy-400'}`} />
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-navy-400">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: Assessment['status'] }) {
  const cls: Record<string, string> = {
    PENDING: 'text-medium bg-medium/10 border-medium/20',
    IN_PROGRESS: 'text-accent-400 bg-accent-500/10 border-accent-500/20',
    COMPLETED: 'text-low bg-low/10 border-low/20',
    PARTIAL: 'text-high bg-high/10 border-high/20',
    FAILED: 'text-critical bg-critical/10 border-critical/20',
  }
  return <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls[status] ?? cls.FAILED}`}>{status}</span>
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dashboardApi.getSummary()
      .then(r => setSummary(r.data))
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="glass-card p-8 text-center max-w-md">
        <AlertTriangle className="w-10 h-10 text-critical mx-auto mb-3" />
        <p className="font-semibold text-white">{error}</p>
        <p className="text-sm text-navy-400 mt-1">Check that the backend is running and you are logged in.</p>
      </div>
    </div>
  )

  if (!summary) return null

  const tierData = Object.entries(summary.findings_by_tier).map(([k, v]) => ({ name: k.replace('_', ' '), value: v, color: TIER_COLORS[k] })).filter(d => d.value > 0)
  const protocolData = Object.entries(summary.findings_by_protocol).map(([k, v]) => ({ name: k.toUpperCase(), value: v }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-navy-400 mt-0.5">Assessment overview and risk summary</p>
        </div>
        <Link to="/assessments/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Assessment
        </Link>
      </div>

      {/* Demo banner */}
      {summary.demo_mode && (
        <div className="demo-banner">
          <AlertTriangle className="w-4 h-4" />
          <span><strong>Demo Mode</strong> — Sample data shown. Add SHODAN_API_KEY and NVD_API_KEY to enable live assessments.</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Assets Observed" value={summary.total_assets} accent />
        <StatCard icon={Shield} label="Total Assessments" value={summary.total_assessments} />
        <StatCard icon={Activity} label="Total Findings" value={summary.total_findings} />
        <StatCard icon={Search} label="Needs Verification" value={summary.needs_verification} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Findings by tier */}
        <div className="glass-card p-5">
          <h2 className="section-header mb-4">Findings by Risk Tier</h2>
          {tierData.length === 0 ? (
            <div className="text-center py-10 text-navy-400 text-sm">No findings yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={tierData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {tierData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#0A1929', border: '1px solid #122845', borderRadius: 8, color: '#fff', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {tierData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-navy-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}: <span className="text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Findings by protocol */}
        <div className="glass-card p-5">
          <h2 className="section-header mb-4">Findings by Protocol</h2>
          {protocolData.length === 0 ? (
            <div className="text-center py-10 text-navy-400 text-sm">No protocol findings yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={protocolData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#122845" />
                <XAxis dataKey="name" tick={{ fill: '#4A6080', fontSize: 11 }} />
                <YAxis tick={{ fill: '#4A6080', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0A1929', border: '1px solid #122845', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                <Bar dataKey="value" fill="#0099D6" radius={[4, 4, 0, 0]} name="Findings" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Trend */}
      {summary.trend && summary.trend.length > 1 && (
        <div className="glass-card p-5">
          <h2 className="section-header mb-4">Finding Trend (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={summary.trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#122845" />
              <XAxis dataKey="date" tick={{ fill: '#4A6080', fontSize: 10 }} />
              <YAxis tick={{ fill: '#4A6080', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0A1929', border: '1px solid #122845', borderRadius: 8, color: '#fff', fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke="#0099D6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Findings" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent assessments */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header">Recent Assessments</h2>
          <Link to="/assessments" className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {summary.recent_assessments.length === 0 ? (
          <div className="text-center py-10">
            <Shield className="w-8 h-8 text-navy-600 mx-auto mb-2" />
            <p className="text-navy-400 text-sm">No assessments yet.</p>
            <Link to="/assessments/new" className="text-accent-400 text-sm hover:text-accent-300 mt-1 inline-block">Start your first assessment →</Link>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Target</th><th>Status</th><th>Findings</th><th>Date</th><th /></tr></thead>
            <tbody>
              {summary.recent_assessments.map(a => (
                <tr key={a.id}>
                  <td><span className="font-mono text-sm">{a.target}</span></td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {a.finding_counts.critical > 0 && <span className="badge-critical">{a.finding_counts.critical}</span>}
                      {a.finding_counts.high > 0 && <span className="badge-high">{a.finding_counts.high}</span>}
                      {a.finding_counts.medium > 0 && <span className="badge-medium">{a.finding_counts.medium}</span>}
                      {a.finding_counts.total === 0 && <span className="text-navy-500 text-xs">None</span>}
                    </div>
                  </td>
                  <td className="text-navy-400 text-xs">{format(new Date(a.started_at), 'dd MMM yyyy HH:mm')}</td>
                  <td>
                    <Link to={`/assessments/${a.id}`} className="text-accent-400 hover:text-accent-300 text-xs flex items-center gap-1 transition-colors">
                      Open <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
