"""
Redis Protocol Detector — fully implemented.

Evaluates:
- Authentication indicators from Shodan-indexed Redis metadata
- Service exposure context
- Product/version CVE matching

Rules:
  REDIS-001: Redis exposed without authentication indicator
  REDIS-002: Redis version-based CVE match

Rule version: 1.0.0

IMPORTANT: Missing authentication information does NOT prove authentication
is disabled. We require a positive indicator. Exposure on port 6379 alone
is not sufficient to classify as unauthenticated.
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

REDIS_CVES = [
    ("CVE-2022-0543",  r"^(5\.|6\.[01])", 10.0,  "Lua sandbox escape leading to RCE (Debian/Ubuntu packages)"),
    ("CVE-2021-32761", r"^(2\.|3\.|4\.|5\.|6\.0)", 7.7, "Integer overflow in COPY command"),
    ("CVE-2023-28856", r"^(7\.0\.[0-4]|6\.)",  6.5,  "LMPOP command crash (DoS) in Redis 7.0.x"),
]

NO_AUTH_BANNER_PATTERNS = [
    r"(?i)requirepass\s+\"?\"",    # empty requirepass in config dump
    r"(?i)# requirepass foobared", # default commented-out (sometimes leaks in INFO)
]

AUTH_REQUIRED_PATTERNS = [
    r"NOAUTH",
    r"Authentication required",
    r"-ERR.*AUTH",
]


class RedisDetector(BaseDetector):
    """Redis protocol detector: auth indicators + version CVEs."""

    @property
    def supported_protocol(self) -> str:
        return "redis"

    @property
    def rule_version(self) -> str:
        return "1.0.0"

    def evaluate(self, obs: ServiceObservation) -> List[Finding]:
        findings: List[Finding] = []
        try:
            auth_finding = self._check_auth(obs)
            if auth_finding:
                findings.append(auth_finding)
            findings.extend(self._check_version_cves(obs))
        except Exception as e:
            logger.error(f"RedisDetector error for obs {obs.observation_id}: {e}")
        return findings

    def _check_auth(self, obs: ServiceObservation) -> Optional[Finding]:
        """
        Check for Redis authentication indicators.

        Evidence hierarchy (most → least reliable):
        1. Shodan redis.auth_required structured field
        2. Banner/data string patterns
        3. Default Redis port exposure — NOT sufficient alone

        We do NOT assume auth is absent merely because the port is 6379
        or because we have no explicit auth indicator. If we cannot
        determine auth status, we return a NEEDS_VERIFICATION finding.
        """
        banner = obs.banner or obs.extra.banner_raw or ""
        evidence: dict = {
            "port": obs.port,
            "service_type": obs.service_type,
        }
        if obs.observed_at:
            evidence["shodan_observed_at"] = obs.observed_at

        # ── Case 1: Shodan structured field ──────────────────────────────────
        if obs.extra.redis_auth_required is False:
            # Positive indicator: auth is explicitly false
            evidence["shodan_redis_auth_required"] = False
            evidence["evidence_quality"] = "HIGH"
            evidence["what_this_does_not_prove"] = (
                "This finding does not confirm unauthenticated access was achieved. "
                "Shodan data may be stale. Network-level controls (firewall, VPC) "
                "may still restrict access. Verify with authorized testing."
            )
            return Finding(
                observation_id=obs.observation_id,
                finding_type="REDIS_NO_AUTHENTICATION_INDICATOR",
                severity=RiskTier.CRITICAL,
                confidence=Confidence.HIGH,
                risk_tier=RiskTier.CRITICAL,
                verification_status=VerificationStatus.LIKELY,
                evidence=evidence,
                rationale=(
                    f"Shodan's structured Redis metadata indicates authentication "
                    f"is not required on port {obs.port}. "
                    "An unauthenticated Redis instance can expose all cached data, "
                    "allow arbitrary command execution (via EVAL/Lua), and potentially "
                    "enable configuration manipulation or file write through CONFIG SET. "
                    "Confidence is HIGH based on Shodan structured field; "
                    "verification_status is LIKELY since Shodan data may not reflect "
                    "the current live configuration."
                ),
                remediation=(
                    "1. Enable Redis authentication: set 'requirepass <strong_password>' in redis.conf.\n"
                    "2. Bind Redis to localhost or a private interface (bind 127.0.0.1).\n"
                    "3. Apply firewall/security-group rules to block port 6379 from public access.\n"
                    "4. Use Redis ACLs (Redis 6+) for fine-grained access control.\n"
                    "5. Enable TLS for Redis connections (Redis 6+ with TLS build).\n"
                    "6. Validate remediation with authorized direct connection test."
                ),
                rule_version=self.rule_version,
                cves=[],
            )

        if obs.extra.redis_auth_required is True:
            # Auth is required — positive good state, no finding
            return None

        # ── Case 2: Banner pattern analysis ──────────────────────────────────
        if banner:
            for pattern in AUTH_REQUIRED_PATTERNS:
                if re.search(pattern, banner, re.IGNORECASE):
                    return None  # Auth is required per banner

            for pattern in NO_AUTH_BANNER_PATTERNS:
                if re.search(pattern, banner, re.IGNORECASE):
                    evidence["banner_pattern"] = pattern
                    evidence["banner_excerpt"] = banner[:200]
                    evidence["evidence_quality"] = "MEDIUM"
                    evidence["what_this_does_not_prove"] = (
                        "Banner pattern match is not conclusive. "
                        "The pattern may appear in debug output or comments."
                    )
                    return Finding(
                        observation_id=obs.observation_id,
                        finding_type="REDIS_NO_AUTHENTICATION_INDICATOR",
                        severity=RiskTier.HIGH,
                        confidence=Confidence.MEDIUM,
                        risk_tier=RiskTier.HIGH,
                        verification_status=VerificationStatus.POTENTIAL,
                        evidence=evidence,
                        rationale=(
                            f"Banner analysis for Redis on port {obs.port} contains a pattern "
                            "suggesting authentication may not be configured. "
                            "Evidence is lower-confidence than structured Shodan fields."
                        ),
                        remediation=(
                            "1. Enable 'requirepass' in redis.conf.\n"
                            "2. Bind to localhost/private interface.\n"
                            "3. Restrict port 6379 via firewall.\n"
                            "4. Verify with authorized testing before treating as confirmed."
                        ),
                        rule_version=self.rule_version,
                        cves=[],
                    )

        # ── Case 3: Insufficient evidence ────────────────────────────────────
        # Port 6379 is open but we have no auth indicator either way.
        # Return a NEEDS_VERIFICATION finding rather than assuming vulnerable.
        evidence["evidence_quality"] = "LOW"
        evidence["reason"] = "No structured auth field or conclusive banner pattern found."
        return Finding(
            observation_id=obs.observation_id,
            finding_type="REDIS_AUTHENTICATION_STATUS_UNKNOWN",
            severity=RiskTier.NEEDS_VERIFICATION,
            confidence=Confidence.LOW,
            risk_tier=RiskTier.NEEDS_VERIFICATION,
            verification_status=VerificationStatus.UNVERIFIED,
            evidence=evidence,
            rationale=(
                f"Redis service observed on port {obs.port} but authentication status "
                "cannot be determined from available Shodan evidence. "
                "Manual verification is required before assigning a risk tier."
            ),
            remediation=(
                "1. Verify Redis authentication configuration directly (with authorization).\n"
                "2. Ensure 'requirepass' is set and port 6379 is firewalled.\n"
                "3. Report status back to update this finding's verification status."
            ),
            rule_version=self.rule_version,
            cves=[],
        )

    def _check_version_cves(self, obs: ServiceObservation) -> List[Finding]:
        findings = []
        version = obs.version or (obs.extra.redis_auth_required is not None and "") or ""
        if not version:
            return findings

        for cve_id, ver_pattern, cvss, desc in REDIS_CVES:
            if not re.search(ver_pattern, version):
                continue
            tier = RiskTier.CRITICAL if cvss >= 9.0 else (RiskTier.HIGH if cvss >= 7.0 else RiskTier.MEDIUM)
            evidence = {
                "product": obs.product or "Redis",
                "version": version,
                "matched_cve": cve_id,
                "cvss": cvss,
                "what_this_does_not_prove": (
                    "Version pattern match does not confirm exploitability. "
                    "Distro-level patches may fix this. Verify with authorized testing."
                ),
            }
            findings.append(Finding(
                observation_id=obs.observation_id,
                finding_type=f"REDIS_VERSION_CVE_{cve_id.replace('-','_')}",
                severity=tier,
                confidence=Confidence.MEDIUM,
                risk_tier=tier,
                verification_status=VerificationStatus.POTENTIAL,
                evidence=evidence,
                rationale=(
                    f"Redis version '{version}' matches the affected range for {cve_id} "
                    f"(CVSS {cvss}): {desc}. This is a pattern-based match only."
                ),
                remediation=(
                    f"1. Upgrade Redis to a version not affected by {cve_id}.\n"
                    "2. Check your OS vendor's security advisory for backported patches.\n"
                    "3. Restrict Redis access to trusted networks while patching."
                ),
                rule_version=self.rule_version,
                cves=[CVEReference(
                    cve_id=cve_id,
                    match_rationale=f"Version '{version}' matched pattern '{ver_pattern}' for {cve_id}.",
                    cvss_score=cvss,
                    description=desc,
                )],
            ))
        return findings
