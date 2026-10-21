"""Tests for Redis detector."""
import pytest
from analysis.models import ServiceObservation, ObservationExtra, RiskTier, Confidence, VerificationStatus
from analysis.detectors.redis_detector import RedisDetector


def make_obs(**kwargs) -> ServiceObservation:
    extra = kwargs.pop("extra", {})
    return ServiceObservation(
        observation_id="redis-obs-1", port=6379,
        service_type="redis", extra=ObservationExtra(**extra), **kwargs
    )


@pytest.fixture
def detector():
    return RedisDetector()


class TestRedisAuth:
    def test_no_auth_structured_field(self, detector):
        obs = make_obs(extra={"redis_auth_required": False})
        findings = detector.evaluate(obs)
        auth = [f for f in findings if "NO_AUTH" in f.finding_type]
        assert len(auth) == 1
        assert auth[0].confidence == Confidence.HIGH
        assert auth[0].risk_tier == RiskTier.CRITICAL

    def test_auth_required_struct_field(self, detector):
        obs = make_obs(extra={"redis_auth_required": True})
        auth = [f for f in detector.evaluate(obs) if "NO_AUTH" in f.finding_type]
        assert len(auth) == 0

    def test_unknown_auth_returns_needs_verification(self, detector):
        obs = make_obs(extra={})
        findings = detector.evaluate(obs)
        verify = [f for f in findings if f.risk_tier == RiskTier.NEEDS_VERIFICATION]
        assert len(verify) == 1
        assert verify[0].verification_status == VerificationStatus.UNVERIFIED

    def test_banner_auth_required_no_finding(self, detector):
        obs = make_obs(banner="NOAUTH Authentication required", extra={})
        auth = [f for f in detector.evaluate(obs) if "NO_AUTH" in f.finding_type]
        assert len(auth) == 0

    def test_evidence_disclaimer_present(self, detector):
        obs = make_obs(extra={"redis_auth_required": False})
        f = [x for x in detector.evaluate(obs) if "NO_AUTH" in x.finding_type][0]
        assert "what_this_does_not_prove" in f.evidence


class TestRedisVersionCVEs:
    def test_cve_2022_0543_matched(self, detector):
        obs = make_obs(product="Redis", version="6.0.16", extra={"redis_auth_required": True})
        cve_f = [f for f in detector.evaluate(obs) if "CVE" in f.finding_type]
        assert any("2022_0543" in f.finding_type for f in cve_f)

    def test_no_cve_when_no_version(self, detector):
        obs = make_obs(product="Redis", version=None, extra={"redis_auth_required": True})
        cve_f = [f for f in detector.evaluate(obs) if "CVE" in f.finding_type]
        assert len(cve_f) == 0

    def test_cve_finding_potential(self, detector):
        obs = make_obs(product="Redis", version="5.0.0", extra={"redis_auth_required": True})
        for f in [x for x in detector.evaluate(obs) if "CVE" in x.finding_type]:
            assert f.verification_status == VerificationStatus.POTENTIAL
