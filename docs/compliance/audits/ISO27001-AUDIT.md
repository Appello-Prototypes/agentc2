# ISO 27001:2022 Compliance Audit

**Audit Date:** February 21, 2026
**Audited System:** AgentC2 AI Agent Platform (agentc2.ai)
**Audited By:** Internal Compliance Assessment
**Standard:** ISO/IEC 27001:2022 — Information Security Management Systems
**Scope:** Annex A Controls (93 controls across 4 themes)

---

## Executive Summary

| Theme                   | Controls | Implemented | Partial | Gap    | Compliance % |
| ----------------------- | -------- | ----------- | ------- | ------ | ------------ |
| A.5 Organizational (37) | 37       | 25          | 8       | 4      | 68%          |
| A.6 People (8)          | 8        | 3           | 3       | 2      | 38%          |
| A.7 Physical (14)       | 14       | 12          | 0       | 2      | 86%          |
| A.8 Technological (34)  | 34       | 28          | 4       | 2      | 82%          |
| **TOTAL**               | **93**   | **68**      | **15**  | **10** | **73%**      |

**Overall Readiness:** Strong technical controls; organizational and people controls need development for certification.

---

## A.5 — Organizational Controls

### A.5.1 Policies for Information Security

| Control                     | Status         | Evidence                                                                        |
| --------------------------- | -------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Information security policy | ✅ Implemented | `docs/compliance/policies/INFORMATION-SECURITY-POLICY.md` — 12 security domains |
| Review and approval process | ⚠️ Partial     | Policies exist in version control                                               | No formal review cadence or approval records |

### A.5.2 Information Security Roles and Responsibilities

| Control               | Status         | Evidence                                                                |
| --------------------- | -------------- | ----------------------------------------------------------------------- | -------------------- |
| Roles defined         | ✅ Implemented | RBAC roles (owner/admin/member/viewer); policy defines responsibilities |
| Segregation of duties | ⚠️ Partial     | Role-based restrictions in code                                         | No formal SoD matrix |

### A.5.3 Segregation of Duties

| Control                      | Status     | Evidence                                    |
| ---------------------------- | ---------- | ------------------------------------------- | -------------------------- |
| Conflicting duties separated | ⚠️ Partial | Owner vs admin vs member roles limit access | No documented SoD analysis |

### A.5.4 Management Responsibilities

| Control                          | Status         | Evidence                                                 |
| -------------------------------- | -------------- | -------------------------------------------------------- |
| Management direction on security | ✅ Implemented | `CLAUDE.md`, `SECURITY.md` enforce development standards |

### A.5.5 Contact with Authorities

| Control                       | Status         | Evidence                                             |
| ----------------------------- | -------------- | ---------------------------------------------------- |
| Regulatory contact maintained | ✅ Implemented | Incident response plan references OAIC, EU DPAs, ICO |

### A.5.6 Contact with Special Interest Groups

| Control                      | Status     | Evidence                |
| ---------------------------- | ---------- | ----------------------- | --------------------------- |
| Industry group participation | ⚠️ Partial | No formal participation | Could join OWASP, CSA, AISA |

### A.5.7 Threat Intelligence

| Control                        | Status     | Evidence                                          |
| ------------------------------ | ---------- | ------------------------------------------------- | ------------------------------------- |
| Threat intelligence collection | ⚠️ Partial | `securityMonitorFunction` monitors audit patterns | No external threat intelligence feeds |

### A.5.8 Information Security in Project Management

| Control                           | Status         | Evidence                                                                  |
| --------------------------------- | -------------- | ------------------------------------------------------------------------- |
| Security in development lifecycle | ✅ Implemented | CI/CD security gates (type-check, lint, audit, secret scan, SCA, license) |

### A.5.9 Inventory of Information and Other Assets

| Control         | Status     | Evidence                                         |
| --------------- | ---------- | ------------------------------------------------ | -------------- |
| Asset inventory | ⚠️ Partial | Subprocessor register, infrastructure documented | No formal CMDB |

### A.5.10 Acceptable Use of Information

| Control               | Status         | Evidence                                            |
| --------------------- | -------------- | --------------------------------------------------- |
| Acceptable use policy | ✅ Implemented | `docs/compliance/policies/ACCEPTABLE-USE-POLICY.md` |

