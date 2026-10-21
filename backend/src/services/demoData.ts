/**
 * Demo data returned when SHODAN_API_KEY is not set and DEMO_MODE=true.
 * Clearly labelled as sample data — never presented as live findings.
 */
export function getDemoDashboard() {
  return {
    demo_mode: true,
    total_assets: 12,
    total_assessments: 4,
    total_findings: 27,
    findings_by_tier: {
      CRITICAL: 2, HIGH: 5, MEDIUM: 9, LOW: 7, INFORMATIONAL: 3, NEEDS_VERIFICATION: 1,
    },
    findings_by_protocol: { ftp: 8, redis: 11, mongodb: 5, smtp: 3 },
    cve_findings: 6,
    needs_verification: 1,
    recent_assessments: [
      {
        id: 'demo-1', target: 'example.com', status: 'COMPLETED',
        started_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date(Date.now() - 83000000).toISOString(),
        error_summary: null,
        finding_counts: { critical:1, high:3, medium:4, low:2, info:1, verify:1, total:12 },
        asset_count: 5,
      },
      {
        id: 'demo-2', target: '198.51.100.10', status: 'COMPLETED',
        started_at: new Date(Date.now() - 172800000).toISOString(),
        completed_at: new Date(Date.now() - 170000000).toISOString(),
        error_summary: null,
        finding_counts: { critical:1, high:2, medium:5, low:5, info:2, verify:0, total:15 },
        asset_count: 7,
      },
    ],
    trend: Array.from({ length: 14 }, (_, i) => ({
      date: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
      total: Math.floor(Math.random() * 8) + 1,
    })),
  }
}
