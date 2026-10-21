-- Migration 002: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_started_at ON assessments(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_assessment_id ON assets(assessment_id);
CREATE INDEX IF NOT EXISTS idx_service_obs_assessment_id ON service_observations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_service_obs_asset_id ON service_observations(asset_id);
CREATE INDEX IF NOT EXISTS idx_findings_observation_id ON findings(observation_id);
CREATE INDEX IF NOT EXISTS idx_findings_risk_tier ON findings(risk_tier);
CREATE INDEX IF NOT EXISTS idx_findings_verification ON findings(verification_status);
CREATE INDEX IF NOT EXISTS idx_finding_cves_cve_id ON finding_cves(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_fetched_at ON cve_records(fetched_at);
