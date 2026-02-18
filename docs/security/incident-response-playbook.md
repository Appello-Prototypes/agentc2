# Incident Response Playbook

## Severity Levels

- SEV-1: Active breach, unauthorized data exposure, platform-wide outage.
- SEV-2: High-risk vulnerability exploited in limited scope.
- SEV-3: Security weakness without confirmed exploitation.

## Response Workflow

1. Detect and triage incident.
2. Contain impact (disable endpoints, rotate keys, restrict access).
3. Eradicate root cause (patch, config correction, dependency update).
4. Recover services and validate integrity.
5. Conduct post-incident review and control improvements.

## Immediate Containment Actions

- Revoke compromised API keys and tokens.
- Disable vulnerable tools or routes via feature flags.
- Increase rate-limit strictness on abused endpoints.
- Enforce maintenance mode for affected surfaces if required.

## Communications

- Internal incident channel and status updates every 30 minutes for SEV-1.
- Customer communication drafted by incident commander and compliance owner.
- Regulatory notification process triggered per applicable law.

## Evidence and Postmortem

- Preserve logs, traces, and timeline events.
- Document blast radius, data classes affected, and remediation.
- Track action items to closure with owners and due dates.
