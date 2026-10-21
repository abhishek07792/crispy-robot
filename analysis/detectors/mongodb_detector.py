"""
MongoDB Protocol Detector — architecture-ready.
Auth and version logic implemented but marked POTENTIAL/UNVERIFIED.
Binding to 0.0.0.0 does NOT by itself prove public reachability.

Rule version: 1.0.0
"""
import logging
from typing import List
from .base import BaseDetector
from ..models import ServiceObservation, Finding, RiskTier, Confidence, VerificationStatus

logger = logging.getLogger(__name__)


class MongoDBDetector(BaseDetector):
    @property
    def supported_protocol(self) -> str:
        return "mongodb"

    @property
    def rule_version(self) -> str:
        return "1.0.0"

    def evaluate(self, obs: ServiceObservation) -> List[Finding]:
        findings: List[Finding] = []
        try:
            evidence = {
                "port": obs.port,
                "product": obs.product,
                "version": obs.version,
                "what_this_does_not_prove": (
                    "Binding to 0.0.0.0 means listening on all IPv4 interfaces "
                    "in the relevant namespace — it does NOT prove public reachability "
                    "or that authentication is absent. Verify with authorized access."
                ),
            }
            if obs.extra.mongodb_auth is False:
                findings.append(Finding(
                    observation_id=obs.observation_id,
                    finding_type="MONGODB_NO_AUTHENTICATION_INDICATOR",
                    severity=RiskTier.CRITICAL,
                    confidence=Confidence.MEDIUM,
                    risk_tier=RiskTier.HIGH,
                    verification_status=VerificationStatus.POTENTIAL,
                    evidence=evidence,
                    rationale=(
                        "Shodan metadata indicates MongoDB authentication may not be enabled. "
                        "This is POTENTIAL — binding address and auth config must be verified."
                    ),
                    remediation=(
                        "1. Enable MongoDB authentication (--auth flag or security.authorization: enabled).\n"
                        "2. Bind to localhost or private IP (net.bindIp).\n"
                        "3. Restrict port 27017 via firewall rules.\n"
                        "4. Use TLS for MongoDB connections.\n"
                        "5. Verify with authorized testing."
                    ),
                    rule_version=self.rule_version,
                    cves=[],
                ))
            elif obs.extra.mongodb_auth is None:
                findings.append(Finding(
                    observation_id=obs.observation_id,
                    finding_type="MONGODB_AUTHENTICATION_STATUS_UNKNOWN",
                    severity=RiskTier.NEEDS_VERIFICATION,
                    confidence=Confidence.LOW,
                    risk_tier=RiskTier.NEEDS_VERIFICATION,
                    verification_status=VerificationStatus.UNVERIFIED,
                    evidence=evidence,
                    rationale="MongoDB observed but authentication status cannot be determined from available evidence.",
                    remediation="Verify MongoDB authentication configuration with authorized access.",
                    rule_version=self.rule_version,
                    cves=[],
                ))
        except Exception as e:
            logger.error(f"MongoDBDetector error: {e}")
        return findings
