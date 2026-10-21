"""
FTP Protocol Detector — fully implemented.

Evaluates:
- Anonymous login indicators from Shodan-indexed FTP banner/metadata
- Product/version identification
- CVE applicability assessment
- Evidence quality and Shodan observation timestamp

Rules:
  FTP-001: Anonymous FTP login indicator detected
  FTP-002: FTP service version identified (potential CVE matching)

Rule version: 1.0.0
"""
import re
import logging
from typing import List, Optional

from .base import BaseDetector
from ..models import (
    ServiceObservation, Finding, CVEReference,
    RiskTier, Confidence, VerificationStatus
)

logger = logging.getLogger(__name__)

# Known high-severity FTP CVEs for cross-reference
# (cve_id, target_product, affected_versions_pattern, cvss, description_short)
FTP_KNOWN_CVES = [
    ("CVE-2011-2523", "vsftpd",  r"^2\.3\.", 10.0, "vsftpd 2.3.4 backdoor (smiley face trigger)"),
    ("CVE-2010-4221", "proftpd", r"^1\.(3|4|5)\.", 10.0, "ProFTPD 1.3.x command injection in telnet IAC"),
    ("CVE-2015-3306", "proftpd", r"^1\.(3\.5|3\.4|3\.3)", 10.0, "ProFTPD mod_copy unauthenticated file copy"),
]

ANONYMOUS_BANNER_PATTERNS = [
    r"\banonymous\b",
    r"\bAnonymous FTP\b",
    r"230[- ].*[Aa]nonymous",   # 230 response code for anonymous login
    r"331.*anonymous",
]


