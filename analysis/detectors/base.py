"""
Base detector interface.
Each concrete detector implements evaluate() against a ServiceObservation
and returns a list of Finding objects (possibly empty).
"""
from abc import ABC, abstractmethod
from typing import List
from ..models import ServiceObservation, Finding


class BaseDetector(ABC):
    """Abstract base class for all protocol detectors."""

    @property
    @abstractmethod
    def supported_protocol(self) -> str:
        """Return the service_type string this detector handles (e.g. 'ftp')."""
        ...

    @property
    @abstractmethod
    def rule_version(self) -> str:
        """Semver rule version — stored with every finding for reproducibility."""
        ...

    @abstractmethod
    def evaluate(self, obs: ServiceObservation) -> List[Finding]:
        """
        Evaluate a single service observation.
        Returns zero or more Finding objects.
        Must not raise — return empty list on errors.
        """
        ...

    def can_handle(self, obs: ServiceObservation) -> bool:
        """Return True if this detector is applicable to the given observation."""
        return (obs.service_type or "").lower() == self.supported_protocol.lower()
