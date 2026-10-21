import os
import logging
from functools import wraps
from flask import Flask, request, jsonify
from pydantic import ValidationError
from .models import AnalysisRequest, AnalysisResponse
from .detectors.registry import run_detectors
from .risk_engine import apply_risk_engine
from .aggregator import deduplicate_findings

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ANALYSIS_SECRET = os.environ.get("ANALYSIS_SERVICE_SECRET", "")


def require_secret(f):
    """Guard internal endpoints with a shared secret header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if ANALYSIS_SECRET:
            provided = request.headers.get("X-Analysis-Secret", "")
            if provided != ANALYSIS_SECRET:
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "vapt-analysis"})


@app.post("/internal/analyze")
@require_secret
def analyze():
    """
    Analyze a batch of service observations and return findings.
    Called only by the Express backend (not exposed publicly).
    """
    try:
        req_data = AnalysisRequest.model_validate(request.get_json(force=True))
    except ValidationError as e:
        logger.warning(f"Invalid analysis request: {e}")
        return jsonify({"error": "Invalid request", "details": e.errors()}), 400

    all_findings = []

    for obs in req_data.observations:
        # Run applicable detectors
        findings = run_detectors(obs, req_data.protocols)
        all_findings.extend(findings)

    # Apply risk engine
    all_findings = apply_risk_engine(all_findings)

    # Deduplicate
    all_findings = deduplicate_findings(all_findings)

    response = AnalysisResponse(
        assessment_id=req_data.assessment_id,
        findings=all_findings,
        observation_count=len(req_data.observations),
        finding_count=len(all_findings),
    )

    logger.info(
        f"Analysis complete: assessment={req_data.assessment_id} "
        f"obs={response.observation_count} findings={response.finding_count}"
    )

    return jsonify(response.model_dump()), 200


if __name__ == "__main__":
    port = int(os.environ.get("ANALYSIS_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
