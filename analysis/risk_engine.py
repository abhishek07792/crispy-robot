"""
Risk Engine — deterministic, explainable tier calculation.

Rules documented in docs/SCORING_METHODOLOGY.md

Inputs per finding:
  - cvss_score (from CVE match, or None for config findings)
  - configuration_severity (from detector)
  - applicability_confidence (HIGH/MEDIUM/LOW)
  - exposure_context (derived from port + service type)
  - verification_status

Final tier mapping:
  CRITICAL  → cvss >= 9.0  AND confidence >= MEDIUM  AND exposure is public-facing port
  HIGH      → cvss >= 7.0  OR (config_sev = CRITICAL/HIGH AND confidence >= MEDIUM)
  MEDIUM    → cvss >= 4.0  OR (config_sev = MEDIUM AND confidence >= LOW)
  LOW       → cvss < 4.0   OR informational config indicator
  NEEDS_VERIFICATION → evidence insufficient for classification

Confidence is preserved from the detector — not recalculated here.
Risk tier may be DOWNGRADED if verification_status is UNVERIFIED.
"""
try:
    from analysis.models import Finding, RiskTier, Confidence, VerificationStatus
except ImportError:
    from .models import Finding, RiskTier, Confidence, VerificationStatus  # type: ignore

# Ports typically exposed on public internet
PUBLIC_FACING_PORTS = {21, 22, 25, 80, 110, 143, 443, 445, 3389, 6379, 27017}


def compute_risk_tier(finding: Finding, cvss_score: float | None = None) -> RiskTier:
    """
    Compute / validate the risk tier for a finding.
    Returns the recommended tier; caller updates finding.risk_tier.
    """
    port = finding.evidence.get("port")
    is_public = int(port) in PUBLIC_FACING_PORTS if port is not None else True
    conf = finding.confidence

    # Downgrade unverified findings to NEEDS_VERIFICATION
    if finding.verification_status == VerificationStatus.UNVERIFIED:
        return RiskTier.NEEDS_VERIFICATION

    # CVE-based scoring
    if cvss_score is not None:
        if cvss_score >= 9.0 and conf != Confidence.LOW and is_public:
            return RiskTier.CRITICAL
        if cvss_score >= 7.0 and conf != Confidence.LOW:
            return RiskTier.HIGH
        if cvss_score >= 4.0:
            return RiskTier.MEDIUM
        return RiskTier.LOW

    # Config-based: use the severity the detector declared
    return finding.severity


def apply_risk_engine(findings: list[Finding]) -> list[Finding]:
    """Apply risk engine to a list of findings, updating risk_tier based on CVSS and context."""
    result = []
    for f in findings:
        # Extract CVSS from CVE references if available
        cvss = max((c.cvss_score for c in f.cves if c.cvss_score is not None), default=None)
        computed_tier = compute_risk_tier(f, cvss_score=cvss)
        # Update tier if the computed tier differs from the detector's tier
        if computed_tier != f.risk_tier:
            f = f.model_copy(update={"risk_tier": computed_tier})
        result.append(f)
    return result


def _tier_rank(t: RiskTier) -> int:
    return {
        RiskTier.CRITICAL: 5,
        RiskTier.HIGH: 4,
        RiskTier.MEDIUM: 3,
        RiskTier.LOW: 2,
        RiskTier.INFORMATIONAL: 1,
        RiskTier.NEEDS_VERIFICATION: 0,
    }.get(t, 0)
