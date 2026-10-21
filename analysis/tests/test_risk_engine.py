"""Tests for risk engine and deduplication."""
import pytest
from analysis.models import ServiceObservation, ObservationExtra, Finding, CVEReference, RiskTier, Confidence, VerificationStatus
from analysis.risk_engine import compute_risk_tier, apply_risk_engine
from analysis.aggregator import deduplicate_findings


def make_finding(**kwargs) -> Finding:
    defaults = dict(
        observation_id="obs-1", finding_type="TEST_FINDING",
        severity=RiskTier.HIGH, confidence=Confidence.HIGH,
        risk_tier=RiskTier.HIGH, verification_status=VerificationStatus.LIKELY,
        evidence={"port": 21}, rationale="test", remediation="test",
        rule_version="1.0.0", cves=[],
    )
    defaults.update(kwargs)
    return Finding(**defaults)


class TestRiskEngine:
    def test_unverified_downgraded_to_needs_verification(self):
        f = make_finding(verification_status=VerificationStatus.UNVERIFIED, evidence={"port": 21})
        tier = compute_risk_tier(f)
        assert tier == RiskTier.NEEDS_VERIFICATION

    def test_cvss_9_public_port_critical(self):
        f = make_finding(
            cves=[CVEReference(cve_id="CVE-2011-2523", match_rationale="test", cvss_score=10.0)],
            evidence={"port": 21},
        )
        [result] = apply_risk_engine([f])
        assert result.risk_tier == RiskTier.CRITICAL

    def test_cvss_7_high(self):
        f = make_finding(
            cves=[CVEReference(cve_id="CVE-X", match_rationale="test", cvss_score=7.5)],
            evidence={"port": 21},
        )
        [result] = apply_risk_engine([f])
        assert result.risk_tier == RiskTier.HIGH

    def test_cvss_low_medium(self):
        f = make_finding(
            cves=[CVEReference(cve_id="CVE-X", match_rationale="test", cvss_score=4.0)],
            evidence={"port": 21},
        )
        [result] = apply_risk_engine([f])
        assert result.risk_tier == RiskTier.MEDIUM

    def test_risk_engine_reproducible(self):
        """Same evidence + rule version → same tier."""
        f = make_finding(evidence={"port": 6379})
        r1 = apply_risk_engine([f])[0].risk_tier
        r2 = apply_risk_engine([f])[0].risk_tier
        assert r1 == r2


class TestDeduplication:
    def test_dedup_same_type_keeps_higher_tier(self):
        low = make_finding(finding_type="FTP_ANON", risk_tier=RiskTier.LOW)
        high = make_finding(finding_type="FTP_ANON", risk_tier=RiskTier.HIGH)
        result = deduplicate_findings([low, high])
        assert len(result) == 1
        assert result[0].risk_tier == RiskTier.HIGH

    def test_different_types_both_kept(self):
        a = make_finding(finding_type="FTP_ANON")
        b = make_finding(finding_type="FTP_CVE", observation_id="obs-2")
        result = deduplicate_findings([a, b])
        assert len(result) == 2
