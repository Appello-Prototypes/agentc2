# Compliance Roadmap — To-Do List

**Created:** February 21, 2026
**Source:** Internal compliance audits across SOC 2, GDPR, CCPA/CPRA, PIPEDA, ISO 27001, EU AI Act, NIST AI RMF
**Target:** Enterprise-procurement ready within 6 months; SOC 2 Type II certified within 14 months

---

## How to Read This Roadmap

- Items are grouped by month and prioritized within each month
- **Type** indicates the nature of work: `code` (engineering), `process` (operational procedure), `document` (policy/documentation), `vendor` (external engagement)
- **Frameworks** shows which audit(s) flagged the gap
- **Blocking** indicates if the item blocks a certification milestone
- Check the box when complete

---

## Month 1 — Foundation & Quick Wins

_Focus: Close the gaps that block SOC 2 engagement and enterprise questionnaires_

### Critical

- [ ] **1.1 — Disaster Recovery Tabletop Exercise** `process`
    - Schedule and run a DR tabletop exercise simulating database failure and application outage
    - Document RTO/RPO targets and validate against Supabase PITR capabilities
    - Produce a written DR test report with findings
    - Frameworks: SOC 2 (CC7.4, CC7.5, A1.3), ISO 27001 (A.5.30)
    - Blocking: SOC 2 engagement
    - Effort: 2 days

- [ ] **1.2 — Backup Restoration Test** `process`
    - Restore a Supabase backup to a separate environment
    - Validate data integrity post-restore
    - Document the restoration procedure and time-to-restore
    - Frameworks: SOC 2 (CC7.5), ISO 27001 (A.8.13)
    - Blocking: SOC 2 engagement
    - Effort: 1 day

- [ ] **1.3 — Security Awareness Training Program** `process` `document`
    - Select a training platform (e.g., KnowBe4, Curricula, or lightweight internal deck)
    - Create or deploy modules covering: phishing, password hygiene, data handling, incident reporting, AI-specific risks
    - Require completion by all team members; log completion dates
    - Frameworks: SOC 2 (CC1.4), ISO 27001 (A.6.3)
    - Blocking: SOC 2 engagement
    - Effort: 1 week

- [ ] **1.4 — Periodic Access Review Process** `process`
    - Define quarterly access review procedure: who reviews, what's reviewed, how findings are remediated
    - Conduct initial access review across: GitHub, Supabase, Digital Ocean, production SSH, platform admin roles
    - Document results and any revocations
    - Frameworks: SOC 2 (CC6.4), ISO 27001 (A.5.18)
    - Blocking: SOC 2 engagement
    - Effort: 2 days

### High

- [ ] **1.5 — Business Continuity Plan (BCP)** `document`
    - Write formal BCP covering: critical services, dependencies, communication plan, recovery procedures, roles
    - Include scenarios: database outage, cloud provider outage, key person unavailability, security breach
    - Frameworks: SOC 2 (CC7.4), ISO 27001 (A.5.29)
    - Effort: 3 days

- [ ] **1.6 — Penetration Test — Vendor Selection** `vendor`
    - Research and select a pen test vendor (e.g., Cobalt, HackerOne, independent firm)
    - Define scope: web application, API, infrastructure
    - Schedule engagement for Month 2
    - Frameworks: SOC 2 (CC7.2), ISO 27001 (A.5.35, A.8.29)
    - Blocking: SOC 2 engagement
    - Effort: 3 days

- [ ] **1.7 — Employee Offboarding Checklist** `document` `process`
    - Create formal offboarding checklist: credential revocation, GitHub access, SSH keys, session termination, knowledge transfer
    - Frameworks: ISO 27001 (A.5.11, A.6.5)
    - Effort: 1 day

---

## Month 2 — Privacy Rights Hardening & Pen Test

_Focus: Close privacy regulation gaps; execute first pen test_

### Critical

- [ ] **2.1 — Complete DPIA for AI Processing** `document`
    - Complete a Data Protection Impact Assessment for: AI agent processing, RAG ingestion, voice processing, integration data processing
    - Follow the DPIA framework in `docs/compliance/PRIVACY-DATA-PROTECTION.md` Sec 12
    - Document risks, mitigations, and residual risk acceptance
    - Frameworks: GDPR (Art. 35), EU AI Act (Art. 26(9)), NIST AI RMF (MAP 2.1)
    - Blocking: GDPR compliance
    - Effort: 1 week

- [ ] **2.2 — Penetration Test Execution** `vendor`
    - Execute pen test per scope defined in 1.6
    - Remediate critical and high findings immediately
    - Produce pen test report (redacted version for customers)
    - Frameworks: SOC 2 (CC7.2), ISO 27001 (A.5.35, A.8.29)
    - Blocking: SOC 2 engagement
    - Effort: 2-4 weeks (vendor-dependent)

