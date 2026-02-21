# AgentC2 Enterprise Compliance Program

**Document Classification:** INTERNAL – RESTRICTED  
**Version:** 1.0  
**Effective Date:** February 21, 2026  
**Document Owner:** Chief Compliance & Security Officer  
**Review Cadence:** Quarterly

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Profile](#2-platform-profile)
3. [Compliance Gap Analysis](#3-compliance-gap-analysis)
4. [12-Month Compliance Roadmap](#4-12-month-compliance-roadmap)
5. [Control Matrix](#5-control-matrix)
6. [Risk Register](#6-risk-register)
7. [Enterprise Readiness Scorecard](#7-enterprise-readiness-scorecard)
8. [Vendor & Subprocessor Management](#8-vendor--subprocessor-management)
9. [Data Flow Architecture](#9-data-flow-architecture)
10. [Certification Sequencing](#10-certification-sequencing)
11. [Tooling Recommendations](#11-tooling-recommendations)
12. [Appendices](#appendices)

---

## 1. Executive Summary

AgentC2 is a multi-tenant AI Agent orchestration platform enabling enterprises to build, deploy, and manage AI agents with voice capabilities, MCP (Model Context Protocol) integrations, RAG pipelines, and background job processing. The platform processes customer data, connects to third-party SaaS systems (CRM, project management, communication), and routes information through LLM providers (OpenAI, Anthropic).

**Current State Assessment:**

| Domain                             | Maturity | Rating |
| ---------------------------------- | -------- | ------ |
| Authentication & Access Control    | Strong   | 8/10   |
| Encryption (at rest / in transit)  | Strong   | 8/10   |
| Multi-Tenant Isolation             | Strong   | 8/10   |
| Audit Logging                      | Strong   | 7/10   |
| Rate Limiting & Abuse Prevention   | Good     | 7/10   |
| Formal Policies & Procedures       | Gap      | 3/10   |
| Privacy Program (GDPR/PIPEDA/CCPA) | Partial  | 4/10   |
| SOC 2 Readiness                    | Gap      | 3/10   |
| AI Governance                      | Partial  | 4/10   |
| Business Continuity / DR           | Gap      | 3/10   |
| Vendor Risk Management             | Gap      | 2/10   |
| Security Awareness Training        | Gap      | 1/10   |
| Penetration Testing                | Gap      | 1/10   |

**Key Finding:** AgentC2 has built robust _technical_ security controls (encryption, RBAC, audit logging, rate limiting, CSRF protection, egress policies, guardrails). The primary gaps are _programmatic_ — formal policies, documented procedures, third-party attestations, and governance structures required by enterprise procurement and auditors.

**Estimated Time to SOC 2 Type I:** 4-6 months  
**Estimated Time to SOC 2 Type II:** 10-14 months (observation period begins after Type I)

---

## 2. Platform Profile

### 2.1 Architecture Overview

| Component                | Technology                   | Hosting                     |
| ------------------------ | ---------------------------- | --------------------------- |
| Frontend Application     | Next.js 16, React 19         | Digital Ocean Droplet       |
| Agent Application        | Next.js 16, Mastra Framework | Digital Ocean Droplet       |
| Admin Application        | Next.js 16                   | Digital Ocean Droplet       |
| Database                 | PostgreSQL (Supabase)        | Supabase Cloud (AWS)        |
| Vector Storage           | PostgreSQL pgvector          | Supabase Cloud (AWS)        |
| Process Manager          | PM2                          | Digital Ocean Droplet       |
| Reverse Proxy / TLS      | Caddy (Let's Encrypt)        | Digital Ocean Droplet       |
| Background Jobs          | Inngest                      | Inngest Cloud / Self-hosted |
| AI Providers             | OpenAI, Anthropic            | Provider Cloud              |
| Voice                    | ElevenLabs                   | Provider Cloud              |
| Webhook Tunneling        | ngrok (dev only)             | ngrok Cloud                 |
| Rate Limiting (optional) | Upstash Redis                | Upstash Cloud               |

### 2.2 Data Categories Processed

| Category                   | Examples                                      | Sensitivity            |
| -------------------------- | --------------------------------------------- | ---------------------- |
| Account Data               | Email, name, organization, role               | PII                    |
| Authentication Credentials | Session tokens, OAuth tokens, API keys        | Critical               |
| Conversation Data          | User prompts, agent responses, memory         | High (may contain PII) |
| Integration Credentials    | HubSpot tokens, Jira tokens, Slack tokens     | Critical               |
| CRM Data                   | Contacts, companies, deals, pipeline data     | High (may contain PII) |
| Communication Data         | Emails (Gmail), Slack messages, call logs     | High (PII)             |
| Document Data              | Uploaded files, RAG-ingested content          | Variable               |
| Voice Data                 | Audio streams, transcripts                    | High (PII)             |
| Meeting Data               | Fathom transcripts, summaries                 | High (PII)             |
| Audit Logs                 | User actions, tool executions, admin activity | Sensitive              |
| Agent Configuration        | Instructions, tool assignments, guardrails    | Business Confidential  |

### 2.3 Data Residency

| Data Store           | Location                                | Provider          |
| -------------------- | --------------------------------------- | ----------------- |
| PostgreSQL (primary) | AWS us-east-1 (Supabase)                | Supabase / AWS    |
| Application Server   | Digital Ocean (datacenter TBD)          | Digital Ocean     |
| AI Processing        | OpenAI Cloud (US), Anthropic Cloud (US) | OpenAI, Anthropic |
| Voice Processing     | ElevenLabs Cloud (US/EU)                | ElevenLabs        |
| Email Data           | Google Cloud (Gmail API)                | Google            |
| CRM Data             | HubSpot Cloud (US)                      | HubSpot           |

---

## 3. Compliance Gap Analysis

### 3.1 SOC 2 Trust Services Criteria Gaps

#### CC1 — Control Environment

| Control                          | Current State                                       | Gap                           | Priority | Effort |
| -------------------------------- | --------------------------------------------------- | ----------------------------- | -------- | ------ |
| CC1.1 — COSO Principles / Ethics | No formal code of ethics or conduct                 | **HIGH GAP** — Must formalize | Required | Low    |
| CC1.2 — Board Oversight          | No formal governance structure documented           | **HIGH GAP**                  | Required | Low    |
| CC1.3 — Organizational Structure | Roles exist but not formally documented             | **MEDIUM GAP**                | Required | Low    |
| CC1.4 — Competence               | No formal security training program                 | **HIGH GAP**                  | Required | Medium |
| CC1.5 — Accountability           | Audit logs exist, accountability structure informal | **MEDIUM GAP**                | Required | Low    |

#### CC2 — Communication and Information

| Control                        | Current State                                                            | Gap            | Priority | Effort |
| ------------------------------ | ------------------------------------------------------------------------ | -------------- | -------- | ------ |
| CC2.1 — Internal Communication | No formal information security awareness program                         | **HIGH GAP**   | Required | Medium |
| CC2.2 — External Communication | SECURITY.md exists; no formal customer-facing security page/trust center | **MEDIUM GAP** | Required | Medium |
| CC2.3 — System Description     | Not formalized for auditors                                              | **HIGH GAP**   | Required | Medium |

#### CC3 — Risk Assessment

| Control                        | Current State                       | Gap                            | Priority | Effort |
| ------------------------------ | ----------------------------------- | ------------------------------ | -------- | ------ |
| CC3.1 — Risk Objectives        | No formal risk management framework | **HIGH GAP**                   | Required | Medium |
| CC3.2 — Risk Identification    | Informal; no risk register          | **HIGH GAP** — Addressed in §6 | Required | Medium |
| CC3.3 — Fraud Risk             | Not assessed                        | **MEDIUM GAP**                 | Required | Low    |
| CC3.4 — Change Management Risk | No formal change management policy  | **HIGH GAP**                   | Required | Medium |

#### CC4 — Monitoring Activities

| Control                          | Current State                         | Gap            | Priority | Effort |
| -------------------------------- | ------------------------------------- | -------------- | -------- | ------ |
| CC4.1 — Ongoing Monitoring       | Audit logs exist; no SIEM or alerting | **MEDIUM GAP** | Required | High   |
| CC4.2 — Deficiency Communication | No formal process                     | **HIGH GAP**   | Required | Low    |

#### CC5 — Control Activities

| Control                       | Current State                            | Gap            | Priority   | Effort |
| ----------------------------- | ---------------------------------------- | -------------- | ---------- | ------ |
| CC5.1 — Control Selection     | Controls exist but not mapped to risks   | **MEDIUM GAP** | Required   | Medium |
| CC5.2 — Technology Controls   | Strong (encryption, RBAC, rate limiting) | **LOW GAP**    | Maintained | —      |
| CC5.3 — Policy-based Controls | Few formal policies                      | **HIGH GAP**   | Required   | High   |

#### CC6 — Logical and Physical Access

| Control                           | Current State                                            | Gap            | Priority   | Effort |
| --------------------------------- | -------------------------------------------------------- | -------------- | ---------- | ------ |
| CC6.1 — Access Provisioning       | Better Auth with RBAC, roles (owner/admin/member/viewer) | **LOW GAP**    | Maintained | —      |
| CC6.2 — Access Revocation         | Session management exists; no formal offboarding process | **MEDIUM GAP** | Required   | Low    |
| CC6.3 — Access Review             | No periodic access review process                        | **HIGH GAP**   | Required   | Medium |
| CC6.4 — Physical Access           | Cloud-hosted; relies on provider SOC 2                   | **N/A**        | Inherited  | —      |
| CC6.5 — Encryption                | AES-256-GCM at rest, TLS in transit. Strong.             | **NO GAP**     | Maintained | —      |
| CC6.6 — Threat Management         | No formal vulnerability management program               | **HIGH GAP**   | Required   | High   |
| CC6.7 — Identity Authentication   | Session-based auth, OAuth, API keys                      | **LOW GAP**    | Maintained | —      |
| CC6.8 — Infrastructure Protection | Caddy with security headers, CSP                         | **LOW GAP**    | Maintained | —      |

#### CC7 — System Operations

| Control                         | Current State                                        | Gap              | Priority | Effort |
| ------------------------------- | ---------------------------------------------------- | ---------------- | -------- | ------ |
| CC7.1 — Vulnerability Detection | No vulnerability scanning, no pen test               | **CRITICAL GAP** | Required | High   |
| CC7.2 — Anomaly Detection       | Rate limiting exists; no anomaly/intrusion detection | **HIGH GAP**     | Required | High   |
| CC7.3 — Incident Response       | SECURITY.md has basic procedures; not formalized     | **HIGH GAP**     | Required | Medium |
| CC7.4 — Incident Recovery       | No DR/BCP plan                                       | **CRITICAL GAP** | Required | High   |
| CC7.5 — Remediation Testing     | No process                                           | **HIGH GAP**     | Required | Medium |

#### CC8 — Change Management

| Control                      | Current State                             | Gap            | Priority | Effort |
| ---------------------------- | ----------------------------------------- | -------------- | -------- | ------ |
| CC8.1 — Change Authorization | GitHub PR workflow exists; not formalized | **MEDIUM GAP** | Required | Low    |

#### CC9 — Risk Mitigation (Vendors)

| Control                        | Current State                 | Gap              | Priority | Effort |
| ------------------------------ | ----------------------------- | ---------------- | -------- | ------ |
| CC9.1 — Vendor Risk Assessment | No formal vendor risk program | **CRITICAL GAP** | Required | High   |
| CC9.2 — Vendor Monitoring      | No ongoing vendor monitoring  | **HIGH GAP**     | Required | Medium |

#### Additional Criteria — Availability (A1)

| Control                    | Current State                                     | Gap              | Priority | Effort |
| -------------------------- | ------------------------------------------------- | ---------------- | -------- | ------ |
| A1.1 — Capacity Planning   | No formal capacity planning                       | **MEDIUM GAP**   | Required | Medium |
| A1.2 — Recovery Objectives | No RTO/RPO defined                                | **CRITICAL GAP** | Required | Medium |
| A1.3 — Backup & Recovery   | Database backups via Supabase; no tested recovery | **HIGH GAP**     | Required | Medium |

#### Additional Criteria — Confidentiality (C1)

| Control                                  | Current State                         | Gap            | Priority | Effort |
| ---------------------------------------- | ------------------------------------- | -------------- | -------- | ------ |
| C1.1 — Confidential Information ID       | Data classification exists informally | **MEDIUM GAP** | Required | Low    |
| C1.2 — Confidential Information Disposal | No data retention/disposal policy     | **HIGH GAP**   | Required | Medium |

#### Additional Criteria — Privacy (P1-P8)

| Control               | Current State                                        | Gap              | Priority    | Effort |
| --------------------- | ---------------------------------------------------- | ---------------- | ----------- | ------ |
| P1 — Privacy Notice   | No privacy policy published                          | **CRITICAL GAP** | Required    | Medium |
| P2 — Choice & Consent | Consent fields exist in DB; no consent management UI | **MEDIUM GAP**   | Required    | Medium |
| P3 — Collection       | No data minimization documentation                   | **MEDIUM GAP**   | Required    | Low    |
| P4 — Use & Retention  | No formal retention policy                           | **HIGH GAP**     | Required    | Medium |
| P5 — Access (DSR)     | Data export API exists                               | **LOW GAP**      | Maintained  | —      |
| P6 — Disclosure       | No subprocessor list published                       | **HIGH GAP**     | Required    | Low    |
| P7 — Quality          | No data accuracy procedures                          | **LOW GAP**      | Recommended | Low    |
| P8 — Monitoring       | No privacy monitoring                                | **MEDIUM GAP**   | Required    | Medium |

### 3.2 GDPR Gap Analysis

| GDPR Article | Requirement                   | Current State                                          | Gap                |
| ------------ | ----------------------------- | ------------------------------------------------------ | ------------------ |
| Art. 5       | Data processing principles    | Partially implemented (encryption, purpose limitation) | Need documentation |
| Art. 6       | Lawful basis                  | Not documented                                         | **HIGH**           |
| Art. 7       | Conditions for consent        | Consent fields exist; mechanism incomplete             | **MEDIUM**         |
| Art. 12-14   | Transparency / Privacy notice | No privacy policy                                      | **CRITICAL**       |
| Art. 15      | Right of access               | Data export API exists                                 | **LOW**            |
| Art. 16      | Right to rectification        | Not implemented                                        | **MEDIUM**         |
| Art. 17      | Right to erasure              | Not implemented                                        | **HIGH**           |
| Art. 20      | Right to data portability     | Data export exists (JSON)                              | **LOW**            |
| Art. 25      | Data protection by design     | Strong technical controls                              | **LOW**            |
| Art. 28      | Processor obligations         | No DPA template                                        | **CRITICAL**       |
| Art. 30      | Records of processing         | Not maintained                                         | **HIGH**           |
| Art. 32      | Security of processing        | Strong encryption, access controls                     | **LOW**            |
| Art. 33      | Breach notification (72h)     | No formal procedure                                    | **CRITICAL**       |
| Art. 35      | DPIA                          | Not conducted for AI processing                        | **HIGH**           |
| Art. 44-49   | International transfers       | No SCCs/adequacy documentation                         | **HIGH**           |

### 3.3 PIPEDA / CPPA Gap Analysis

| Principle              | Requirement                          | Current State                               | Gap          |
| ---------------------- | ------------------------------------ | ------------------------------------------- | ------------ |
| Accountability         | Designated privacy officer, policies | No designated officer                       | **HIGH**     |
| Identifying Purposes   | Document purposes before collection  | Not documented                              | **HIGH**     |
| Consent                | Meaningful consent                   | Consent fields exist; mechanism incomplete  | **MEDIUM**   |
| Limiting Collection    | Collect only what's needed           | Not formally documented                     | **MEDIUM**   |
| Limiting Use           | Use only for stated purposes         | Not formally documented                     | **MEDIUM**   |
| Accuracy               | Keep data accurate                   | Data export exists; no correction mechanism | **MEDIUM**   |
| Safeguards             | Appropriate security                 | Strong technical controls                   | **LOW**      |
| Openness               | Publish privacy practices            | No privacy policy                           | **CRITICAL** |
| Individual Access      | Access to personal data              | Data export exists                          | **LOW**      |
| Challenging Compliance | Complaint process                    | Not established                             | **HIGH**     |

### 3.4 CCPA/CPRA Gap Analysis

| Requirement                                | Current State                                       | Gap          |
| ------------------------------------------ | --------------------------------------------------- | ------------ |
| Right to Know                              | Data export API exists                              | **LOW**      |
| Right to Delete                            | Not implemented                                     | **HIGH**     |
| Right to Opt-Out of Sale/Sharing           | Not applicable (no data sale) — needs documentation | **MEDIUM**   |
| Right to Correct                           | Not implemented                                     | **MEDIUM**   |
| Data Processing Agreements                 | No service provider agreements                      | **HIGH**     |
| Privacy Policy (CCPA-specific disclosures) | Not published                                       | **CRITICAL** |
| Do Not Sell/Share link                     | Not implemented (may not be required if no sale)    | **LOW**      |
| Reasonable Security                        | Strong technical controls                           | **LOW**      |

---

## 4. 12-Month Compliance Roadmap

### Phase 1: Foundation (Months 1-3) — "Policy & Governance"

**Objective:** Establish governance framework, core policies, and privacy program.

| #    | Deliverable                           | Owner      | Framework Ref                        | Effort    | Deadline |
| ---- | ------------------------------------- | ---------- | ------------------------------------ | --------- | -------- |
| 1.1  | Information Security Policy           | CISO       | SOC 2 CC1.1, CC5.3 / ISO 27001 A.5.1 | 2 weeks   | M1 W2    |
| 1.2  | Acceptable Use Policy                 | CISO       | SOC 2 CC1.1 / ISO 27001 A.5.10       | 1 week    | M1 W2    |
| 1.3  | Access Control Policy                 | CISO       | SOC 2 CC6.1-6.3 / ISO 27001 A.5.15   | 1 week    | M1 W3    |
| 1.4  | Data Classification Policy            | CISO       | SOC 2 C1.1 / ISO 27001 A.5.12        | 1 week    | M1 W3    |
| 1.5  | Privacy Policy (public)               | Legal/CISO | GDPR Art. 13-14 / CCPA / PIPEDA      | 2 weeks   | M1 W4    |
| 1.6  | Data Processing Addendum (DPA)        | Legal/CISO | GDPR Art. 28 / SOC 2 P1              | 2 weeks   | M2 W1    |
| 1.7  | Data Retention Policy                 | CISO       | SOC 2 C1.2 / GDPR Art. 5(1)(e)       | 1 week    | M2 W2    |
| 1.8  | Cookie Policy                         | Legal      | ePrivacy Directive / GDPR            | 1 week    | M2 W2    |
| 1.9  | Risk Management Framework             | CISO       | SOC 2 CC3.1-3.4 / ISO 27001 6.1      | 2 weeks   | M2 W3    |
| 1.10 | Risk Register (initial)               | CISO       | SOC 2 CC3.2 / NIST CSF ID.RA         | 2 weeks   | M2 W4    |
| 1.11 | AI Governance Policy                  | CISO/CTO   | NIST AI RMF / EU AI Act              | 2 weeks   | M3 W2    |
| 1.12 | Vendor Risk Management Policy         | CISO       | SOC 2 CC9.1 / ISO 27001 A.5.19       | 1 week    | M3 W3    |
| 1.13 | Subprocessor List (public)            | CISO       | GDPR Art. 28(2) / SOC 2 CC9          | 1 week    | M3 W3    |
| 1.14 | Designate Privacy Officer             | Exec       | PIPEDA / GDPR Art. 37                | Immediate | M1 W1    |
| 1.15 | Security Awareness Training (initial) | CISO       | SOC 2 CC1.4 / ISO 27001 A.6.3        | 2 weeks   | M3 W4    |

**Phase 1 Exit Criteria:**

- All core policies approved and distributed
- Privacy Policy and DPA published
- Risk register populated with top 20 risks
- Privacy Officer designated
- All team members complete initial security training

### Phase 2: Operationalize (Months 4-6) — "Controls & Evidence"

**Objective:** Implement operational procedures, select compliance tooling, begin evidence collection.

| #    | Deliverable                                       | Owner         | Framework Ref                         | Effort  | Deadline |
| ---- | ------------------------------------------------- | ------------- | ------------------------------------- | ------- | -------- |
| 2.1  | Select & deploy compliance platform (Vanta/Drata) | CISO          | All frameworks                        | 2 weeks | M4 W2    |
| 2.2  | Incident Response Plan (formalized)               | CISO          | SOC 2 CC7.3 / ISO 27001 A.5.24        | 2 weeks | M4 W3    |
| 2.3  | Business Continuity / DR Plan                     | CTO/CISO      | SOC 2 A1.2-A1.3 / ISO 27001 A.5.29    | 3 weeks | M4 W4    |
| 2.4  | Change Management Procedure                       | CTO           | SOC 2 CC8.1 / ISO 27001 A.8.32        | 1 week  | M5 W1    |
| 2.5  | Vulnerability Management Program                  | CISO          | SOC 2 CC7.1 / ISO 27001 A.8.8         | 2 weeks | M5 W2    |
| 2.6  | Implement vulnerability scanner (Snyk/Dependabot) | Engineering   | SOC 2 CC7.1                           | 1 week  | M5 W3    |
| 2.7  | Conduct initial penetration test                  | CISO (vendor) | SOC 2 CC7.1 / PCI DSS 11.3            | 3 weeks | M5 W4    |
| 2.8  | Data Subject Request (DSR) procedure              | CISO          | GDPR Art. 15-22 / CCPA                | 1 week  | M5 W2    |
| 2.9  | Breach Notification Procedure                     | CISO/Legal    | GDPR Art. 33 / PIPEDA / US state laws | 1 week  | M5 W3    |
| 2.10 | Periodic access review process                    | CISO          | SOC 2 CC6.3 / ISO 27001 A.5.18        | 1 week  | M5 W4    |
| 2.11 | Vendor risk assessments (top 10)                  | CISO          | SOC 2 CC9.1 / ISO 27001 A.5.19        | 3 weeks | M6 W2    |
| 2.12 | Data Protection Impact Assessment (DPIA)          | CISO          | GDPR Art. 35                          | 2 weeks | M6 W3    |
| 2.13 | Backup & recovery testing                         | CTO           | SOC 2 A1.3 / ISO 27001 A.8.13         | 1 week  | M6 W3    |
| 2.14 | Records of Processing Activities (RoPA)           | CISO          | GDPR Art. 30                          | 1 week  | M6 W4    |
| 2.15 | Implement SIEM/alerting (basic)                   | Engineering   | SOC 2 CC7.2 / ISO 27001 A.8.15        | 2 weeks | M6 W4    |

**Phase 2 Exit Criteria:**

- Compliance platform operational, evidence collection automated
- Incident response plan tested (tabletop exercise)
- DR plan documented with RTO/RPO defined
- First penetration test completed, findings remediated
- Top 10 vendor risk assessments complete
- DPIA for AI processing complete

### Phase 3: Audit Readiness (Months 7-9) — "SOC 2 Type I"

**Objective:** Engage auditor, prepare evidence packages, achieve SOC 2 Type I.

| #   | Deliverable                              | Owner            | Framework Ref    | Effort  | Deadline |
| --- | ---------------------------------------- | ---------------- | ---------------- | ------- | -------- |
| 3.1 | Select SOC 2 auditor                     | CISO             | AICPA            | 2 weeks | M7 W2    |
| 3.2 | SOC 2 readiness assessment (auditor-led) | CISO/Auditor     | SOC 2 TSC        | 2 weeks | M7 W4    |
| 3.3 | Remediate readiness assessment findings  | Engineering/CISO | SOC 2 TSC        | 3 weeks | M8 W3    |
| 3.4 | System Description document              | CISO             | SOC 2 CC2.3      | 2 weeks | M8 W4    |
| 3.5 | Evidence package compilation             | CISO             | SOC 2 TSC        | 2 weeks | M9 W2    |
| 3.6 | SOC 2 Type I audit                       | Auditor          | SOC 2 TSC        | 3 weeks | M9 W4    |
| 3.7 | Enterprise Security Overview PDF         | CISO/Marketing   | Sales enablement | 1 week  | M9 W2    |
| 3.8 | Security questionnaire answer library    | CISO             | SIG/CAIQ/Custom  | 2 weeks | M9 W3    |
| 3.9 | Trust Center page                        | Engineering/CISO | Sales enablement | 1 week  | M9 W4    |

**Phase 3 Exit Criteria:**

- SOC 2 Type I report issued (or audit in progress)
- Enterprise security documentation complete
- Trust Center live on agentc2.ai

### Phase 4: Maturity (Months 10-12) — "Type II Observation & Scale"

**Objective:** Begin SOC 2 Type II observation period, expand privacy program, prepare for scale.

| #    | Deliverable                             | Owner         | Framework Ref    | Effort  | Deadline |
| ---- | --------------------------------------- | ------------- | ---------------- | ------- | -------- |
| 4.1  | SOC 2 Type II observation period begins | Auditor       | SOC 2 TSC        | Ongoing | M10      |
| 4.2  | Quarterly access reviews (first cycle)  | CISO          | SOC 2 CC6.3      | 1 week  | M10 W2   |
| 4.3  | Second penetration test                 | CISO (vendor) | SOC 2 CC7.1      | 2 weeks | M10 W4   |
| 4.4  | Incident response tabletop exercise     | CISO          | SOC 2 CC7.3      | 1 day   | M11 W1   |
| 4.5  | DR failover test                        | CTO           | SOC 2 A1.3       | 1 week  | M11 W2   |
| 4.6  | Annual risk assessment update           | CISO          | SOC 2 CC3.2      | 1 week  | M11 W3   |
| 4.7  | Privacy program maturity review         | CISO          | GDPR/PIPEDA/CCPA | 1 week  | M12 W1   |
| 4.8  | ISO 27001 gap assessment (if pursuing)  | CISO          | ISO 27001        | 2 weeks | M12 W3   |
| 4.9  | Annual security awareness training      | CISO          | SOC 2 CC1.4      | Ongoing | M12      |
| 4.10 | Compliance roadmap Year 2               | CISO          | All              | 1 week  | M12 W4   |

**Phase 4 Exit Criteria:**

- SOC 2 Type II observation underway (minimum 3-month window)
- All evidence collection automated via compliance platform
- Two penetration tests completed in calendar year
- Quarterly access reviews operational

---

## 5. Control Matrix

### Legend

- **Priority:** Required (R) / Recommended (RC) / Optional (O)
- **Status:** Implemented (✅) / Partial (⚠️) / Gap (❌) / N/A (—)

### 5.1 Access Control

| #     | Control                            | SOC 2 | ISO 27001 | NIST CSF | Status | Priority | Evidence                                            |
| ----- | ---------------------------------- | ----- | --------- | -------- | ------ | -------- | --------------------------------------------------- |
| AC-01 | Role-based access control (RBAC)   | CC6.1 | A.5.15    | PR.AC-4  | ✅     | R        | `Membership` model: owner/admin/member/viewer roles |
| AC-02 | Multi-factor authentication        | CC6.1 | A.5.17    | PR.AC-7  | ⚠️     | R        | Two-factor plugin configured, not enforced          |
| AC-03 | Session management                 | CC6.1 | A.8.5     | PR.AC-1  | ✅     | R        | 30-min idle timeout, HTTP-only secure cookies       |
| AC-04 | API authentication                 | CC6.7 | A.5.17    | PR.AC-1  | ✅     | R        | API key + session auth, `X-API-Key` header          |
| AC-05 | Periodic access reviews            | CC6.3 | A.5.18    | PR.AC-6  | ❌     | R        | Need quarterly review process                       |
| AC-06 | Least privilege (tool permissions) | CC6.1 | A.5.15    | PR.AC-4  | ✅     | R        | `AgentToolPermission` per-agent overrides           |
| AC-07 | Onboarding/offboarding procedure   | CC6.2 | A.6.1     | PR.AC-6  | ❌     | R        | Need formal procedure                               |
| AC-08 | Password policy                    | CC6.1 | A.5.17    | PR.AC-1  | ⚠️     | R        | Better Auth defaults; need formal policy            |
| AC-09 | Network egress control             | CC6.8 | A.8.20    | PR.AC-5  | ✅     | RC       | `NetworkEgressPolicy` domain allow/denylist         |

### 5.2 Data Protection

| #     | Control                          | SOC 2 | ISO 27001 | NIST CSF | Status | Priority | Evidence                                              |
| ----- | -------------------------------- | ----- | --------- | -------- | ------ | -------- | ----------------------------------------------------- |
| DP-01 | Encryption at rest (AES-256-GCM) | CC6.5 | A.8.24    | PR.DS-1  | ✅     | R        | All credentials, OAuth tokens, private keys           |
| DP-02 | Encryption in transit (TLS 1.2+) | CC6.5 | A.8.24    | PR.DS-2  | ✅     | R        | Caddy TLS termination, Let's Encrypt                  |
| DP-03 | Key management                   | CC6.5 | A.8.24    | PR.DS-1  | ✅     | R        | Key rotation support, HKDF derivation, versioned keys |
| DP-04 | Data classification scheme       | C1.1  | A.5.12    | ID.AM-5  | ❌     | R        | Need formal classification policy                     |
| DP-05 | Data retention/disposal          | C1.2  | A.5.12    | PR.IP-6  | ❌     | R        | Need retention schedule and disposal procedures       |
| DP-06 | Backup procedures                | A1.3  | A.8.13    | PR.IP-4  | ⚠️     | R        | Supabase automated backups; not tested                |
| DP-07 | PII redaction in logs            | P4.3  | A.8.11    | PR.DS-5  | ✅     | R        | `log-sanitizer.ts`: email, phone, SSN, CC redaction   |
| DP-08 | Digital signatures (Ed25519)     | CC6.5 | A.8.24    | PR.DS-6  | ✅     | RC       | Per-org key pairs for federation messages             |

### 5.3 Security Operations

| #     | Control                        | SOC 2 | ISO 27001 | NIST CSF | Status | Priority | Evidence                                         |
| ----- | ------------------------------ | ----- | --------- | -------- | ------ | -------- | ------------------------------------------------ |
| SO-01 | Vulnerability scanning         | CC7.1 | A.8.8     | DE.CM-8  | ❌     | R        | Need automated scanning (Snyk/Dependabot)        |
| SO-02 | Penetration testing            | CC7.1 | A.8.8     | DE.CM-8  | ❌     | R        | Need annual pen test                             |
| SO-03 | Security incident response     | CC7.3 | A.5.24    | RS.RP-1  | ⚠️     | R        | SECURITY.md exists; need formalized IRP          |
| SO-04 | Intrusion detection            | CC7.2 | A.8.16    | DE.CM-1  | ❌     | R        | Rate limiting exists; need IDS/SIEM              |
| SO-05 | Security headers               | CC6.8 | A.8.20    | PR.DS-2  | ✅     | R        | HSTS, X-Frame-Options, CSP, Referrer-Policy      |
| SO-06 | CSRF protection                | CC6.8 | A.8.26    | PR.DS-5  | ✅     | R        | Origin validation on state-changing methods      |
| SO-07 | Rate limiting                  | CC7.2 | A.8.16    | DE.CM-1  | ✅     | R        | Per-endpoint policies (auth, chat, mcp, uploads) |
| SO-08 | Webhook signature verification | CC6.7 | A.8.26    | PR.DS-5  | ✅     | R        | HMAC-SHA256 for Slack, generic webhooks          |
| SO-09 | Input validation               | CC6.8 | A.8.26    | PR.DS-5  | ✅     | R        | Zod schemas on all API endpoints                 |
| SO-10 | Security awareness training    | CC1.4 | A.6.3     | PR.AT-1  | ❌     | R        | Need formal program                              |

### 5.4 AI-Specific Controls

| #     | Control                        | NIST AI RMF | EU AI Act | SOC 2 | Status | Priority | Evidence                                          |
| ----- | ------------------------------ | ----------- | --------- | ----- | ------ | -------- | ------------------------------------------------- |
| AI-01 | AI model inventory             | MAP 1.1     | Art. 11   | CC2.3 | ⚠️     | R        | Models configured per agent; no central inventory |
| AI-02 | Guardrails (input/output)      | MEASURE 2.6 | Art. 14   | CC7.2 | ✅     | R        | `GuardrailPolicy`, `OrgGuardrailPolicy`           |
| AI-03 | Human oversight mechanisms     | GOVERN 1.4  | Art. 14   | CC5.1 | ⚠️     | R        | `humanApprovalWorkflow` exists; not universal     |
| AI-04 | Model output monitoring        | MEASURE 2.5 | Art. 14   | CC4.1 | ⚠️     | R        | `GuardrailEvent` logs; no systematic monitoring   |
| AI-05 | Budget controls (spend limits) | GOVERN 1.5  | —         | CC5.1 | ✅     | R        | `BudgetPolicy` per-agent, per-org, per-user       |
| AI-06 | Prompt logging                 | MEASURE 2.3 | Art. 12   | CC4.1 | ✅     | R        | Mastra observability with SensitiveDataFilter     |
| AI-07 | Bias assessment                | MEASURE 2.7 | Art. 10   | —     | ❌     | RC       | No bias testing framework                         |
| AI-08 | AI transparency statement      | GOVERN 4.1  | Art. 13   | CC2.2 | ❌     | R        | Need customer-facing AI disclosure                |
| AI-09 | Model evaluation (evals)       | MEASURE 2.1 | Art. 9    | —     | ✅     | RC       | `@mastra/evals` integration                       |
| AI-10 | Agent feedback collection      | MEASURE 3.1 | —         | CC4.1 | ✅     | RC       | `AgentFeedback` model, Slack reactions            |

### 5.5 Privacy Controls

| #     | Control                          | GDPR       | PIPEDA             | CCPA      | SOC 2 | Status | Priority |
| ----- | -------------------------------- | ---------- | ------------------ | --------- | ----- | ------ | -------- |
| PV-01 | Privacy notice                   | Art. 13-14 | Openness           | §1798.100 | P1    | ❌     | R        |
| PV-02 | Consent management               | Art. 7     | Consent            | —         | P2    | ⚠️     | R        |
| PV-03 | Data subject access request      | Art. 15    | Access             | §1798.100 | P5    | ✅     | R        |
| PV-04 | Right to erasure                 | Art. 17    | —                  | §1798.105 | —     | ❌     | R        |
| PV-05 | Data portability                 | Art. 20    | —                  | —         | —     | ✅     | RC       |
| PV-06 | Breach notification              | Art. 33-34 | PIPEDA s.10.1      | §1798.150 | —     | ❌     | R        |
| PV-07 | Cross-border transfer safeguards | Art. 44-49 | PIPEDA Principle 1 | —         | —     | ❌     | R        |
| PV-08 | Records of processing            | Art. 30    | —                  | —         | —     | ❌     | R        |
| PV-09 | DPIA for AI processing           | Art. 35    | —                  | —         | —     | ❌     | R        |

### 5.6 Business Continuity

| #     | Control                  | SOC 2 | ISO 27001 | NIST CSF | Status | Priority |
| ----- | ------------------------ | ----- | --------- | -------- | ------ | -------- |
| BC-01 | Business continuity plan | A1.2  | A.5.29    | RC.RP-1  | ❌     | R        |
| BC-02 | Disaster recovery plan   | A1.2  | A.5.30    | RC.RP-1  | ❌     | R        |
| BC-03 | RTO/RPO definition       | A1.2  | A.5.29    | RC.RP-1  | ❌     | R        |
| BC-04 | Backup testing           | A1.3  | A.8.13    | PR.IP-4  | ❌     | R        |
| BC-05 | Failover procedures      | A1.2  | A.5.30    | RC.RP-1  | ❌     | R        |

---

## 6. Risk Register

### Risk Scoring

- **Likelihood:** 1 (Rare) – 5 (Almost Certain)
- **Impact:** 1 (Negligible) – 5 (Catastrophic)
- **Risk Score:** Likelihood × Impact
- **Risk Rating:** Low (1-6), Medium (7-12), High (13-19), Critical (20-25)

### Active Risks

| ID   | Risk                                                                                                                                  | Category             | L   | I   | Score | Rating       | Current Controls                                                  | Residual Risk | Mitigation Plan                                                                 | Owner | Target Date |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --- | --- | ----- | ------------ | ----------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------- | ----- | ----------- |
| R-01 | **LLM prompt injection** — Adversary manipulates agent via crafted input to exfiltrate data or execute unauthorized actions           | AI Safety            | 4   | 5   | 20    | **CRITICAL** | Guardrails (input/output filtering), egress policies              | HIGH          | Implement prompt injection detection layer; red-team testing; output validation | CTO   | M4          |
| R-02 | **Data breach via compromised API keys** — Stolen integration credentials expose customer CRM/email data                              | Data Security        | 3   | 5   | 15    | **HIGH**     | AES-256-GCM encryption, key rotation support                      | MEDIUM        | Automated key rotation, secret scanning in CI, credential expiry alerts         | CISO  | M5          |
| R-03 | **Unauthorized data access across tenants** — Multi-tenant isolation failure exposes org A data to org B                              | Data Security        | 2   | 5   | 10    | **MEDIUM**   | Org-scoped queries, RBAC                                          | LOW           | Automated tenant isolation testing, penetration test scope                      | CTO   | M5          |
| R-04 | **AI model hallucination causes business harm** — Agent provides incorrect financial/legal/medical information acted upon by customer | AI Safety            | 4   | 4   | 16    | **HIGH**     | Guardrails, evals, human approval workflow                        | MEDIUM        | AI transparency disclosures, output confidence scoring, domain guardrails       | CTO   | M3          |
| R-05 | **Service unavailability** — Single-server architecture creates SPOF                                                                  | Availability         | 3   | 4   | 12    | **MEDIUM**   | PM2 restart, Caddy health checks                                  | MEDIUM        | DR plan, define RTO/RPO, evaluate multi-node deployment                         | CTO   | M4          |
| R-06 | **Third-party LLM provider data exposure** — OpenAI/Anthropic retains or leaks customer data sent via API                             | Third Party          | 3   | 4   | 12    | **MEDIUM**   | Provider DPAs, no training on customer data (per provider policy) | MEDIUM        | Document provider commitments, evaluate zero-retention APIs, DPA review         | CISO  | M3          |
| R-07 | **Subprocessor breach** — Supabase, ElevenLabs, or other subprocessor suffers breach affecting AgentC2 data                           | Third Party          | 2   | 5   | 10    | **MEDIUM**   | Encryption at rest                                                | MEDIUM        | Vendor risk assessments, subprocessor monitoring, DPAs                          | CISO  | M6          |
| R-08 | **Insider threat** — Malicious or negligent employee accesses/exfiltrates data                                                        | Personnel            | 2   | 5   | 10    | **MEDIUM**   | RBAC, audit logging                                               | MEDIUM        | Access reviews, security training, offboarding procedure                        | CISO  | M3          |
| R-09 | **Regulatory enforcement action** — GDPR/PIPEDA/CCPA violation due to missing privacy program                                         | Legal/Compliance     | 3   | 4   | 12    | **MEDIUM**   | Consent fields, data export                                       | MEDIUM        | Privacy policy, DPA, DSR procedures, breach notification plan                   | CISO  | M2          |
| R-10 | **Supply chain vulnerability** — Compromised npm dependency introduces backdoor                                                       | Supply Chain         | 3   | 4   | 12    | **MEDIUM**   | `bun.lockb` lockfile                                              | MEDIUM        | Dependabot/Snyk, SCA scanning, security gates in CI                             | CTO   | M5          |
| R-11 | **Voice data exposure** — ElevenLabs voice streams contain PII processed outside organizational control                               | Data Privacy         | 3   | 3   | 9     | **MEDIUM**   | ElevenLabs DPA                                                    | LOW           | Document voice data flows, consent mechanisms, retention limits                 | CISO  | M6          |
| R-12 | **Webhook replay attack** — Replayed webhook events cause duplicate or unauthorized agent actions                                     | Application Security | 3   | 3   | 9     | **MEDIUM**   | HMAC verification, timestamp validation (5-min window)            | LOW           | Idempotency enforcement, nonce tracking                                         | CTO   | M5          |
| R-13 | **Loss of encryption keys** — `CREDENTIAL_ENCRYPTION_KEY` lost/corrupted, all encrypted data unrecoverable                            | Operational          | 1   | 5   | 5     | **LOW**      | Key rotation support with `_PREV` fallback                        | LOW           | Key escrow procedure, HSM evaluation, documented recovery                       | CTO   | M4          |
| R-14 | **AI model bias** — Agent produces discriminatory outputs affecting protected classes                                                 | AI Ethics            | 2   | 4   | 8     | **MEDIUM**   | Guardrail policies                                                | MEDIUM        | Bias testing framework, diverse test scenarios, monitoring                      | CTO   | M8          |
| R-15 | **MCP tool abuse** — Compromised or misconfigured MCP tool performs destructive actions on customer systems                           | Integration Risk     | 3   | 4   | 12    | **MEDIUM**   | Tool permissions, budget controls, egress policies                | MEDIUM        | Tool sandboxing, execution audit, customer approval flows                       | CTO   | M6          |

---

## 7. Enterprise Readiness Scorecard

### Current State (as of February 2026)

| Category                             | Weight | Score (0-10) | Weighted      | Notes                                                         |
| ------------------------------------ | ------ | ------------ | ------------- | ------------------------------------------------------------- |
| **Authentication & SSO**             | 10%    | 7            | 0.70          | Better Auth with RBAC; SSO not available (enterprise blocker) |
| **Encryption**                       | 10%    | 9            | 0.90          | AES-256-GCM at rest, TLS in transit, key rotation             |
| **Multi-Tenancy**                    | 10%    | 8            | 0.80          | Strong org-level isolation, scoped queries                    |
| **Audit Logging**                    | 8%     | 7            | 0.56          | Comprehensive; needs SIEM integration                         |
| **SOC 2 Certification**              | 15%    | 0            | 0.00          | Not started                                                   |
| **Privacy Program**                  | 10%    | 3            | 0.30          | Technical controls exist; policies missing                    |
| **Incident Response**                | 8%     | 3            | 0.24          | Basic procedures; not formalized/tested                       |
| **Vendor Management**                | 5%     | 2            | 0.10          | No formal vendor risk program                                 |
| **Business Continuity**              | 8%     | 2            | 0.16          | Single server, no DR plan                                     |
| **AI Governance**                    | 8%     | 4            | 0.32          | Guardrails/budgets exist; governance framework missing        |
| **Penetration Testing**              | 5%     | 0            | 0.00          | Never conducted                                               |
| **Security Questionnaire Readiness** | 3%     | 2            | 0.06          | No answer library                                             |
| **TOTAL**                            | 100%   | —            | **4.14 / 10** | **Not Enterprise-Ready**                                      |

### Target State (12 Months)

| Category                         | Current  | Target   | Key Actions                               |
| -------------------------------- | -------- | -------- | ----------------------------------------- |
| Authentication & SSO             | 7        | 9        | Add SAML/OIDC SSO support                 |
| Encryption                       | 9        | 9        | Maintain                                  |
| Multi-Tenancy                    | 8        | 9        | Automated tenant isolation tests          |
| Audit Logging                    | 7        | 8        | SIEM integration, retention policy        |
| SOC 2 Certification              | 0        | 7        | Type I achieved, Type II in progress      |
| Privacy Program                  | 3        | 8        | Full policy suite, DSR automation         |
| Incident Response                | 3        | 8        | Formalized IRP, tabletop tested           |
| Vendor Management                | 2        | 7        | Top 10 vendors assessed, DPAs signed      |
| Business Continuity              | 2        | 7        | DR plan, tested recovery, multi-node eval |
| AI Governance                    | 4        | 7        | NIST AI RMF aligned, DPIA complete        |
| Penetration Testing              | 0        | 8        | Two annual tests, remediation tracking    |
| Security Questionnaire Readiness | 2        | 8        | 200+ answer library, Trust Center         |
| **PROJECTED TOTAL**              | **4.14** | **7.92** |                                           |

### Enterprise Sales Threshold: 7.0+ required for mid-market, 8.5+ for large enterprise.

---

## 8. Vendor & Subprocessor Management

### 8.1 Subprocessor Register

| Subprocessor              | Service                      | Data Processed                                | Location           | DPA Status              | SOC 2          | Risk Tier |
| ------------------------- | ---------------------------- | --------------------------------------------- | ------------------ | ----------------------- | -------------- | --------- |
| **Supabase**              | PostgreSQL database hosting  | All application data, credentials (encrypted) | US (AWS us-east-1) | Required                | Yes (Type II)  | Critical  |
| **OpenAI**                | LLM inference (GPT-4o)       | User prompts, agent responses                 | US                 | Required                | Yes (Type II)  | Critical  |
| **Anthropic**             | LLM inference (Claude)       | User prompts, agent responses                 | US                 | Required                | Yes (Type II)  | Critical  |
| **ElevenLabs**            | Voice synthesis, live agents | Voice audio, text prompts                     | US/EU              | Required                | Pending review | High      |
| **Digital Ocean**         | Application hosting          | Application runtime, logs                     | US                 | Required                | Yes (Type II)  | Critical  |
| **Google (Gmail API)**    | Email processing             | Email content, contacts                       | US                 | Required                | Yes (Type II)  | High      |
| **Microsoft (Graph API)** | Email/Calendar               | Email content, calendar events                | US/Global          | Required                | Yes (Type II)  | High      |
| **HubSpot**               | CRM integration              | Contacts, companies, deals                    | US                 | N/A (customer-provided) | Yes (Type II)  | Medium    |
| **Atlassian (Jira)**      | Project management           | Issues, sprint data                           | US/Global          | N/A (customer-provided) | Yes (Type II)  | Medium    |
| **Slack**                 | Messaging integration        | Messages, user info                           | US                 | Required                | Yes (Type II)  | High      |
| **Inngest**               | Background job processing    | Event payloads, function metadata             | US                 | Required                | Pending review | Medium    |
| **ngrok**                 | Webhook tunneling (dev only) | Webhook payloads (transient)                  | US                 | N/A (dev only)          | Pending review | Low       |
| **Upstash**               | Redis (rate limiting)        | Rate limit counters (no PII)                  | US/Global          | N/A                     | Yes            | Low       |
| **Fathom**                | Meeting transcripts          | Meeting recordings, transcripts               | US                 | N/A (customer-provided) | Pending review | Medium    |
| **JustCall**              | Phone/SMS                    | Call logs, SMS content                        | US                 | N/A (customer-provided) | Pending review | Medium    |
| **Dropbox**               | File storage                 | Files, metadata                               | US                 | N/A (customer-provided) | Yes (Type II)  | Medium    |

### 8.2 Vendor Risk Assessment Requirements

| Risk Tier    | Assessment Required                    | Review Frequency | DPA Required     | SOC 2 Required |
| ------------ | -------------------------------------- | ---------------- | ---------------- | -------------- |
| **Critical** | Full risk assessment + security review | Annually         | Yes              | Yes            |
| **High**     | Standard risk assessment               | Annually         | Yes              | Preferred      |
| **Medium**   | Abbreviated assessment                 | Every 2 years    | If PII processed | Preferred      |
| **Low**      | Self-assessment questionnaire          | Every 3 years    | No               | No             |

### 8.3 Cross-Border Transfer Mechanisms

| Transfer                             | Mechanism                           | Notes                                         |
| ------------------------------------ | ----------------------------------- | --------------------------------------------- |
| Canada → US (Supabase, OpenAI, etc.) | Standard Contractual Clauses (SCCs) | Required for PIPEDA/CPPA                      |
| EU → US                              | EU-US Data Privacy Framework + SCCs | DPF certification required from subprocessors |
| General                              | Transfer Impact Assessments (TIAs)  | Required per Schrems II for EU data           |

---

## 9. Data Flow Architecture

### 9.1 Primary Data Flows (Text Description)

**Flow 1: User Authentication**

```
User Browser → Caddy (TLS) → Next.js Frontend → Better Auth → PostgreSQL (Supabase)
Session cookie returned → stored HTTP-only, Secure, SameSite=Lax
```

**Flow 2: Agent Conversation (Chat)**

```
User Browser → Caddy (TLS) → Agent App API → Session Validation →
  → Agent Resolver (PostgreSQL) → Mastra Agent →
  → LLM Provider (OpenAI/Anthropic API, TLS) →
  → Agent Response → Conversation Memory (PostgreSQL) →
  → Streamed to User Browser (SSE)
Optional: → MCP Tool Execution → Third-party API (credentials decrypted at runtime)
```

**Flow 3: Voice Agent**

```
User Browser → ElevenLabs WebSocket → ElevenLabs Platform →
  → Webhook to Agent App (via ngrok in dev, direct in prod) →
  → HMAC verification → MCP Tool Execution →
  → Response to ElevenLabs → Audio to User
```

**Flow 4: Slack Integration**

```
Slack User Message → Slack Platform → Webhook POST to /api/slack/events →
  → Signature Verification (HMAC-SHA256) →
  → Multi-tenant Resolution (team_id → IntegrationConnection) →
  → Agent Processing → Slack API (bot response in thread)
```

**Flow 5: Email Processing (Gmail)**

```
Gmail Inbox → Google Pub/Sub → Webhook POST to /api/gmail/webhook →
  → OAuth Token Decryption → Gmail API (fetch messages) →
  → Inngest Event (background) → Agent Processing →
  → Gmail API (send response/archive)
```

**Flow 6: Document Ingestion (RAG)**

```
User Upload (multipart/form-data, max 10MB) → File Validation →
  → Content Extraction (PDF parse, text) →
  → Chunking → Embedding (OpenAI text-embedding-3-small) →
  → Vector Storage (pgvector) + Full-Text Index (PostgreSQL)
  → Tenant-isolated queries (organizationId enforced)
```

**Flow 7: Webhook Triggers**

```
External System → POST /api/webhooks/{path} →
  → HMAC-SHA256 Signature Verification →
  → Rate Limiting (60/min per IP) →
  → TriggerEvent Record → Inngest Event → Agent Execution
```

**Flow 8: Data Export (DSR)**

```
Authenticated User → GET /api/user/data-export →
  → Rate Limit (1/hour) → Query User Data →
  → Profile + Memberships + Integrations + Documents + Audit Logs + Runs →
  → JSON Bundle → Audit Log Entry → Response to User
```

### 9.2 Data Boundary Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────┐
│                        AgentC2 BOUNDARY                         │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Frontend    │   │  Agent App   │   │   Admin App          │ │
│  │  (Next.js)   │   │  (Next.js)   │   │   (Next.js)          │ │
│  │  Port 3000   │   │  Port 3001   │   │   Port 3003          │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                  │                       │             │
│         └──────────────────┼───────────────────────┘             │
│                            │                                     │
│                    ┌───────┴────────┐                            │
│                    │  Caddy Proxy   │  TLS Termination           │
│                    │  (HSTS, CSP)   │  Security Headers          │
│                    └───────┬────────┘                            │
│                            │                                     │
│  ┌─────────────────────────┼──────────────────────────────────┐ │
│  │              Credential Encryption Layer                    │ │
│  │              AES-256-GCM + Ed25519 Signing                 │ │
│  └─────────────────────────┼──────────────────────────────────┘ │
│                            │                                     │
│  ┌─────────────────────────┼──────────────────────────────────┐ │
│  │              PostgreSQL (Supabase)                          │ │
│  │              Users, Agents, Credentials, Audit Logs        │ │
│  │              Vector Store (pgvector), Full-Text Search      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────────┐
          │                  │                      │
  ┌───────▼──────┐  ┌───────▼──────┐  ┌────────────▼──────────┐
  │   LLM APIs   │  │  Voice API   │  │  MCP Integrations     │
  │  OpenAI      │  │  ElevenLabs  │  │  HubSpot, Jira,       │
  │  Anthropic   │  │              │  │  Slack, Gmail,         │
  │              │  │              │  │  GitHub, Google Drive,  │
  │              │  │              │  │  Microsoft, Dropbox,    │
  │              │  │              │  │  JustCall, Fathom, etc. │
  └──────────────┘  └──────────────┘  └────────────────────────┘
```

---

## 10. Certification Sequencing

### Recommended Sequence (Cost vs. Impact)

| Priority | Certification/Attestation               | Cost Estimate                          | Timeline                 | Impact on Sales                                  |
| -------- | --------------------------------------- | -------------------------------------- | ------------------------ | ------------------------------------------------ |
| 1        | **SOC 2 Type I**                        | $30-60K (audit) + $15-25K (tooling/yr) | 6-9 months               | **HIGHEST** — Required by 80%+ enterprise buyers |
| 2        | **SOC 2 Type II**                       | $30-50K (audit)                        | +3-6 months after Type I | **HIGHEST** — Required for large enterprise      |
| 3        | **GDPR Compliance Program**             | $10-20K (legal review)                 | 3-4 months               | **HIGH** — Required for EU customers             |
| 4        | **HIPAA BAA readiness** (if healthcare) | $20-40K                                | 6-9 months               | **HIGH** — If targeting healthcare               |
| 5        | **ISO 27001**                           | $40-80K (audit)                        | 12-18 months             | **MEDIUM** — Preferred by EU/global enterprise   |
| 6        | **CSA STAR**                            | $10-20K                                | 3-6 months (after SOC 2) | **MEDIUM** — Cloud-specific                      |
| 7        | **PIPEDA Compliance Assessment**        | $5-10K (legal review)                  | 2-3 months               | **MEDIUM** — Required for Canadian market        |
| 8        | **FedRAMP** (if US government)          | $500K-2M+                              | 18-24 months             | **HIGH** — Only if targeting US gov              |

### Sequencing Dependencies

```
SOC 2 Type I ──→ SOC 2 Type II ──→ ISO 27001 (overlap)
     │                                    │
     ├──→ CSA STAR (leverages SOC 2)      │
     │                                    │
     └──→ Enterprise Questionnaires       └──→ FedRAMP (if applicable)

GDPR Program ──→ DPIA ──→ International Expansion
     │
     └──→ PIPEDA/CCPA (parallel)
```

---

## 11. Tooling Recommendations

### 11.1 Compliance Automation Platform

| Tool                  | Cost (Annual) | Pros                                               | Cons                                    | Recommendation                             |
| --------------------- | ------------- | -------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| **Vanta**             | $15-25K       | Market leader, 200+ integrations, fast SOC 2       | Higher cost, enterprise-focused pricing | **Recommended** for mid-market positioning |
| **Drata**             | $12-20K       | Good UI, AI-assisted evidence, competitive pricing | Newer, fewer integrations than Vanta    | Strong alternative                         |
| **Secureframe**       | $10-18K       | Lower cost, good startup pricing                   | Smaller ecosystem                       | Budget option                              |
| **Thoropass (Laika)** | $15-25K       | Combined tooling + audit firm                      | Less flexible auditor choice            | Consider if want single vendor             |

**Decision Criteria:** Choose Vanta or Drata for best integration ecosystem. Both integrate with Digital Ocean, GitHub, Supabase, Slack. Vanta has slightly better enterprise trust signal.

### 11.2 Additional Tooling

| Category                     | Tool                                           | Cost               | Priority          |
| ---------------------------- | ---------------------------------------------- | ------------------ | ----------------- |
| Vulnerability Scanning (SCA) | **Snyk** or **GitHub Advanced Security**       | $0-15K/yr          | Required (M5)     |
| Secret Scanning              | **Gitleaks** (already in CI) + **GitGuardian** | $0-5K/yr           | Required (exists) |
| Penetration Testing          | **Cobalt** or **HackerOne**                    | $15-30K/engagement | Required (M5)     |
| SIEM/Alerting                | **Datadog** or **Better Stack**                | $5-15K/yr          | Required (M6)     |
| Security Training            | **KnowBe4** or **Curricula**                   | $2-5K/yr           | Required (M3)     |
| Privacy Management           | **OneTrust** or **TrustArc**                   | $10-30K/yr         | Optional (future) |
| Bug Bounty                   | **HackerOne** or **Bugcrowd**                  | Variable           | Optional (Year 2) |

---

## Appendices

### Appendix A: Framework Cross-Reference

| SOC 2 TSC                     | ISO 27001:2022           | NIST CSF 2.0 | NIST AI RMF |
| ----------------------------- | ------------------------ | ------------ | ----------- |
| CC1 (Control Environment)     | A.5.1-5.8                | GV (Govern)  | GOVERN      |
| CC2 (Communication)           | A.5.9-5.11               | GV.SC, ID.AM | GOVERN 4    |
| CC3 (Risk Assessment)         | 6.1, A.5.12              | ID.RA        | MAP         |
| CC4 (Monitoring)              | A.8.15-8.16              | DE (Detect)  | MEASURE     |
| CC5 (Control Activities)      | A.5.13-5.38              | PR (Protect) | MANAGE      |
| CC6 (Logical/Physical Access) | A.5.15-5.18, A.8.1-8.5   | PR.AC, PR.DS | —           |
| CC7 (System Operations)       | A.5.24-5.28, A.8.8       | DE, RS       | MEASURE     |
| CC8 (Change Management)       | A.8.32                   | PR.IP-3      | —           |
| CC9 (Risk Mitigation)         | A.5.19-5.23              | GV.SC        | GOVERN 6    |
| A1 (Availability)             | A.5.29-5.30, A.8.13-8.14 | RC (Recover) | —           |
| C1 (Confidentiality)          | A.5.12, A.8.10-8.12      | PR.DS        | —           |
| P1-P8 (Privacy)               | A.5.34                   | —            | GOVERN 5    |

### Appendix B: Audit Readiness Prerequisites

Before engaging a SOC 2 auditor, ensure:

1. ✅ All required policies are approved, dated, and distributed
2. ✅ Compliance platform deployed and collecting evidence automatically
3. ✅ At least 1 month of evidence collection (access reviews, change tickets, etc.)
4. ✅ Risk assessment completed and documented
5. ✅ Vendor risk assessments for critical subprocessors
6. ✅ Penetration test completed with remediation evidence
7. ✅ Incident response plan approved and tabletop-tested
8. ✅ Security awareness training completed by all personnel
9. ✅ System description drafted
10. ✅ Data flow diagrams documented

### Appendix C: Key Contacts & Ownership

| Role                    | Responsibility                                    | SOC 2 TSC           |
| ----------------------- | ------------------------------------------------- | ------------------- |
| CEO/CTO                 | Risk acceptance, governance oversight             | CC1.2               |
| CISO (to be designated) | Policy ownership, compliance program, vendor risk | CC1-CC9, P1-P8      |
| Engineering Lead        | Technical controls, change management, DR         | CC5.2, CC7, CC8, A1 |
| Legal Counsel           | Privacy policies, DPA, regulatory analysis        | P1-P8, CC9          |
| People Operations       | Security training, onboarding/offboarding         | CC1.4, CC6.2        |

---

_Document maintained by the AgentC2 Compliance Program. Next review: May 2026._
