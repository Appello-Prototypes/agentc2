# EU AI Act Compliance Audit

**Audit Date:** February 21, 2026
**Audited System:** AgentC2 AI Agent Platform (agentc2.ai)
**Audited By:** Internal Compliance Assessment
**Regulation:** Regulation (EU) 2024/1689 — Artificial Intelligence Act
**Effective Dates:** August 1, 2024 (entry into force); February 2, 2025 (prohibited AI); August 2, 2025 (GPAIS); August 2, 2026 (high-risk)

---

## Executive Summary

| Assessment Area          | Status        | Notes                                               |
| ------------------------ | ------------- | --------------------------------------------------- |
| Risk Classification      | ✅ Determined | Limited / Minimal risk (deployer)                   |
| GPAIS Classification     | ✅ Determined | Platform deploys GPAIS; not a GPAIS provider        |
| Prohibited Practices     | ✅ Compliant  | No prohibited AI practices                          |
| Transparency Obligations | ✅ Compliant  | AI transparency page, model disclosure              |
| High-Risk Requirements   | ✅ N/A        | Not classified as high-risk                         |
| Deployer Obligations     | ⚠️ Partial    | Usage monitoring exists; some obligations need work |

**Overall EU AI Act Readiness: Positioned well; primarily a deployer with transparency obligations.**

---

## 1. AI System Classification

### 1.1 What is AgentC2?

AgentC2 is an **AI agent orchestration platform** that enables organizations to build, deploy, and manage AI agents. It integrates third-party Large Language Models (LLMs) and provides tools, workflows, guardrails, and monitoring.

### 1.2 Role Under the EU AI Act

| Role                     | Description                                   | Applies?                                                       |
| ------------------------ | --------------------------------------------- | -------------------------------------------------------------- |
| **Provider** (Art. 3(3)) | Develops or places an AI system on the market | ❌ No — AgentC2 does not develop foundation models             |
| **Deployer** (Art. 3(4)) | Uses an AI system under its authority         | ✅ Yes — AgentC2 deploys third-party LLMs for customers        |
| **Importer**             | Imports AI system into EU                     | ❌ No                                                          |
| **Distributor**          | Makes AI system available in supply chain     | ⚠️ Potentially — if facilitating customer access to LLMs in EU |
| **Product manufacturer** | Integrates AI into a product                  | ✅ Yes — integrates LLMs into agent platform                   |

**Primary Role: Deployer of third-party AI systems (GPT-4o, Claude, ElevenLabs)**

### 1.3 Risk Category

| Risk Level                        | Criteria                                                                                         | AgentC2? | Rationale                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------- |
| **Unacceptable** (Art. 5)         | Social scoring, manipulative AI, real-time biometric surveillance                                | ❌ No    | None of these practices apply                                        |
| **High-Risk** (Art. 6, Annex III) | AI in employment, credit scoring, law enforcement, critical infrastructure, education, migration | ❌ No    | AgentC2 is a business productivity tool; not in Annex III categories |
| **Limited Risk** (Art. 50)        | AI systems interacting with persons; generating content                                          | ✅ Yes   | AI agents interact with users; generate text/voice content           |
| **Minimal Risk**                  | AI systems not in above categories                                                               | ✅ Yes   | Core platform is minimal risk                                        |

**Classification: Limited Risk (transparency obligations) with Minimal Risk baseline**

---

## 2. Prohibited AI Practices (Article 5)

| Prohibited Practice                                | AgentC2 Assessment                                             | Status            |
| -------------------------------------------------- | -------------------------------------------------------------- | ----------------- |
| **(a) Subliminal manipulation**                    | No manipulative techniques; agents serve user-defined purposes | ✅ Not applicable |
| **(b) Exploitation of vulnerabilities**            | No targeting of age, disability, or social situation           | ✅ Not applicable |
| **(c) Social scoring**                             | No social scoring system                                       | ✅ Not applicable |
| **(d) Predictive policing**                        | No law enforcement use case                                    | ✅ Not applicable |
| **(e) Untargeted scraping for facial recognition** | No biometric processing                                        | ✅ Not applicable |
| **(f) Emotion recognition in workplace/education** | No emotion recognition                                         | ✅ Not applicable |
| **(g) Biometric categorization**                   | No biometric categorization                                    | ✅ Not applicable |
| **(h) Real-time biometric identification**         | No biometric identification                                    | ✅ Not applicable |

**Prohibited uses explicitly listed:** AI transparency page Sec 9 lists prohibited uses including social scoring, mass surveillance, autonomous weapons, deceptive impersonation, and privacy rights circumvention.

---

## 3. General-Purpose AI Systems (GPAIS) Assessment (Articles 51-56)

