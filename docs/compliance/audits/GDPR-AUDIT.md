# GDPR Compliance Audit

**Audit Date:** February 21, 2026
**Audited System:** AgentC2 AI Agent Platform (agentc2.ai)
**Audited By:** Internal Compliance Assessment
**Regulation:** EU General Data Protection Regulation (Regulation 2016/679)
**Data Controller:** Appello Software Pty Ltd (ABN 62 641 990 128)

---

## Executive Summary

| Chapter                         | Articles Assessed | Compliant | Partial | Non-Compliant | N/A   |
| ------------------------------- | ----------------- | --------- | ------- | ------------- | ----- |
| Ch. II — Principles             | 6                 | 5         | 1       | 0             | 0     |
| Ch. III — Data Subject Rights   | 8                 | 5         | 3       | 0             | 0     |
| Ch. IV — Controller/Processor   | 11                | 7         | 3       | 1             | 0     |
| Ch. V — International Transfers | 2                 | 1         | 1       | 0             | 0     |
| **TOTAL**                       | **27**            | **18**    | **8**   | **1**         | **0** |

**Overall GDPR Readiness: 67% compliant, 30% partial, 3% gap**

---

## Chapter II — Principles (Articles 5-11)

### Article 5 — Principles Relating to Processing

| Principle                                      | Status       | Evidence                                                                                                                    | Assessment                                                                        |
| ---------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **5(1)(a) Lawfulness, fairness, transparency** | ✅ Compliant | Privacy policy at `/privacy` identifies 4 legal bases: contract performance, consent, legitimate interest, legal obligation | Legal bases mapped per processing activity                                        |
| **5(1)(b) Purpose limitation**                 | ✅ Compliant | Privacy policy Sec 6 enumerates 9 specific purposes; Sec 6 "What We Do Not Do" lists 5 prohibited uses                      | Purposes clearly defined                                                          |
| **5(1)(c) Data minimization**                  | ✅ Compliant | Security policy Sec 8 documents minimum OAuth scopes; calendar uses `calendar.readonly`                                     | Per-integration scope justification                                               |
| **5(1)(d) Accuracy**                           | ⚠️ Partial   | Users can edit profile data; no automated data quality mechanisms                                                           | User self-service exists; DSR type RECTIFICATION exists but no automated workflow |
| **5(1)(e) Storage limitation**                 | ✅ Compliant | `dataRetentionCleanupFunction` enforces 9 retention schedules; Privacy policy Sec 11 documents periods                      | Automated purge with audit trail                                                  |
| **5(1)(f) Integrity and confidentiality**      | ✅ Compliant | AES-256-GCM encryption, TLS, RBAC, audit logging, PII redaction, security headers                                           | Comprehensive technical measures                                                  |
| **5(2) Accountability**                        | ✅ Compliant | Audit logs (107 action types), consent records, DSR tracking, compliance documentation                                      | Evidence-generating controls                                                      |

### Article 6 — Lawfulness of Processing

| Legal Basis                      | Status       | Evidence                                                                                    |
| -------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| **6(1)(a) Consent**              | ✅ Compliant | `ConsentRecord` model tracks consent per type/version; OAuth consent flows for integrations |
| **6(1)(b) Contract performance** | ✅ Compliant | Terms of Service at `/terms`; processing necessary to provide the platform                  |
| **6(1)(f) Legitimate interests** | ✅ Compliant | Privacy policy Sec 5 identifies: security monitoring, fraud prevention, analytics           |

### Article 7 — Conditions for Consent

| Requirement                      | Status       | Evidence                                                                                               | Assessment                                                                    |
| -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **7(1) Demonstrate consent**     | ✅ Compliant | `ConsentRecord` captures userId, consentType, version, IP, userAgent, timestamp                        | Full audit trail                                                              |
| **7(2) Distinguishable request** | ✅ Compliant | Separate consent types: PRIVACY_POLICY, TERMS_OF_SERVICE, MARKETING, DATA_PROCESSING                   | Granular consent                                                              |
| **7(3) Right to withdraw**       | ✅ Compliant | Consent revocation API (`POST /api/user/consent` with `granted: false`); `CONSENT_REVOKE` audit action | Withdrawal as easy as granting                                                |
| **7(4) Not conditional**         | ⚠️ Partial   | Marketing consent separate from service consent                                                        | Terms/privacy acceptance required for service use (permissible under 6(1)(b)) |

