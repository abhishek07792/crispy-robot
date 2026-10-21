"""
Finding aggregator — deduplicates findings across detectors for the same observation.
"""
try:
    from analysis.models import Finding
    from analysis.risk_engine import _tier_rank
except ImportError:
    from .models import Finding  # type: ignore
    from .risk_engine import _tier_rank  # type: ignore


def deduplicate_findings(findings: list[Finding]) -> list[Finding]:
    """
    Remove duplicate findings for the same observation+finding_type combination.
    Keeps the highest-risk-tier version.
    """
    seen: dict[str, Finding] = {}
    for f in findings:
        key = f"{f.observation_id}::{f.finding_type}"
        if key not in seen:
            seen[key] = f
        else:
            existing = seen[key]
            if _tier_rank(f.risk_tier) > _tier_rank(existing.risk_tier):
                seen[key] = f
    return list(seen.values())