### A.5.11 Return of Assets

| Control                     | Status | Evidence                      |
| --------------------------- | ------ | ----------------------------- | --------------------------------------------- |
| Asset return on termination | ❌ Gap | No formal offboarding process | Cloud-based — primarily credential revocation |

### A.5.12 Classification of Information

| Control                    | Status         | Evidence                                                                                                         |
| -------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Data classification scheme | ✅ Implemented | `docs/compliance/policies/DATA-CLASSIFICATION-POLICY.md` — 4 levels (Public, Internal, Confidential, Restricted) |

### A.5.13 Labelling of Information

| Control               | Status | Evidence                    |
| --------------------- | ------ | --------------------------- | ------------------------------------------------------- |
| Information labelling | ❌ Gap | No labelling in application | Classification policy exists but no enforcement in code |

### A.5.14 Information Transfer

| Control                  | Status         | Evidence                                                 |
| ------------------------ | -------------- | -------------------------------------------------------- |
| Secure transfer controls | ✅ Implemented | TLS for all transfers; encrypted credentials; HTTPS-only |

### A.5.15 Access Control

| Control               | Status         | Evidence                                            |
| --------------------- | -------------- | --------------------------------------------------- |
| Access control policy | ✅ Implemented | `docs/compliance/policies/ACCESS-CONTROL-POLICY.md` |

### A.5.16 Identity Management

| Control                       | Status         | Evidence                                                      |
| ----------------------------- | -------------- | ------------------------------------------------------------- |
| Identity lifecycle management | ✅ Implemented | User registration, invite system, deletion with anonymization |

### A.5.17 Authentication Information

| Control                   | Status         | Evidence                                             |
| ------------------------- | -------------- | ---------------------------------------------------- |
| Authentication management | ✅ Implemented | Session management (30-min timeout), OAuth, TOTP 2FA |

### A.5.18 Access Rights

| Control                  | Status         | Evidence                                      |
| ------------------------ | -------------- | --------------------------------------------- |
| Access rights management | ✅ Implemented | Membership-based access, organization scoping |

### A.5.19 Information Security in Supplier Relationships

| Control                        | Status         | Evidence                                                    |
| ------------------------------ | -------------- | ----------------------------------------------------------- |
| Supplier security requirements | ✅ Implemented | `docs/compliance/policies/VENDOR-RISK-MANAGEMENT-POLICY.md` |

### A.5.20 Addressing Information Security in Supplier Agreements

| Control               | Status         | Evidence                                   |
| --------------------- | -------------- | ------------------------------------------ |
| Security in contracts | ✅ Implemented | DPA template includes security obligations |

### A.5.21 Managing Information Security in the ICT Supply Chain

| Control               | Status         | Evidence                                          |
| --------------------- | -------------- | ------------------------------------------------- |
| Supply chain security | ✅ Implemented | License compliance, SCA scanning, SBOM generation |

### A.5.22 Monitoring, Review, and Change Management of Supplier Services

| Control                     | Status     | Evidence                         |
| --------------------------- | ---------- | -------------------------------- | ------------------------------- |
| Supplier service monitoring | ⚠️ Partial | Health checks for infrastructure | No formal vendor review cadence |

### A.5.23 Information Security for Use of Cloud Services

| Control                 | Status         | Evidence                                                    |
| ----------------------- | -------------- | ----------------------------------------------------------- |
| Cloud security controls | ✅ Implemented | Supabase (SOC 2), Digital Ocean, TLS, encrypted credentials |

### A.5.24 Information Security Incident Management Planning

| Control                  | Status         | Evidence                                             |
| ------------------------ | -------------- | ---------------------------------------------------- |
| Incident management plan | ✅ Implemented | `docs/compliance/policies/INCIDENT-RESPONSE-PLAN.md` |

### A.5.25 Assessment and Decision on Information Security Events

| Control              | Status         | Evidence                                         |
| -------------------- | -------------- | ------------------------------------------------ |
| Event classification | ✅ Implemented | Incident classification (P1-P4) in response plan |

### A.5.26 Response to Information Security Incidents

| Control                      | Status         | Evidence                                      |
| ---------------------------- | -------------- | --------------------------------------------- |
| Incident response procedures | ✅ Implemented | 6 response phases defined; communication plan |

