# AgentC2 AI Governance Framework

**Document Classification:** INTERNAL – RESTRICTED  
**Version:** 1.0  
**Effective Date:** February 21, 2026  
**Document Owner:** Chief Compliance & Security Officer  
**Review Cadence:** Semi-Annually  
**Framework Alignment:** NIST AI Risk Management Framework (AI RMF 1.0), EU AI Act (Regulation 2024/1689)

---

## Table of Contents

1. [AI System Classification](#1-ai-system-classification)
2. [EU AI Act Analysis](#2-eu-ai-act-analysis)
3. [NIST AI RMF Alignment](#3-nist-ai-rmf-alignment)
4. [Model Inventory & Risk Assessment](#4-model-inventory--risk-assessment)
5. [Data Sources & Processing](#5-data-sources--processing)
6. [Prompt Logging & Observability](#6-prompt-logging--observability)
7. [Human Oversight Mechanisms](#7-human-oversight-mechanisms)
8. [Bias Mitigation Program](#8-bias-mitigation-program)
9. [Model Monitoring](#9-model-monitoring)
10. [AI Misuse Prevention](#10-ai-misuse-prevention)
11. [AI Transparency Statement](#11-ai-transparency-statement)
12. [AI Risk Register](#12-ai-risk-register)
13. [Governance Structure](#13-governance-structure)

---

## 1. AI System Classification

### 1.1 Platform Description

AgentC2 is an **AI Agent orchestration platform** that enables enterprise customers to:

- Configure and deploy AI agents powered by third-party LLMs (OpenAI GPT-4o, Anthropic Claude)
- Connect agents to external tools via MCP (Model Context Protocol)
- Ingest documents into RAG pipelines for domain-specific knowledge
- Enable voice-based AI interactions via ElevenLabs
- Process customer data from CRM, email, project management, and communication systems
- Automate workflows with human-in-the-loop approval gates

### 1.2 AI System Type

| Dimension           | Classification                     | Rationale                                                             |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| **Role**            | AI Platform / Orchestrator         | AgentC2 does not train models; it orchestrates third-party models     |
| **Model Provider**  | Third-party (OpenAI, Anthropic)    | No proprietary model development                                      |
| **Deployment**      | API-based inference                | Models accessed via provider APIs; no self-hosted weights             |
| **Customization**   | Prompt engineering + RAG           | No fine-tuning; behavior shaped by instructions and retrieved context |
| **Autonomy Level**  | Semi-autonomous with guardrails    | Agents can execute tools; human approval workflows available          |
| **Data Processing** | Processor (on behalf of customers) | Customer data processed per customer instructions                     |

### 1.3 General Purpose AI System (GPAIS) Analysis

Under the EU AI Act, AgentC2 must be assessed for GPAIS classification:

| GPAIS Criteria                      | Assessment                                                        |
| ----------------------------------- | ----------------------------------------------------------------- |
| Uses general-purpose AI models      | **Yes** — GPT-4o and Claude are GPAISs                            |
| Provides the GPAIS model            | **No** — AgentC2 uses third-party models, does not provide them   |
| Deploys GPAIS in specific use cases | **Yes** — AgentC2 deploys models in customer-configured use cases |
| Downstream provider obligations     | AgentC2 is a **deployer** of GPAIS, not a provider                |

**Conclusion:** AgentC2 is a **deployer** of General Purpose AI Systems. Primary GPAIS provider obligations (Art. 51-53) fall on OpenAI and Anthropic. AgentC2 has deployer obligations under Art. 26 for any high-risk use cases.

---

## 2. EU AI Act Analysis

### 2.1 Risk Category Determination

The EU AI Act (Regulation 2024/1689) classifies AI systems into four risk tiers:

| Risk Level                     | Applicability to AgentC2                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Unacceptable Risk** (Art. 5) | **Not applicable.** AgentC2 does not perform social scoring, real-time biometric identification, or prohibited manipulative techniques. |
| **High Risk** (Annex III)      | **Potentially applicable** depending on customer use cases (see §2.2).                                                                  |
| **Limited Risk** (Art. 50)     | **Applicable.** Transparency obligations apply to all AI-generated content.                                                             |
| **Minimal Risk**               | **Applicable** for most general business automation use cases.                                                                          |

### 2.2 High-Risk Use Case Assessment

AgentC2 is a general-purpose platform. Whether it constitutes a high-risk AI system depends on how customers deploy agents. The following Annex III categories could apply:

| Annex III Category               | Possible Customer Use                              | Risk Level         | AgentC2 Obligation                                      |
| -------------------------------- | -------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| **Employment (§4)**              | AI agents screening resumes, scheduling interviews | **High Risk**      | Must provide guardrails, human oversight, documentation |
| **Access to services (§5)**      | AI agents processing insurance/loan applications   | **High Risk**      | Must enable human review before binding decisions       |
| **Law enforcement (§6)**         | N/A — not targeted at law enforcement              | **Not applicable** | —                                                       |
| **Education (§3)**               | AI agents grading or evaluating students           | **High Risk**      | Must ensure human oversight                             |
| **Critical infrastructure (§2)** | AI agents managing infrastructure systems          | **High Risk**      | Must provide safety controls                            |

**Platform Obligation:** AgentC2 must:

1. Document which customer use cases may constitute high-risk deployments
2. Provide configurable guardrails and human oversight mechanisms (already implemented)
3. Enable customers to comply with their high-risk obligations
4. Maintain records of AI system deployments per Art. 26(5)

### 2.3 Transparency Obligations (Art. 50)

**Required for all AI-generated content:**

| Obligation                                | Current State                                   | Action Required                                                        |
| ----------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Inform users they are interacting with AI | ⚠️ Partial — depends on customer implementation | Require customers to disclose AI nature; provide default disclosure UX |
| Mark AI-generated content                 | ❌ Not implemented                              | Add metadata/watermarking to agent outputs                             |
| Disclose deepfakes/synthetic media        | ⚠️ Voice agents use synthetic speech            | ElevenLabs handles voice watermarking; document in terms               |
| Inform about emotion recognition          | N/A                                             | Not performed                                                          |

### 2.4 AgentC2 Obligations Summary

| EU AI Act Article | Obligation                        | Status                                        | Priority                           |
| ----------------- | --------------------------------- | --------------------------------------------- | ---------------------------------- |
| Art. 26(1)        | Use AI systems per instructions   | ✅ Agents operate per configured instructions | Compliant                          |
| Art. 26(2)        | Human oversight                   | ⚠️ Available but not enforced                 | Required — document and promote    |
| Art. 26(5)        | Maintain deployment logs          | ✅ Audit logs, run history                    | Compliant                          |
| Art. 26(6)        | Data protection impact assessment | ❌ Not conducted                              | Required (M6)                      |
| Art. 26(7)        | Cooperate with authorities        | ❌ No procedure                               | Required — create procedure        |
| Art. 50(1)        | AI interaction disclosure         | ⚠️ Partial                                    | Required — platform-level controls |
| Art. 50(2)        | Synthetic content marking         | ⚠️ Voice only (ElevenLabs)                    | Required — extend to text          |

---

## 3. NIST AI RMF Alignment

### 3.1 GOVERN Function — Organizational Governance

| GOVERN Category | Requirement                                   | Current State                           | Gap    | Action                                |
| --------------- | --------------------------------------------- | --------------------------------------- | ------ | ------------------------------------- |
| GOVERN 1.1      | Legal/regulatory requirements identified      | ⚠️ Informal                             | MEDIUM | Formalize regulatory register         |
| GOVERN 1.2      | Trustworthy AI characteristics prioritized    | ❌ Not documented                       | HIGH   | Define AI principles/values statement |
| GOVERN 1.3      | Processes for risk management decisions       | ⚠️ Guardrails exist                     | MEDIUM | Document decision framework           |
| GOVERN 1.4      | Oversight of AI risk management               | ❌ No formal governance body            | HIGH   | Establish AI governance committee     |
| GOVERN 1.5      | Risk tolerances documented                    | ⚠️ Budget controls exist                | MEDIUM | Document risk appetite statement      |
| GOVERN 1.6      | Mechanisms for feedback                       | ✅ AgentFeedback model, Slack reactions | LOW    | Maintain                              |
| GOVERN 2.1      | Roles and responsibilities defined            | ❌ Not documented                       | HIGH   | Define RACI matrix                    |
| GOVERN 2.2      | Training for AI risk management               | ❌ No training                          | HIGH   | Include in security awareness program |
| GOVERN 3.1      | Workforce diversity considerations            | ❌ Not documented                       | MEDIUM | Include in bias mitigation program    |
| GOVERN 4.1      | Organizational AI risk practices communicated | ❌ No public statement                  | HIGH   | Create AI transparency statement      |
| GOVERN 5.1      | AI impacts on affected communities            | ❌ Not assessed                         | MEDIUM | Include in DPIA                       |
| GOVERN 6.1      | Policies for third-party AI                   | ⚠️ Vendor SOC 2 checks                  | MEDIUM | Formal third-party AI policy          |

### 3.2 MAP Function — Context & Risk Framing

| MAP Category | Requirement                   | Current State                   | Gap    | Action                                          |
| ------------ | ----------------------------- | ------------------------------- | ------ | ----------------------------------------------- |
| MAP 1.1      | Intended purpose documented   | ⚠️ Agent instructions exist     | MEDIUM | Formalize use case documentation template       |
| MAP 1.2      | Interdisciplinary perspective | ❌ Not formalized               | MEDIUM | Include legal/ethics review in agent deployment |
| MAP 1.5      | Deployment context documented | ⚠️ Agent configuration captured | LOW    | Enhance with risk context                       |
| MAP 2.1      | Target audience defined       | ⚠️ Per customer                 | LOW    | Provide customer guidance                       |
| MAP 2.3      | AI system categorized         | ✅ See §1 classification        | —      | Maintain                                        |
| MAP 3.1      | Benefits vs risks assessed    | ❌ Not formalized               | MEDIUM | Add to agent deployment checklist               |
| MAP 5.1      | Impacts on individuals/groups | ❌ Not assessed                 | MEDIUM | Include in DPIA                                 |

### 3.3 MEASURE Function — Analysis & Assessment

| MEASURE Category | Requirement                       | Current State                 | Gap    | Action                           |
| ---------------- | --------------------------------- | ----------------------------- | ------ | -------------------------------- |
| MEASURE 1.1      | Approaches for measuring AI risks | ⚠️ Evals exist                | MEDIUM | Formalize measurement framework  |
| MEASURE 2.1      | Evaluation methodology            | ✅ @mastra/evals              | LOW    | Document and expand              |
| MEASURE 2.3      | AI system performance tracking    | ✅ Run history, observability | LOW    | Maintain                         |
| MEASURE 2.5      | Output monitoring                 | ⚠️ GuardrailEvent tracking    | MEDIUM | Systematic monitoring dashboard  |
| MEASURE 2.6      | Guardrail effectiveness           | ⚠️ Events logged              | MEDIUM | Periodic guardrail review        |
| MEASURE 2.7      | Bias evaluation                   | ❌ No bias testing            | HIGH   | Implement bias testing framework |
| MEASURE 3.1      | Feedback integration              | ✅ AgentFeedback model        | LOW    | Maintain                         |
| MEASURE 4.1      | Measurement approaches reviewed   | ❌ No review process          | MEDIUM | Annual review                    |

### 3.4 MANAGE Function — Risk Treatment

| MANAGE Category | Requirement                          | Current State              | Gap    | Action                            |
| --------------- | ------------------------------------ | -------------------------- | ------ | --------------------------------- |
| MANAGE 1.1      | Risk treatment plans                 | ⚠️ Guardrails, budgets     | MEDIUM | Document treatment strategies     |
| MANAGE 1.3      | Responses to risk events             | ⚠️ GuardrailEvent logging  | MEDIUM | Automated escalation              |
| MANAGE 2.1      | Resource allocation for risk         | ⚠️ Budget controls         | LOW    | Formalize                         |
| MANAGE 2.3      | Mechanisms to supersede AI decisions | ⚠️ Human approval workflow | MEDIUM | Make universally available        |
| MANAGE 3.1      | Pre-deployment validation            | ⚠️ Evals available         | MEDIUM | Mandatory pre-deployment evals    |
| MANAGE 4.1      | Decommissioning procedures           | ❌ Not documented          | MEDIUM | Create agent retirement procedure |

---

## 4. Model Inventory & Risk Assessment

### 4.1 Model Inventory

| Model ID | Provider   | Model Name               | Capability                           | Data Sent                                   | Retention (Provider)                    | Risk Tier |
| -------- | ---------- | ------------------------ | ------------------------------------ | ------------------------------------------- | --------------------------------------- | --------- |
| M-01     | OpenAI     | gpt-4o                   | Text generation, reasoning, tool use | Prompts, tool results, conversation history | 30 days (abuse monitoring), no training | High      |
| M-02     | OpenAI     | gpt-4o-mini              | Text generation (cost-optimized)     | Prompts, tool results                       | 30 days, no training                    | Medium    |
| M-03     | Anthropic  | claude-sonnet-4-20250514 | Text generation, reasoning, tool use | Prompts, tool results, conversation history | 30 days, no training                    | High      |
| M-04     | Anthropic  | claude-haiku (if used)   | Text generation (cost-optimized)     | Prompts, tool results                       | 30 days, no training                    | Medium    |
| M-05     | OpenAI     | text-embedding-3-small   | Text embedding (RAG)                 | Document chunks                             | 30 days, no training                    | Medium    |
| M-06     | OpenAI     | whisper-1 (if used)      | Speech-to-text                       | Audio data                                  | 30 days, no training                    | High      |
| M-07     | ElevenLabs | Various voice models     | Text-to-speech, voice cloning        | Text prompts, voice data                    | Per ElevenLabs policy                   | High      |
| M-08     | OpenAI     | Realtime API (if used)   | Real-time voice conversation         | Audio streams                               | Per OpenAI policy                       | High      |

### 4.2 Model Risk Assessment

| Risk                       | Models Affected        | Likelihood | Impact      | Controls                                      | Residual Risk |
| -------------------------- | ---------------------- | ---------- | ----------- | --------------------------------------------- | ------------- |
| **Prompt injection**       | M-01, M-02, M-03, M-04 | High       | High        | Guardrails, egress policies, tool permissions | MEDIUM        |
| **Data leakage via model** | All                    | Medium     | High        | Provider zero-training policies, DPAs         | MEDIUM        |
| **Hallucination**          | M-01, M-02, M-03, M-04 | High       | Medium-High | RAG grounding, evals, human oversight         | MEDIUM        |
| **Bias in outputs**        | M-01, M-02, M-03, M-04 | Medium     | Medium-High | Guardrails, feedback collection               | MEDIUM        |
| **Model availability**     | All                    | Medium     | Medium      | Multi-provider support, fallback config       | LOW           |
| **Provider policy change** | All                    | Medium     | Medium      | Contractual protections, multi-provider       | LOW           |
| **Voice deepfake misuse**  | M-07, M-08             | Medium     | High        | Customer terms, voice consent requirements    | MEDIUM        |
| **Embedding inversion**    | M-05                   | Low        | Medium      | Tenant-isolated vector stores                 | LOW           |

### 4.3 Provider Commitments

| Provider   | Zero Training on Customer Data | DPA Available         | SOC 2                 | Data Residency Options | API Data Retention            |
| ---------- | ------------------------------ | --------------------- | --------------------- | ---------------------- | ----------------------------- |
| OpenAI     | ✅ (API, not ChatGPT)          | ✅                    | ✅ Type II            | Limited (US default)   | 30 days for abuse monitoring  |
| Anthropic  | ✅ (API)                       | ✅                    | ✅ Type II            | Limited                | 30 days for safety monitoring |
| ElevenLabs | ✅ (verify)                    | ⚠️ Needs verification | ⚠️ Needs verification | TBD                    | TBD                           |

**Action Items:**

1. Obtain and file DPAs from all AI providers
2. Verify ElevenLabs data handling and retention policies
3. Document provider data residency commitments
4. Evaluate OpenAI zero-retention API (if available for enterprise)

---

## 5. Data Sources & Processing

### 5.1 Data Sources for AI Processing

| Source                                | Data Type                       | How Data Reaches AI Model                   | Consent Mechanism                  | Retention                                         |
| ------------------------------------- | ------------------------------- | ------------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| **User prompts**                      | Text (may contain PII)          | Directly sent to LLM API                    | Terms of Service, user consent     | Conversation memory (PostgreSQL), provider 30-day |
| **RAG documents**                     | Uploaded files, scraped content | Chunked, embedded, retrieved as context     | Customer upload action             | Until deleted by customer + vector store          |
| **CRM data** (HubSpot)                | Contacts, companies, deals      | Retrieved via MCP tools, included in prompt | Customer integration authorization | Transient (not stored by AgentC2 beyond prompt)   |
| **Email data** (Gmail)                | Email content, contacts         | Retrieved via Gmail API, processed by agent | Google OAuth consent               | Transient + optional memory                       |
| **Slack messages**                    | Message content, user info      | Webhook event payload, processed by agent   | Slack app installation consent     | Transient + conversation memory                   |
| **Voice audio**                       | Speech audio streams            | Sent to ElevenLabs/OpenAI for processing    | User consent at call initiation    | Provider retention policy                         |
| **Meeting transcripts** (Fathom)      | Transcript text                 | Retrieved via MCP, included in prompt       | Customer integration authorization | Transient                                         |
| **Calendar data** (Microsoft)         | Event details, attendees        | Retrieved via Graph API                     | Microsoft OAuth consent            | Transient                                         |
| **File data** (Dropbox, Google Drive) | File contents, metadata         | Retrieved via MCP/OAuth, included in prompt | Customer integration authorization | Transient                                         |

### 5.2 Data Minimization Principles

AgentC2 applies the following data minimization measures:

1. **Transient processing**: MCP tool results are used in the current prompt context and not persisted unless explicitly stored via memory
2. **Purpose limitation**: Data retrieved from integrations is used only for the specific agent task requested
3. **Chunking for RAG**: Documents are broken into small chunks; only relevant chunks are retrieved per query
4. **PII redaction in logs**: Automatic redaction of emails, phone numbers, SSNs, credit card numbers in application logs
5. **Sensitive data filtering in observability**: `SensitiveDataFilter` redacts password, apiKey, token, secret fields from trace data

### 5.3 Data Processing Roles

| Scenario                            | AgentC2 Role                                     | Customer Role | Legal Basis                    |
| ----------------------------------- | ------------------------------------------------ | ------------- | ------------------------------ |
| Customer configures/uses agents     | **Processor**                                    | Controller    | DPA (Art. 28)                  |
| AgentC2 stores account/billing data | **Controller**                                   | Data Subject  | Legitimate interest / Contract |
| Customer uploads documents to RAG   | **Processor**                                    | Controller    | DPA (Art. 28)                  |
| Voice agent conversations           | **Processor** (with ElevenLabs as sub-processor) | Controller    | DPA (Art. 28)                  |
| AgentC2 marketing/analytics         | **Controller**                                   | Data Subject  | Consent / Legitimate interest  |

---

## 6. Prompt Logging & Observability

### 6.1 Current Implementation

| Component                | Implementation               | Data Captured                                            | Redaction                                                           |
| ------------------------ | ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| **Mastra Observability** | DefaultExporter → PostgreSQL | Trace spans, model inputs/outputs, tool calls, durations | SensitiveDataFilter: password, apiKey, token, secret, authorization |
| **Audit Log**            | `AuditLog` model             | Action type, actor, entity, metadata                     | No automatic PII redaction (metadata may contain PII)               |
| **Run History**          | Stored in PostgreSQL         | Agent execution results, tool outputs                    | Per observability filter                                            |
| **Guardrail Events**     | `GuardrailEvent` model       | Blocked/modified/flagged content, reason                 | Input/output content stored                                         |
| **Application Logs**     | stdout/stderr via PM2        | Application events, errors                               | `log-sanitizer.ts`: email, phone, SSN, CC redaction                 |

### 6.2 Prompt Logging Risks

| Risk                                  | Severity | Current Mitigation                  | Recommended Enhancement                         |
| ------------------------------------- | -------- | ----------------------------------- | ----------------------------------------------- |
| PII in prompt logs                    | HIGH     | SensitiveDataFilter (partial)       | Expand PII detection to all log sinks           |
| Customer data in observability traces | HIGH     | Redaction of known sensitive fields | Customer-configurable data retention for traces |
| Prompt logs subpoenaed in litigation  | MEDIUM   | None                                | Define retention limits, legal hold procedures  |
| Unauthorized access to prompt logs    | MEDIUM   | RBAC on admin portal                | Encrypt prompt logs at rest, restrict access    |

### 6.3 Recommended Prompt Logging Controls

1. **Retention limits**: Define maximum retention period for prompt logs (recommend: 90 days default, customer-configurable)
2. **Access controls**: Restrict prompt log access to designated roles (admin/owner only)
3. **Customer opt-out**: Allow customers to disable detailed prompt logging
4. **PII scanning**: Implement automated PII detection on logged prompts with redaction
5. **Legal hold process**: Define procedure for preserving logs when required by legal process
6. **Audit trail for log access**: Log when prompt logs are viewed (already partially implemented via admin audit log)

---

## 7. Human Oversight Mechanisms

### 7.1 Existing Mechanisms

| Mechanism                   | Implementation                    | Scope                                         | Status         |
| --------------------------- | --------------------------------- | --------------------------------------------- | -------------- |
| **Human Approval Workflow** | `humanApprovalWorkflow` in Mastra | Per-workflow, requires explicit setup         | ✅ Implemented |
| **Guardrail Policies**      | `GuardrailPolicy` model           | Per-agent input/output filtering              | ✅ Implemented |
| **Organization Guardrails** | `OrgGuardrailPolicy` model        | Organization-wide baseline                    | ✅ Implemented |
| **Budget Controls**         | `BudgetPolicy` model              | Per-agent/org/user spending limits            | ✅ Implemented |
| **Tool Permissions**        | `AgentToolPermission` model       | Per-agent tool access (read/write/spend/full) | ✅ Implemented |
| **Network Egress**          | `NetworkEgressPolicy` model       | Domain allowlist/denylist per organization    | ✅ Implemented |
| **Agent Feedback**          | `AgentFeedback` model             | Post-execution feedback collection            | ✅ Implemented |

### 7.2 Oversight Gaps

| Gap                                               | Risk                                            | Recommendation                                       | Priority |
| ------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- | -------- |
| Human approval not default for high-risk actions  | Autonomous execution of sensitive operations    | Make human approval configurable per-tool risk level | HIGH     |
| No automatic escalation on guardrail blocks       | Repeated guardrail triggers may indicate attack | Alert on guardrail block rate exceeding threshold    | MEDIUM   |
| No kill switch for agent execution                | Runaway agent cannot be immediately stopped     | Implement real-time agent termination capability     | HIGH     |
| Customer cannot review agent actions in real-time | Limited visibility during execution             | Real-time execution stream visible to customers      | MEDIUM   |

### 7.3 Recommended Oversight Enhancements

1. **Risk-based approval gates**: Automatically require human approval when agent attempts actions classified as `write` or `spend`
2. **Anomaly-triggered pause**: Automatically pause agent execution when unusual patterns detected (high error rate, excessive tool calls, budget spike)
3. **Customer-configurable oversight levels**:
    - Level 1 (Autonomous): Agent executes freely within guardrails
    - Level 2 (Monitored): Agent executes, all actions logged and reviewable
    - Level 3 (Supervised): High-risk actions require human approval
    - Level 4 (Restricted): All external tool calls require approval

---

## 8. Bias Mitigation Program

### 8.1 Current State

AgentC2 relies on third-party model providers (OpenAI, Anthropic) for base model fairness. Neither AgentC2 nor its customers fine-tune models. Bias can be introduced through:

1. **System instructions**: Agent instructions may embed biased assumptions
2. **RAG content**: Customer-uploaded documents may contain biased information
3. **Tool outputs**: External system data may reflect historical biases
4. **Prompt engineering**: Agent prompt design may favor certain demographics

### 8.2 Bias Risk Assessment

| Bias Source                | Likelihood | Impact | Customer Use Cases at Risk                           |
| -------------------------- | ---------- | ------ | ---------------------------------------------------- |
| LLM inherent bias          | Medium     | High   | HR/recruitment, customer service, financial services |
| Biased RAG corpus          | Medium     | Medium | Any domain with biased training documents            |
| Biased system instructions | Low-Medium | High   | HR screening, eligibility determination              |
| Output bias in CRM actions | Low        | Medium | Lead scoring, prioritization                         |

### 8.3 Recommended Bias Mitigation Controls

| #     | Control                     | Implementation                                                              | Timeline     | Owner       |
| ----- | --------------------------- | --------------------------------------------------------------------------- | ------------ | ----------- |
| BM-01 | Bias testing framework      | Create test suite with diverse demographic scenarios using @mastra/evals    | M8           | Engineering |
| BM-02 | Bias disclosure             | Include bias risk disclosure in AI transparency statement                   | M3           | CISO        |
| BM-03 | Customer guidance           | Provide best practices for bias-aware agent configuration                   | M6           | Product     |
| BM-04 | Instruction review          | Periodic review of agent instructions for biased language                   | M6 (ongoing) | Product     |
| BM-05 | Disparate impact monitoring | Monitor agent outputs for statistically significant demographic disparities | M10          | Engineering |
| BM-06 | RAG content screening       | Provide tools for customers to audit RAG corpus for bias                    | M12          | Engineering |

---

## 9. Model Monitoring

### 9.1 Current Monitoring

| Metric                    | Implementation              | Frequency      | Alerting                                    |
| ------------------------- | --------------------------- | -------------- | ------------------------------------------- |
| Agent run success/failure | Run history in PostgreSQL   | Per execution  | ❌ No alerting                              |
| Guardrail block rate      | GuardrailEvent counts       | Per execution  | ❌ No alerting                              |
| Budget consumption        | BudgetPolicy tracking       | Per execution  | ⚠️ Hard limits enforce, no proactive alerts |
| Model latency             | Mastra observability traces | Per execution  | ❌ No alerting                              |
| Token usage               | Tracked in run metadata     | Per execution  | ❌ No alerting                              |
| User feedback             | AgentFeedback model         | Per submission | ❌ No alerting                              |

### 9.2 Recommended Monitoring Enhancements

| Metric                 | Threshold                  | Alert Channel      | Priority |
| ---------------------- | -------------------------- | ------------------ | -------- |
| Agent error rate       | >10% over 1 hour           | Slack/PagerDuty    | HIGH     |
| Guardrail block spike  | >5x baseline over 15 min   | Slack + email      | HIGH     |
| Budget utilization     | >80% of limit              | Email to org admin | MEDIUM   |
| Model response latency | >10s p95                   | Slack              | MEDIUM   |
| Negative feedback rate | >20% over 24 hours         | Slack              | MEDIUM   |
| Token cost per org     | >$X/day threshold          | Email to org admin | MEDIUM   |
| Failed tool executions | >20% per agent over 1 hour | Slack              | HIGH     |

### 9.3 Model Drift Considerations

Since AgentC2 uses third-party models via API, model drift occurs when providers update models:

1. **Monitor provider announcements** for model updates and deprecations
2. **Pin model versions** where possible (e.g., `gpt-4o-2024-11-20` vs `gpt-4o`)
3. **Re-run evaluation suites** when model versions change
4. **Document model version in agent configuration** (currently stored as `modelName`)
5. **Alert customers** when underlying models change

---

## 10. AI Misuse Prevention

### 10.1 Misuse Taxonomy

| Category                            | Description                                                      | Risk Level | Prevention Mechanism                                        |
| ----------------------------------- | ---------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| **Prompt injection attack**         | Adversary crafts input to override agent instructions            | Critical   | Input guardrails, instruction separation, output validation |
| **Data exfiltration via agent**     | Adversary uses agent to extract sensitive data from integrations | Critical   | Egress policies, tool permissions, output guardrails        |
| **Unauthorized automation**         | Agent executes actions beyond intended scope                     | High       | Tool permission matrix, budget controls, human approval     |
| **Social engineering via voice**    | Voice agent used to impersonate or deceive                       | High       | Customer terms, voice consent, call disclaimers             |
| **Spam/abuse via integrations**     | Agent used to send mass emails/messages via connected systems    | High       | Rate limiting, budget controls, tool permissions            |
| **Intellectual property violation** | Agent reproduces copyrighted content from RAG or training data   | Medium     | Output filtering, customer content responsibility           |
| **Harassment via agent**            | Agent produces abusive/harmful content                           | Medium     | Output guardrails, content filtering                        |
| **Competitive intelligence abuse**  | Agent used to scrape/aggregate competitor data inappropriately   | Medium     | Terms of service, customer responsibility                   |

### 10.2 Misuse Prevention Controls

| Control                               | Implementation                                         | Status      |
| ------------------------------------- | ------------------------------------------------------ | ----------- |
| Input guardrails (content filtering)  | `GuardrailPolicy` — per-agent input rules              | ✅          |
| Output guardrails (content filtering) | `GuardrailPolicy` — per-agent output rules             | ✅          |
| Organization-wide guardrail baseline  | `OrgGuardrailPolicy` — cannot be overridden by agents  | ✅          |
| Tool permission matrix                | `AgentToolPermission` — read/write/spend/full per tool | ✅          |
| Network egress control                | `NetworkEgressPolicy` — domain allowlist/denylist      | ✅          |
| Budget limits                         | `BudgetPolicy` — per-agent/org/user spending caps      | ✅          |
| Rate limiting                         | Per-endpoint rate limits (auth, chat, mcp, uploads)    | ✅          |
| Audit logging                         | All tool executions and agent actions logged           | ✅          |
| Abuse reporting                       | ❌ No customer-facing abuse report mechanism           | Required    |
| Automated abuse detection             | ❌ No pattern-based abuse detection                    | Recommended |
| Terms of Service enforcement          | ⚠️ Terms exist but no automated enforcement            | Required    |

### 10.3 Acceptable Use Policy (AI-Specific)

AgentC2 customers must not use the platform to:

1. Generate content that promotes violence, discrimination, or illegal activity
2. Impersonate individuals or organizations without authorization
3. Conduct unauthorized surveillance or data collection
4. Make automated decisions with legal or significant effects without human oversight
5. Process special category data (health, biometric, genetic) without appropriate safeguards
6. Circumvent or test guardrail protections outside of authorized security testing
7. Use voice capabilities to create non-consensual deepfakes or impersonations
8. Send unsolicited communications (spam) via connected integrations
9. Scrape or aggregate data in violation of third-party terms of service
10. Process data of children under applicable age thresholds without parental consent

---

## 11. AI Transparency Statement

### For Enterprise Customers

> **AgentC2 AI Transparency Disclosure**
>
> AgentC2 is an AI agent orchestration platform. The following transparency disclosures apply to all AI capabilities:
>
> **AI Models Used:**
> AgentC2 agents are powered by third-party Large Language Models from OpenAI (GPT-4o family) and Anthropic (Claude family). AgentC2 does not develop proprietary AI models. Models are accessed via provider APIs — no customer data is used for model training.
>
> **Data Processing:**
> When you interact with an AgentC2 agent, your input (text or voice) is sent to the configured AI model provider for processing. Responses are generated by the AI model and may be supplemented by information retrieved from your organization's connected data sources (CRM, email, documents, etc.). AgentC2 acts as a data processor on your behalf.
>
> **Accuracy & Limitations:**
> AI-generated responses may be inaccurate, incomplete, or outdated. AgentC2 agents should not be the sole basis for decisions with legal, financial, medical, or safety implications. Human review is recommended for all consequential decisions.
>
> **Human Oversight:**
> AgentC2 provides configurable guardrails, human approval workflows, budget controls, and tool permission matrices to ensure appropriate human oversight of AI agent behavior.
>
> **Data Retention:**
> Conversation data is stored in your organization's workspace within AgentC2's database (hosted on Supabase). AI model providers may retain API inputs for up to 30 days for abuse monitoring but do not use API data for training. You may export your data at any time.
>
> **Feedback:**
> You can provide feedback on agent responses to help your organization improve agent configuration. Feedback is stored within your organization's workspace and is not shared with AI model providers.
>
> **Contact:**
> For questions about AI governance, data processing, or to exercise data rights, contact: privacy@agentc2.ai

---

## 12. AI Risk Register

| ID     | Risk                                          | NIST AI RMF             | EU AI Act               | L   | I   | Score | Controls                                           | Residual | Owner |
| ------ | --------------------------------------------- | ----------------------- | ----------------------- | --- | --- | ----- | -------------------------------------------------- | -------- | ----- |
| AI-R01 | Prompt injection leading to data exfiltration | MANAGE 1.3, MEASURE 2.6 | Art. 9, Art. 15         | 4   | 5   | 20    | Guardrails, egress policies, tool permissions      | HIGH     | CTO   |
| AI-R02 | Hallucination causing customer harm           | MEASURE 2.5, MANAGE 2.3 | Art. 9, Art. 14         | 4   | 4   | 16    | RAG grounding, evals, transparency disclosure      | MEDIUM   | CTO   |
| AI-R03 | Biased outputs in HR/financial use cases      | MEASURE 2.7, MAP 5.1    | Art. 10, Annex III §4-5 | 3   | 4   | 12    | Guardrails, customer guidance                      | MEDIUM   | CISO  |
| AI-R04 | Unauthorized agent autonomy                   | GOVERN 1.4, MANAGE 2.3  | Art. 14                 | 3   | 4   | 12    | Human approval workflow, tool permissions, budgets | MEDIUM   | CTO   |
| AI-R05 | Voice deepfake misuse                         | MAP 1.5, GOVERN 4.1     | Art. 50(4)              | 3   | 4   | 12    | Customer terms, ElevenLabs voice protections       | MEDIUM   | CISO  |
| AI-R06 | Customer data in AI provider logs             | GOVERN 6.1, MAP 5.1     | Art. 26(6)              | 3   | 3   | 9     | Provider DPAs, zero-training commitments           | LOW      | CISO  |
| AI-R07 | Model deprecation/availability                | MANAGE 4.1              | —                       | 3   | 3   | 9     | Multi-provider architecture                        | LOW      | CTO   |
| AI-R08 | RAG poisoning (malicious document upload)     | MEASURE 2.6             | Art. 15                 | 2   | 4   | 8     | Document validation, org isolation                 | LOW      | CTO   |
| AI-R09 | Supply chain risk (Mastra framework)          | GOVERN 6.1              | Art. 26                 | 2   | 3   | 6     | Open-source review, dependency scanning            | LOW      | CTO   |
| AI-R10 | Regulatory enforcement for non-compliance     | GOVERN 1.1              | Art. 99                 | 2   | 5   | 10    | This governance framework, compliance program      | MEDIUM   | CISO  |

---

## 13. Governance Structure

### 13.1 Recommended AI Governance Committee

| Role                        | Responsibility                                     | Meeting Frequency      |
| --------------------------- | -------------------------------------------------- | ---------------------- |
| CTO (Chair)                 | Technical oversight of AI systems, model selection | Monthly                |
| CISO                        | AI risk management, compliance, audit              | Monthly                |
| Product Lead                | Customer use case review, feature governance       | Monthly                |
| Legal Counsel               | Regulatory compliance, customer agreements         | Monthly (or as needed) |
| Engineering Lead            | Implementation of controls, monitoring             | Monthly                |
| Customer Success (observer) | Customer feedback, use case patterns               | Quarterly              |

### 13.2 Governance Processes

| Process                          | Frequency     | Owner       | Output                              |
| -------------------------------- | ------------- | ----------- | ----------------------------------- |
| AI Risk Assessment review        | Semi-annually | CISO        | Updated AI risk register            |
| Model inventory update           | Quarterly     | CTO         | Updated model inventory             |
| Guardrail effectiveness review   | Quarterly     | Engineering | Guardrail update recommendations    |
| Bias assessment                  | Semi-annually | CTO         | Bias test results, remediation plan |
| Customer use case risk review    | Quarterly     | Product     | High-risk use case register         |
| Regulatory landscape review      | Quarterly     | Legal       | Regulatory change impact assessment |
| AI incident review               | Per incident  | CISO        | Incident report, lessons learned    |
| AI transparency statement review | Annually      | CISO        | Updated transparency statement      |

### 13.3 Decision Framework

```
New Agent Deployment or Configuration Change
    │
    ▼
Risk Assessment Checklist
    │
    ├── Low Risk (general business automation)
    │       → Standard guardrails → Deploy
    │
    ├── Medium Risk (customer data processing, external actions)
    │       → Enhanced guardrails + monitoring → Deploy with review
    │
    ├── High Risk (HR, financial, legal decisions)
    │       → Human oversight required + DPIA → Governance committee approval
    │
    └── Prohibited (per acceptable use policy)
            → Block deployment → Escalate to legal
```

---

_Document maintained by the AgentC2 AI Governance Program. Next review: August 2026._