### High

- [ ] **2.3 — DSR SLA Tracking** `code`
    - Add `deadline` field to `DataSubjectRequest` model (calculated: 30 days for GDPR/PIPEDA, 45 days for CCPA)
    - Add Inngest cron job to check for approaching and overdue DSR deadlines
    - Send alerts when DSR is within 5 days of deadline or overdue
    - Frameworks: GDPR (Art. 12(3)), CCPA (§1798.130), PIPEDA (Principle 9)
    - Effort: 2 days

- [ ] **2.4 — MFA Enforcement for Admins** `code`
    - Require TOTP 2FA for users with `owner` or `admin` membership roles
    - Add middleware check: if role ≥ admin and 2FA not enabled, redirect to 2FA setup
    - Frameworks: SOC 2 (CC6.1), ISO 27001 (A.8.5)
    - Effort: 2 days

- [ ] **2.5 — Art. 22 Automated Decision-Making Disclosure** `document`
    - Add section to privacy policy disclosing any automated decision-making
    - Clarify that AI agents assist humans, not make autonomous consequential decisions
    - Frameworks: GDPR (Art. 13(2)(e), Art. 22)
    - Effort: 1 day

- [ ] **2.6 — Segregation of Duties Matrix** `document`
    - Document SoD analysis for critical operations: deployment, database access, financial controls, user management
    - Map RBAC roles to duties and identify any conflicts
    - Frameworks: SOC 2 (CC1.3), ISO 27001 (A.5.3)
    - Effort: 1 day

---

## Month 3 — SOC 2 Readiness & AI Safety

_Focus: Engage SOC 2 auditor; begin AI-specific testing_

### Critical

- [ ] **3.1 — SOC 2 Auditor Engagement** `vendor`
    - Select and engage SOC 2 auditor (e.g., Prescient Assurance, Johanson Group, A-LIGN)
    - Alternative: engage via compliance automation platform (Vanta, Drata, Secureframe) which bundles auditor
    - Define scope: Security + Confidentiality TSCs (add Privacy if ready)
    - Begin Type I readiness assessment
    - Blocking: SOC 2 certification
    - Effort: 1 week (selection), ongoing (engagement)

- [ ] **3.2 — Compliance Automation Platform Evaluation** `vendor`
    - Evaluate Vanta, Drata, or Secureframe for: evidence collection, policy management, continuous monitoring, auditor integration
    - Select and implement chosen platform
    - Connect integrations: GitHub, cloud provider, identity provider
    - Frameworks: SOC 2, ISO 27001
    - Effort: 2 weeks

### High

- [ ] **3.3 — Bias Testing Suite** `code`
    - Build automated bias evaluation tests using `@mastra/evals` bias scorer
    - Create test prompts across protected categories: gender, race, age, disability, religion
    - Run baseline evaluation and document results
    - Integrate into CI/CD or periodic evaluation schedule
    - Frameworks: NIST AI RMF (MEASURE 2.1), EU AI Act (Art. 26)
    - Effort: 1 week

- [ ] **3.4 — Encryption Key Rotation Procedure** `document` `code`
    - Document key rotation procedure for `CREDENTIAL_ENCRYPTION_KEY`
    - Implement dual-key support: decrypt with old key, re-encrypt with new key
    - Test rotation in staging environment
    - Frameworks: SOC 2 (CC6.8), ISO 27001 (A.8.24)
    - Effort: 1 week

- [ ] **3.5 — SAST Integration in CI/CD** `code`
    - Add static application security testing to `security-gates.yml`
    - Evaluate: Semgrep (free tier), CodeQL (GitHub-native), or SonarQube
    - Configure rules appropriate for TypeScript/Next.js
    - Frameworks: ISO 27001 (A.8.25)
    - Effort: 2 days

- [ ] **3.6 — Dependency Update Automation** `code`
    - Enable Dependabot or Renovate for automated dependency PRs
    - Configure: security-only updates auto-merged; feature updates require review
    - Frameworks: ISO 27001 (A.8.8)
    - Effort: 1 day

---

## Month 4 — Audit Evidence & Advanced Controls

_Focus: Accumulate SOC 2 evidence; strengthen advanced controls_

### High

- [ ] **4.1 — Immutable Audit Logs** `code`
    - Implement hash-chain integrity for audit log entries (each entry includes hash of previous entry)
    - Add verification endpoint to detect tampering
    - Frameworks: SOC 2 (CC4.1), ISO 27001 (A.8.15)
    - Effort: 1 week