### A.5.27 Learning from Information Security Incidents

| Control                | Status     | Evidence                                             |
| ---------------------- | ---------- | ---------------------------------------------------- | ------------------------------------------- |
| Post-incident learning | ⚠️ Partial | Incident response plan includes post-incident review | No evidence of actual post-incident reviews |

### A.5.28 Collection of Evidence

| Control                        | Status         | Evidence                                                  |
| ------------------------------ | -------------- | --------------------------------------------------------- |
| Evidence collection procedures | ✅ Implemented | Incident response plan Sec 8 covers evidence preservation |

### A.5.29 Information Security During Disruption

| Control                      | Status     | Evidence                              |
| ---------------------------- | ---------- | ------------------------------------- | ------------- |
| Continuity during disruption | ⚠️ Partial | PM2 auto-restart, deployment rollback | No formal BCP |

### A.5.30 ICT Readiness for Business Continuity

| Control                 | Status | Evidence                             |
| ----------------------- | ------ | ------------------------------------ |
| ICT continuity planning | ❌ Gap | Supabase PITR backups; no DR testing |

### A.5.31 Legal, Statutory, Regulatory, and Contractual Requirements

| Control                   | Status         | Evidence                                                      |
| ------------------------- | -------------- | ------------------------------------------------------------- |
| Compliance identification | ✅ Implemented | GDPR, CCPA, PIPEDA compliance documented with controls mapped |

### A.5.32 Intellectual Property Rights

| Control       | Status         | Evidence                                            |
| ------------- | -------------- | --------------------------------------------------- |
| IP protection | ✅ Implemented | License compliance check in CI/CD (blocks GPL/AGPL) |

### A.5.33 Protection of Records

| Control          | Status         | Evidence                                                |
| ---------------- | -------------- | ------------------------------------------------------- |
| Record retention | ✅ Implemented | Automated retention cleanup; 2-year audit log retention |

### A.5.34 Privacy and Protection of PII

| Control        | Status         | Evidence                                                               |
| -------------- | -------------- | ---------------------------------------------------------------------- |
| PII protection | ✅ Implemented | PII redaction, consent management, data subject rights, DPIA framework |

### A.5.35 Independent Review of Information Security

| Control                     | Status | Evidence                                |
| --------------------------- | ------ | --------------------------------------- |
| Independent security review | ❌ Gap | No external audit or pen test performed |

### A.5.36 Compliance with Policies, Rules, and Standards

| Control             | Status         | Evidence                                           |
| ------------------- | -------------- | -------------------------------------------------- |
| Compliance checking | ✅ Implemented | CI/CD gates enforce standards; this audit document |

### A.5.37 Documented Operating Procedures

| Control                | Status         | Evidence                                |
| ---------------------- | -------------- | --------------------------------------- |
| Operational procedures | ✅ Implemented | `DEPLOY.md`, `SECURITY.md`, `CLAUDE.md` |

---

## A.6 — People Controls

### A.6.1 Screening

| Control              | Status | Evidence                    |
| -------------------- | ------ | --------------------------- | --------------- |
| Background screening | ❌ Gap | No background check process | Startup context |

### A.6.2 Terms and Conditions of Employment

| Control                      | Status     | Evidence                     |
| ---------------------------- | ---------- | ---------------------------- | ------------------------------------------------------ |
| Security in employment terms | ⚠️ Partial | Acceptable use policy exists | No evidence of incorporation into employment contracts |

### A.6.3 Information Security Awareness, Education, and Training

| Control                   | Status | Evidence            |
| ------------------------- | ------ | ------------------- | ------------------------------ |
| Security training program | ❌ Gap | No training program | Policies document expectations |

### A.6.4 Disciplinary Process

| Control                         | Status     | Evidence                                        |
| ------------------------------- | ---------- | ----------------------------------------------- | -------------------- |
| Security violation consequences | ⚠️ Partial | Acceptable use policy Sec 5 defines enforcement | No formal HR process |

### A.6.5 Responsibilities After Termination or Change of Employment

| Control                      | Status     | Evidence                   |
| ---------------------------- | ---------- | -------------------------- | ------------------------------- |
| Post-termination obligations | ⚠️ Partial | Account deletion available | No formal offboarding checklist |

