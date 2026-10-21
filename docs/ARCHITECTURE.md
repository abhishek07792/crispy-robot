# Architecture Guide

## System Overview

The **Multi-Protocol Exposure & Risk-Scoring Framework** is a production-grade cybersecurity web application composed of three containerised services that communicate over HTTP, backed by PostgreSQL.

```
┌───────────────────────────────────────────────────────────────────┐
│                          Browser Client                           │
│                  React / TypeScript / Vite (5173)                 │
└─────────────────────────────┬─────────────────────────────────────┘
                              │ HTTPS / REST
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                      Node / Express API (3001)                    │
│  Auth · Assessments CRUD · Findings · Dashboard · Swagger Docs   │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │  Shodan Svc │  │  NVD CVE Svc   │  │ Assessment          │   │
│  │  (ext HTTP) │  │  (ext HTTP)    │  │ Orchestrator        │   │
│  └─────────────┘  └────────────────┘  └──────────────────────┘   │
└──────────┬────────────────────────────────────┬───────────────────┘
           │ TCP 5432                           │ HTTP (internal secret)
           ▼                                    ▼
┌─────────────────────┐            ┌───────────────────────────────┐
│  PostgreSQL (5432)  │            │  Python / Flask Engine (5050) │
│  Users · Assets     │            │  FTP · Redis · MongoDB        │
│  Assessments        │            │  Detectors · Risk Engine      │
│  Findings · CVEs    │            │  Aggregator · /internal/      │
└─────────────────────┘            │  analyze                      │
                                   └───────────────────────────────┘
```

---

## Directory Structure

```
vapt/
├── frontend/          React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── api/       axios client + typed endpoints
│       ├── components/ RiskBadge, Layout
│       ├── context/   AuthContext (JWT storage + /me polling)
│       ├── pages/     Landing · Dashboard · New Assessment · Results
│       │              Finding Detail · History · Report
│       ├── types/     Shared TypeScript interfaces
│       └── test/      Vitest test suite (types, components, API)
│
├── backend/           Node.js + Express + TypeScript
│   └── src/
│       ├── db/        pool.ts · migrate.ts · migrations/
│       ├── middleware/ auth.ts (JWT verify + role guard)
│       ├── routes/    auth · assessments · findings · cves · dashboard
│       ├── services/  shodan.ts · nvd.ts · orchestrator.ts
│       └── utils/     logger.ts
│
├── analysis/          Python 3.11 + Flask
│   ├── detectors/     ftp.py · redis.py · mongodb.py
│   ├── models/        input.py (Pydantic schemas)
│   ├── app.py         Flask app + /internal/analyze
│   ├── risk_engine.py Deterministic CVSS-based scorer
│   ├── aggregator.py  Finding deduplication
│   └── tests/         25 pytest tests
│
├── docs/              SCORING_METHODOLOGY.md · ARCHITECTURE.md
├── docker-compose.yml All 4 services (db · backend · analysis · frontend)
├── .env.example       Required environment variables
└── .gitignore
```

---

## Data Flow: Assessment Lifecycle

```
User submits target
        │
        ▼
Backend creates Assessment (status=PENDING)
        │
        ▼
Orchestrator: PENDING → IN_PROGRESS
        │
        ├─ 1. Shodan API query → persist ServiceObservations + Assets
        │
        ├─ 2. NVD prefetch CVEs for detected products (24h cache)
        │
        ├─ 3. POST /internal/analyze to Python engine
        │       └─ FTP detector → Redis detector → MongoDB detector
        │       └─ Risk Engine assigns tier (CVSS + context)
        │       └─ Aggregator deduplicates findings
        │
        ├─ 4. Persist findings + CVE links to PostgreSQL
        │
        └─ 5. Status → COMPLETED / PARTIAL / FAILED
```

---

## Database Schema

