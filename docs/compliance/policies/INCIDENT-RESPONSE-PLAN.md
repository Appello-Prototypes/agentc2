# Incident Response Plan

**Document Classification:** INTERNAL – RESTRICTED  
**Policy ID:** IRP-001  
**Version:** 1.0  
**Effective Date:** [DATE]  
**Approved By:** [CEO/CTO NAME]  
**Document Owner:** CISO  
**Review Cadence:** Annually (and after each significant incident)  
**Framework Reference:** SOC 2 CC7.3-7.5 / ISO 27001 A.5.24-5.28 / NIST CSF RS.RP, RS.AN, RS.MI, RS.CO

---

## 1. Purpose

This plan establishes procedures for detecting, responding to, recovering from, and learning from security incidents affecting AgentC2 systems, data, or customers.

## 2. Scope

All security events and incidents affecting AgentC2 infrastructure, applications, data, and customer data.

## 3. Definitions

| Term                  | Definition                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Security Event**    | An observable occurrence relevant to information security                                           |
| **Security Incident** | A security event that has been confirmed as a threat to confidentiality, integrity, or availability |
| **Data Breach**       | Unauthorized access to, disclosure of, or loss of personal data                                     |

## 4. Incident Classification

| Severity          | Criteria                                                        | Response Time      | Examples                                                               |
| ----------------- | --------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| **P1 — Critical** | Active breach, data exfiltration confirmed, multi-tenant impact | Immediate (1 hour) | Database breach, credential theft, ransomware, supply chain compromise |
| **P2 — High**     | Confirmed unauthorized access, single-tenant impact             | 4 hours            | Tenant isolation failure, unauthorized data access, API key exposure   |
| **P3 — Medium**   | Suspected unauthorized access, no confirmed exfiltration        | 24 hours           | Suspicious login patterns, anomalous API usage, guardrail abuse        |
| **P4 — Low**      | Security event, no data impact                                  | 72 hours           | Blocked brute-force, failed injection attempt, expired certificate     |

## 5. Incident Response Team

| Role                    | Responsibilities                                      | Primary       | Backup           |
| ----------------------- | ----------------------------------------------------- | ------------- | ---------------- |
| **Incident Commander**  | Overall incident management, communication, decisions | CISO          | CTO              |
| **Technical Lead**      | Investigation, containment, remediation               | CTO           | Senior Engineer  |
| **Communications Lead** | Customer/regulatory/public communication              | CEO           | CISO             |
| **Legal Advisor**       | Regulatory obligations, evidence preservation         | Legal Counsel | External Counsel |

## 6. Response Phases

### Phase 1: Detection & Triage (T+0 to T+1 hour)

1. **Detect** — Incident identified through:
    - Automated alerts (rate limiting, guardrail events, error rate spikes)
    - Audit log review
    - Employee report
    - Customer report
    - External disclosure

2. **Triage** — On-call personnel:
    - Validate the incident (false positive check)
    - Classify severity (P1-P4)
    - Activate Incident Response Team if P1 or P2
    - Create incident tracking record
    - Begin incident timeline documentation

### Phase 2: Containment (T+1 to T+4 hours)

**Immediate containment actions (as applicable):**

- Revoke compromised credentials (API keys, OAuth tokens, session tokens)
- Rotate encryption keys (`CREDENTIAL_ENCRYPTION_KEY`)
- Block suspicious IP addresses at firewall/Caddy level
- Disable compromised user accounts
- Isolate affected tenant data
- Suspend affected agent executions
- Preserve evidence (logs, database snapshots, memory dumps)
- Enable enhanced logging if not already active

**DO NOT:**

- Delete logs or evidence
- Modify affected systems without documenting changes
- Communicate externally before authorized by Incident Commander
- Restore from backup before forensic preservation

### Phase 3: Investigation (T+4 to T+48 hours)

1. **Scope determination:**
    - Which systems were affected?
    - Which tenants/customers were impacted?
    - What data was accessed, modified, or exfiltrated?
    - What was the attack vector?
    - What was the timeline of the incident?

2. **Evidence collection:**
    - Audit logs (`AuditLog`, `AdminAuditLog`, `FederationAuditLog`)
    - Application logs (PM2 logs)
    - Caddy access logs
    - Observability traces
    - Database query logs (if available)
    - Git commit history (if code-related)

3. **Root cause analysis:**
    - Identify the vulnerability or control failure
    - Determine if the incident is ongoing
    - Assess whether additional systems are at risk

### Phase 4: Eradication (T+24 to T+72 hours)