### A.6.6 Confidentiality or Non-Disclosure Agreements

| Control     | Status         | Evidence                                            |
| ----------- | -------------- | --------------------------------------------------- |
| NDA process | ✅ Implemented | Terms of Service include confidentiality provisions |

### A.6.7 Remote Working

| Control                 | Status         | Evidence                                                                 |
| ----------------------- | -------------- | ------------------------------------------------------------------------ |
| Remote working security | ✅ Implemented | Cloud-first architecture; encrypted communications; no local data stores |

### A.6.8 Information Security Event Reporting

| Control                 | Status         | Evidence                                         |
| ----------------------- | -------------- | ------------------------------------------------ |
| Event reporting process | ✅ Implemented | security@agentc2.ai; alert system; audit logging |

---

## A.7 — Physical Controls

### A.7.1-A.7.4 Physical Security Perimeters, Entry, Offices, Monitoring

| Control           | Status            | Evidence                                                                  |
| ----------------- | ----------------- | ------------------------------------------------------------------------- |
| Physical security | ✅ Cloud Provider | Digital Ocean, Supabase data centers — provider responsibility with SOC 2 |

### A.7.5-A.7.8 Environmental Threats, Working in Secure Areas, Clear Desk, Equipment

| Control                | Status            | Evidence                                            |
| ---------------------- | ----------------- | --------------------------------------------------- |
| Environmental controls | ✅ Cloud Provider | Provider-managed data center environmental controls |

### A.7.9 Security of Assets Off-Premises

| Control                | Status         | Evidence                                    |
| ---------------------- | -------------- | ------------------------------------------- |
| Off-premises equipment | ✅ Implemented | All data in cloud; no on-premises equipment |

### A.7.10 Storage Media

| Control        | Status            | Evidence                               |
| -------------- | ----------------- | -------------------------------------- |
| Media handling | ✅ Cloud Provider | No removable media; cloud storage only |

### A.7.11 Supporting Utilities

| Control        | Status            | Evidence                   |
| -------------- | ----------------- | -------------------------- |
| Power, cooling | ✅ Cloud Provider | Data center infrastructure |

### A.7.12 Cabling Security

| Control | Status            | Evidence            |
| ------- | ----------------- | ------------------- |
| Cabling | ✅ Cloud Provider | Data center managed |

### A.7.13 Equipment Maintenance

| Control              | Status            | Evidence         |
| -------------------- | ----------------- | ---------------- |
| Hardware maintenance | ✅ Cloud Provider | Provider-managed |

### A.7.14 Secure Disposal or Reuse of Equipment

| Control            | Status | Evidence                                  |
| ------------------ | ------ | ----------------------------------------- |
| Equipment disposal | ❌ N/A | Cloud-only; no owned equipment to dispose |

---

## A.8 — Technological Controls

### A.8.1 User Endpoint Devices

| Control           | Status     | Evidence                                         |
| ----------------- | ---------- | ------------------------------------------------ | ------------------------------- |
| Endpoint security | ⚠️ Partial | Web application; no client-side data persistence | No MDM or endpoint requirements |

### A.8.2 Privileged Access Rights

| Control                      | Status         | Evidence                                                               |
| ---------------------------- | -------------- | ---------------------------------------------------------------------- |
| Privileged access management | ✅ Implemented | Owner/Admin roles with specific permissions; production SSH restricted |

### A.8.3 Information Access Restriction

| Control            | Status         | Evidence                                         |
| ------------------ | -------------- | ------------------------------------------------ |
| Access restriction | ✅ Implemented | Multi-tenant isolation; org-scoped queries; RBAC |

### A.8.4 Access to Source Code

| Control                    | Status         | Evidence                                      |
| -------------------------- | -------------- | --------------------------------------------- |
| Source code access control | ✅ Implemented | GitHub with branch protection; access reviews |

### A.8.5 Secure Authentication

| Control                   | Status         | Evidence                                                     |
| ------------------------- | -------------- | ------------------------------------------------------------ |
| Authentication mechanisms | ✅ Implemented | Better Auth: password + OAuth + TOTP 2FA; session management |

### A.8.6 Capacity Management

