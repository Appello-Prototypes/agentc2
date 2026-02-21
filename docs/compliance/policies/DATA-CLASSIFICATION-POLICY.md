# Data Classification Policy

**Document Classification:** INTERNAL  
**Policy ID:** DCP-001  
**Version:** 1.0  
**Effective Date:** [DATE]  
**Approved By:** [CEO/CTO NAME]  
**Document Owner:** CISO  
**Review Cadence:** Annually  
**Framework Reference:** SOC 2 C1.1 / ISO 27001 A.5.12-5.13 / NIST CSF ID.AM-5

---

## 1. Purpose

This policy defines data classification levels and handling requirements to ensure appropriate protection of information based on its sensitivity and business value.

## 2. Classification Levels

| Level       | Label            | Description                                                                                      | Examples                                                                                                                  |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Level 4** | **Critical**     | Data whose compromise would cause severe business harm, regulatory penalties, or legal liability | Encryption keys, master secrets, CREDENTIAL_ENCRYPTION_KEY, database credentials, production SSH keys                     |
| **Level 3** | **Confidential** | Sensitive personal data, customer data, and business-critical information                        | Customer PII, OAuth tokens, API keys, integration credentials, conversation content, voice audio, CRM data, email content |
| **Level 2** | **Internal**     | Internal business information not intended for public release                                    | Agent configurations, internal policies, architecture documentation, audit logs, employee information                     |
| **Level 1** | **Public**       | Information approved for public release                                                          | Marketing materials, public documentation, published blog posts, open-source code                                         |

## 3. Handling Requirements

| Requirement               | Critical                                                      | Confidential                                    | Internal                | Public                 |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ----------------------- | ---------------------- |
| **Encryption at rest**    | Required (AES-256-GCM)                                        | Required (AES-256-GCM or provider equivalent)   | Recommended             | Not required           |
| **Encryption in transit** | Required (TLS 1.2+)                                           | Required (TLS 1.2+)                             | Required (TLS 1.2+)     | Recommended            |
| **Access control**        | Named individuals only; MFA required                          | Role-based (need-to-know)                       | Authenticated users     | No restriction         |
| **Storage**               | Encrypted environment variables or encrypted database columns | Encrypted database columns                      | Standard database       | Any                    |
| **Sharing**               | Never shared externally; named recipients only                | Shared per DPA/NDA only                         | Internal only           | Unrestricted           |
| **Logging**               | Access logging required; content never logged                 | Access logging required; PII redacted from logs | Standard logging        | Standard logging       |
| **Disposal**              | Cryptographic erasure or secure deletion                      | Deletion with verification                      | Standard deletion       | No special handling    |
| **Backup**                | Encrypted backups only                                        | Encrypted backups                               | Standard backup         | Standard backup        |
| **Source control**        | Never committed to source control                             | Never committed to source control               | May be in private repos | May be in public repos |

## 4. Classification of AgentC2 Data

| Data Element                             | Classification   | Justification                                |
| ---------------------------------------- | ---------------- | -------------------------------------------- |
| `CREDENTIAL_ENCRYPTION_KEY`              | **Critical**     | Master key for all credential encryption     |
| `BETTER_AUTH_SECRET`                     | **Critical**     | Session signing key                          |
| Database connection strings              | **Critical**     | Database access credentials                  |
| SSH private keys                         | **Critical**     | Infrastructure access                        |
| Customer OAuth tokens (encrypted)        | **Confidential** | Customer integration access                  |
| Customer API keys (encrypted)            | **Confidential** | Customer tool access                         |
| Conversation content (prompts/responses) | **Confidential** | May contain customer PII                     |
| User PII (name, email)                   | **Confidential** | Personal data subject to privacy regulations |
| Voice audio data                         | **Confidential** | Biometric-adjacent data                      |
| CRM data (transient)                     | **Confidential** | Customer business data                       |
| Email content (transient)                | **Confidential** | Private communications                       |
| RAG document content                     | **Confidential** | Customer business documents                  |
| Agent instructions/configuration         | **Internal**     | Business logic                               |
| Audit log records                        | **Internal**     | May reference PII (must be redacted)         |
| Guardrail policies                       | **Internal**     | Security configuration                       |
| Platform usage metrics (aggregated)      | **Internal**     | Business intelligence                        |
| Marketing website content                | **Public**       | Published materials                          |
| API documentation                        | **Public**       | Published for customers                      |
| Open-source dependencies list            | **Public**       | Publicly visible                             |

## 5. Responsibilities

| Role               | Responsibility                                               |
| ------------------ | ------------------------------------------------------------ |
| **Data Owner**     | Assign classification to data; approve access                |
| **Data Custodian** | Implement technical controls per classification              |
| **All personnel**  | Handle data per its classification; report misclassification |
| **CISO**           | Policy oversight; audit compliance                           |

## 6. Reclassification

Data classification must be reviewed when:

- The data's business purpose changes
- Regulatory requirements change
- A security incident reveals inadequate classification
- Data aggregation creates higher-sensitivity combinations

---

**Approval:**

| Role    | Name | Signature | Date |
| ------- | ---- | --------- | ---- |
| CEO/CTO |      |           |      |
| CISO    |      |           |      |
