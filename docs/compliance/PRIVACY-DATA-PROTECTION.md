# AgentC2 Privacy & Data Protection Program

**Document Classification:** INTERNAL – RESTRICTED  
**Version:** 1.0  
**Effective Date:** February 21, 2026  
**Document Owner:** Privacy Officer / CISO  
**Review Cadence:** Annually (or upon material change)

---

## Table of Contents

1. [Privacy Program Overview](#1-privacy-program-overview)
2. [Data Mapping & Categories](#2-data-mapping--categories)
3. [Controller vs. Processor Roles](#3-controller-vs-processor-roles)
4. [Records of Processing Activities (RoPA)](#4-records-of-processing-activities-ropa)
5. [Privacy Policy (Template)](#5-privacy-policy-template)
6. [Data Processing Addendum (DPA)](#6-data-processing-addendum-dpa)
7. [Cookie Policy](#7-cookie-policy)
8. [Data Retention Policy](#8-data-retention-policy)
9. [Data Subject Request (DSR) Workflow](#9-data-subject-request-dsr-workflow)
10. [Breach Notification Procedures](#10-breach-notification-procedures)
11. [Cross-Border Transfer Mechanisms](#11-cross-border-transfer-mechanisms)
12. [Data Protection Impact Assessment (DPIA)](#12-data-protection-impact-assessment-dpia)

---

## 1. Privacy Program Overview

### 1.1 Applicable Regulations

| Regulation               | Jurisdiction   | Applicability                                                                | Key Requirements                                                      |
| ------------------------ | -------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **GDPR** (Reg. 2016/679) | EU/EEA         | Applies when processing data of EU residents or offering services to EU      | Lawful basis, DPA, DPIA, 72-hour breach notification, DSR fulfillment |
| **PIPEDA** / **CPPA**    | Canada         | Applies to commercial activities involving personal information in Canada    | 10 fair information principles, breach reporting, consent             |
| **CCPA/CPRA**            | California, US | Applies if ≥$25M revenue, or ≥100K consumers, or ≥50% revenue from data sale | Right to know/delete/opt-out, service provider agreements             |
| **LGPD**                 | Brazil         | If serving Brazilian customers                                               | Similar to GDPR, DPO requirement                                      |
| **POPIA**                | South Africa   | If serving South African customers                                           | Lawful processing, data subject rights                                |
| **UK GDPR**              | United Kingdom | If serving UK customers                                                      | Mirrors EU GDPR with ICO oversight                                    |

### 1.2 Privacy Officer Designation

**Requirement:** PIPEDA Principle 1 (Accountability), GDPR Art. 37 (where applicable).

**Action Required:** Designate a Privacy Officer with authority to:

- Oversee the privacy program
- Respond to data subject requests
- Serve as contact for supervisory authorities
- Conduct privacy impact assessments
- Manage breach notification processes

**Recommended Contact:** privacy@agentc2.ai

---

## 2. Data Mapping & Categories

### 2.1 Personal Data Inventory

| Data Category               | Specific Data Elements                                         | Source                   | Storage Location                              | Retention                                            | Legal Basis (GDPR)                                      |
| --------------------------- | -------------------------------------------------------------- | ------------------------ | --------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| **Account Data**            | Name, email, avatar                                            | User registration        | PostgreSQL (Supabase)                         | Duration of account + 30 days                        | Art. 6(1)(b) Contract                                   |
| **Authentication Data**     | Session tokens, OAuth tokens, password hashes                  | Auth flows               | PostgreSQL (encrypted)                        | Session: 30 min idle; tokens: duration of connection | Art. 6(1)(b) Contract                                   |
| **Organization Data**       | Org name, slug, domain, billing info                           | Org creation             | PostgreSQL                                    | Duration of org account + 90 days                    | Art. 6(1)(b) Contract                                   |
| **Membership Data**         | User-org relationships, roles, permissions                     | Membership management    | PostgreSQL                                    | Duration of membership                               | Art. 6(1)(b) Contract                                   |
| **Conversation Data**       | User prompts, agent responses, tool results                    | Agent interactions       | PostgreSQL                                    | Customer-configurable (default: indefinite)          | Art. 6(1)(b) Contract                                   |
| **Integration Credentials** | OAuth tokens, API keys (encrypted)                             | Integration setup        | PostgreSQL (AES-256-GCM encrypted)            | Duration of integration connection                   | Art. 6(1)(b) Contract                                   |
| **CRM Data** (transient)    | Contacts, companies, deals from HubSpot                        | MCP tool execution       | In-memory during processing                   | Not persisted by AgentC2                             | Art. 6(1)(f) Legitimate interest (customer instruction) |
| **Email Data** (transient)  | Email content, recipients, subjects                            | Gmail/Microsoft API      | In-memory during processing + optional memory | Customer-configurable                                | Art. 6(1)(b) Contract                                   |
| **Voice Data**              | Audio streams, transcripts                                     | Voice calls (ElevenLabs) | ElevenLabs platform (transient to AgentC2)    | Per ElevenLabs retention policy                      | Art. 6(1)(a) Consent                                    |
| **Document Data**           | Uploaded files (text, PDF, CSV)                                | Document upload          | PostgreSQL + vector store                     | Until customer deletion                              | Art. 6(1)(b) Contract                                   |
| **RAG Embeddings**          | Vector representations of text chunks                          | RAG ingestion            | PostgreSQL (pgvector)                         | Until customer deletion                              | Art. 6(1)(b) Contract                                   |
| **Audit Logs**              | User actions, IP addresses, user agents                        | Platform operations      | PostgreSQL                                    | 2 years (compliance requirement)                     | Art. 6(1)(f) Legitimate interest                        |
| **Usage/Analytics**         | Feature usage, API call counts                                 | Platform telemetry       | PostgreSQL                                    | Aggregated: indefinite; raw: 90 days                 | Art. 6(1)(f) Legitimate interest                        |
| **Consent Records**         | Privacy consent timestamp, terms acceptance, marketing consent | Registration             | PostgreSQL                                    | Duration of account + 7 years                        | Art. 6(1)(c) Legal obligation                           |

### 2.2 Special Category Data

AgentC2 does **not** intentionally collect special category data (Art. 9 GDPR). However, customer-provided prompts, documents, or integrated data may contain:

- Health information
- Racial or ethnic origin
- Political opinions
- Religious beliefs
- Biometric data
- Sexual orientation data

**Control:** Customers are responsible for ensuring they have lawful basis for processing special category data through AgentC2. AgentC2's DPA addresses this through customer warranties.

---

## 3. Controller vs. Processor Roles

### 3.1 Role Matrix

| Processing Activity                                | AgentC2 Role           | Customer Role | Basis                          |
| -------------------------------------------------- | ---------------------- | ------------- | ------------------------------ |
| Account management & authentication                | **Controller**         | Data Subject  | Contract performance           |
| Agent configuration & deployment                   | **Processor**          | Controller    | Customer instructions via DPA  |
| Conversation processing (prompts → LLM → response) | **Processor**          | Controller    | Customer instructions via DPA  |
| Document ingestion & RAG                           | **Processor**          | Controller    | Customer instructions via DPA  |
| Integration data processing (CRM, email, etc.)     | **Processor**          | Controller    | Customer instructions via DPA  |
| Voice agent conversations                          | **Processor**          | Controller    | Customer instructions via DPA  |
| Audit logging & security monitoring                | **Controller** (joint) | —             | Legitimate interest (security) |
| Marketing communications                           | **Controller**         | Data Subject  | Consent                        |
| Product analytics & improvement                    | **Controller**         | —             | Legitimate interest            |
| Billing & invoicing                                | **Controller**         | Data Subject  | Contract performance           |

### 3.2 Sub-Processor Chain

When acting as Processor, AgentC2 engages sub-processors:

```
Customer (Controller)
    │
    ▼
AgentC2 (Processor)
    │
    ├── Supabase (Sub-Processor) — Database hosting
    ├── OpenAI (Sub-Processor) — LLM inference
    ├── Anthropic (Sub-Processor) — LLM inference
    ├── ElevenLabs (Sub-Processor) — Voice processing
    ├── Digital Ocean (Sub-Processor) — Application hosting
    ├── Inngest (Sub-Processor) — Background job processing
    └── Upstash (Sub-Processor) — Rate limiting (no PII)
```

**Customer-directed integrations** (HubSpot, Jira, Slack, Gmail, etc.) are NOT sub-processors of AgentC2. The customer directly authorizes these integrations, and AgentC2 acts as a conduit processing data per customer instructions.

---

## 4. Records of Processing Activities (RoPA)

**Requirement:** GDPR Art. 30

### 4.1 Controller Processing Activities

| #    | Processing Activity                 | Purpose                      | Categories of Data Subjects | Categories of Data                     | Recipients                   | Transfer to Third Countries | Retention                      |
| ---- | ----------------------------------- | ---------------------------- | --------------------------- | -------------------------------------- | ---------------------------- | --------------------------- | ------------------------------ |
| C-01 | User account management             | Provide platform access      | Users, administrators       | Name, email, role                      | None (internal)              | US (Supabase hosting)       | Account lifetime + 30 days     |
| C-02 | Authentication & session management | Secure platform access       | Users                       | Session tokens, IP address, user agent | None                         | US (Supabase)               | 30-min sessions; logs: 2 years |
| C-03 | Billing & invoicing                 | Contract performance         | Org administrators          | Name, email, billing info              | Payment processor (TBD)      | US                          | 7 years (tax obligation)       |
| C-04 | Security monitoring & audit logging | Fraud prevention, security   | Users, administrators       | IP, user agent, actions, timestamps    | None                         | US (Supabase)               | 2 years                        |
| C-05 | Marketing communications            | Product updates, newsletters | Users (opted-in)            | Name, email                            | Email service provider (TBD) | US                          | Until opt-out + 30 days        |
| C-06 | Product analytics                   | Service improvement          | Users (anonymized)          | Feature usage, API metrics             | None                         | US                          | Aggregated: indefinite         |

### 4.2 Processor Processing Activities

| #    | Processing Activity              | Purpose                              | Data Subjects                        | Categories of Data                       | Sub-Processors                              | Transfer           | Retention                                  |
| ---- | -------------------------------- | ------------------------------------ | ------------------------------------ | ---------------------------------------- | ------------------------------------------- | ------------------ | ------------------------------------------ |
| P-01 | AI agent conversation processing | Customer-directed agent interactions | Customer's end users                 | Prompts, responses, conversation history | OpenAI, Anthropic                           | US (provider APIs) | Customer-configurable                      |
| P-02 | Document ingestion & RAG         | Knowledge base building              | N/A (document content)               | Text content, embeddings                 | OpenAI (embeddings)                         | US                 | Until customer deletion                    |
| P-03 | Integration data processing      | Customer-directed tool execution     | Customer's contacts, employees, etc. | CRM data, email, calendar, files         | Integration providers (customer-authorized) | Various            | Transient (not persisted)                  |
| P-04 | Voice agent processing           | Voice-based AI interactions          | Customer's callers                   | Audio, transcripts                       | ElevenLabs, OpenAI                          | US/EU              | Per provider policy                        |
| P-05 | Slack message processing         | Customer-directed bot responses      | Slack workspace users                | Messages, user info                      | Slack                                       | US                 | Conversation memory: customer-configurable |
| P-06 | Email processing                 | Customer-directed email automation   | Email correspondents                 | Email content, metadata                  | Google, Microsoft                           | US                 | Transient + optional memory                |

---

## 5. Privacy Policy (Template)

**Note:** This is a template for legal review. Must be reviewed by qualified legal counsel before publication.

---

### AGENTC2 PRIVACY POLICY

**Last Updated:** [DATE]

#### 1. Who We Are

AgentC2 ("we," "us," "our") operates the agentc2.ai platform, an AI agent orchestration service. Our registered address is [ADDRESS]. Our Privacy Officer can be reached at privacy@agentc2.ai.

#### 2. Information We Collect

**Information you provide:**

- Account information (name, email address)
- Organization information (company name, domain)
- Content you upload (documents, files)
- Communications with our support team
- Payment information (processed by our payment provider)

**Information collected automatically:**

- IP address, browser type, device information
- Usage data (features used, pages visited)
- Session data (login times, duration)
- Cookies and similar technologies (see Cookie Policy)

**Information processed on your behalf (as Processor):**

- AI conversation content (prompts and responses)
- Data retrieved from your connected integrations (CRM, email, etc.)
- Voice conversation data (if using voice features)
- Documents ingested into knowledge bases

#### 3. How We Use Your Information

| Purpose                                | Legal Basis (GDPR)                  | Data Used                            |
| -------------------------------------- | ----------------------------------- | ------------------------------------ |
| Provide and operate the platform       | Contract performance (Art. 6(1)(b)) | Account data, usage data             |
| Process AI interactions on your behalf | Contract performance + DPA          | Conversation data, integration data  |
| Ensure platform security               | Legitimate interest (Art. 6(1)(f))  | IP address, session data, audit logs |
| Send service communications            | Contract performance                | Email address                        |
| Send marketing communications          | Consent (Art. 6(1)(a))              | Email address, name                  |
| Improve our services                   | Legitimate interest                 | Aggregated usage data                |
| Comply with legal obligations          | Legal obligation (Art. 6(1)(c))     | As required by law                   |

#### 4. How We Share Your Information

We share personal information only as follows:

- **Sub-processors:** We use service providers to operate our platform (see Subprocessor List at [URL])
- **AI model providers:** Conversation content is sent to OpenAI and/or Anthropic for AI processing. These providers do not use API data for model training.
- **Customer-authorized integrations:** When you connect integrations (CRM, email, etc.), data is exchanged with those services per your authorization.
- **Legal requirements:** If required by law, subpoena, or legal process.
- **Business transfers:** In connection with a merger, acquisition, or sale of assets.

We do **not** sell your personal information.

#### 5. International Data Transfers

Your data is processed in the United States. For transfers from the EU/EEA/UK, we rely on:

- Standard Contractual Clauses (SCCs) approved by the European Commission
- EU-US Data Privacy Framework (where applicable for sub-processors)
- Your explicit consent where required

For transfers from Canada, we ensure adequate protections per PIPEDA requirements.

#### 6. Data Retention

| Data Type                 | Retention Period                             |
| ------------------------- | -------------------------------------------- |
| Account data              | Duration of account + 30 days                |
| Conversation data         | Customer-configurable; default until deleted |
| Uploaded documents        | Until deleted by customer                    |
| Audit logs                | 2 years                                      |
| Billing records           | 7 years                                      |
| Marketing consent records | Duration of account + 7 years                |

#### 7. Your Rights

Depending on your jurisdiction, you may have the right to:

- **Access** your personal data (GDPR Art. 15 / CCPA §1798.100 / PIPEDA)
- **Correct** inaccurate data (GDPR Art. 16 / CCPA §1798.106)
- **Delete** your data (GDPR Art. 17 / CCPA §1798.105)
- **Port** your data to another service (GDPR Art. 20)
- **Object** to processing based on legitimate interest (GDPR Art. 21)
- **Restrict** processing (GDPR Art. 18)
- **Withdraw consent** at any time (GDPR Art. 7(3))
- **Opt out** of sale/sharing of personal information (CCPA — note: we do not sell data)
- **Non-discrimination** for exercising privacy rights (CCPA §1798.125)

To exercise these rights, contact privacy@agentc2.ai. We will respond within 30 days (GDPR/PIPEDA) or 45 days (CCPA).

**For California residents:** You may designate an authorized agent to exercise rights on your behalf. We may verify your identity before fulfilling requests.

**For Canadian residents:** You may file a complaint with the Office of the Privacy Commissioner of Canada.

**For EU/EEA/UK residents:** You may lodge a complaint with your local supervisory authority.

#### 8. Children's Privacy

AgentC2 is not directed at individuals under 16. We do not knowingly collect personal information from children. If we learn we have collected data from a child, we will delete it promptly.

#### 9. AI-Specific Disclosures

AgentC2 uses third-party AI models (OpenAI, Anthropic) to power agent conversations. Key disclosures:

- Your conversation inputs are sent to AI model providers for processing
- AI providers retain API data for up to 30 days for abuse monitoring only
- AI providers do not use API data to train their models
- AI-generated responses may be inaccurate and should not be relied upon for consequential decisions
- See our AI Transparency Statement for full details at [URL]

#### 10. Changes to This Policy

We will notify you of material changes via email or platform notification at least 30 days before the changes take effect.

#### 11. Contact Us

Privacy Officer: privacy@agentc2.ai  
General inquiries: support@agentc2.ai  
Mailing address: [ADDRESS]

---

## 6. Data Processing Addendum (DPA)

**Note:** This is a structural template. Must be reviewed by qualified legal counsel before use.

---

### DATA PROCESSING ADDENDUM

This Data Processing Addendum ("DPA") is incorporated into and forms part of the agreement ("Agreement") between [CUSTOMER] ("Controller") and AgentC2 Inc. ("Processor").

#### 1. Definitions

Terms used in this DPA have the meanings given in the GDPR, PIPEDA, CCPA/CPRA, and the Agreement, as applicable.

#### 2. Scope and Roles

2.1 The Controller determines the purposes and means of processing Personal Data through the AgentC2 platform. The Processor processes Personal Data solely on behalf of the Controller and in accordance with the Controller's documented instructions.

2.2 The subject matter, duration, nature, purpose, categories of data subjects, and types of Personal Data are described in **Annex I** (Description of Processing).

#### 3. Processor Obligations

The Processor shall:

(a) Process Personal Data only on documented instructions from the Controller, including with regard to transfers outside the EU/EEA, unless required by applicable law;

(b) Ensure that persons authorized to process Personal Data have committed themselves to confidentiality;

(c) Take all measures required pursuant to Article 32 of the GDPR (security of processing), including:

- AES-256-GCM encryption of data at rest
- TLS 1.2+ encryption of data in transit
- Role-based access controls
- Regular security testing
- Multi-tenant data isolation
- Audit logging of data access

(d) Not engage another processor without prior specific or general written authorization of the Controller. In the case of general authorization, the Processor shall inform the Controller of any intended changes and provide the Controller with the opportunity to object;

(e) Assist the Controller in fulfilling data subject requests (access, rectification, erasure, portability, restriction, objection);

(f) Assist the Controller in ensuring compliance with Articles 32-36 of the GDPR (security, breach notification, DPIA, prior consultation);

(g) At the choice of the Controller, delete or return all Personal Data after the end of the provision of services, and delete existing copies unless required by applicable law;

(h) Make available to the Controller all information necessary to demonstrate compliance with this DPA and allow for and contribute to audits.

#### 4. Sub-Processors

4.1 The Controller provides general authorization for the Processor to engage sub-processors listed in **Annex II** (Sub-Processors).

4.2 The Processor shall: (a) notify the Controller of any intended changes to sub-processors at least 30 days in advance; (b) impose equivalent data protection obligations on sub-processors; (c) remain liable for sub-processor compliance.

4.3 The Controller may object to a new sub-processor within 30 days of notification. If the objection is not resolved, the Controller may terminate the affected services.

#### 5. International Data Transfers

5.1 The Processor shall not transfer Personal Data outside the EU/EEA unless adequate safeguards are in place:

- Standard Contractual Clauses (Module 2: Controller-to-Processor), incorporated as **Annex III**
- EU-US Data Privacy Framework certification (where applicable for sub-processors)
- Transfer Impact Assessment documented and available upon request

    5.2 For transfers from Canada, the Processor ensures protections comparable to PIPEDA through contractual and technical safeguards.

#### 6. Data Breach Notification

6.1 The Processor shall notify the Controller without undue delay (and in any event within **48 hours**) after becoming aware of a Personal Data Breach.

6.2 The notification shall include: (a) nature of the breach; (b) categories and approximate number of data subjects/records; (c) likely consequences; (d) measures taken or proposed to address the breach.

6.3 The Processor shall cooperate with the Controller in fulfilling the Controller's breach notification obligations under GDPR Article 33 (72 hours to supervisory authority) and Article 34 (notification to data subjects).

#### 7. Audits

7.1 The Processor shall make available SOC 2 Type II reports, penetration test summaries, and other compliance evidence upon request (no more than annually).

7.2 The Controller may conduct or commission an audit with 30 days' written notice, during business hours, at Controller's expense, subject to confidentiality obligations.

#### 8. Data Retention and Deletion

8.1 Upon termination of the Agreement or upon Controller's written request, the Processor shall delete all Personal Data within 30 days, unless retention is required by applicable law.

8.2 The Processor shall provide written certification of deletion upon request.

#### 9. CCPA/CPRA Provisions

Where the CCPA/CPRA applies:

9.1 The Processor acts as a "Service Provider" and shall not: (a) sell or share Personal Information; (b) retain, use, or disclose Personal Information for any purpose other than performing services under the Agreement; (c) combine Personal Information with information from other sources except as permitted by CCPA.

9.2 The Processor certifies that it understands and will comply with these restrictions.

#### 10. PIPEDA/CPPA Provisions

Where PIPEDA/CPPA applies:

10.1 The Processor shall implement safeguards appropriate to the sensitivity of the information.

10.2 The Processor shall assist the Controller in responding to access requests and complaints.

10.3 The Processor shall report breaches that create a "real risk of significant harm" to the Controller.

#### Annex I — Description of Processing

| Element                         | Description                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Subject Matter**              | Processing Personal Data through AI agent interactions                                                                   |
| **Duration**                    | Term of the Agreement                                                                                                    |
| **Nature of Processing**        | Collection, storage, AI inference, retrieval, transmission, deletion                                                     |
| **Purpose**                     | Providing AI agent orchestration services as configured by Controller                                                    |
| **Categories of Data Subjects** | Controller's employees, customers, contacts, end users                                                                   |
| **Categories of Personal Data** | Names, emails, phone numbers, conversation content, CRM data, documents, voice audio — as determined by Controller's use |
| **Sensitive Data**              | Only if provided by Controller; Controller warrants lawful basis                                                         |

#### Annex II — Sub-Processors

[See Subprocessor Register in ENTERPRISE-COMPLIANCE-PROGRAM.md §8.1]

#### Annex III — Standard Contractual Clauses

[Incorporate EU Commission Decision 2021/914 SCCs, Module 2 (Controller to Processor)]

---

## 7. Cookie Policy

### 7.1 Cookies Used by AgentC2

| Cookie                       | Type               | Purpose                               | Duration                  | Party       |
| ---------------------------- | ------------------ | ------------------------------------- | ------------------------- | ----------- |
| Session cookie (Better Auth) | Strictly Necessary | Authentication and session management | 30 minutes (idle timeout) | First-party |
| CSRF token                   | Strictly Necessary | Cross-site request forgery protection | Session                   | First-party |
| `__Secure-*`                 | Strictly Necessary | Secure cookie attributes              | Session                   | First-party |

### 7.2 Current State

AgentC2 currently uses only **strictly necessary cookies** for authentication and security. No analytics, advertising, or tracking cookies are deployed.

### 7.3 Compliance Notes

- **GDPR/ePrivacy:** Strictly necessary cookies do not require consent. If analytics or marketing cookies are added in the future, a consent management platform (CMP) must be implemented.
- **CCPA:** Cookie disclosure included in Privacy Policy.
- **PIPEDA:** Cookie usage disclosed transparently.

---

## 8. Data Retention Policy

### 8.1 Retention Schedule

| Data Category                       | Retention Period                            | Basis                                     | Disposal Method                         |
| ----------------------------------- | ------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| User account data                   | Account lifetime + 30 days                  | Contract necessity                        | Soft delete → hard delete after 30 days |
| Organization data                   | Org lifetime + 90 days                      | Contract necessity                        | Soft delete → hard delete after 90 days |
| Session/auth tokens                 | 30 minutes (idle)                           | Security                                  | Automatic expiration                    |
| Integration credentials (encrypted) | Duration of connection + 7 days             | Contract necessity                        | Encrypted deletion                      |
| Conversation memory                 | Customer-configurable (default: indefinite) | Customer instruction                      | Customer-initiated deletion             |
| RAG documents & embeddings          | Until customer deletion                     | Customer instruction                      | Customer-initiated deletion             |
| Audit logs                          | 2 years                                     | Legitimate interest (security/compliance) | Automated purge                         |
| Admin audit logs                    | 2 years                                     | Legitimate interest                       | Automated purge                         |
| Guardrail event logs                | 1 year                                      | Security monitoring                       | Automated purge                         |
| Billing records                     | 7 years                                     | Tax/legal obligation                      | Automated purge                         |
| Consent records                     | Account lifetime + 7 years                  | Legal obligation                          | Automated purge                         |
| Application logs (PM2)              | 90 days                                     | Operations                                | Log rotation                            |
| Caddy access logs                   | 30 days (720 hours)                         | Operations                                | Automatic rotation (5 files × 100MB)    |
| Observability traces                | 90 days                                     | Operations                                | Automated purge                         |
| Backup snapshots (Supabase)         | Per Supabase plan (7-30 days)               | Disaster recovery                         | Automatic rotation                      |

### 8.2 Implementation Requirements

1. **Automated purge jobs**: Implement Inngest scheduled functions to enforce retention periods
2. **Customer-facing controls**: Provide UI for customers to manage their data retention preferences
3. **Legal hold override**: Ability to suspend retention/deletion for data subject to legal proceedings
4. **Deletion verification**: Automated verification that deleted data is purged from all stores (PostgreSQL, vector store, backups)
5. **Backup consideration**: Deleted data may persist in backups until rotation; document this in DPA

---

## 9. Data Subject Request (DSR) Workflow

### 9.1 Request Types

| Right            | GDPR Article | CCPA Section | PIPEDA Principle | Response Time                          |
| ---------------- | ------------ | ------------ | ---------------- | -------------------------------------- |
| Access           | Art. 15      | §1798.100    | Principle 9      | 30 days (GDPR/PIPEDA) / 45 days (CCPA) |
| Rectification    | Art. 16      | §1798.106    | Principle 6      | 30 days                                |
| Erasure          | Art. 17      | §1798.105    | —                | 30 days (GDPR) / 45 days (CCPA)        |
| Data Portability | Art. 20      | —            | —                | 30 days                                |
| Restriction      | Art. 18      | —            | —                | 30 days                                |
| Objection        | Art. 21      | —            | Principle 10     | 30 days                                |
| Opt-Out of Sale  | —            | §1798.120    | —                | 15 business days                       |

### 9.2 Workflow

```
1. REQUEST RECEIVED (privacy@agentc2.ai or platform UI)
     │
     ▼
2. ACKNOWLEDGE (within 3 business days)
     │  - Confirm receipt
     │  - Assign case ID
     │  - Identify applicable jurisdiction(s)
     │
     ▼
3. VERIFY IDENTITY
     │  - For account holders: confirm email via logged-in session
     │  - For non-account holders: request identity verification (government ID + proof of data)
     │  - For authorized agents: request authorization documentation
     │
     ▼
4. DETERMINE SCOPE
     │  - Controller data (AgentC2 as Controller): process directly
     │  - Processor data (AgentC2 as Processor): forward to Controller (customer)
     │    with details, assist as needed per DPA
     │
     ▼
5. PROCESS REQUEST
     │  Access: Generate data export via /api/user/data-export (existing)
     │  Rectification: Update user profile data
     │  Erasure: Delete user data, propagate to sub-processors
     │  Portability: Generate JSON/CSV export
     │  Restriction: Flag data as restricted, cease processing
     │  Objection: Evaluate legitimate interest balancing test
     │
     ▼
6. RESPOND (within applicable timeframe)
     │  - Provide requested data/confirmation
     │  - If refusing: document legal basis for refusal
     │  - If extending: notify of extension and reasons (max +60 days GDPR, +45 days CCPA)
     │
     ▼
7. DOCUMENT
     - Log in DSR register: date received, type, jurisdiction, resolution, timeline
     - Audit log entry created
```

### 9.3 Implementation Status

| Capability                      | Status                      | Gap                                       |
| ------------------------------- | --------------------------- | ----------------------------------------- |
| Data export (access)            | ✅ `/api/user/data-export`  | Expand to include all data categories     |
| Data correction (rectification) | ⚠️ Profile edit exists      | Need API for comprehensive correction     |
| Data deletion (erasure)         | ❌ Not implemented          | **HIGH PRIORITY** — Need cascading delete |
| Data portability                | ⚠️ JSON export exists       | Need structured export format             |
| Processing restriction          | ❌ Not implemented          | Need account freeze capability            |
| Consent withdrawal              | ⚠️ Marketing consent toggle | Need comprehensive consent management     |
| DSR tracking system             | ❌ Not implemented          | Need DSR register/ticketing               |

### 9.4 Erasure Scope (Right to Delete)

When processing an erasure request, the following data stores must be addressed:

| Store                                  | Action                                                | Complexity        |
| -------------------------------------- | ----------------------------------------------------- | ----------------- |
| User record (PostgreSQL)               | Anonymize or delete                                   | Low               |
| Session records                        | Delete                                                | Low               |
| Organization membership                | Remove membership                                     | Low               |
| Conversation memory                    | Delete all user conversations                         | Medium            |
| RAG documents (user-uploaded)          | Delete documents and embeddings                       | Medium            |
| Audit logs                             | Anonymize actor references (retain log integrity)     | Medium            |
| Observability traces                   | Anonymize user references                             | Medium            |
| Sub-processor data (OpenAI, Anthropic) | Request deletion per provider DPA (30-day auto-purge) | Low               |
| Backups                                | Document backup retention period in response          | N/A (auto-rotate) |

---

## 10. Breach Notification Procedures

### 10.1 Definitions

**Personal Data Breach** (GDPR Art. 4(12)): A breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data.

### 10.2 Breach Classification

| Severity          | Criteria                                                             | Examples                                            | Response Time             |
| ----------------- | -------------------------------------------------------------------- | --------------------------------------------------- | ------------------------- |
| **Critical (P1)** | Confirmed exfiltration of PII/credentials affecting multiple tenants | Database breach, credential theft, API key exposure | Immediate (within 1 hour) |
| **High (P2)**     | Confirmed unauthorized access to PII, single tenant                  | Tenant isolation failure, unauthorized data access  | Within 4 hours            |
| **Medium (P3)**   | Potential unauthorized access, no confirmed exfiltration             | Suspicious login patterns, anomalous API usage      | Within 24 hours           |
| **Low (P4)**      | Security event with no PII exposure                                  | Failed brute-force attempt, blocked injection       | Within 72 hours           |

### 10.3 Notification Timeline

```
BREACH DETECTED (T=0)
    │
    ├── T+1 hour: Initial assessment by CISO/on-call
    │   - Classify severity (P1-P4)
    │   - Contain the breach (revoke access, rotate keys, isolate systems)
    │   - Assemble incident response team
    │
    ├── T+4 hours: Detailed assessment
    │   - Identify affected data subjects and data categories
    │   - Determine scope (which tenants, which data)
    │   - Assess risk to data subjects
    │
    ├── T+24 hours: Internal reporting
    │   - Brief executive team
    │   - Brief legal counsel
    │   - Determine regulatory notification obligations
    │
    ├── T+48 hours: Customer notification (per DPA)
    │   - Notify affected customers (Controllers)
    │   - Provide: nature, scope, measures taken, recommendations
    │
    ├── T+72 hours: Regulatory notification (GDPR — if required)
    │   - Notify lead supervisory authority (if risk to data subjects)
    │   - Content per Art. 33(3): nature, DPO contact, consequences, measures
    │
    ├── T+72 hours: PIPEDA notification (if "real risk of significant harm")
    │   - Notify OPC (Office of the Privacy Commissioner)
    │   - Notify affected individuals directly
    │   - Keep records for 24 months
    │
    ├── T+72 hours: US State notification (varies by state)
    │   - Most states: "without unreasonable delay" (30-90 days)
    │   - California: "in the most expedient time possible"
    │
    ├── T+7 days: Data subject notification (if high risk to individuals, GDPR Art. 34)
    │   - Plain language description of breach
    │   - DPO contact information
    │   - Likely consequences
    │   - Measures taken
    │
    └── T+30 days: Post-incident review
        - Root cause analysis
        - Remediation verification
        - Lessons learned document
        - Control improvements implemented
        - Incident report filed
```

### 10.4 Notification Templates

**Template A — Customer (Controller) Notification:**

> Subject: Security Incident Notification — AgentC2
>
> Dear [Customer],
>
> We are writing to notify you of a security incident affecting the AgentC2 platform that may have involved data processed on your behalf.
>
> **What happened:** [Description of incident]
> **When:** [Date/time of discovery]
> **What data was affected:** [Categories of data]
> **What we have done:** [Containment and remediation measures]
> **What you should do:** [Recommended actions]
>
> We are available to assist you with any regulatory notification obligations you may have. Please contact us at security@agentc2.ai.
>
> [CISO Name]  
> AgentC2 Security Team

**Template B — Supervisory Authority (GDPR Art. 33):**

> 1. Nature of the breach: [Description]
> 2. Name and contact of DPO: [DPO contact]
> 3. Likely consequences: [Assessment]
> 4. Measures taken/proposed: [Remediation]
> 5. Categories and approximate number of data subjects: [Count]
> 6. Categories and approximate number of personal data records: [Count]

### 10.5 Breach Register

All breaches (confirmed and suspected) must be logged in a breach register containing:

- Date of breach and date of discovery
- Description and classification
- Data categories and data subjects affected
- Assessment of risk to individuals
- Notifications made (regulatory, customer, individual)
- Containment and remediation actions
- Root cause and lessons learned

---

## 11. Cross-Border Transfer Mechanisms

### 11.1 Transfer Map

| From        | To                 | Data                | Mechanism                                       | Notes                                            |
| ----------- | ------------------ | ------------------- | ----------------------------------------------- | ------------------------------------------------ |
| EU/EEA → US | Supabase (AWS)     | All database data   | SCCs (Module 2 C→P) + TIA                       | Encryption at rest mitigates US access risk      |
| EU/EEA → US | OpenAI             | Prompts, responses  | SCCs + DPF (if certified)                       | 30-day retention, no training                    |
| EU/EEA → US | Anthropic          | Prompts, responses  | SCCs                                            | 30-day retention, no training                    |
| EU/EEA → US | Digital Ocean      | Application runtime | SCCs                                            | Data encrypted in transit and at rest            |
| EU/EEA → US | ElevenLabs         | Voice data          | SCCs                                            | Verify ElevenLabs DPF status                     |
| Canada → US | All sub-processors | All data            | Contractual protections per PIPEDA              | PIPEDA allows transfer with adequate protections |
| UK → US     | All sub-processors | All data            | UK SCCs (International Data Transfer Agreement) | UK GDPR post-Brexit                              |

### 11.2 Transfer Impact Assessment (TIA) Summary

| Factor                                     | Assessment                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Legal framework of destination country** | US: FISA 702 and EO 12333 surveillance risks. Mitigated by DPF adequacy decision (where applicable) and supplementary measures.                    |
| **Supplementary measures**                 | AES-256-GCM encryption at rest; TLS 1.2+ in transit; multi-tenant isolation; access controls; audit logging.                                       |
| **Practical experience**                   | No government access requests received to date.                                                                                                    |
| **Assessment conclusion**                  | Transfers permitted with SCCs + supplementary technical measures. Risk to data subjects assessed as LOW given encryption and provider commitments. |

---

## 12. Data Protection Impact Assessment (DPIA)

**Requirement:** GDPR Art. 35 — Required for processing likely to result in high risk to individuals, including systematic and extensive evaluation of personal aspects (profiling) and large-scale processing using new technologies.

### 12.1 DPIA Trigger Assessment

| Criteria (Art. 35(3) + WP29 Guidelines)       | Applicable?    | Reasoning                                                                 |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| Systematic and extensive evaluation/profiling | ⚠️ Potentially | AI agents may evaluate/profile individuals depending on customer use case |
| Large-scale processing of special categories  | ⚠️ Potentially | Customer documents/prompts may contain special category data              |
| Systematic monitoring of public areas         | ❌ No          | Not applicable                                                            |
| New technologies                              | ✅ Yes         | Generative AI / LLM processing                                            |
| Automated decision-making with legal effects  | ⚠️ Potentially | If customers use agents for HR, financial, or legal decisions             |

**Conclusion:** DPIA is **required** for AgentC2's core AI processing activities due to new technology (generative AI) and potential for systematic evaluation of individuals.

### 12.2 DPIA — AgentC2 AI Processing

| Section                         | Content                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Processing description**      | Multi-tenant AI agent platform processing natural language prompts through third-party LLMs, retrieving data from connected integrations, and generating responses. May include voice processing.                                                                               |
| **Purpose**                     | Enable enterprise customers to deploy AI agents for business automation                                                                                                                                                                                                         |
| **Necessity & proportionality** | Processing is necessary to fulfill the platform's core purpose. Data minimization achieved through transient processing of integration data, PII redaction in logs, tenant isolation.                                                                                           |
| **Risks to individuals**        | (1) Inaccurate AI outputs leading to adverse decisions; (2) Unauthorized data access via prompt injection; (3) PII exposure through model provider processing; (4) Bias in AI outputs affecting protected groups; (5) Voice data misuse                                         |
| **Risk mitigation**             | (1) Guardrails + human oversight + transparency disclosures; (2) Input/output filtering, egress controls, tool permissions; (3) Provider DPAs, zero-training commitments, encryption; (4) Bias testing framework (planned), diverse evals; (5) Consent mechanisms, provider DPA |
| **Consultation**                | Consultation with engineering, legal, and product teams conducted. No supervisory authority consultation required at this time (risks mitigated to acceptable levels).                                                                                                          |
| **Review date**                 | Every 12 months or upon material change to processing                                                                                                                                                                                                                           |

---

_Document maintained by the AgentC2 Privacy Program. Next review: February 2027._
