from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum


class RiskTier(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFORMATIONAL = "INFORMATIONAL"
    NEEDS_VERIFICATION = "NEEDS_VERIFICATION"


class Confidence(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class VerificationStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    LIKELY = "LIKELY"
    POTENTIAL = "POTENTIAL"
    UNVERIFIED = "UNVERIFIED"


class ObservationExtra(BaseModel):
    ftp_anonymous: Optional[bool] = None
    redis_auth_required: Optional[bool] = None
    mongodb_auth: Optional[bool] = None
    banner_raw: Optional[str] = None


class ServiceObservation(BaseModel):
    observation_id: str
    port: int
    service_type: Optional[str] = None
    product: Optional[str] = None
    version: Optional[str] = None
    banner: Optional[str] = None
    observed_at: Optional[str] = None
    extra: ObservationExtra = Field(default_factory=ObservationExtra)


class CVEReference(BaseModel):
    cve_id: str
    match_rationale: str
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    description: Optional[str] = None


class Finding(BaseModel):
    observation_id: str
    finding_type: str
    severity: RiskTier
    confidence: Confidence
    risk_tier: RiskTier
    verification_status: VerificationStatus
    evidence: Dict[str, Any] = Field(default_factory=dict)
    rationale: str
    remediation: str
    rule_version: str = "1.0.0"
    cves: List[CVEReference] = Field(default_factory=list)


class AnalysisRequest(BaseModel):
    assessment_id: str
    target: str
    protocols: List[str]
    observations: List[ServiceObservation]


class AnalysisResponse(BaseModel):
    assessment_id: str
    findings: List[Finding]
    observation_count: int
    finding_count: int