- [ ] **4.2 — Cross-Tenant Isolation Tests** `code`
    - Write automated tests that verify: User A cannot access Org B's data across all major API endpoints
    - Add to CI/CD test suite
    - Frameworks: SOC 2 (CC6.7), ISO 27001 (A.8.3)
    - Effort: 1 week

- [ ] **4.3 — Data Rectification Workflow** `code`
    - Extend DSR type RECTIFICATION with automated workflow
    - Allow correction of profile fields, metadata, and annotations
    - Audit log all rectification actions
    - Frameworks: GDPR (Art. 16), CCPA (§1798.106), PIPEDA (Principle 6)
    - Effort: 3 days

- [ ] **4.4 — AI Content Provenance Evaluation** `code`
    - Research C2PA or similar machine-readable content provenance standards
    - Evaluate feasibility for AI-generated text and voice output
    - If viable, implement metadata tagging for AI-generated content
    - Frameworks: EU AI Act (Art. 50(2))
    - Effort: 1 week

- [ ] **4.5 — Sub-Processor Deletion Notification** `code`
    - On user erasure, send automated notification to relevant sub-processors (OpenAI, Anthropic) requesting data deletion
    - Log notification attempts and responses
    - Frameworks: GDPR (Art. 17(2)), CCPA (§1798.105)
    - Effort: 3 days

### Medium

- [ ] **4.6 — CSP Reporting Endpoint** `code`
    - Add Content-Security-Policy-Report-Only header with report-uri
    - Create `/api/csp-report` endpoint to collect and log violations
    - Frameworks: SOC 2 (CC8.1)
    - Effort: 1 day

- [ ] **4.7 — SCC Execution with Sub-Processors** `vendor` `document`
    - Review existing DPAs/terms with OpenAI, Anthropic, Supabase, Digital Ocean, ElevenLabs
    - Ensure Standard Contractual Clauses are in place for EU data transfers
    - Document SCC status per sub-processor
    - Frameworks: GDPR (Art. 46)
    - Effort: 2 weeks

---

## Month 5 — SOC 2 Type I & AI Governance

_Focus: Complete SOC 2 Type I; mature AI governance_

### Critical

- [ ] **5.1 — SOC 2 Type I Audit** `vendor`
    - Complete Type I point-in-time assessment with auditor
    - Remediate any findings
    - Obtain Type I report
    - Blocking: Enterprise sales (unblocks ~80% of deals)
    - Effort: 2-4 weeks (auditor-led)

### High

- [ ] **5.2 — Red-Teaming Program** `code` `process`
    - Establish automated adversarial testing for AI agents
    - Create prompt injection test suite (jailbreak attempts, indirect injection, context manipulation)
    - Run monthly and document findings
    - Frameworks: NIST AI RMF (MEASURE 2.1)
    - Effort: 2 weeks

- [ ] **5.3 — Model Drift Detection** `code`
    - Implement automated monitoring for agent output quality degradation
    - Compare evaluation scores over time windows (weekly rolling average)
    - Alert when scores drop below configurable threshold
    - Frameworks: NIST AI RMF (MEASURE 3.1)
    - Effort: 1 week

- [ ] **5.4 — AI Risk Reporting Cadence** `process`
    - Establish quarterly AI risk reporting
    - Define report template: guardrail violation trends, cost trends, alert patterns, evaluation scores, incident summary
    - Deliver first report
    - Frameworks: NIST AI RMF (MEASURE 4.1, MANAGE 2.1)
    - Effort: 2 days

---

## Month 6 — Process Maturity & Expansion

_Focus: Harden processes; prepare for SOC 2 Type II observation period_

### High

- [ ] **6.1 — SOC 2 Type II Observation Period Begins** `vendor`
    - Begin 6-month observation period with auditor
    - Ensure continuous evidence collection (via compliance automation platform or manual)
    - Blocking: SOC 2 Type II certification
    - Effort: Ongoing

- [ ] **6.2 — CSA STAR Level 1 Self-Assessment** `document`
    - Complete CAIQ self-assessment questionnaire
    - Publish on CSA STAR Registry
    - Quick win for cloud-specific enterprise requirements
    - Frameworks: CSA STAR
    - Effort: 1 week

- [ ] **6.3 — Annual Policy Review** `process`
    - Conduct first annual review of all 6 policy documents
    - Update as needed; record approval and version
    - Establish annual review calendar
    - Frameworks: ISO 27001 (A.5.1)
    - Effort: 2 days

- [ ] **6.4 — Vendor Review Cadence** `process`
    - Conduct first annual sub-processor risk review
    - Update subprocessor register with latest SOC 2 status and DPA status
    - Frameworks: ISO 27001 (A.5.22), SOC 2 (CC9.1)
    - Effort: 3 days

