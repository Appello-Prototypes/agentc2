# SOC 2 Control Matrix

## Scope

This matrix maps key platform controls to SOC 2 Trust Services Criteria (Security, Availability, Confidentiality).

## Control Mapping

| Control ID | SOC 2 Criteria | Control Description                                                                           | Evidence Source                                             | Owner                |
| ---------- | -------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------- |
| SEC-001    | CC6.1, CC6.2   | Centralized authentication and organization-scoped authorization for API and MCP routes       | API route guard code, integration tests, access logs        | Platform Engineering |
| SEC-002    | CC6.6          | Role-based admin enforcement for sensitive org operations                                     | Membership role checks, audit logs                          | Platform Engineering |
| SEC-003    | CC7.1          | Input validation and schema enforcement (route and tool inputs)                               | Validation middleware and test fixtures                     | Platform Engineering |
| SEC-004    | CC7.2          | Rate limiting on high-cost and mutation endpoints                                             | Rate-limit policy config, runtime metrics                   | Platform Engineering |
| SEC-005    | CC6.7, C1.2    | Secrets handling and token protection (opaque tokens, masked API keys, encrypted credentials) | Token endpoint code, credential encryption code, audit logs | Security Engineering |
| SEC-006    | CC7.3          | Webhook signature verification fail-closed in production                                      | Slack/ElevenLabs route tests, runtime logs                  | Platform Engineering |
| SEC-007    | CC7.1, A1.2    | Sandbox and remote execution hardening (no unsafe fallback in prod, command escaping)         | Tool implementation diff, security tests                    | Platform Engineering |
| SEC-008    | CC8.1          | Security headers, CSP, CSRF checks                                                            | Next config headers, API CSRF checks                        | Platform Engineering |
| SEC-009    | CC7.1          | Dependency vulnerability management                                                           | `bun audit` output, CI workflow reports                     | Security Engineering |
| SEC-010    | CC7.4          | Audit trail for key management and guardrail updates                                          | `audit_log` rows and retention policy                       | Security Engineering |

## Control Operation Notes

- All production deployments require non-empty webhook secrets.
- Sensitive operations require admin or owner role.
- Cross-tenant reads are disallowed by organization-scoped lookups.
- Security-relevant events are logged and retained according to retention policy.

## Review Cadence

- Monthly: access-control tests and vulnerability scan review.
- Quarterly: control effectiveness review and evidence package refresh.