class FTPDetector(BaseDetector):
    """FTP protocol detector — anonymous login + version CVEs."""

    @property
    def supported_protocol(self) -> str:
        return "ftp"

    @property
    def rule_version(self) -> str:
        return "1.0.0"

    def evaluate(self, obs: ServiceObservation) -> List[Finding]:
        findings: List[Finding] = []

        try:
            # Rule FTP-001: Anonymous login indicator
            anon_finding = self._check_anonymous(obs)
            if anon_finding:
                findings.append(anon_finding)

            # Rule FTP-002: Version CVE matching
            cve_findings = self._check_version_cves(obs)
            findings.extend(cve_findings)

        except Exception as e:
            logger.error(f"FTPDetector error for obs {obs.observation_id}: {e}")

        return findings

    def _check_anonymous(self, obs: ServiceObservation) -> Optional[Finding]:
        """
        Check for anonymous FTP login indicators.

        Evidence is drawn from:
        1. Shodan structured ftp.anonymous field (most reliable)
        2. Banner string patterns (medium reliability)

        Note: We do NOT assume anonymous login is enabled merely because
        the FTP port is open. We require a positive indicator.
        """
        anonymous_confirmed = False
        anonymous_likely = False
        evidence = {}

        # Highest-confidence: Shodan structured field
        if obs.extra.ftp_anonymous is True:
            anonymous_confirmed = True
            evidence["shodan_ftp_anonymous_field"] = True
            evidence["evidence_quality"] = "HIGH"
        elif obs.extra.ftp_anonymous is False:
            # Explicitly false — not anonymous
            evidence["shodan_ftp_anonymous_field"] = False
            return None

        # Medium-confidence: banner string patterns
        banner_text = obs.banner or obs.extra.banner_raw or ""
        if not anonymous_confirmed and banner_text:
            for pattern in ANONYMOUS_BANNER_PATTERNS:
                if re.search(pattern, banner_text, re.IGNORECASE):
                    anonymous_likely = True
                    evidence["banner_pattern_match"] = pattern
                    evidence["banner_excerpt"] = banner_text[:200]
                    evidence["evidence_quality"] = "MEDIUM"
                    break

        if not anonymous_confirmed and not anonymous_likely:
            return None

        verification = VerificationStatus.CONFIRMED if anonymous_confirmed else VerificationStatus.LIKELY
        confidence = Confidence.HIGH if anonymous_confirmed else Confidence.MEDIUM

        evidence["port"] = obs.port
        evidence["service_type"] = obs.service_type
        if obs.observed_at:
            evidence["shodan_observed_at"] = obs.observed_at
        evidence["what_this_does_not_prove"] = (
            "This finding does not confirm active exploitation. "
            "Shodan data may be stale. Verify with authorized direct testing."
        )

        rationale = (
            f"Shodan-indexed data for port {obs.port}/FTP indicates anonymous login "
            f"is {'enabled (structured field)' if anonymous_confirmed else 'likely enabled (banner pattern)'}. "
            f"Anonymous FTP allows unauthenticated read (and sometimes write) access, "
            f"which may expose sensitive files or allow data exfiltration. "
            f"Confidence: {confidence.value}. Verification: {verification.value}."
        )

        remediation = (
            "1. Disable anonymous FTP login if not operationally required.\n"
            "2. If anonymous access is required, restrict to a dedicated read-only directory.\n"
            "3. Ensure the FTP service does not expose sensitive system files.\n"
            "4. Consider replacing FTP with SFTP (SSH file transfer) for authenticated transfers.\n"
            "5. Apply firewall rules to restrict FTP access to authorized IP ranges.\n"
            "6. Validate this finding with an authorized FTP login test before escalating."
        )

        return Finding(
            observation_id=obs.observation_id,
            finding_type="FTP_ANONYMOUS_LOGIN_INDICATOR",
            severity=RiskTier.HIGH,
            confidence=confidence,
            risk_tier=RiskTier.HIGH,
            verification_status=verification,
            evidence=evidence,
            rationale=rationale,
            remediation=remediation,
            rule_version=self.rule_version,
            cves=[],
        )

    def _check_version_cves(self, obs: ServiceObservation) -> List[Finding]:
        """
        Match FTP product/version against known CVEs.

        Only returns findings when product AND version are available
        and a pattern match is plausible. Never assumes CVE applies
        without version evidence.
        """
        findings = []
        product = (obs.product or "").lower()
        version = obs.version or ""

        if not product or not version:
            return findings

        for cve_id, target_product, version_pattern, cvss, description in FTP_KNOWN_CVES:
            # Simple prefix/regex match — not a substitute for CPE-based matching
            if re.search(version_pattern, version, re.IGNORECASE):
                # Check product relevance using the target_product field
                product_match = (
                    target_product in product or
                    # Generic: include if product is just "ftp" or unknown
                    product in ("ftp", "")
                )
                if not product_match:
                    continue

                evidence = {
                    "product": obs.product,
                    "version": version,
                    "matched_cve": cve_id,
                    "version_pattern": version_pattern,
                    "cvss": cvss,
                    "match_method": "version_prefix_regex",
                    "what_this_does_not_prove": (
                        "Version string match does not confirm the service is unpatched. "
                        "Vendor-specific backports, custom builds, or patch labels may differ. "
                        "Verify patch status via authorized testing."
                    ),
                }
                if obs.observed_at:
                    evidence["shodan_observed_at"] = obs.observed_at

                cve_ref = CVEReference(
                    cve_id=cve_id,
                    match_rationale=f"Version '{version}' matches pattern for {cve_id} (regex: {version_pattern}). Product: {obs.product}.",
                    cvss_score=cvss,
                    description=description,
                )

                tier = RiskTier.CRITICAL if cvss >= 9.0 else RiskTier.HIGH

                findings.append(Finding(
                    observation_id=obs.observation_id,
                    finding_type=f"FTP_VERSION_CVE_{cve_id.replace('-', '_')}",
                    severity=tier,
                    confidence=Confidence.MEDIUM,  # Version match only — not confirmed
                    risk_tier=tier,
                    verification_status=VerificationStatus.POTENTIAL,
                    evidence=evidence,
                    rationale=(
                        f"FTP product '{obs.product}' version '{version}' matches the version range "
                        f"associated with {cve_id} (CVSS {cvss}): {description}. "
                        f"This is a pattern-based match and has NOT been confirmed via active testing. "
                        f"Vendor patches and backported fixes may mean this system is not actually vulnerable."
                    ),
                    remediation=(
                        f"1. Verify the installed patch level for {obs.product} on this host.\n"
                        f"2. Apply the upstream patch or upgrade to a version not affected by {cve_id}.\n"
                        f"3. Review vendor advisory and confirm remediation status.\n"
                        f"4. If upgrading is not immediately possible, restrict FTP access to trusted IPs.\n"
                        f"5. Validate remediation with authorized penetration testing."
                    ),
                    rule_version=self.rule_version,
                    cves=[cve_ref],
                ))

        return findings