### 3.1 Does AgentC2 Use GPAIS?

| Model                  | Provider   | GPAIS? | Rationale                                              |
| ---------------------- | ---------- | ------ | ------------------------------------------------------ |
| GPT-4o                 | OpenAI     | ✅ Yes | General-purpose language model with broad capabilities |
| GPT-4o-mini            | OpenAI     | ✅ Yes | General-purpose language model                         |
| text-embedding-3-small | OpenAI     | ❌ No  | Specialized embedding model                            |
| Claude 3.5 Sonnet      | Anthropic  | ✅ Yes | General-purpose language model                         |
| Claude 4               | Anthropic  | ✅ Yes | General-purpose language model                         |
| ElevenLabs voices      | ElevenLabs | ❌ No  | Specialized TTS model                                  |

### 3.2 AgentC2's Obligations as GPAIS Deployer

AgentC2 is a **deployer** of GPAIS, not a **provider** of GPAIS. The GPAIS provider obligations (Art. 53) fall on OpenAI and Anthropic.

| GPAIS Provider Obligation (Art. 53) | Responsible Party            | AgentC2 Action                        |
| ----------------------------------- | ---------------------------- | ------------------------------------- |
| Technical documentation             | OpenAI / Anthropic           | ✅ Referenced in AI transparency page |
| Information to downstream deployers | OpenAI / Anthropic → AgentC2 | ✅ Model capabilities documented      |
| Copyright compliance                | OpenAI / Anthropic           | N/A for AgentC2                       |
| Training data summary               | OpenAI / Anthropic           | N/A for AgentC2                       |

### 3.3 Systemic Risk Assessment (Art. 51(2))

| Criterion                                | Assessment                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Does AgentC2 itself have systemic risk?  | ❌ No — platform is not a foundation model with >10^25 FLOP training compute |
| Do underlying models have systemic risk? | Potentially — determined by European AI Office for each GPAIS                |

---

## 4. Transparency Obligations (Article 50)

### 4.1 Art. 50(1) — AI Interaction Disclosure

| Requirement                                 | Status        | Evidence                                                             | Assessment                                     |
| ------------------------------------------- | ------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| Inform persons they are interacting with AI | ✅ Compliant  | Platform clearly brands agents as AI; agent names indicate AI nature | Users know they interact with AI agents        |
| Clear and distinguishable notification      | ✅ Compliant  | Chat interfaces labeled; voice agents identified as AI               | UI makes AI nature apparent                    |
| Exception: obvious from context             | ✅ Applicable | AI agent platform — context inherently indicates AI                  | Users deliberately configure and use AI agents |

### 4.2 Art. 50(2) — AI-Generated Content Marking

| Requirement                       | Status     | Evidence                                                        | Assessment                        |
| --------------------------------- | ---------- | --------------------------------------------------------------- | --------------------------------- |
| Mark AI-generated content as such | ⚠️ Partial | Agent responses displayed in chat interface with AI attribution | No machine-readable watermarking  |
| Machine-readable format           | ⚠️ Partial | No C2PA or similar content provenance                           | Could implement response metadata |

### 4.3 Art. 50(4) — Deepfake Disclosure

| Requirement                            | Status       | Evidence                                        | Assessment                                        |
| -------------------------------------- | ------------ | ----------------------------------------------- | ------------------------------------------------- |
| Disclose synthetic audio/video content | ✅ Compliant | Voice agents clearly identified as AI-generated | ElevenLabs integration docs note synthetic nature |

### 4.4 Public Transparency Statement

| Element                    | Status       | Evidence                                                                  |
| -------------------------- | ------------ | ------------------------------------------------------------------------- |
| AI models used             | ✅ Compliant | `/ai-transparency` Sec 2: GPT-4o, Claude, ElevenLabs listed               |
| How data is processed      | ✅ Compliant | `/ai-transparency` Sec 3: data flow described                             |
| Model limitations          | ✅ Compliant | `/ai-transparency` Sec 4: accuracy, hallucinations, bias                  |
| Human oversight mechanisms | ✅ Compliant | `/ai-transparency` Sec 5: approval workflows, guardrails, budget controls |
| Data retention             | ✅ Compliant | `/ai-transparency` Sec 7: retention policies                              |
| NIST AI RMF alignment      | ✅ Compliant | `/ai-transparency` Sec 8: framework alignment                             |
| EU AI Act position         | ✅ Compliant | `/ai-transparency` Sec 8: deployer classification, GPAIS acknowledgment   |
| Prohibited uses            | ✅ Compliant | `/ai-transparency` Sec 9: 6 prohibited categories                         |

---

## 5. Deployer Obligations (Article 26)

