# Risk Scoring Methodology

## Overview

The VAPT Framework uses a **deterministic, explainable** risk scoring engine. Every finding receives a `risk_tier`, `confidence`, and `verification_status` that are fully traceable to the input evidence. Given the same evidence and rule version, the same tier is always produced.

## Inputs

Each finding is scored based on:

| Input | Source | Description |
|-------|--------|-------------|
| `cvss_score` | NVD CVE record | CVSS base score (v3.1 preferred, v2 fallback) |
| `configuration_severity` | Protocol detector | Detector-determined severity for config findings |
| `applicability_confidence` | Protocol detector | HIGH / MEDIUM / LOW — how certain we are the finding applies |
| `exposure_context` | Port number | Whether the port is typically public-facing |
| `verification_status` | Detector evidence | CONFIRMED / LIKELY / POTENTIAL / UNVERIFIED |

## Risk Tier Mapping

### CVE-Based Findings

| CVSS Score | Confidence | Exposure | Resulting Tier |
|-----------|-----------|----------|---------------|
| ≥ 9.0 | ≥ MEDIUM | Public-facing port | **CRITICAL** |
| ≥ 9.0 | LOW | Any | HIGH |
| ≥ 7.0 | ≥ MEDIUM | Any | **HIGH** |
| ≥ 4.0 | Any | Any | **MEDIUM** |
| < 4.0 | Any | Any | **LOW** |

### Configuration-Based Findings

For findings without CVE matches (e.g., anonymous FTP, unauthenticated Redis), the **detector's declared severity** is used directly.

### Verification Override

Any finding with `verification_status = UNVERIFIED` is automatically downgraded to `NEEDS_VERIFICATION`, regardless of CVSS or configuration severity.

## Confidence Levels

| Level | Meaning | Example |
|-------|---------|---------|
| **HIGH** | Strong, structured evidence | Shodan `ftp.anonymous = true` field |
| **MEDIUM** | Pattern-based evidence | Banner regex match, version string match |
| **LOW** | Insufficient or ambiguous evidence | Port open but no auth indicator |

## Verification Status

| Status | Meaning |
|--------|---------|
| **CONFIRMED** | Evidence from structured, reliable source |
| **LIKELY** | Strong indicator but not independently verified |
| **POTENTIAL** | Pattern match only — requires manual verification |
| **UNVERIFIED** | Insufficient evidence to classify |

## What Findings Do NOT Prove

Every finding includes a `what_this_does_not_prove` field. Common disclaimers:

1. **Shodan data may be stale** — observations reflect indexed state, not live configuration
2. **CVE match ≠ exploitability** — vendor backports, custom patches, and config hardening may mitigate
3. **Port exposure ≠ reachability** — firewalls, VPCs, and ACLs may block access
4. **Version match ≠ vulnerability** — distro-level patches may fix without changing version strings
5. **No active testing performed** — all data is passively sourced

## Deduplication

When multiple detectors produce findings for the same `observation_id + finding_type`:
- Only the highest-risk-tier version is kept
- Lower-risk duplicates are silently removed
- This prevents count inflation in reports

## Reproducibility

All findings include a `rule_version` field (e.g., `1.0.0`). The same rule version + same evidence will always produce the same risk tier. Rule version changes are documented in detector changelogs.

## Public-Facing Ports

The following ports are considered "public-facing" for exposure context:

```
21 (FTP), 22 (SSH), 25 (SMTP), 80 (HTTP), 110 (POP3),
143 (IMAP), 443 (HTTPS), 445 (SMB), 3389 (RDP),
6379 (Redis), 27017 (MongoDB)
```
