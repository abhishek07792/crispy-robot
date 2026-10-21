-- Migration 001: Initial Schema
-- Run via: npm run migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role         VARCHAR(50) NOT NULL DEFAULT 'analyst',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target        VARCHAR(512) NOT NULL,
  status        VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
  protocols     TEXT[]       NOT NULL DEFAULT '{}',
  notes         TEXT,
  started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  error_summary TEXT,
  CONSTRAINT assessments_status_check CHECK (
    status IN ('PENDING','IN_PROGRESS','COMPLETED','PARTIAL','FAILED')
  )
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id        UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  canonical_identifier VARCHAR(512) NOT NULL,
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service observations (one per port/service per asset)
CREATE TABLE IF NOT EXISTS service_observations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  port          INTEGER NOT NULL,
  service_type  VARCHAR(100),
  product       VARCHAR(255),
  version       VARCHAR(255),
  source        VARCHAR(100) NOT NULL DEFAULT 'shodan',
  observed_at   TIMESTAMPTZ,
  raw_metadata  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CVE records (cached from NVD)
CREATE TABLE IF NOT EXISTS cve_records (
  cve_id           VARCHAR(30) PRIMARY KEY,
  description      TEXT,
  cvss_score       NUMERIC(4,1),
  cvss_vector      VARCHAR(255),
  cvss_version     VARCHAR(20),
  affected_criteria JSONB,
  source_updated_at TIMESTAMPTZ,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Findings
CREATE TABLE IF NOT EXISTS findings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id      UUID NOT NULL REFERENCES service_observations(id) ON DELETE CASCADE,
  finding_type        VARCHAR(255) NOT NULL,
  severity            VARCHAR(50)  NOT NULL,
  confidence          VARCHAR(20)  NOT NULL DEFAULT 'LOW',
  risk_tier           VARCHAR(50)  NOT NULL,
  verification_status VARCHAR(50)  NOT NULL DEFAULT 'UNVERIFIED',
  evidence            JSONB        NOT NULL DEFAULT '{}',
  rationale           TEXT,
  remediation         TEXT,
  rule_version        VARCHAR(50)  NOT NULL DEFAULT '1.0.0',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT findings_risk_check CHECK (
    risk_tier IN ('CRITICAL','HIGH','MEDIUM','LOW','INFORMATIONAL','NEEDS_VERIFICATION')
  ),
  CONSTRAINT findings_confidence_check CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  CONSTRAINT findings_verification_check CHECK (
    verification_status IN ('CONFIRMED','LIKELY','POTENTIAL','UNVERIFIED')
  )
);

-- Finding ↔ CVE join table
CREATE TABLE IF NOT EXISTS finding_cves (
  finding_id      UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  cve_id          VARCHAR(30) NOT NULL REFERENCES cve_records(cve_id) ON DELETE CASCADE,
  match_rationale TEXT,
  PRIMARY KEY (finding_id, cve_id)
);

-- Assessment summaries (denormalized for reporting)
CREATE TABLE IF NOT EXISTS assessment_summaries (
  assessment_id UUID PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
  summary_data  JSONB NOT NULL DEFAULT '{}',
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(100) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
