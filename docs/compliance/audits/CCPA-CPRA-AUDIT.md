# CCPA / CPRA Compliance Audit

**Audit Date:** February 21, 2026
**Audited System:** AgentC2 AI Agent Platform (agentc2.ai)
**Audited By:** Internal Compliance Assessment
**Regulation:** California Consumer Privacy Act (Cal. Civ. Code §1798.100-199.100) as amended by CPRA
**Entity Role:** Business (Controller equivalent)

---

## Executive Summary

| Category                      | Requirements | Compliant | Partial | Non-Compliant |
| ----------------------------- | ------------ | --------- | ------- | ------------- |
| Consumer Rights               | 7            | 5         | 2       | 0             |
| Business Obligations          | 8            | 6         | 2       | 0             |
| Service Provider Requirements | 4            | 3         | 1       | 0             |
| **TOTAL**                     | **19**       | **14**    | **5**   | **0**         |

**Overall CCPA/CPRA Readiness: 74% compliant, 26% partial**

---

## 1. Applicability Assessment

### Does CCPA/CPRA Apply to AgentC2?

| Threshold                               | Current Status                      | Applies?    |
| --------------------------------------- | ----------------------------------- | ----------- |
| Annual gross revenue > $25M             | To be determined                    | Potentially |
| Buy/sell/share PI of 100,000+ consumers | Enterprise SaaS — possible at scale | Potentially |
| 50%+ revenue from selling/sharing PI    | No — AgentC2 does not sell PI       | No          |

**Assessment:** CCPA/CPRA likely applies as AgentC2 scales. Even if not currently subject, implementing compliance is required for enterprise sales into California-based organizations.

---

## 2. Personal Information Categories (§1798.100)

### PI Categories Collected by AgentC2

| CCPA Category                    | AgentC2 Data                                                | Collected? | Source                     |
| -------------------------------- | ----------------------------------------------------------- | ---------- | -------------------------- |
| **A. Identifiers**               | Name, email, user ID, IP address                            | ✅ Yes     | Account creation, sessions |
| **B. Customer records**          | Name, email, organization info                              | ✅ Yes     | Account management         |
| **C. Protected classifications** | None collected                                              | ❌ No      | N/A                        |
| **D. Commercial information**    | Subscription status, usage data, cost events                | ✅ Yes     | Platform usage             |
| **E. Biometric information**     | None collected                                              | ❌ No      | N/A                        |
| **F. Internet activity**         | Browser type, device info, pages viewed, agent interactions | ✅ Yes     | Technical logs, audit logs |
| **G. Geolocation data**          | IP address (coarse location only)                           | ✅ Yes     | Session logs               |
| **H. Sensory data**              | Voice data (when voice agents enabled)                      | ✅ Yes     | ElevenLabs integration     |
| **I. Professional information**  | Organization name, role                                     | ✅ Yes     | Multi-tenancy              |
| **J. Education information**     | None collected                                              | ❌ No      | N/A                        |
| **K. Inferences**                | Agent performance scores, evaluation metrics                | ✅ Yes     | Learning system            |
| **L. Sensitive PI**              | None intentionally collected                                | ❌ No      | Guardrails block PII input |

---

## 3. Consumer Rights Assessment

### §1798.100 — Right to Know (Categories)

| Requirement                          | Status       | Evidence                                            | Assessment                                 |
| ------------------------------------ | ------------ | --------------------------------------------------- | ------------------------------------------ |
| Disclose categories of PI collected  | ✅ Compliant | Privacy policy Sec 4 (8 sub-categories)             | Comprehensive disclosure                   |
| Disclose categories of sources       | ✅ Compliant | Privacy policy Sec 4 identifies source per category | Direct collection + integrations           |
| Disclose business purpose            | ✅ Compliant | Privacy policy Sec 6 (9 purposes)                   | Clear purpose statements                   |
| Disclose categories of third parties | ✅ Compliant | Privacy policy Sec 7, `/subprocessors`              | AI providers, infrastructure, integrations |

### §1798.105 — Right to Delete