- Remove attacker access (all entry points)
- Patch the vulnerability that enabled the incident
- Rotate all potentially compromised keys and credentials
- Verify containment is effective
- Deploy additional monitoring for recurrence

### Phase 5: Recovery (T+48 to T+168 hours)

- Restore affected systems to known-good state
- Verify data integrity
- Re-enable services with enhanced monitoring
- Confirm no persistence mechanisms remain
- Validate all security controls operational

### Phase 6: Post-Incident Review (T+7 to T+30 days)

- Conduct post-incident review meeting with all responders
- Document:
    - Incident timeline (detection to resolution)
    - Root cause
    - Impact assessment
    - Response effectiveness
    - Lessons learned
    - Control improvements required
- Update incident response procedures based on lessons learned
- Update risk register
- File incident report

## 7. Communication Plan

### Internal Communication

| Audience               | Trigger               | Channel                           | Responsibility     |
| ---------------------- | --------------------- | --------------------------------- | ------------------ |
| Incident Response Team | P1-P2 confirmed       | Secure channel (Slack DM or call) | On-call / CISO     |
| Executive Team         | P1 confirmed, any P2  | Direct briefing                   | Incident Commander |
| All employees          | P1 (if public-facing) | Company-wide communication        | CEO                |

### External Communication

| Audience                     | Trigger                                       | Timeline                        | Responsibility      |
| ---------------------------- | --------------------------------------------- | ------------------------------- | ------------------- |
| Affected customers           | Confirmed data breach affecting their data    | Within 48 hours of confirmation | Communications Lead |
| Supervisory authority (GDPR) | Breach with risk to data subjects             | Within 72 hours (Art. 33)       | Legal Advisor       |
| OPC (PIPEDA)                 | Breach with "real risk of significant harm"   | As soon as feasible             | Legal Advisor       |
| State AG offices (US)        | Per applicable state breach notification laws | Per state requirements (varies) | Legal Advisor       |
| Data subjects (individuals)  | High risk to individuals (GDPR Art. 34)       | Without undue delay             | Communications Lead |
| Law enforcement              | If criminal activity suspected                | Per legal advice                | Legal Advisor       |

### Communication Templates

See PRIVACY-DATA-PROTECTION.md §10.4 for notification templates.

## 8. Evidence Preservation

- All evidence shall be preserved with chain-of-custody documentation
- Do not modify, delete, or overwrite logs during an active investigation
- Database snapshots shall be taken before any remediation actions
- Screen captures and exports of relevant dashboards shall be saved
- All incident-related communications shall be preserved
- Legal hold shall be applied to all relevant data stores if litigation is anticipated

## 9. Regulatory Notification Decision Tree

```
Incident Confirmed
    │
    ├── Personal data involved?
    │   ├── NO → Internal incident report only
    │   └── YES
    │       ├── Risk to data subjects?
    │       │   ├── LOW (encrypted data, no access confirmed) → Log, no external notification
    │       │   ├── MEDIUM → Notify customers (48h), assess regulatory notification
    │       │   └── HIGH → Notify customers (48h), notify regulators (72h), notify individuals
    │       │
    │       ├── GDPR applies? → Notify supervisory authority within 72 hours
    │       ├── PIPEDA applies? → Notify OPC if "real risk of significant harm"
    │       ├── CCPA applies? → Notify AG if >500 California residents
    │       └── Other state laws? → Follow state-specific requirements
    │
    └── Infrastructure only (no data)?
        └── Internal incident report, remediation, monitoring
```

## 10. Tabletop Exercise Schedule

| Exercise                    | Frequency     | Scenario Examples                                                                        |
| --------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| Tabletop (discussion-based) | Semi-annually | Database breach, credential theft, insider threat, prompt injection leading to data leak |
| Functional exercise         | Annually      | Simulated breach with timed response                                                     |
| Communication drill         | Annually      | Test notification procedures with mock customer notifications                            |

## 11. Metrics & Reporting

| Metric                           | Target             | Reporting    |
| -------------------------------- | ------------------ | ------------ |
| Mean Time to Detect (MTTD)       | < 4 hours          | Quarterly    |
| Mean Time to Contain (MTTC)      | < 8 hours (P1-P2)  | Per incident |
| Mean Time to Resolve (MTTR)      | < 72 hours (P1-P2) | Per incident |
| Post-incident review completion  | 100% (P1-P3)       | Per incident |
| Tabletop exercises conducted     | ≥ 2 per year       | Annual       |
| Regulatory notifications on time | 100%               | Per incident |

---

**Approval:**

| Role    | Name | Signature | Date |
| ------- | ---- | --------- | ---- |
| CEO/CTO |      |           |      |
| CISO    |      |           |      |
