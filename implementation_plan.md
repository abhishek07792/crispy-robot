# Multi-Protocol Exposure & Risk-Scoring Framework — Implementation Plan

## Overview

Build a full-stack cybersecurity exposure-analysis platform that correlates Shodan indexed observations, NVD CVE intelligence, and protocol-specific heuristics to produce explainable, evidence-based risk findings. The workspace is currently empty — everything is built from scratch.

> [!IMPORTANT]
> This is a large, multi-phase project. Each phase below maps to a development phase. The user should review the overall approach and phase ordering before execution begins.

---

## Proposed Changes

### Monorepo Root

#### [NEW] `.gitignore`
Root gitignore covering node_modules, __pycache__, .env, dist, build, .venv.

#### [NEW] `.env.example`
Template listing all required environment variables (DATABASE_URL, SHODAN_API_KEY, NVD_API_KEY, SESSION_SECRET, FRONTEND_URL, BACKEND_PORT, ANALYSIS_SERVICE_URL, JWT_SECRET, DEMO_MODE).

#### [NEW] `docker-compose.yml`
Orchestrates: postgres, backend (Node), analysis (Python/Flask), frontend (Vite dev or nginx).

#### [NEW] `README.md`
Full setup, run, test, and deployment instructions for Windows and Docker.

---

### Frontend — `frontend/`

Vite + React + TypeScript + Tailwind CSS + shadcn/ui + React Router + Axios + Recharts.

#### [NEW] `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`
Project scaffolding via `npx create-vite`.

#### [NEW] `frontend/src/pages/LandingPage.tsx`
Professional SaaS-style landing: hero, features, workflow steps, Start Assessment CTA, dashboard link, authorization notice.

#### [NEW] `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`
Auth forms with React Hook Form + Zod validation.

#### [NEW] `frontend/src/pages/DashboardPage.tsx`
Live stats (assets, assessments, findings by tier/protocol, CVE findings, trends). Demo-mode banner when no live credentials.

#### [NEW] `frontend/src/pages/NewAssessmentPage.tsx`
Target input, authorization checkbox, protocol selection, Start Assessment, progress/status display.

#### [NEW] `frontend/src/pages/AssessmentResultsPage.tsx`
Paginated findings table, protocol/risk/CVE/confidence/status filters.

#### [NEW] `frontend/src/pages/FindingDetailPage.tsx`
Full evidence, rule applied, rationale, CVE details, remediation, what-is-NOT-proven section.

#### [NEW] `frontend/src/pages/AssessmentHistoryPage.tsx`
List, reopen, compare assessments.

#### [NEW] `frontend/src/pages/ReportPage.tsx`
PDF/CSV export.

#### [NEW] `frontend/src/components/` (shared UI components, charts, severity badges, layout)
#### [NEW] `frontend/src/context/AuthContext.tsx` + `frontend/src/api/client.ts`
#### [NEW] `frontend/src/__tests__/` — Vitest tests for loading/error/results states.

---

### Backend — `backend/`

Node.js + Express + TypeScript. Zod validation. Helmet, cors, express-rate-limit. bcrypt + JWT. pg (node-postgres). Swagger-jsdoc + swagger-ui-express.

#### [NEW] `backend/src/index.ts` — app entry
#### [NEW] `backend/src/routes/auth.ts` — register, login, logout
#### [NEW] `backend/src/routes/assessments.ts` — CRUD, findings, report
#### [NEW] `backend/src/routes/dashboard.ts` — summary stats
#### [NEW] `backend/src/routes/cves.ts` — CVE detail
#### [NEW] `backend/src/middleware/auth.ts` — JWT verify middleware
#### [NEW] `backend/src/middleware/rateLimit.ts`
#### [NEW] `backend/src/services/shodanService.ts` — Shodan API wrapper (server-side only)
#### [NEW] `backend/src/services/nvdService.ts` — NVD CVE API wrapper
#### [NEW] `backend/src/services/analysisService.ts` — calls Python Flask engine
#### [NEW] `backend/src/db/migrations/` — SQL migration files (001_initial_schema.sql through 005_indexes.sql)
#### [NEW] `backend/src/db/migrate.ts` — migration runner
#### [NEW] `backend/src/db/pool.ts` — pg connection pool
#### [NEW] `backend/swagger.ts` + `backend/openapi.yaml`
#### [NEW] `backend/tests/` — Supertest tests for all routes

---

### Analysis Engine — `analysis/`

Python 3.11 + Flask + Pydantic. Modular detector registry.