| Control             | Status     | Evidence                                     |
| ------------------- | ---------- | -------------------------------------------- | ------------------------------------ |
| Capacity monitoring | ⚠️ Partial | Health check endpoints monitor system status | No capacity planning or auto-scaling |

### A.8.7 Protection Against Malware

| Control            | Status         | Evidence                                                                         |
| ------------------ | -------------- | -------------------------------------------------------------------------------- |
| Malware protection | ✅ Implemented | Input guardrails (prompt injection detection); dependency audit; secret scanning |

### A.8.8 Management of Technical Vulnerabilities

| Control                  | Status         | Evidence                                   |
| ------------------------ | -------------- | ------------------------------------------ |
| Vulnerability management | ✅ Implemented | `bun audit`, `audit-ci`, Gitleaks in CI/CD |

### A.8.9 Configuration Management

| Control               | Status         | Evidence                                                         |
| --------------------- | -------------- | ---------------------------------------------------------------- |
| Configuration control | ✅ Implemented | Git-tracked configs; environment variables; PM2 ecosystem config |

### A.8.10 Information Deletion

| Control       | Status         | Evidence                                                              |
| ------------- | -------------- | --------------------------------------------------------------------- |
| Data deletion | ✅ Implemented | Cascading user deletion; automated retention cleanup; 9 purge targets |

### A.8.11 Data Masking

| Control                       | Status         | Evidence                                              |
| ----------------------------- | -------------- | ----------------------------------------------------- |
| Data masking/pseudonymization | ✅ Implemented | PII redaction in logs; user anonymization on deletion |

### A.8.12 Data Leakage Prevention

| Control      | Status         | Evidence                                                      |
| ------------ | -------------- | ------------------------------------------------------------- |
| DLP controls | ✅ Implemented | Output guardrails prevent PII/secret leakage; egress policies |

### A.8.13 Information Backup

| Control           | Status         | Evidence                                   |
| ----------------- | -------------- | ------------------------------------------ |
| Backup procedures | ✅ Implemented | Supabase automated daily backups with PITR |

### A.8.14 Redundancy of Information Processing Facilities

| Control               | Status     | Evidence                              |
| --------------------- | ---------- | ------------------------------------- | ---------------------------- |
| Processing redundancy | ⚠️ Partial | PM2 cluster mode; Supabase managed HA | Single Digital Ocean droplet |

### A.8.15 Logging

| Control          | Status         | Evidence                                                                   |
| ---------------- | -------------- | -------------------------------------------------------------------------- |
| Activity logging | ✅ Implemented | 107 audit action types; structured JSON logging; security event monitoring |

### A.8.16 Monitoring Activities

| Control             | Status         | Evidence                                                            |
| ------------------- | -------------- | ------------------------------------------------------------------- |
| Security monitoring | ✅ Implemented | `securityMonitorFunction` (5-min cron); health checks; Slack alerts |

### A.8.17 Clock Synchronization

| Control              | Status         | Evidence                                                     |
| -------------------- | -------------- | ------------------------------------------------------------ |
| Time synchronization | ✅ Implemented | Cloud provider NTP; PostgreSQL timestamps; `DateTime` fields |

### A.8.18 Use of Privileged Utility Programs

| Control                    | Status         | Evidence                                      |
| -------------------------- | -------------- | --------------------------------------------- |
| Privileged utility control | ✅ Implemented | SSH restricted; deployment via CI/CD pipeline |

### A.8.19 Installation of Software on Operational Systems

| Control                       | Status         | Evidence                                                          |
| ----------------------------- | -------------- | ----------------------------------------------------------------- |
| Software installation control | ✅ Implemented | Deployment via CI/CD only; lockfile (`bun.lock`) for dependencies |

### A.8.20 Networks Security

| Control              | Status         | Evidence                                                        |
| -------------------- | -------------- | --------------------------------------------------------------- |
| Network segmentation | ✅ Implemented | Network egress policies; domain allowlists; Caddy reverse proxy |

### A.8.21 Security of Network Services

| Control                  | Status         | Evidence                                            |
| ------------------------ | -------------- | --------------------------------------------------- |
| Network service security | ✅ Implemented | TLS 1.2+; HSTS; Caddy with Let's Encrypt auto-certs |

### A.8.22 Segregation of Networks

