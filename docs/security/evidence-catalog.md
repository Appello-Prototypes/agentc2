# Security Evidence Catalog

## Purpose

Defines the recurring artifacts to collect for SOC 2 audits and internal security reviews.

## Evidence Inventory

| Artifact                          | Source                          | Frequency           | Retention |
| --------------------------------- | ------------------------------- | ------------------- | --------- |
| API authz integration test report | `tests/integration/api/` CI job | Per merge to main   | 1 year    |
| Dependency vulnerability report   | `bun audit` CI job              | Daily and per merge | 1 year    |
| Type/lint/build verification logs | CI pipeline                     | Per merge           | 1 year    |
| Security header snapshot          | HTTP smoke test in CI           | Per merge           | 1 year    |
| Guardrail policy change log       | `audit_log` table               | Real-time           | 2 years   |
| Credential access/rotation log    | `audit_log` table               | Real-time           | 2 years   |
| Incident response drill notes     | Security runbook execution      | Quarterly           | 2 years   |
| Access review sign-off            | Org role review document        | Quarterly           | 2 years   |

## Collection Responsibilities

- Platform Engineering: CI artifacts, route and tool security tests.
- Security Engineering: vulnerability triage reports, risk acceptance records.
- Compliance Owner: policy attestations and quarterly review notes.

## Acceptance Criteria

- Every control in the SOC 2 matrix has at least one current artifact.
- No critical or high vulnerabilities remain untriaged beyond SLA.
- Evidence is timestamped, immutable, and attributable to an owner.
