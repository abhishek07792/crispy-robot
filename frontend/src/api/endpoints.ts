import apiClient from './client'
import type { Assessment, AssessmentSummary, Finding, FindingDetail, DashboardSummary, CVERecord } from '../types'

// --- Assessments ---
export const assessmentsApi = {
  create: (data: { target: string; authorized: boolean; protocols: string[]; notes?: string }) =>
    apiClient.post<{ assessment: Assessment }>('/assessments', data),

  list: (page = 1, limit = 20) =>
    apiClient.get<{ assessments: Assessment[]; total: number; page: number; limit: number }>(`/assessments?page=${page}&limit=${limit}`),

  get: (id: string) =>
    apiClient.get<{ assessment: Assessment }>(`/assessments/${id}`),

  getFindings: (id: string, params?: Record<string, string>) =>
    apiClient.get<{ findings: Finding[]; total: number }>(`/assessments/${id}/findings`, { params }),

  getReport: (id: string) =>
    apiClient.get<AssessmentSummary>(`/assessments/${id}/report`),

  downloadReport: (id: string) =>
    apiClient.get(`/assessments/${id}/report/pdf`, { responseType: 'blob' }),
}

// --- Findings ---
export const findingsApi = {
  get: (id: string) =>
    apiClient.get<{ finding: FindingDetail }>(`/findings/${id}`),
}

// --- CVEs ---
export const cvesApi = {
  get: (cveId: string) =>
    apiClient.get<{ cve: CVERecord }>(`/cves/${cveId}`),
}

// --- Dashboard ---
export const dashboardApi = {
  getSummary: () =>
    apiClient.get<DashboardSummary>('/dashboard/summary'),
}
