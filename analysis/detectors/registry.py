"""
Detector Registry — routes observations to the appropriate detector(s).
"""
from typing import List
from ..models import ServiceObservation, Finding
from .ftp_detector import FTPDetector
from .redis_detector import RedisDetector
from .mongodb_detector import MongoDBDetector

_DETECTORS = [FTPDetector(), RedisDetector(), MongoDBDetector()]


def run_detectors(obs: ServiceObservation, protocols: List[str]) -> List[Finding]:
    """Run all applicable detectors for a service observation."""
    findings: List[Finding] = []
    service = (obs.service_type or "").lower()
    for detector in _DETECTORS:
        if detector.supported_protocol not in protocols:
            continue
        if detector.can_handle(obs):
            findings.extend(detector.evaluate(obs))
    return findings