| Requirement                        | Status       | Evidence                                      | Assessment                                  |
| ---------------------------------- | ------------ | --------------------------------------------- | ------------------------------------------- |
| Delete PI on request               | ✅ Compliant | `DELETE /api/user/account` cascading deletion | 20+ models in `$transaction`                |
| Direct service providers to delete | ⚠️ Partial   | Documentation notes provider auto-purge       | No automated notification to sub-processors |
| Exceptions documented              | ✅ Compliant | Privacy policy Sec 11 notes legal retention   | Required retention noted                    |

### §1798.106 — Right to Correct (CPRA)

| Requirement           | Status     | Evidence                       | Assessment                                    |
| --------------------- | ---------- | ------------------------------ | --------------------------------------------- |
| Correct inaccurate PI | ⚠️ Partial | User profile editing available | DSR type RECTIFICATION exists but no workflow |

### §1798.110 — Right to Know (Specific Pieces)

| Requirement                   | Status       | Evidence                                          | Assessment                |
| ----------------------------- | ------------ | ------------------------------------------------- | ------------------------- |
| Provide specific PI collected | ✅ Compliant | `GET /api/user/data-export` exports 12 categories | JSON bundle with manifest |

### §1798.115 — Right to Know (Sale/Sharing)

| Requirement                 | Status       | Evidence                                                          | Assessment                                                  |
| --------------------------- | ------------ | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| Disclose sale/sharing of PI | ✅ Compliant | Privacy policy Sec 13: "We do not sell your personal information" | No sale or sharing for cross-context behavioral advertising |

### §1798.120 — Right to Opt-Out of Sale/Sharing

| Requirement        | Status | Evidence                                  | Assessment                                  |
| ------------------ | ------ | ----------------------------------------- | ------------------------------------------- |
| Opt-out mechanism  | ✅ N/A | AgentC2 does not sell or share PI         | Affirmatively stated in privacy policy      |
| "Do Not Sell" link | ✅ N/A | Not required since no sale/sharing occurs | Privacy policy Sec 14 addresses DNT signals |

### §1798.121 — Right to Limit Use of Sensitive PI (CPRA)

| Requirement                   | Status       | Evidence                                              | Assessment                                                  |
| ----------------------------- | ------------ | ----------------------------------------------------- | ----------------------------------------------------------- |
| Limit sensitive PI processing | ✅ Compliant | Guardrails block sensitive data input (PII detection) | AI transparency Sec 9 prohibits special category processing |

---

## 4. Business Obligations Assessment

### §1798.100(b) — Privacy Policy Disclosure

| Requirement                                 | Status       | Evidence                               | Assessment                     |
| ------------------------------------------- | ------------ | -------------------------------------- | ------------------------------ |
| Categories of PI collected (past 12 months) | ✅ Compliant | Privacy policy Sec 4                   | 8 sub-categories               |
| Categories of sources                       | ✅ Compliant | Privacy policy Sec 4                   | Source identified per category |
| Business/commercial purpose                 | ✅ Compliant | Privacy policy Sec 6                   | 9 purposes listed              |
| Categories of third parties                 | ✅ Compliant | Privacy policy Sec 7, `/subprocessors` | 4 provider categories          |
| Categories sold/shared                      | ✅ Compliant | "None" — stated explicitly             | Sec 13                         |

### §1798.100(d) — Collect Only Necessary PI

| Requirement                            | Status       | Evidence                                                        | Assessment                          |
| -------------------------------------- | ------------ | --------------------------------------------------------------- | ----------------------------------- |
| Reasonably necessary and proportionate | ✅ Compliant | Minimum OAuth scopes, security policy Sec 8 (data minimization) | Per-integration scope justification |

### §1798.130 — Request Handling Process

| Requirement                              | Status       | Evidence                                        | Assessment                   |
| ---------------------------------------- | ------------ | ----------------------------------------------- | ---------------------------- |
| Two verifiable request methods           | ✅ Compliant | DSR API + privacy@agentc2.ai email              | API + email channels         |
| 45-day response timeline                 | ⚠️ Partial   | DSR tracking exists                             | No automated SLA tracking    |
| Identity verification before fulfillment | ✅ Compliant | Authenticated user session required for DSR API | Session-based verification   |
| Free of charge (2x per year)             | ✅ Compliant | No charges for data requests                    | Rate limited but not charged |

