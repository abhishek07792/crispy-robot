"""
Tests for FTP detector.
Run with: pytest tests/ -v
"""
import pytest
from analysis.models import ServiceObservation, ObservationExtra, RiskTier, Confidence, VerificationStatus
from analysis.detectors.ftp_detector import FTPDetector


def make_obs(**kwargs) -> ServiceObservation:
    extra_data = kwargs.pop("extra", {})
    return ServiceObservation(
        observation_id="test-obs-1",
        port=21,
        service_type="ftp",
        extra=ObservationExtra(**extra_data),
        **kwargs,
    )


@pytest.fixture
def detector():
    return FTPDetector()


class TestFTPAnonymousLogin:
    def test_anonymous_via_structured_field(self, detector):
        obs = make_obs(extra={"ftp_anonymous": True})
        findings = detector.evaluate(obs)
        assert len(findings) == 1
        f = findings[0]
        assert f.finding_type == "FTP_ANONYMOUS_LOGIN_INDICATOR"
        assert f.risk_tier == RiskTier.HIGH
        assert f.confidence == Confidence.HIGH
        assert f.verification_status == VerificationStatus.CONFIRMED

    def test_no_anonymous_structured_false(self, detector):
        obs = make_obs(extra={"ftp_anonymous": False})
        findings = detector.evaluate(obs)
        # Should produce no anonymous finding
        anon = [f for f in findings if "ANONYMOUS" in f.finding_type]
        assert len(anon) == 0

    def test_anonymous_via_banner_pattern(self, detector):
        obs = make_obs(
            banner="220 (vsFTPd 3.0.3)\r\n230 Login successful (Anonymous FTP server).",
            extra={"ftp_anonymous": None}
        )
        findings = detector.evaluate(obs)
        anon = [f for f in findings if "ANONYMOUS" in f.finding_type]
        assert len(anon) == 1
        assert anon[0].confidence == Confidence.MEDIUM
        assert anon[0].verification_status == VerificationStatus.LIKELY

    def test_no_banner_no_field_no_finding(self, detector):
        obs = make_obs(banner=None, extra={})
        findings = [f for f in detector.evaluate(obs) if "ANONYMOUS" in f.finding_type]
        assert len(findings) == 0  # no evidence → no anonymous finding

    def test_evidence_contains_disclaimer(self, detector):
        obs = make_obs(extra={"ftp_anonymous": True})
        f = detector.evaluate(obs)[0]
        assert "what_this_does_not_prove" in f.evidence

    def test_remediation_present(self, detector):
        obs = make_obs(extra={"ftp_anonymous": True})
        f = detector.evaluate(obs)[0]
        assert "SFTP" in f.remediation or "anonymous" in f.remediation.lower()


class TestFTPVersionCVEs:
    def test_vsftpd_234_backdoor(self, detector):
        obs = make_obs(product="vsftpd", version="2.3.4")
        cve_findings = [f for f in detector.evaluate(obs) if "CVE" in f.finding_type]
        assert any("2011_2523" in f.finding_type for f in cve_findings)

    def test_no_cve_when_no_version(self, detector):
        obs = make_obs(product="vsftpd", version=None)
        cve_findings = [f for f in detector.evaluate(obs) if "CVE" in f.finding_type]
        assert len(cve_findings) == 0

    def test_cve_finding_is_potential_not_confirmed(self, detector):
        obs = make_obs(product="vsftpd", version="2.3.4")
        cve_f = [f for f in detector.evaluate(obs) if "CVE" in f.finding_type]
        for f in cve_f:
            assert f.verification_status == VerificationStatus.POTENTIAL
            assert f.confidence == Confidence.MEDIUM

    def test_non_matching_version_no_cve(self, detector):
        obs = make_obs(product="vsftpd", version="3.0.5")
        cve_findings = [f for f in detector.evaluate(obs) if "2011_2523" in f.finding_type]
        assert len(cve_findings) == 0