```
users            — id (UUID) · email · password_hash · role · created_at
assets           — id · target (FK) · canonical_identifier · ports (JSONB)
assessments      — id · user_id (FK) · target · status · started_at · completed_at · error_summary
service_observations — id · assessment_id · asset_id · port · service_type · product · version · source · raw_banner
findings         — id · observation_id (FK) · finding_type · severity · confidence · risk_tier
                   verification_status · rule_version · evidence (JSONB) · rationale · remediation
finding_cves     — finding_id (FK) · cve_id (FK) · match_rationale (JSONB)
cve_records      — cve_id PK · description · cvss_score · cvss_vector · affected_criteria (JSONB)
```

All tables have appropriate B-tree indexes on FKs and status columns. The `findings` table has a composite index on `(observation_id, finding_type, risk_tier)` for deduplication queries.

---

## Analysis Engine Design

### Detector Contract

Each detector is a Python class that implements:

```python
def detect(self, obs: ServiceObservation, nvd_cache: dict) -> list[FindingResult]
```

**FTP Detector** — checks `data.ftp.anonymous` (structured Shodan field > banner regex) and matches version strings against known CVE patterns (vsftpd 2.3.4 backdoor, ProFTPD mod_copy RCE).

**Redis Detector** — 3-level auth evidence hierarchy:
1. Structured auth field present → explicit
2. Banner contains auth/noauth keyword → banner-derived
3. No evidence → `NEEDS_VERIFICATION`

**MongoDB Detector** — checks absence of auth indicator in Shodan metadata.

### Risk Engine

Deterministic CVSS-based tier mapping:

| CVSS Score | Port Public | Result   |
|:----------:|:-----------:|:--------:|
| ≥ 9.0      | yes         | CRITICAL |
| ≥ 7.0      | yes         | HIGH     |
| ≥ 4.0      | yes         | MEDIUM   |
| < 4.0      | yes         | LOW      |
| Any        | unverified  | NEEDS_VERIFICATION |

### Aggregator (Deduplication)

Findings with the same `(observation_id, finding_type)` key are merged — the highest-risk tier wins. This prevents duplicate records when multiple detectors flag the same service.

---

## Security Controls

| Layer       | Control                                              |
|-------------|------------------------------------------------------|
| Auth        | JWT HS256, 24h expiry, stored in-memory (not cookie) |
| API         | Rate limiting: 20 req/15 min (auth), 200 (API)       |
| Database    | Ownership checks on all assessment endpoints           |
| Enumeration | 404 (not 403) on assess ownership mismatch             |
| Transport   | Helmet CORS/CSP headers, no default CORS              |
| Analysis    | Internal `ANALYSIS_SECRET` shared secret               |
| Passwords   | bcrypt, min 8 chars, uppercase + digit required        |

---

## Integration: Shodan & NVD

### Shodan (Demo mode fallback)
- `SHODAN_API_KEY` in `.env` activates live queries
- Without key: pre-seeded demo observations loaded from DB seed data
- Rate limit errors and 402 responses trigger graceful fallback

### NVD CVE API
- `NVD_API_KEY` increases rate limits (50 req/30s vs 5 req/30s)
- 24-hour cache in `cve_records` table (upsert on conflict)
- Products matched by keyword search; CVSS v3.1 preferred, fallback to v2

---

## Configuration Reference (`.env`)

| Variable              | Required | Default            | Description                          |
|-----------------------|----------|--------------------|--------------------------------------|
| `DATABASE_URL`        | ✓        | —                  | PostgreSQL connection string         |
| `JWT_SECRET`          | ✓        | —                  | HS256 signing secret (≥32 chars)     |
| `ANALYSIS_SECRET`     | ✓        | —                  | Shared secret for analysis engine    |
| `ANALYSIS_URL`        | —        | `http://localhost:5050` | Analysis service URL            |
| `SHODAN_API_KEY`      | —        | —                  | Without key: demo mode               |
| `NVD_API_KEY`         | —        | —                  | Rate limit boost                     |
| `BACKEND_PORT`        | —        | `3001`             | Backend listen port                  |
| `FRONTEND_URL`        | —        | `http://localhost:5173` | CORS allowed origin             |