#### [NEW] `analysis/app.py` — Flask app entry
#### [NEW] `analysis/requirements.txt`
#### [NEW] `analysis/models/` — Pydantic models (ServiceObservation, Finding, CVERecord, RiskScore)
#### [NEW] `analysis/normalizer.py` — normalize Shodan records to ServiceObservation
#### [NEW] `analysis/product_identifier.py` — extract vendor/product/version/CPE hints
#### [NEW] `analysis/cve_matcher.py` — match ServiceObservation to NVD CVE records
#### [NEW] `analysis/detectors/base.py` — BaseDetector interface
#### [NEW] `analysis/detectors/ftp_detector.py` — FTP anonymous login, CVEs, remediation
#### [NEW] `analysis/detectors/redis_detector.py` — Redis auth, exposure context, CVEs
#### [NEW] `analysis/detectors/mongodb_detector.py` — MongoDB auth, exposure (architecture-ready)
#### [NEW] `analysis/detectors/registry.py` — detector registry
#### [NEW] `analysis/aggregator.py` — dedup, associate findings to asset/service
#### [NEW] `analysis/risk_engine.py` — deterministic tier calculation (Critical/High/Medium/Low/Info/NeedsVerification)
#### [NEW] `analysis/confidence.py` — confidence assessment (High/Medium/Low)
#### [NEW] `analysis/remediation.py` — remediation mapping by rule
#### [NEW] `analysis/routes/analyze.py` — POST /internal/analyze endpoint (localhost-only)
#### [NEW] `analysis/tests/` — pytest unit tests for all detectors, risk engine, normalizer, CVE matcher

---

### Database — migrations

SQL migrations managed by a custom Node.js runner using `node-postgres`.

Tables: `users`, `assessments`, `assets`, `service_observations`, `cve_records`, `findings`, `finding_cves`, `assessment_summaries`.

Indexes on: assessment_id, user_id, cve_id, finding type, risk_tier.

Foreign keys with ON DELETE CASCADE where appropriate.

---

### Documentation — `docs/`

#### [NEW] `docs/FINAL_PROJECT_REPORT.md`
#### [NEW] `docs/ARCHITECTURE.md`
#### [NEW] `docs/API_DOCUMENTATION.md`
#### [NEW] `docs/SCORING_METHODOLOGY.md`
#### [NEW] `docs/TEST_REPORT.md`

---

## Risk-Scoring Methodology (Summary)

Each finding has:
- `cvss_score` — from NVD, used as severity input only
- `configuration_severity` — rule-based (e.g., anonymous FTP = High)
- `applicability_confidence` — product/version match quality (High/Medium/Low)
- `exposure_context` — public IP vs private, port context
- `verification_status` — Confirmed / Likely / Potential / Unverified

Final risk tier:
```
Critical  → CVSS >= 9.0 AND confidence >= Medium AND exposure = public
High      → CVSS >= 7.0 OR (config_severity = High AND confidence >= Medium)
Medium    → CVSS >= 4.0 OR (config_severity = Medium AND confidence >= Low)
Low       → CVSS < 4.0 OR informational config indicator
Needs Verification → insufficient evidence for classification
```
All thresholds and rules are code-documented. Rule version is stored with each finding.

---

## Verification Plan

### Automated Tests

**Frontend (Vitest)**
```
cd frontend && npm run test
```
Covers: auth form validation, dashboard loading/error states, finding table rendering.

**Backend (Supertest + Jest/ts-jest)**
```
cd backend && npm run test
```
Covers: auth endpoints (register/login/logout), assessment CRUD with auth, ownership checks (403 on wrong user), Shodan service mock (success/quota/empty), NVD service mock (success/timeout), input validation (Zod), rate limiting.

**Python analysis (pytest)**
```
cd analysis && python -m pytest tests/ -v
```
Covers: FTP detector (anonymous login positive/negative, banner ambiguity), Redis detector (auth present/absent/unknown), risk engine reproducibility, CVE matcher fuzzy version matching, normalizer edge cases, dedup logic.

### Manual Verification Steps

1. Start with `docker-compose up` (or npm/python dev servers).
2. Navigate to `http://localhost:5173` — confirm landing page loads.
3. Register a new account → confirm redirect to dashboard.
4. Start a new assessment with a test domain → confirm authorization checkbox is required.
5. With DEMO_MODE=true → confirm demo data appears with "Sample Data" banner.
6. With real SHODAN_API_KEY → confirm assessment runs and results appear.
7. Open Finding Detail → confirm evidence, rationale, CVE info, and remediation section all populated.
8. Export PDF report → confirm download.
9. Log in as a second user → confirm cannot access first user's assessment by ID.

---

> [!NOTE]
> Phase ordering follows the prompt exactly. Each phase will be implemented sequentially. The project is large; phases 2–8 are the heaviest. After each phase, tests are run and blockers are noted.
