/**
 * API client tests — uses msw (Mock Service Worker) to intercept HTTP requests
 * and verifies that the API layer handles responses and errors correctly.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import apiClient from '../api/client'
import { assessmentsApi, dashboardApi } from '../api/endpoints'

// ── MSW server setup ──────────────────────────────────────────────────────────

const server = setupServer(
  // Assessment list endpoint
  http.get('/api/assessments', () => {
    return HttpResponse.json({
      assessments: [
        {
          id: 'aaa-001',
          user_id: 'user-1',
          target: 'example.com',
          status: 'COMPLETED',
          started_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T00:05:00Z',
          error_summary: null,
          finding_counts: { critical: 1, high: 2, medium: 3, low: 0, info: 1, verify: 0, total: 7 },
          asset_count: 3,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
  }),

  // Single assessment endpoint
  http.get('/api/assessments/:id', ({ params }) => {
    if (params.id === 'not-found') {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json({
      assessment: {
        id: params.id,
        user_id: 'user-1',
        target: '192.168.1.1',
        status: 'COMPLETED',
        started_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:05:00Z',
        error_summary: null,
        finding_counts: { critical: 0, high: 1, medium: 0, low: 0, info: 0, verify: 1, total: 2 },
        asset_count: 1,
        created_at: '2024-01-01T00:00:00Z',
      },
    })
  }),

  // Create assessment endpoint
  http.post('/api/assessments', async ({ request }) => {
    const body = await request.json() as { target?: string; authorized?: boolean; protocols?: string[] }
    if (!body.authorized) {
      return HttpResponse.json({ error: 'Authorization required' }, { status: 400 })
    }
    return HttpResponse.json(
      {
        assessment: {
          id: 'new-123',
          user_id: 'user-1',
          target: body.target,
          status: 'PENDING',
          started_at: new Date().toISOString(),
          completed_at: null,
          error_summary: null,
          finding_counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0, verify: 0, total: 0 },
          asset_count: 0,
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    )
  }),

  // Dashboard summary endpoint
  http.get('/api/dashboard/summary', () => {
    return HttpResponse.json({
      demo_mode: true,
      total_assets: 12,
      total_assessments: 5,
      total_findings: 23,
      findings_by_tier: {
        CRITICAL: 2,
        HIGH: 5,
        MEDIUM: 8,
        LOW: 4,
        INFORMATIONAL: 3,
        NEEDS_VERIFICATION: 1,
      },
      findings_by_protocol: { ftp: 10, redis: 8, mongodb: 5 },
      cve_findings: 7,
      needs_verification: 1,
      recent_assessments: [],
      trend: [{ date: '2024-01-01', total: 5 }],
    })
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok', database: 'connected', service: 'vapt-backend' })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('assessmentsApi.list', () => {
  it('returns a list of assessments', async () => {
    const res = await assessmentsApi.list()
    expect(res.data.assessments).toHaveLength(1)
    expect(res.data.assessments[0].target).toBe('example.com')
  })

  it('returns pagination metadata', async () => {
    const res = await assessmentsApi.list()
    expect(res.data.total).toBe(1)
    expect(res.data.page).toBe(1)
    expect(res.data.limit).toBe(20)
  })
})

describe('assessmentsApi.get', () => {
  it('fetches a single assessment by ID', async () => {
    const res = await assessmentsApi.get('abc-123')
    expect(res.data.assessment.id).toBe('abc-123')
    expect(res.data.assessment.target).toBe('192.168.1.1')
  })

  it('rejects with 404 for unknown assessment', async () => {
    await expect(assessmentsApi.get('not-found')).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})

describe('assessmentsApi.create', () => {
  it('creates a new assessment with valid payload', async () => {
    const res = await assessmentsApi.create({
      target: 'scanme.nmap.org',
      authorized: true,
      protocols: ['ftp', 'redis'],
    })
    expect(res.status).toBe(201)
    expect(res.data.assessment.target).toBe('scanme.nmap.org')
    expect(res.data.assessment.status).toBe('PENDING')
  })

  it('rejects when authorized is false', async () => {
    await expect(
      assessmentsApi.create({ target: 'example.com', authorized: false, protocols: ['ftp'] })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })
})

describe('dashboardApi.getSummary', () => {
  it('returns summary with expected structure', async () => {
    const res = await dashboardApi.getSummary()
    const data = res.data
    expect(typeof data.total_assessments).toBe('number')
    expect(typeof data.total_findings).toBe('number')
    expect(data.findings_by_tier).toHaveProperty('CRITICAL')
    expect(data.findings_by_tier).toHaveProperty('HIGH')
  })

  it('has demo_mode flag', async () => {
    const res = await dashboardApi.getSummary()
    expect(typeof res.data.demo_mode).toBe('boolean')
  })
})

describe('apiClient base behaviour', () => {
  it('GET /api/health returns ok', async () => {
    const res = await apiClient.get('/health')
    expect(res.data.status).toBe('ok')
  })
})