### Article 9 — Special Categories

| Requirement                            | Status       | Evidence                                                                                                              |
| -------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| No processing of special category data | ✅ Compliant | Platform is a business tool; AI transparency page Sec 9 prohibits processing special category data without safeguards |

### Article 10 — Criminal Convictions

| Requirement                    | Status | Evidence                                           |
| ------------------------------ | ------ | -------------------------------------------------- |
| No processing of criminal data | ✅ N/A | Platform does not process criminal conviction data |

---

## Chapter III — Rights of the Data Subject (Articles 12-23)

### Article 12 — Transparent Communication

| Requirement                             | Status       | Evidence                                                                     | Assessment                                     |
| --------------------------------------- | ------------ | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| **12(1) Clear, plain language**         | ✅ Compliant | Privacy policy uses accessible language, structured sections, tables         | No legal jargon without explanation            |
| **12(2) Facilitate exercise of rights** | ✅ Compliant | DSR API (`POST /api/dsr`), data export API, account deletion, account freeze | Self-service endpoints                         |
| **12(3) Respond within 1 month**        | ⚠️ Partial   | DSR tracking with status field                                               | No automated SLA tracking or deadline alerting |

### Article 13 — Information at Collection

| Requirement                            | Status       | Evidence                                                                          |
| -------------------------------------- | ------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **13(1)(a) Controller identity**       | ✅ Compliant | Privacy policy Sec 2: "Appello Software Pty Ltd" with ABN                         |
| **13(1)(b) Contact details**           | ✅ Compliant | privacy@agentc2.ai, security@agentc2.ai                                           |
| **13(1)(c) Processing purposes**       | ✅ Compliant | Privacy policy Sec 6: 9 enumerated purposes                                       |
| **13(1)(d) Legal basis**               | ✅ Compliant | Privacy policy Sec 5: table with 4 legal bases                                    |
| **13(1)(e) Recipients**                | ✅ Compliant | Privacy policy Sec 7: AI providers, voice providers, integrations, infrastructure |
| **13(1)(f) International transfers**   | ✅ Compliant | Privacy policy Sec 8: US data centers, SCCs, safeguards                           |
| **13(2)(a) Retention periods**         | ✅ Compliant | Privacy policy Sec 11: 7-row retention table                                      |
| **13(2)(b) Data subject rights**       | ✅ Compliant | Privacy policy Sec 12: 11 rights enumerated                                       |
| **13(2)(c) Consent withdrawal**        | ✅ Compliant | Privacy policy Sec 12: right to withdraw consent                                  |
| **13(2)(d) Supervisory authority**     | ✅ Compliant | Privacy policy Sec 17: OAIC, DPA, ICO listed                                      |
| **13(2)(e) Automated decision-making** | ⚠️ Partial   | AI transparency page discusses model limitations                                  | No explicit Art. 22 automated decision-making disclosure |

### Article 14 — Information Not Obtained from Data Subject

| Requirement                     | Status     | Evidence                                                                                                  |
| ------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Indirect data collection notice | ⚠️ Partial | Integration data (CRM, email) processed from third-party sources; privacy policy mentions this in Sec 4.5 | Could be more explicit about categories obtained from integrations |

### Article 15 — Right of Access

| Requirement                   | Status       | Evidence                                             | Assessment                  |
| ----------------------------- | ------------ | ---------------------------------------------------- | --------------------------- |
| **15(1) Confirm processing**  | ✅ Compliant | `GET /api/user/data-export` returns full data bundle | 12 data categories exported |
| **15(2) Transfer safeguards** | ✅ Compliant | Privacy policy Sec 8 documents SCCs                  | Safeguards described        |
| **15(3) Copy of data**        | ✅ Compliant | JSON export with manifest                            | Machine-readable format     |

### Article 16 — Right to Rectification

| Requirement             | Status     | Evidence                                                                    | Assessment                                                           |
| ----------------------- | ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Rectification mechanism | ⚠️ Partial | User profile editing via `/api/user/profile`; DSR type RECTIFICATION exists | No API for correcting other data categories (agent runs, audit logs) |

### Article 17 — Right to Erasure