| Control             | Status     | Evidence                                   |
| ------------------- | ---------- | ------------------------------------------ | ------------------------- |
| Network segregation | ⚠️ Partial | Egress policies separate internal/external | No VLAN-level segregation |

### A.8.23 Web Filtering

| Control               | Status         | Evidence                                                         |
| --------------------- | -------------- | ---------------------------------------------------------------- |
| Web content filtering | ✅ Implemented | Guardrails filter input/output; egress policies control outbound |

### A.8.24 Use of Cryptography

| Control                | Status         | Evidence                                     |
| ---------------------- | -------------- | -------------------------------------------- |
| Cryptographic controls | ✅ Implemented | AES-256-GCM, TLS, Ed25519, HKDF, HMAC-SHA256 |

### A.8.25 Secure Development Life Cycle

| Control       | Status         | Evidence                                                       |
| ------------- | -------------- | -------------------------------------------------------------- |
| SDLC security | ✅ Implemented | Type-check, lint, audit, secret scan, SCA, license check, SBOM |

### A.8.26 Application Security Requirements

| Control               | Status         | Evidence                                                              |
| --------------------- | -------------- | --------------------------------------------------------------------- |
| Security requirements | ✅ Implemented | CSRF protection; rate limiting; input validation; output sanitization |

### A.8.27 Secure System Architecture and Engineering Principles

| Control             | Status         | Evidence                                                               |
| ------------------- | -------------- | ---------------------------------------------------------------------- |
| Secure architecture | ✅ Implemented | Multi-tenant isolation; defense in depth; principle of least privilege |

### A.8.28 Secure Coding

| Control                 | Status         | Evidence                                                  |
| ----------------------- | -------------- | --------------------------------------------------------- |
| Secure coding practices | ✅ Implemented | `SECURITY.md` with 12 security domains; CI/CD enforcement |

### A.8.29 Security Testing in Development and Acceptance

| Control          | Status     | Evidence              |
| ---------------- | ---------- | --------------------- | -------------------------------------------- |
| Security testing | ⚠️ Partial | Automated CI/CD gates | No penetration testing yet (planned Q2 2026) |

### A.8.30 Outsourced Development

| Control                         | Status         | Evidence                                             |
| ------------------------------- | -------------- | ---------------------------------------------------- |
| Outsourced development security | ✅ Implemented | Vendor risk management policy; supply chain controls |

### A.8.31 Separation of Development, Test, and Production

| Control                | Status         | Evidence                                                           |
| ---------------------- | -------------- | ------------------------------------------------------------------ |
| Environment separation | ✅ Implemented | Git branching; workspace isolation; separate database environments |

### A.8.32 Change Management

| Control           | Status         | Evidence                                               |
| ----------------- | -------------- | ------------------------------------------------------ |
| Change management | ✅ Implemented | Git PR workflow; CI/CD gates; deployment with rollback |

### A.8.33 Test Information

| Control              | Status         | Evidence                                              |
| -------------------- | -------------- | ----------------------------------------------------- |
| Test data protection | ✅ Implemented | Separate test environments; no production data in dev |

### A.8.34 Protection of Information Systems During Audit Testing

| Control                | Status         | Evidence                                                       |
| ---------------------- | -------------- | -------------------------------------------------------------- |
| Audit testing controls | ✅ Implemented | Read-only access for audit queries; no production modification |

---

## Gap Remediation Priority

### Critical (For Certification)

1. **A.5.30 ICT Continuity** — Develop and test DR plan
2. **A.5.35 Independent Review** — Schedule external pen test / audit
3. **A.6.3 Security Training** — Implement awareness training program
4. **A.6.1 Screening** — Establish background check process

### High

5. **A.5.11 Return of Assets** — Create offboarding checklist
6. **A.5.13 Information Labelling** — Implement classification labels in application
7. **A.5.9 Asset Inventory** — Create formal CMDB
8. **A.5.22 Supplier Review** — Establish annual vendor review cadence

### Medium

9. **A.5.1 Policy Review** — Establish annual review and approval process
10. **A.5.3 SoD Matrix** — Document segregation of duties analysis
11. **A.5.6 Industry Groups** — Join OWASP, CSA, or similar
12. **A.8.14 Redundancy** — Evaluate multi-server deployment