### 5.1 Use in Accordance with Instructions (Art. 26(1))

| Requirement                                     | Status       | Evidence                                                       | Assessment                      |
| ----------------------------------------------- | ------------ | -------------------------------------------------------------- | ------------------------------- |
| Use AI in accordance with provider instructions | ✅ Compliant | OpenAI and Anthropic usage policies followed                   | API terms accepted              |
| Technical competence for use                    | ✅ Compliant | Platform designed for technical users; documentation available | Deployment tools and monitoring |

### 5.2 Human Oversight (Art. 26(2))

| Requirement                               | Status       | Evidence                                                                | Assessment                                 |
| ----------------------------------------- | ------------ | ----------------------------------------------------------------------- | ------------------------------------------ |
| Ensure human oversight measures           | ✅ Compliant | Human approval workflows, budget controls, guardrails, tool permissions | `packages/agentc2/src/guardrails/index.ts` |
| Assign oversight to competent individuals | ✅ Compliant | Org owners/admins configure guardrails and policies                     | RBAC system                                |

### 5.3 Input Data Quality (Art. 26(4))

| Requirement                             | Status       | Evidence                               | Assessment                                      |
| --------------------------------------- | ------------ | -------------------------------------- | ----------------------------------------------- |
| Input data relevant to intended purpose | ✅ Compliant | Input guardrails validate data quality | Max length, PII detection, injection prevention |

### 5.4 Monitoring of Operation (Art. 26(5))

| Requirement                            | Status       | Evidence                                                 | Assessment                                   |
| -------------------------------------- | ------------ | -------------------------------------------------------- | -------------------------------------------- |
| Monitor AI system operation            | ✅ Compliant | Agent run tracking, evaluation scoring, guardrail events | Comprehensive monitoring                     |
| Report incidents to provider/authority | ⚠️ Partial   | Alert system for anomalies                               | No formal incident reporting to AI providers |

### 5.5 Record Keeping (Art. 26(6))

| Requirement                      | Status       | Evidence                                                      | Assessment          |
| -------------------------------- | ------------ | ------------------------------------------------------------- | ------------------- |
| Keep logs generated by AI system | ✅ Compliant | Audit logs (2-year retention), agent runs (180-day retention) | Automated retention |
| Logs available for review        | ✅ Compliant | `/api/security/events` API, audit log queries                 | Queryable records   |

### 5.6 Data Protection Impact Assessment (Art. 26(9))

| Requirement                        | Status     | Evidence                  | Assessment                                     |
| ---------------------------------- | ---------- | ------------------------- | ---------------------------------------------- |
| Use output of DPIA where available | ⚠️ Partial | DPIA framework documented | No DPIA completed for AI processing activities |

---

## 6. Fundamental Rights Impact Assessment (Article 27)

| Requirement                   | Status | Evidence                            | Assessment   |
| ----------------------------- | ------ | ----------------------------------- | ------------ |
| FRIA for high-risk AI systems | ✅ N/A | AgentC2 not classified as high-risk | Not required |

---

## 7. Codes of Practice (Article 56)

| Requirement                              | Status     | Evidence                                         | Assessment                       |
| ---------------------------------------- | ---------- | ------------------------------------------------ | -------------------------------- |
| Adherence to codes of practice for GPAIS | ⚠️ Pending | EU codes of practice for GPAIS under development | Monitor and adopt when published |

---

## 8. Penalties and Enforcement

| Violation Category       | Maximum Fine                | AgentC2 Exposure                             |
| ------------------------ | --------------------------- | -------------------------------------------- |
| Prohibited AI practices  | €35M or 7% global turnover  | ✅ Low risk — no prohibited practices        |
| High-risk non-compliance | €15M or 3% global turnover  | ✅ N/A — not high-risk                       |
| Incorrect information    | €7.5M or 1% global turnover | ⚠️ Ensure transparency statement is accurate |

---

## Gap Remediation Priority

### High

1. **DPIA Completion** — Complete data protection impact assessment for AI processing
2. **AI Content Provenance** — Evaluate C2PA or similar machine-readable content marking
3. **Incident Reporting to Providers** — Establish formal process for reporting AI incidents to OpenAI/Anthropic

### Medium

4. **Codes of Practice** — Monitor EU codes of practice development and adopt when published
5. **Model Card Documentation** — Document model capabilities, limitations, and evaluation results per deployed model
6. **Bias Testing** — Implement bias detection testing for agent outputs

### Low

7. **Conformity Assessment Preparation** — Prepare materials in case classification changes
8. **Supply Chain Documentation** — Maintain records of AI provider compliance claims
9. **Training** — EU AI Act awareness training for team