### §1798.135 — Do Not Sell Link

| Requirement   | Status | Evidence              | Assessment   |
| ------------- | ------ | --------------------- | ------------ |
| Homepage link | ✅ N/A | No sale/sharing of PI | Not required |

### §1798.140 — Definitions Compliance

| Requirement             | Status       | Evidence                                               | Assessment                                              |
| ----------------------- | ------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| "Sale" not occurring    | ✅ Compliant | No PI exchanged for monetary or valuable consideration | AI provider transmission is service provision, not sale |
| "Sharing" not occurring | ✅ Compliant | No cross-context behavioral advertising                | No tracking cookies or ad networks                      |

### §1798.145 — Exemptions

| Requirement               | Status       | Evidence                               | Assessment                              |
| ------------------------- | ------------ | -------------------------------------- | --------------------------------------- |
| B2B transaction exemption | ✅ Compliant | AgentC2 primarily serves B2B customers | B2B communications exemption applicable |

### §1798.150 — Private Right of Action (Security)

| Requirement                    | Status       | Evidence                                             | Assessment                                    |
| ------------------------------ | ------------ | ---------------------------------------------------- | --------------------------------------------- |
| Reasonable security procedures | ✅ Compliant | AES-256-GCM, TLS, RBAC, audit logging, MFA available | Documented at `/security` and `/trust-center` |

### §1798.185 — CPRA Regulations

| Requirement                                 | Status     | Evidence                  | Assessment                                     |
| ------------------------------------------- | ---------- | ------------------------- | ---------------------------------------------- |
| Risk assessments for significant processing | ⚠️ Partial | DPIA framework documented | No risk assessment completed for AI processing |

---

## 5. Service Provider Requirements

### When AgentC2 Acts as Service Provider (Processing Customer Data)

| Requirement                            | Status       | Evidence                                                       | Assessment                                               |
| -------------------------------------- | ------------ | -------------------------------------------------------------- | -------------------------------------------------------- |
| Written contract with business purpose | ✅ Compliant | DPA template in compliance docs                                | Covers CCPA service provider requirements                |
| No selling/sharing of received PI      | ✅ Compliant | Platform design precludes sale/sharing                         | No ad network, no data broker integration                |
| No retention beyond contract term      | ✅ Compliant | Account deletion removes all data; retention cleanup automated | Cascading delete + retention cron                        |
| Assist with consumer requests          | ⚠️ Partial   | DSR tracking exists                                            | No automated pipeline between customer and sub-processor |

---

## 6. Non-Discrimination (§1798.125)

| Requirement                             | Status       | Evidence                                                                                                  | Assessment                                    |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| No discrimination for exercising rights | ✅ Compliant | Privacy policy Sec 13: "We will not discriminate against you for exercising any of your CCPA/CPRA rights" | Explicit commitment                           |
| No denial of service                    | ✅ Compliant | No tiered pricing based on data sharing                                                                   | Uniform service regardless of privacy choices |

---

## 7. Children's Privacy

| Requirement                                   | Status       | Evidence                                                                         | Assessment                                 |
| --------------------------------------------- | ------------ | -------------------------------------------------------------------------------- | ------------------------------------------ |
| No collection from minors < 16 without opt-in | ✅ Compliant | Privacy policy Sec 15: "not intended for use by individuals under the age of 18" | B2B platform; Terms Sec 3 requires age 18+ |

---

## Gap Remediation Priority

### High

1. **Automated SLA Tracking** — Add 45-day deadline tracking to DSR model with automated alerts
2. **Risk Assessment** — Complete CPRA-required risk assessment for AI processing activities
3. **Sub-processor Notification** — Automate deletion requests to sub-processors on consumer delete

### Medium

4. **Rectification Workflow** — Build automated data correction workflow for DSR type RECTIFICATION
5. **Annual Privacy Policy Update** — Ensure privacy policy reflects past-12-months disclosure requirement
6. **Consumer Request Metrics** — Track and report DSR fulfillment metrics (volume, response time, outcomes)

### Low

7. **Employee Training** — CCPA-specific training for any staff handling consumer requests
8. **Vendor Contract Review** — Ensure all sub-processor contracts include CCPA service provider terms