| Requirement                      | Status       | Evidence                                                                          | Assessment                                    |
| -------------------------------- | ------------ | --------------------------------------------------------------------------------- | --------------------------------------------- |
| **17(1) Erasure on request**     | ✅ Compliant | `DELETE /api/user/account` cascading deletion across 20+ tables in `$transaction` | Comprehensive implementation                  |
| **17(1)(a) No longer necessary** | ✅ Compliant | `dataRetentionCleanupFunction` auto-purges expired data                           | 9 purge targets                               |
| **17(1)(b) Consent withdrawn**   | ✅ Compliant | Consent revocation triggers restriction consideration                             | Integration disconnection deletes credentials |
| **17(2) Notify processors**      | ⚠️ Partial   | Documentation notes OpenAI/Anthropic auto-purge after 30 days                     | No automated notification to sub-processors   |

### Article 18 — Right to Restriction

| Requirement                     | Status       | Evidence                                                | Assessment                                             |
| ------------------------------- | ------------ | ------------------------------------------------------- | ------------------------------------------------------ |
| **18(1) Restrict processing**   | ✅ Compliant | `POST /api/user/account/freeze` sets status to "frozen" | Agent/tool execution blocked; authentication preserved |
| **18(2) Storage only**          | ✅ Compliant | Frozen accounts: data stored but not processed          | Matches GDPR requirement                               |
| **18(3) Notify before lifting** | ⚠️ Partial   | Unfreeze API exists                                     | No notification mechanism before lifting restriction   |

### Article 20 — Right to Data Portability

| Requirement                 | Status           | Evidence                                    | Assessment                                                    |
| --------------------------- | ---------------- | ------------------------------------------- | ------------------------------------------------------------- |
| **20(1) Structured format** | ✅ Compliant     | JSON export with 12 categories and manifest | Machine-readable, structured                                  |
| **20(2) Direct transfer**   | ❌ Non-Compliant | No API-to-API transfer mechanism            | Would need to implement direct transfer to another controller |

### Article 21 — Right to Object

| Requirement                    | Status       | Evidence                                            | Assessment                 |
| ------------------------------ | ------------ | --------------------------------------------------- | -------------------------- |
| **21(1) Object to processing** | ✅ Compliant | DSR type OBJECTION exists; account freeze available | Can restrict processing    |
| **21(2) Direct marketing**     | ✅ Compliant | `marketingConsent` field; consent revocation        | Separate marketing consent |

---

## Chapter IV — Controller and Processor (Articles 24-43)

### Article 24 — Responsibility of the Controller

| Requirement                    | Status       | Evidence                                                                          |
| ------------------------------ | ------------ | --------------------------------------------------------------------------------- |
| Implement appropriate measures | ✅ Compliant | Technical measures documented in `/security`, organizational measures in policies |

### Article 25 — Data Protection by Design and Default

| Requirement          | Status       | Evidence                                                                  | Assessment                  |
| -------------------- | ------------ | ------------------------------------------------------------------------- | --------------------------- |
| **25(1) By design**  | ✅ Compliant | PII redaction, encryption, RBAC, guardrails built into platform           | Not retrofit; designed in   |
| **25(2) By default** | ✅ Compliant | Minimum scopes per integration, no tracking cookies, session-only cookies | Privacy-preserving defaults |

### Article 28 — Processor

| Requirement                     | Status       | Evidence                                                                           | Assessment                     |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------- | ------------------------------ |
| **28(1) Sufficient guarantees** | ✅ Compliant | Vendor risk management policy; subprocessors all SOC 2 certified (where available) | Assessment process defined     |
| **28(2) Prior authorization**   | ✅ Compliant | Subprocessor register with 30-day notice period                                    | `/subprocessors` page          |
| **28(3) DPA requirements**      | ✅ Compliant | DPA template in `docs/compliance/PRIVACY-DATA-PROTECTION.md` Sec 6                 | Covers all Art. 28(3) elements |

### Article 30 — Records of Processing Activities

| Requirement               | Status       | Evidence                                           | Assessment                                    |
| ------------------------- | ------------ | -------------------------------------------------- | --------------------------------------------- |
| **30(1) Controller RoPA** | ✅ Compliant | `docs/compliance/PRIVACY-DATA-PROTECTION.md` Sec 4 | 7 processing activities documented            |
| **30(2) Processor RoPA**  | ⚠️ Partial   | Categories in RoPA                                 | Needs per-customer processing record template |