- [ ] **6.5 — Environmental Impact Assessment** `document`
    - Estimate compute usage and associated carbon footprint
    - Document in AI governance framework
    - Frameworks: NIST AI 600-1
    - Effort: 2 days

### Medium

- [ ] **6.6 — DPO Assessment** `document`
    - Assess whether a Data Protection Officer appointment is required based on processing scale
    - Document decision rationale
    - Frameworks: GDPR (Art. 37-39)
    - Effort: 1 day

- [ ] **6.7 — Formal Asset Inventory / CMDB** `document`
    - Create a configuration management database listing all infrastructure, services, and integrations
    - Include owner, criticality, classification level, and recovery priority
    - Frameworks: ISO 27001 (A.5.9)
    - Effort: 2 days

---

## Months 7-12 — Certification & Continuous Improvement

_Focus: Maintain SOC 2 observation; pursue ISO 27001; continuous improvement_

- [ ] **7.1 — SOC 2 Type II Observation (Ongoing)** `vendor`
    - Maintain controls throughout observation period
    - Respond to auditor evidence requests
    - Frameworks: SOC 2
    - Effort: Ongoing

- [ ] **7.2 — ISO 27001 Gap Assessment** `vendor`
    - Engage ISO 27001 certification body for gap assessment
    - Identify remaining gaps beyond SOC 2 overlap
    - Frameworks: ISO 27001
    - Effort: 2 weeks

- [ ] **7.3 — Second Penetration Test** `vendor`
    - Annual pen test (validates remediation of first test findings)
    - Frameworks: SOC 2, ISO 27001
    - Effort: 2-4 weeks

- [ ] **7.4 — DR Test (Annual)** `process`
    - Conduct second DR exercise (different scenario from first)
    - Validate improvements from first test
    - Frameworks: SOC 2, ISO 27001
    - Effort: 2 days

- [ ] **7.5 — Second Access Review** `process`
    - Quarterly access review (Q2)
    - Frameworks: SOC 2, ISO 27001
    - Effort: 1 day

- [ ] **7.6 — SOC 2 Type II Report** `vendor`
    - Complete Type II observation period
    - Obtain Type II report
    - Blocking: Gold-standard enterprise certification
    - Effort: 2-4 weeks (auditor-led)

---

## Progress Tracking

| Month       | Items  | Critical | High   | Medium | Status         |
| ----------- | ------ | -------- | ------ | ------ | -------------- |
| Month 1     | 7      | 4        | 3      | 0      | ⬜ Not started |
| Month 2     | 6      | 2        | 4      | 0      | ⬜ Not started |
| Month 3     | 6      | 2        | 4      | 0      | ⬜ Not started |
| Month 4     | 7      | 0        | 5      | 2      | ⬜ Not started |
| Month 5     | 4      | 1        | 3      | 0      | ⬜ Not started |
| Month 6     | 7      | 2        | 3      | 2      | ⬜ Not started |
| Months 7-12 | 6      | 0        | 6      | 0      | ⬜ Not started |
| **TOTAL**   | **43** | **11**   | **28** | **4**  |                |

---

## Estimated Investment Summary

| Category                       | Effort (Internal) | Cost (External) |
| ------------------------------ | ----------------- | --------------- |
| Engineering (code)             | ~8 weeks          | —               |
| Process / Documentation        | ~4 weeks          | —               |
| SOC 2 Type I + II              | —                 | $55K-110K       |
| ISO 27001                      | —                 | $40K-80K        |
| Penetration Testing (2x)       | —                 | $10K-30K        |
| Compliance Automation Platform | —                 | $10K-25K/yr     |
| Security Training Platform     | —                 | $2K-8K/yr       |
| **TOTAL**                      | **~12 weeks**     | **$117K-253K**  |

---

## Dependencies

```
1.6 Pen Test Vendor Selection ──→ 2.2 Pen Test Execution ──→ 7.3 Second Pen Test
1.3 Training Program ──→ 3.1 SOC 2 Engagement
1.4 Access Reviews ──→ 3.1 SOC 2 Engagement
1.1 DR Exercise ──→ 3.1 SOC 2 Engagement
2.2 Pen Test ──→ 3.1 SOC 2 Engagement
3.1 SOC 2 Engagement ──→ 5.1 SOC 2 Type I ──→ 6.1 Type II Observation ──→ 7.6 Type II Report
3.2 Compliance Platform ──→ 6.1 Type II Observation (evidence collection)
5.1 SOC 2 Type I ──→ 7.2 ISO 27001 Gap Assessment
```
