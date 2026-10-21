import { Link } from 'react-router-dom'
import {
  ShieldCheck, Search, Database, FileWarning, ArrowRight,
  CheckCircle, AlertTriangle, Globe, Lock, Terminal
} from 'lucide-react'

const features = [
  {
    icon: Search,
    title: 'Shodan Intelligence',
    desc: 'Correlate internet-facing service observations with indexed Shodan data — no active scanning required.',
  },
  {
    icon: Database,
    title: 'NVD CVE Matching',
    desc: 'Match observed products and versions against NVD records with CPE-aware version range evaluation.',
  },
  {
    icon: FileWarning,
    title: 'Protocol Detectors',
    desc: 'Modular, rule-based detectors for FTP, Redis, MongoDB, and more with explainable findings.',
  },
  {
    icon: ShieldCheck,
    title: 'Risk Scoring',
    desc: 'Deterministic tier-based scoring (CRITICAL → INFO) with confidence levels and verification status.',
  },
  {
    icon: Lock,
    title: 'Explainable Evidence',
    desc: 'Every finding shows what was detected, which rule fired, what it does NOT prove, and how to remediate.',
  },
  {
    icon: Terminal,
    title: 'Actionable Reports',
    desc: 'Export PDF/CSV reports with executive summaries, CVE details, and prioritized remediation steps.',
  },
]

const workflowSteps = [
  { n: '01', label: 'Sign In', desc: 'Create an account and access your private assessment workspace.' },
  { n: '02', label: 'Enter Target', desc: 'Input an authorized domain or IP. Confirm you have permission to assess it.' },
  { n: '03', label: 'Analysis', desc: 'The framework queries Shodan and NVD, normalizes observations, and runs protocol detectors.' },
  { n: '04', label: 'Review Findings', desc: 'Each finding includes evidence, scoring rationale, CVE matches, and remediation guidance.' },
  { n: '05', label: 'Export Report', desc: 'Generate a PDF report with executive summary plus full technical details.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-navy-950/80 backdrop-blur-md border-b border-navy-700/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent-400" />
            <span className="font-bold text-sm">VAPT Framework</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-navy-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">How It Works</a>
            <a href="#ethics" className="hover:text-white transition-colors">Ethics & Scope</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-navy-300 hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-critical/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-medium mb-6">
            <Globe className="w-3.5 h-3.5" /> Passive Intelligence · Evidence-Based · Explainable Risk
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Multi-Protocol Exposure<br />
            <span className="text-gradient">& Risk-Scoring Framework</span>
          </h1>

          <p className="text-xl text-navy-300 max-w-2xl mx-auto mb-10">
            Correlate Shodan observations, NVD CVE intelligence, and protocol-specific indicators
            to produce explainable, prioritized security findings — without active scanning.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-primary text-base px-8 py-3">
              Start Assessment <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/dashboard" className="btn-secondary text-base px-8 py-3">
              View Dashboard
            </Link>
          </div>

          {/* Authorization notice */}
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-navy-400">
            <AlertTriangle className="w-4 h-4 text-medium flex-shrink-0" />
            <span>All assessments require explicit operator authorization for the target in scope.</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Platform Capabilities</h2>
            <p className="text-navy-300 max-w-xl mx-auto">Built for security analysts who need transparent, reproducible findings rather than noisy scanners.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="glass-card-hover p-6">
                <div className="w-10 h-10 rounded-lg bg-accent-500/15 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-accent-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-navy-300 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="py-20 px-6 bg-navy-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">How Assessments Work</h2>
            <p className="text-navy-300 max-w-xl mx-auto">A transparent, step-by-step workflow from target input to actionable findings.</p>
          </div>
          <div className="space-y-4">
            {workflowSteps.map((step, i) => (
              <div key={step.n} className="flex items-start gap-6 glass-card p-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent-500/15 flex items-center justify-center font-mono text-accent-400 font-bold text-sm">
                  {step.n}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{step.label}</h3>
                  <p className="text-sm text-navy-300">{step.desc}</p>
                </div>
                {i < workflowSteps.length - 1 && (
                  <div className="hidden lg:flex flex-shrink-0 items-center">
                    <ArrowRight className="w-4 h-4 text-navy-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ethics */}
      <section id="ethics" className="py-20 px-6">
        <div className="max-w-3xl mx-auto glass-card p-8 border-l-4 border-l-medium">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-medium flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-white mb-3">Authorization & Ethical Use</h2>
              <div className="space-y-2 text-sm text-navy-300">
                <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-low mt-0.5 flex-shrink-0" /><span>Only assess systems you own or have explicit written authorization to test.</span></div>
                <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-low mt-0.5 flex-shrink-0" /><span>This platform performs passive correlation, not active exploitation.</span></div>
                <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-low mt-0.5 flex-shrink-0" /><span>Shodan data reflects previously indexed observations — not real-time reconnaissance.</span></div>
                <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-low mt-0.5 flex-shrink-0" /><span>A matched CVE does not confirm exploitation or mean a service is definitely vulnerable.</span></div>
                <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-low mt-0.5 flex-shrink-0" /><span>By using this platform you confirm you are assessing authorized infrastructure only.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-navy-700/40 text-center">
        <p className="text-xs text-navy-500">
          Multi-Protocol Exposure & Risk-Scoring Framework © 2024 · Passive intelligence, explainable findings, responsible disclosure
        </p>
      </footer>
    </div>
  )
}