### Article 32 — Security of Processing

| Requirement                                           | Status       | Evidence                                               | Assessment                                   |
| ----------------------------------------------------- | ------------ | ------------------------------------------------------ | -------------------------------------------- |
| **32(1)(a) Pseudonymization/encryption**              | ✅ Compliant | AES-256-GCM encryption; user anonymization on deletion | Both implemented                             |
| **32(1)(b) Confidentiality, integrity, availability** | ✅ Compliant | RBAC, audit logs, TLS, health checks, PM2 auto-restart | All three pillars addressed                  |
| **32(1)(c) Restore availability**                     | ⚠️ Partial   | Supabase PITR backups; deployment rollback             | DR testing not performed                     |
| **32(1)(d) Regular testing**                          | ⚠️ Partial   | CI/CD security gates                                   | No penetration testing yet (planned Q2 2026) |

### Article 33 — Notification to Supervisory Authority

| Requirement                      | Status       | Evidence                                                   | Assessment                      |
| -------------------------------- | ------------ | ---------------------------------------------------------- | ------------------------------- |
| **33(1) 72-hour notification**   | ✅ Compliant | `docs/compliance/policies/INCIDENT-RESPONSE-PLAN.md` Sec 9 | Templates and timelines defined |
| **33(2) Processor notification** | ✅ Compliant | DPA requires "without undue delay" notification            | DPA clause included             |

### Article 34 — Communication to Data Subject

| Requirement                      | Status       | Evidence                                                   |
| -------------------------------- | ------------ | ---------------------------------------------------------- | ----------------- |
| **34(1) High-risk notification** | ✅ Compliant | Incident response plan includes affected user notification | Templates defined |

### Article 35 — Data Protection Impact Assessment

| Requirement                             | Status       | Evidence                                            | Assessment                                              |
| --------------------------------------- | ------------ | --------------------------------------------------- | ------------------------------------------------------- |
| **35(1) DPIA for high-risk processing** | ✅ Compliant | `docs/compliance/PRIVACY-DATA-PROTECTION.md` Sec 12 | DPIA framework documented                               |
| **35(7) Assessment elements**           | ⚠️ Partial   | DPIA structure defined                              | No DPIA actually completed for AI processing activities |

### Article 37-39 — Data Protection Officer

| Requirement     | Status     | Evidence                         | Assessment                                                                       |
| --------------- | ---------- | -------------------------------- | -------------------------------------------------------------------------------- |
| DPO appointment | ⚠️ Partial | privacy@agentc2.ai contact point | No formally designated DPO; may not be required (depends on scale of processing) |

---

## Chapter V — International Transfers (Articles 44-49)

### Article 44 — General Transfer Principle

| Requirement         | Status       | Evidence                                          |
| ------------------- | ------------ | ------------------------------------------------- |
| Transfer safeguards | ✅ Compliant | Privacy policy Sec 8; DPA includes SCC references |

### Article 46 — Appropriate Safeguards

| Requirement                               | Status     | Evidence                                | Assessment                                |
| ----------------------------------------- | ---------- | --------------------------------------- | ----------------------------------------- |
| **46(2)(c) Standard Contractual Clauses** | ⚠️ Partial | SCC reference in privacy policy and DPA | SCCs not yet executed with sub-processors |

---

## Gap Remediation Priority

### Critical

1. **Art. 20(2) Direct Data Transfer** — Implement or document inability to transfer directly to another controller
2. **Art. 35 DPIA Completion** — Complete DPIA for AI agent processing (high-risk automated processing)

### High

3. **Art. 12(3) SLA Tracking** — Add 30-day deadline tracking to DSR model
4. **Art. 17(2) Sub-processor Notification** — Automate deletion notification to sub-processors
5. **Art. 13(2)(e) Automated Decision-Making** — Add Art. 22 disclosure to privacy policy
6. **Art. 46 SCC Execution** — Execute SCCs with OpenAI, Anthropic, Supabase, Digital Ocean

### Medium

7. **Art. 30(2) Processor RoPA** — Create per-customer processing record template
8. **Art. 37 DPO** — Assess whether DPO appointment is required based on processing scale
9. **Art. 16 Rectification** — Extend rectification to additional data categories
10. **Art. 18(3) Restriction Notification** — Add notification before lifting processing restriction
