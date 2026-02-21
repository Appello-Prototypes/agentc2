# Vendor Risk Management Policy

**Document Classification:** INTERNAL  
**Policy ID:** VRM-001  
**Version:** 1.0  
**Effective Date:** [DATE]  
**Approved By:** [CEO/CTO NAME]  
**Document Owner:** CISO  
**Review Cadence:** Annually  
**Framework Reference:** SOC 2 CC9.1-9.2 / ISO 27001 A.5.19-5.23 / NIST CSF GV.SC

---

## 1. Purpose

This policy establishes requirements for assessing, managing, and monitoring risks associated with third-party vendors and subprocessors that access, process, or store Company or customer data.

## 2. Scope

All third-party vendors, subprocessors, and service providers that: (a) process personal data on behalf of the Company or its customers; (b) have access to Company systems or networks; (c) provide services critical to platform operations; or (d) handle sensitive or confidential information.

## 3. Vendor Classification

### 3.1 Risk Tiers

| Tier         | Criteria                                                                                       | Examples                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Critical** | Direct access to customer data; platform cannot operate without them; processes sensitive data | Supabase (database), OpenAI (LLM), Anthropic (LLM), Digital Ocean (hosting) |
| **High**     | Processes personal data; significant operational dependency                                    | ElevenLabs (voice), Slack (integration), Google/Microsoft (OAuth + email)   |
| **Medium**   | Limited data access; moderate operational impact                                               | HubSpot, Jira, Fathom, JustCall, Inngest                                    |
| **Low**      | No data access or only non-sensitive data; easily replaceable                                  | Upstash (rate limiting counters), ngrok (dev tunneling)                     |

### 3.2 Assessment Requirements by Tier

| Requirement                   | Critical | High           | Medium           | Low           |
| ----------------------------- | -------- | -------------- | ---------------- | ------------- |
| Full security risk assessment | ✅       | ✅             | ✅ (abbreviated) | —             |
| SOC 2 report review           | ✅       | ✅ (preferred) | Optional         | —             |
| DPA execution                 | ✅       | ✅             | If PII processed | —             |
| Penetration test review       | ✅       | Optional       | —                | —             |
| Insurance verification        | ✅       | Optional       | —                | —             |
| Review frequency              | Annually | Annually       | Every 2 years    | Every 3 years |
| Contractual security terms    | ✅       | ✅             | ✅               | Optional      |

## 4. Assessment Process

### 4.1 Pre-Engagement (New Vendors)

1. **Business justification** — Document why the vendor is needed and what alternatives were considered
2. **Data mapping** — Identify what data the vendor will access/process
3. **Tier classification** — Assign risk tier based on §3.1 criteria
4. **Security assessment** — Conduct assessment appropriate to tier:
    - Review SOC 2 Type II report (or equivalent)
    - Review privacy policy and DPA terms
    - Assess data residency and transfer mechanisms
    - Evaluate encryption and access control capabilities
    - Review incident response and breach notification commitments
5. **Risk acceptance** — Document residual risks and obtain approval:
    - Critical/High: CISO + executive approval
    - Medium: CISO approval
    - Low: Team lead approval
6. **Contractual protections** — Ensure DPA, security terms, and SLA are in place

### 4.2 Ongoing Monitoring

| Activity                   | Critical   | High          | Medium        | Low |
| -------------------------- | ---------- | ------------- | ------------- | --- |
| SOC 2 report re-review     | Annually   | Annually      | —             | —   |
| Security questionnaire     | Annually   | Every 2 years | Every 3 years | —   |
| Incident/breach monitoring | Continuous | Continuous    | Quarterly     | —   |
| Performance/SLA review     | Quarterly  | Semi-annually | Annually      | —   |
| DPA/contract review        | Annually   | Annually      | Every 2 years | —   |
| Subprocessor change review | Per change | Per change    | —             | —   |

### 4.3 Vendor Assessment Questionnaire (Key Themes)

For Critical and High tier vendors, assess the following:

1. **Certifications:** SOC 2, ISO 27001, HIPAA, PCI DSS, FedRAMP
2. **Encryption:** At rest and in transit standards
3. **Access control:** RBAC, MFA, privileged access management
4. **Data handling:** Retention, deletion, residency, backup
5. **Incident response:** Breach notification timelines, IRP existence
6. **Personnel security:** Background checks, training, NDAs
7. **Business continuity:** DR plan, RTO/RPO, tested recovery
8. **Subprocessors:** Their own subprocessor chain
9. **Regulatory compliance:** GDPR, CCPA, PIPEDA compliance
10. **Insurance:** Cyber liability insurance coverage

## 5. Subprocessor Management

### 5.1 Customer Notification

- Maintain a current list of all subprocessors
- Provide 30 days' advance notice of subprocessor additions or changes (per DPA)
- Publish subprocessor list at an accessible URL
- Allow customers to object to new subprocessors per DPA terms

### 5.2 Subprocessor Requirements

All subprocessors must:

- Execute a DPA with equivalent data protection obligations
- Maintain appropriate security certifications (SOC 2 preferred)
- Support data deletion upon contract termination
- Cooperate with breach notification requirements
- Comply with international data transfer requirements

## 6. Vendor Termination

Upon vendor termination or replacement:

1. Confirm deletion/return of all Company and customer data
2. Obtain written certification of data deletion
3. Revoke all access credentials
4. Update subprocessor list and notify customers
5. Update risk register
6. Archive vendor assessment documentation

## 7. Exceptions

Exceptions to this policy must be documented with:

- Business justification
- Risk assessment of the exception
- Compensating controls
- Time limit for the exception
- CISO approval (Critical/High) or team lead approval (Medium/Low)

## 8. Responsibilities

| Role             | Responsibility                                                  |
| ---------------- | --------------------------------------------------------------- |
| CISO             | Policy ownership, Critical/High vendor approvals, risk register |
| Engineering Lead | Technical assessment, integration security review               |
| Legal Counsel    | DPA negotiation, contractual terms review                       |
| Procurement      | Vendor engagement, contract management                          |
| Team Leads       | Medium/Low vendor evaluations, ongoing relationship management  |

---

**Approval:**

| Role    | Name | Signature | Date |
| ------- | ---- | --------- | ---- |
| CEO/CTO |      |           |      |
| CISO    |      |           |      |
