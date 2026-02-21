# AgentC2 Enterprise Sales Enablement — Security & Compliance

**Document Classification:** EXTERNAL – SHAREABLE  
**Version:** 1.0  
**Effective Date:** February 21, 2026  
**Document Owner:** CISO

---

## Table of Contents

1. [Security Overview (PDF Content)](#1-security-overview)
2. [One-Page Compliance Summary](#2-one-page-compliance-summary)
3. [Cloud Architecture Description](#3-cloud-architecture-description)
4. [Encryption Documentation](#4-encryption-documentation)
5. [Backup & Disaster Recovery](#5-backup--disaster-recovery)
6. [Penetration Testing Plan](#6-penetration-testing-plan)
7. [Security Questionnaire Answer Library](#7-security-questionnaire-answer-library)

---

## 1. Security Overview

_Content suitable for a customer-facing Security Overview PDF._

---

### AGENTC2 SECURITY OVERVIEW

#### Our Commitment

AgentC2 is built with enterprise-grade security from the ground up. As an AI agent orchestration platform, we understand that our customers trust us with sensitive business data and mission-critical integrations. Security is not an afterthought — it is foundational to our architecture.

#### Architecture & Infrastructure

| Component             | Detail                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Hosting**           | Dedicated cloud infrastructure (Digital Ocean) with isolated compute                                |
| **Database**          | PostgreSQL hosted on Supabase (AWS infrastructure), with SOC 2 Type II certification                |
| **TLS/HTTPS**         | All traffic encrypted in transit via TLS 1.2+ with automated certificate management (Let's Encrypt) |
| **Reverse Proxy**     | Caddy with HSTS, CSP, X-Frame-Options, X-Content-Type-Options, and additional security headers      |
| **Process Isolation** | Separate application processes with memory limits and restart policies                              |

#### Encryption

| Layer                  | Standard            | Detail                                                                             |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| **In Transit**         | TLS 1.2+            | All client-server and server-server communication encrypted                        |
| **At Rest**            | AES-256-GCM         | All credentials, OAuth tokens, API keys, and private keys encrypted before storage |
| **Key Management**     | HKDF key derivation | Per-purpose key derivation from master key; key rotation support with fallback     |
| **Digital Signatures** | Ed25519             | Per-organization key pairs for message signing and verification                    |

#### Authentication & Access Control

| Feature                | Detail                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Authentication**     | Session-based authentication with HTTP-only secure cookies, 30-minute idle timeout |
| **Multi-Factor Auth**  | Two-factor authentication support                                                  |
| **RBAC**               | Four-tier role model: Owner, Admin, Member, Viewer                                 |
| **API Authentication** | API key or session-based authentication; keys stored encrypted                     |
| **Session Security**   | CSRF protection, origin validation, secure cookie attributes                       |

#### Multi-Tenant Isolation

| Control                    | Detail                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| **Database Isolation**     | All queries scoped to organization ID; no cross-tenant data access |
| **Credential Isolation**   | Per-organization encrypted credential storage                      |
| **Agent Isolation**        | Agents, tools, and configurations scoped to organization           |
| **Vector Store Isolation** | RAG embeddings and documents isolated by organization              |
| **Key Pair Isolation**     | Per-organization Ed25519 key pairs for identity                    |

#### AI Security

| Control              | Detail                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Guardrails**       | Configurable input/output content filtering per agent and per organization             |
| **Tool Permissions** | Granular per-agent tool access control (read-only, write, spend, full)                 |
| **Budget Controls**  | Per-agent, per-organization, and per-user spending limits with hard enforcement        |
| **Network Egress**   | Domain allowlist/denylist controls for outbound requests                               |
| **Human Oversight**  | Configurable human approval workflows for high-risk operations                         |
| **Model Providers**  | OpenAI and Anthropic; both SOC 2 Type II certified; no customer data used for training |

#### Monitoring & Logging

| Feature            | Detail                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| **Audit Logging**  | Comprehensive audit trail for all write operations, tool executions, and administrative actions          |
| **PII Redaction**  | Automatic redaction of email addresses, phone numbers, SSNs, and credit card numbers in application logs |
| **Observability**  | Full trace observability with sensitive data filtering                                                   |
| **Access Logging** | HTTP access logs with rotation and retention policies                                                    |

#### Application Security

| Control                 | Detail                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- |
| **Input Validation**    | Schema-based validation (Zod) on all API endpoints                            |
| **CSRF Protection**     | Origin validation on all state-changing HTTP methods                          |
| **Rate Limiting**       | Per-endpoint rate limiting (authentication, chat, API, uploads)               |
| **Security Headers**    | HSTS (preload), CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| **Webhook Security**    | HMAC-SHA256 signature verification with timestamp validation                  |
| **Dependency Security** | Lockfile-based dependency management; secret scanning in CI pipeline          |

#### Compliance Program

| Certification/Program    | Status                                                  |
| ------------------------ | ------------------------------------------------------- |
| **SOC 2 Type I**         | In progress (target: Q4 2026)                           |
| **SOC 2 Type II**        | Planned (target: Q2 2027)                               |
| **GDPR Compliance**      | Privacy program implemented; DPA available              |
| **CCPA/CPRA Compliance** | Privacy program implemented                             |
| **PIPEDA Compliance**    | Privacy program implemented                             |
| **Penetration Testing**  | Annual third-party testing (first test planned Q2 2026) |

#### Data Processing

| Aspect                | Detail                                                   |
| --------------------- | -------------------------------------------------------- |
| **Data Residency**    | United States (primary)                                  |
| **DPA**               | Available upon request                                   |
| **Subprocessor List** | Published and maintained with 30-day change notification |
| **Data Export**       | Full data export available via API                       |
| **Data Deletion**     | Account and data deletion available upon request         |
| **Backup**            | Automated database backups via Supabase                  |

#### Contact

- **Security inquiries:** security@agentc2.ai
- **Privacy inquiries:** privacy@agentc2.ai
- **Vulnerability reports:** security@agentc2.ai (we welcome responsible disclosure)

---

## 2. One-Page Compliance Summary

_For procurement teams._

---

### AGENTC2 COMPLIANCE AT A GLANCE

| Category                   | Status                   | Details                                                      |
| -------------------------- | ------------------------ | ------------------------------------------------------------ |
| **SOC 2**                  | 🟡 In Progress           | Type I audit planned for Q4 2026; Type II target Q2 2027     |
| **Encryption at Rest**     | ✅ Implemented           | AES-256-GCM for all sensitive data                           |
| **Encryption in Transit**  | ✅ Implemented           | TLS 1.2+ on all connections                                  |
| **RBAC**                   | ✅ Implemented           | Owner / Admin / Member / Viewer roles                        |
| **MFA**                    | ✅ Available             | Two-factor authentication supported                          |
| **SSO (SAML/OIDC)**        | 🟡 Planned               | Roadmap item for enterprise tier                             |
| **Audit Logging**          | ✅ Implemented           | Full audit trail for all operations                          |
| **DPA**                    | ✅ Available             | GDPR-compliant DPA available on request                      |
| **GDPR**                   | ✅ Program Implemented   | Privacy Policy, DPA, DSR workflow, breach procedures         |
| **CCPA/CPRA**              | ✅ Program Implemented   | Privacy notice, deletion rights, service provider terms      |
| **PIPEDA**                 | ✅ Program Implemented   | Fair information principles compliance                       |
| **Pen Test**               | 🟡 Planned               | First annual test scheduled Q2 2026                          |
| **Vulnerability Scanning** | 🟡 In Progress           | CI pipeline with secret scanning; SCA implementation planned |
| **Backup & DR**            | ⚠️ Partial               | Automated DB backups; formal DR plan in development          |
| **AI Governance**          | ✅ Framework Established | NIST AI RMF aligned; guardrails, human oversight, budgets    |
| **Data Residency**         | United States            | Database: AWS us-east-1 (Supabase); Compute: Digital Ocean   |
| **Uptime SLA**             | 🟡 Planned               | Target: 99.9% (to be formalized in enterprise agreement)     |

**Documents Available on Request:**

- Data Processing Addendum (DPA)
- Subprocessor List
- Security Overview PDF
- Privacy Policy
- AI Transparency Statement
- SOC 2 Report (when available)
- Penetration Test Executive Summary (when available)

---

## 3. Cloud Architecture Description

### 3.1 Infrastructure Topology

```
                    Internet
                       │
                       ▼
              ┌────────────────┐
              │   Caddy Proxy  │  TLS termination, security headers
              │  (agentc2.ai)  │  HSTS, CSP, rate limiting
              └───────┬────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │Frontend │  │  Agent   │  │  Admin  │
   │  App    │  │   App    │  │   App   │
   │Port 3000│  │Port 3001 │  │Port 3003│
   │ 2GB RAM │  │ 4GB RAM  │  │ 512MB   │
   └────┬────┘  └────┬─────┘  └────┬────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
              ┌───────▼────────┐
              │  PostgreSQL    │  Supabase (AWS us-east-1)
              │  + pgvector    │  Encrypted at rest (AWS AES-256)
              │                │  TLS in transit
              └────────────────┘
```

### 3.2 Compute Environment

| Property             | Detail                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| **Provider**         | Digital Ocean                                                           |
| **Instance Type**    | Dedicated Droplet (32GB RAM, 8 vCPU)                                    |
| **Operating System** | Ubuntu Linux (hardened)                                                 |
| **Runtime**          | Bun 1.3.4+ (JavaScript/TypeScript runtime)                              |
| **Process Manager**  | PM2 with automatic restart, memory limits, and crash detection          |
| **Deployment**       | Git-based via GitHub Actions CI/CD; automated rollback on failure       |
| **Build**            | Turborepo (monorepo build orchestration) with standalone Next.js output |

### 3.3 Database

| Property                  | Detail                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| **Provider**              | Supabase (managed PostgreSQL on AWS)                                    |
| **Infrastructure**        | AWS us-east-1                                                           |
| **Encryption at Rest**    | AWS AES-256 (Supabase managed)                                          |
| **Encryption in Transit** | TLS/SSL required for all connections                                    |
| **Backups**               | Automated daily backups with point-in-time recovery (per Supabase plan) |
| **Access Control**        | Connection string restricted to application servers; no public access   |
| **SOC 2**                 | Supabase is SOC 2 Type II certified                                     |

### 3.4 Network Security

| Layer        | Control                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge**     | Caddy reverse proxy with automatic HTTPS (Let's Encrypt)                                                                                                                         |
| **TLS**      | Minimum TLS 1.2; HSTS with preload directive                                                                                                                                     |
| **Headers**  | X-Content-Type-Options: nosniff; X-Frame-Options: DENY (except embeds); X-XSS-Protection: 1; mode=block; Referrer-Policy: strict-origin-when-cross-origin; Server header removed |
| **CSP**      | Content-Security-Policy configured per application context                                                                                                                       |
| **CORS**     | Restricted to application domains                                                                                                                                                |
| **Firewall** | Digital Ocean cloud firewall (SSH + HTTPS only)                                                                                                                                  |

### 3.5 CI/CD Pipeline

```
Developer Push → GitHub Actions
    │
    ├── Type Checking (TypeScript)
    ├── Linting (ESLint)
    ├── Secret Scanning (Gitleaks)
    ├── Dependency Audit
    │
    ▼
Build & Deploy
    │
    ├── SSH to production server
    ├── Pull latest code
    ├── Install dependencies
    ├── Generate Prisma client
    ├── Build applications
    ├── Backup previous build (rollback safety)
    ├── Restart applications (PM2)
    ├── Health check verification
    ├── Crash-loop detection
    │
    └── Slack notification (success/failure)
```

---

## 4. Encryption Documentation

### 4.1 Encryption Standards

| Use Case              | Algorithm | Key Size | Mode                | Standard                   |
| --------------------- | --------- | -------- | ------------------- | -------------------------- |
| Credentials at rest   | AES       | 256-bit  | GCM (authenticated) | NIST SP 800-38D            |
| Data in transit       | TLS       | 256-bit  | 1.2+                | NIST SP 800-52 Rev 2       |
| Key derivation        | HKDF      | SHA-256  | —                   | RFC 5869                   |
| Digital signatures    | Ed25519   | 256-bit  | —                   | RFC 8032                   |
| Webhook verification  | HMAC      | SHA-256  | —                   | RFC 2104                   |
| Random key generation | CSPRNG    | 256-bit  | —                   | Node.js crypto.randomBytes |

### 4.2 Key Management

| Key                          | Purpose                                                   | Storage                                     | Rotation                                                | Backup                    |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- | ------------------------- |
| `CREDENTIAL_ENCRYPTION_KEY`  | Master encryption key (KEK) for all credential encryption | Environment variable                        | Manual rotation with `_PREV` fallback for re-encryption | Must be securely escrowed |
| Per-org Ed25519 private keys | Organization identity and message signing                 | PostgreSQL (encrypted with KEK)             | API-triggered rotation with version history             | Encrypted in database     |
| TLS certificates             | HTTPS termination                                         | Caddy auto-managed (Let's Encrypt)          | Automatic (90-day Let's Encrypt cycle)                  | Auto-renewed              |
| OAuth tokens                 | Third-party integration access                            | PostgreSQL (AES-256-GCM encrypted)          | Automatic refresh on expiry                             | Encrypted in database     |
| Session secrets              | Session cookie signing                                    | Environment variable (`BETTER_AUTH_SECRET`) | Manual rotation                                         | Must be securely stored   |

### 4.3 Encrypted Data Flow

```
Plaintext credential
    │
    ▼
AES-256-GCM Encryption
    │  Key: HKDF(CREDENTIAL_ENCRYPTION_KEY, purpose)
    │  IV: Random 12 bytes (crypto.randomBytes)
    │  Output: { __enc: "v1", iv, tag, data }
    │
    ▼
PostgreSQL (ciphertext stored in JSON column)
    │
    ▼
On read: Decrypt with current key → if fails → try CREDENTIAL_ENCRYPTION_KEY_PREV
    │
    ▼
Plaintext (used in memory, never logged)
```

---

## 5. Backup & Disaster Recovery

### 5.1 Current State

| Component           | Backup Mechanism           | Frequency      | Retention            | Tested                              |
| ------------------- | -------------------------- | -------------- | -------------------- | ----------------------------------- |
| PostgreSQL database | Supabase automated backups | Daily          | Per plan (7-30 days) | ❌ Not formally tested              |
| Application code    | Git repository (GitHub)    | Continuous     | Indefinite           | ✅ Continuously recovered via CI/CD |
| Application builds  | PM2 deploy with rollback   | Per deployment | Previous build       | ✅ Automated rollback on failure    |
| Environment config  | `.env` (not in git)        | Manual         | Manual backup        | ❌ Needs formal backup              |
| Encryption keys     | Environment variable       | Manual         | Manual backup        | ❌ Needs key escrow                 |

### 5.2 Recovery Objectives (To Be Formalized)

| Metric                             | Target  | Current Capability                  | Gap                                |
| ---------------------------------- | ------- | ----------------------------------- | ---------------------------------- |
| **RTO** (Recovery Time Objective)  | 4 hours | ~1-2 hours (new server from backup) | Need formal procedure and testing  |
| **RPO** (Recovery Point Objective) | 1 hour  | ~24 hours (daily backup)            | Need PITR or more frequent backups |
| **MTTR** (Mean Time to Recovery)   | 2 hours | Unknown (untested)                  | Need DR drills                     |

### 5.3 DR Plan (To Be Implemented)

**Scenario 1: Application Server Failure**

1. Provision new Digital Ocean droplet from snapshot/image
2. Pull code from GitHub, install dependencies
3. Restore environment configuration from secure backup
4. Start applications via PM2
5. Update DNS / Caddy configuration
6. Verify health checks

**Scenario 2: Database Failure**

1. Supabase handles failover (managed service)
2. If Supabase unavailable: restore from backup to new instance
3. Verify data integrity
4. Update connection strings
5. Restart applications

**Scenario 3: Complete Infrastructure Failure**

1. Execute Scenario 1 + Scenario 2 in parallel
2. Restore from most recent known-good state
3. Verify all integrations operational
4. Notify affected customers

### 5.4 Penetration Testing Plan

| Element             | Detail                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Scope**           | External network, web application (agent + frontend + admin), API endpoints, authentication flows, multi-tenant isolation |
| **Methodology**     | OWASP Testing Guide v4.2, PTES, NIST SP 800-115                                                                           |
| **Frequency**       | Annually (minimum), plus after significant architecture changes                                                           |
| **Provider**        | Independent third-party firm (CREST/OSCP certified)                                                                       |
| **Duration**        | 2-3 weeks engagement                                                                                                      |
| **Output**          | Executive summary, detailed findings with CVSS scoring, remediation recommendations                                       |
| **Remediation SLA** | Critical: 7 days; High: 30 days; Medium: 90 days; Low: next release cycle                                                 |
| **Retest**          | Remediation verification within 30 days of fix                                                                            |
| **First Test**      | Scheduled Q2 2026                                                                                                         |

**Scope Inclusions:**

- Authentication and session management
- Authorization and RBAC enforcement
- Multi-tenant isolation testing
- API security (injection, BOLA, BFLA)
- AI-specific testing (prompt injection, data exfiltration via agent)
- Integration security (OAuth flow, credential handling)
- Webhook endpoint security
- Rate limiting effectiveness
- Content Security Policy bypass testing

**Scope Exclusions:**

- Third-party provider infrastructure (Supabase, OpenAI, Anthropic)
- Physical security
- Social engineering (separate engagement if desired)

---

## 6. Penetration Testing Plan

See §5.4 above for the complete penetration testing plan.

---

## 7. Security Questionnaire Answer Library

### Instructions

This library provides standard answers to the most common security questionnaire themes encountered in enterprise procurement (SIG, CAIQ, VSAQ, and custom questionnaires). Each answer reflects the current or planned state of AgentC2's security posture as of February 2026.

**Format:** Theme → Standard Answer (mark items "Planned" where not yet implemented)

---

### 7.1 Organization & Governance (30 themes)

**Q: Do you have an information security policy?**
A: Yes. AgentC2 maintains a formal Information Security Policy approved by executive management, reviewed annually. The policy establishes requirements for access control, data protection, incident response, and acceptable use.

**Q: Do you have a dedicated security team or CISO?**
A: AgentC2 has designated a Chief Information Security Officer (CISO) responsible for the security and compliance program. [Note: Update when CISO formally designated.]

**Q: Do you conduct security awareness training?**
A: Yes. All employees complete security awareness training upon onboarding and annually thereafter. Training covers phishing, data handling, access management, and incident reporting. _(Planned: Implementation scheduled for Q2 2026.)_

**Q: Do you have an acceptable use policy?**
A: Yes. AgentC2 maintains an Acceptable Use Policy covering authorized use of company systems, data handling requirements, and prohibited activities.

**Q: Do you have a risk management program?**
A: Yes. AgentC2 maintains a risk register with identified risks scored by likelihood and impact. Risk assessments are conducted annually and upon material changes. The risk management framework is aligned with NIST CSF and SOC 2 requirements.

**Q: Do you carry cyber insurance?**
A: _(To be confirmed and documented. Recommended: $5M minimum coverage.)_

**Q: Do you have a business continuity / disaster recovery plan?**
A: AgentC2 maintains a Business Continuity Plan with defined Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO). Automated database backups are maintained via Supabase. Application deployment includes automated rollback capabilities. _(Formal BCP/DR plan in development; target Q2 2026.)_

**Q: Do you have a change management process?**
A: Yes. All code changes go through a version-controlled workflow (Git/GitHub) with pull request reviews. Automated CI/CD pipelines enforce type checking, linting, and secret scanning before deployment. Deployments include automated rollback on failure.

**Q: Have you experienced any security incidents or breaches in the past 3 years?**
A: No. AgentC2 has not experienced any security breaches or incidents involving customer data.

**Q: Do you have a vendor/third-party risk management program?**
A: Yes. AgentC2 maintains a subprocessor register and conducts risk assessments on critical vendors. We review vendor SOC 2 reports and ensure DPAs are in place for all subprocessors handling personal data.

### 7.2 Access Control (25 themes)

**Q: How do you manage user authentication?**
A: AgentC2 uses session-based authentication with HTTP-only secure cookies, 30-minute idle timeout, and CSRF protection. Multi-factor authentication is supported. API access uses encrypted API keys.

**Q: Do you support Single Sign-On (SSO)?**
A: SSO (SAML/OIDC) is on our roadmap for enterprise customers. _(Planned: Implementation targeted for 2026.)_

**Q: Do you support multi-factor authentication (MFA)?**
A: Yes. AgentC2 supports two-factor authentication for user accounts.

**Q: How do you handle role-based access control (RBAC)?**
A: AgentC2 implements a four-tier RBAC model: Owner (full control), Admin (management), Member (standard access), Viewer (read-only). Additionally, granular tool-level permissions control which tools each agent can access.

**Q: Do you conduct periodic access reviews?**
A: Quarterly access reviews are part of our compliance program. _(Planned: Process being formalized for SOC 2 readiness.)_

**Q: How do you manage privileged access?**
A: Administrative access to infrastructure is restricted to authorized personnel via SSH key authentication. Database access is restricted to application connection strings. No shared administrative accounts are used.

**Q: How do you handle employee onboarding/offboarding?**
A: Formal onboarding and offboarding procedures ensure access is provisioned per role requirements and revoked upon termination. Session tokens are invalidated upon account deactivation. _(Formal procedure documentation in progress.)_

**Q: Do you enforce password complexity requirements?**
A: Password requirements are enforced through our authentication framework. _(Formal password policy documentation in progress.)_

**Q: Do you enforce session timeouts?**
A: Yes. Sessions have a 30-minute idle timeout with automatic expiration. Session cookies are HTTP-only and Secure-flagged.

**Q: How do you manage API keys?**
A: API keys are stored encrypted (AES-256-GCM) in the database. Keys are scoped to organizations and can be rotated by administrators. API key usage is logged in the audit trail.

### 7.3 Data Protection (30 themes)

**Q: How do you encrypt data at rest?**
A: All sensitive data (credentials, OAuth tokens, API keys, private keys) is encrypted using AES-256-GCM before storage in PostgreSQL. The database itself is hosted on Supabase with AWS-managed encryption at rest. Encryption keys support rotation with fallback to previous keys.

**Q: How do you encrypt data in transit?**
A: All client-server and server-server communication uses TLS 1.2+. HSTS with preload is enforced. The Caddy reverse proxy handles TLS termination with automatically renewed Let's Encrypt certificates.

**Q: How do you manage encryption keys?**
A: A master encryption key (KEK) is stored as an environment variable on the application server. Per-purpose keys are derived using HKDF (RFC 5869). Key rotation is supported with automatic re-encryption using the previous key as fallback. Per-organization Ed25519 key pairs are generated for digital signatures.

**Q: Where is customer data stored?**
A: Customer data is stored in PostgreSQL hosted on Supabase (AWS us-east-1, United States). Application compute runs on Digital Ocean infrastructure.

**Q: Do you support data residency requirements?**
A: Currently, all data is stored in the United States. Data residency options for other regions can be discussed for enterprise deployments.

**Q: Do you perform data classification?**
A: Yes. AgentC2 classifies data into categories: Critical (credentials, encryption keys), High (PII, conversation data), Medium (agent configuration, audit logs), Low (aggregated analytics). Data handling procedures are applied based on classification.

**Q: How do you handle data retention and disposal?**
A: AgentC2 maintains a formal data retention policy. Account data is retained for the duration of the account plus 30 days. Audit logs are retained for 2 years. Customers can delete their data at any time. Automated purge jobs enforce retention limits.

**Q: Can customers export their data?**
A: Yes. AgentC2 provides a data export API (`/api/user/data-export`) that exports user profile, memberships, integrations, documents, audit logs, and agent run history in JSON format.

**Q: Can customers delete their data?**
A: Yes. Data deletion is available upon request. We are implementing self-service deletion capabilities. Deletion cascades to all associated records. Sub-processors auto-purge after their retention periods.

**Q: Do you have a DPA (Data Processing Agreement)?**
A: Yes. A GDPR-compliant DPA is available upon request. The DPA covers data processing obligations, sub-processor management, breach notification, international transfers, and audit rights.

**Q: Do you have a subprocessor list?**
A: Yes. Our subprocessor list is maintained and available upon request. We provide 30-day advance notice of sub-processor changes per our DPA.

**Q: How do you handle PII in logs?**
A: Our log sanitization framework automatically redacts email addresses, phone numbers, Social Security numbers, and credit card numbers from application logs. Observability traces filter sensitive fields (password, apiKey, token, secret, authorization).

**Q: Do you process data for AI model training?**
A: No. Customer data sent to AI providers (OpenAI, Anthropic) via API is not used for model training. Both providers have committed to this in their terms and DPAs.

### 7.4 Application Security (25 themes)

**Q: How do you prevent injection attacks?**
A: All API inputs are validated using Zod schema validation. SQL injection is prevented by using Prisma ORM with parameterized queries. We implement Content Security Policy (CSP) headers to prevent XSS.

**Q: How do you handle CSRF protection?**
A: CSRF protection is enforced on all state-changing HTTP methods (POST, PUT, PATCH, DELETE) via origin validation. API key-authenticated requests bypass CSRF checks (as they use non-cookie authentication).

**Q: Do you implement rate limiting?**
A: Yes. Rate limiting is applied to all critical endpoints: authentication (20 requests/15 min), chat (30/min), MCP API (50/min), file uploads (10/min), organization mutations (30/min). Rate limiting uses in-memory and distributed (Redis) enforcement.

**Q: Do you have a secure development lifecycle (SDLC)?**
A: Yes. Our SDLC includes: code review via pull requests, automated type checking (TypeScript), automated linting (ESLint), secret scanning in CI (Gitleaks), dependency auditing, and automated deployment with rollback capabilities.

**Q: Do you perform static application security testing (SAST)?**
A: TypeScript strict mode and ESLint serve as our primary static analysis. We are evaluating dedicated SAST tooling. _(Recommended: Add Snyk Code or Semgrep.)_

**Q: Do you perform software composition analysis (SCA)?**
A: We use lockfile-based dependency management (bun.lockb) and CI secret scanning. SCA tooling (Snyk/Dependabot) is being implemented. _(Planned: Q2 2026.)_

**Q: Do you have a vulnerability disclosure / bug bounty program?**
A: We welcome responsible disclosure at security@agentc2.ai. A formal bug bounty program is planned. _(Planned: Year 2 roadmap.)_

**Q: How do you handle security headers?**
A: Our Caddy reverse proxy enforces: HSTS (max-age=31536000; includeSubDomains; preload), X-Content-Type-Options (nosniff), X-Frame-Options (DENY or SAMEORIGIN per route), X-XSS-Protection (1; mode=block), Referrer-Policy (strict-origin-when-cross-origin), Permissions-Policy (camera=(), microphone=(), geolocation=()), and Content-Security-Policy.

**Q: Do you support webhook signature verification?**
A: Yes. All webhook endpoints verify HMAC-SHA256 signatures with timestamp validation (5-minute window) to prevent replay attacks.

**Q: How do you handle file uploads?**
A: File uploads are restricted to: maximum 10MB size, allowed types (.txt, .md, .json, .html, .csv, .pdf), maximum 500K characters of content. Uploads are rate-limited (10/min per user) and scanned for content type verification.

### 7.5 Infrastructure & Network Security (20 themes)

**Q: What cloud provider do you use?**
A: AgentC2 uses Digital Ocean for compute infrastructure and Supabase (AWS) for database hosting. Both providers maintain SOC 2 Type II certifications.

**Q: How do you manage firewall rules?**
A: Digital Ocean cloud firewall restricts inbound traffic to SSH and HTTPS only. The Caddy reverse proxy provides application-layer security controls.

**Q: How do you handle patching?**
A: Operating system patches are applied regularly. Application dependencies are managed via lockfiles. We are implementing automated vulnerability scanning for dependency updates. _(Formal patch management policy in development.)_

**Q: Do you use a WAF (Web Application Firewall)?**
A: Application-layer protections are provided through Caddy configuration, rate limiting, and input validation. A dedicated WAF is being evaluated. _(Recommended: Cloudflare or AWS WAF.)_

**Q: How do you handle DDoS protection?**
A: Rate limiting provides application-layer DDoS mitigation. Infrastructure-layer DDoS protection is provided by Digital Ocean. We are evaluating CDN/DDoS protection services for enhanced protection.

**Q: Do you perform network segmentation?**
A: Application services run as separate processes with distinct ports and memory limits. Database access is restricted to application connection strings. Administrative SSH access is separate from application traffic.

**Q: How do you handle logging and monitoring?**
A: Application logs are written to structured JSON format with PII redaction. Caddy access logs are maintained with rotation (100MB files, 5 rotations, 720-hour retention). Audit logs capture all write operations and administrative actions. _(SIEM integration planned for Q3 2026.)_

**Q: Do you monitor for intrusion attempts?**
A: Rate limiting and audit logging capture suspicious activity patterns. We are implementing SIEM-based alerting for anomaly detection. _(Planned: Q3 2026.)_

### 7.6 AI-Specific Security (20 themes)

**Q: Which AI models do you use?**
A: AgentC2 supports OpenAI GPT-4o and Anthropic Claude models, configurable per agent. Models are accessed via provider APIs — no models are self-hosted or fine-tuned.

**Q: Is customer data used to train AI models?**
A: No. Both OpenAI and Anthropic explicitly commit that API data is not used for model training. This is documented in their terms of service and our DPAs.

**Q: How do you handle AI hallucinations/inaccurate outputs?**
A: AgentC2 provides: (1) RAG grounding to anchor responses in customer-provided knowledge; (2) Configurable guardrails for input/output filtering; (3) Human approval workflows for high-risk decisions; (4) Evaluation frameworks for measuring response quality; (5) AI transparency disclosures advising that AI outputs should not be solely relied upon for consequential decisions.

**Q: How do you prevent prompt injection?**
A: AgentC2 implements: (1) Input guardrails that filter malicious prompts; (2) Output guardrails that validate responses; (3) Tool permission controls limiting what agents can do; (4) Network egress policies restricting outbound requests; (5) Budget controls capping spend. Red-team testing for prompt injection is being added to our penetration testing scope.

**Q: How do you handle AI bias?**
A: AgentC2 is implementing a bias mitigation program including: diverse scenario testing, customer guidance for bias-aware configuration, periodic instruction review, and output monitoring for disparate impact. AI providers (OpenAI, Anthropic) also implement bias mitigations at the model level.

**Q: Do you have human-in-the-loop controls?**
A: Yes. AgentC2 provides configurable human approval workflows, allowing customers to require human approval before agents execute high-risk operations. Additionally, tool permissions can restrict agents to read-only access, and budget controls enforce spending limits.

**Q: How do you monitor AI agent behavior?**
A: All agent executions are logged with full observability traces. Guardrail events (blocked, modified, flagged) are tracked. Budget consumption is monitored per agent, organization, and user. Feedback collection enables customers to flag problematic outputs.

**Q: What is your AI governance framework?**
A: AgentC2's AI Governance Framework is aligned with the NIST AI Risk Management Framework (AI RMF 1.0) and addresses EU AI Act requirements. It covers: model inventory, risk assessment, bias mitigation, human oversight, prompt logging, transparency, and organizational governance.

**Q: How do you comply with the EU AI Act?**
A: AgentC2 is classified as a deployer of General Purpose AI Systems (GPAIS). We comply with deployer obligations under Art. 26 including: maintaining deployment logs, enabling human oversight, conducting DPIAs for AI processing, and providing transparency about AI-generated content. We provide customers with tools to meet their own high-risk obligations where applicable.

**Q: Do you have an AI acceptable use policy?**
A: Yes. Our AI Acceptable Use Policy prohibits: generating harmful content, impersonation, unauthorized surveillance, automated consequential decisions without human oversight, processing special category data without safeguards, and circumventing guardrails.

### 7.7 Incident Response (15 themes)

**Q: Do you have an incident response plan?**
A: Yes. AgentC2 maintains a formal Incident Response Plan covering: detection, classification (P1-P4), containment, eradication, recovery, and post-incident review. The plan is tested via tabletop exercises. _(Formal IRP and first tabletop exercise planned for Q2 2026.)_

**Q: How quickly would you notify us of a breach?**
A: Per our DPA, AgentC2 notifies affected customers within 48 hours of confirming a breach involving their data. Regulatory notifications follow within 72 hours per GDPR requirements.

**Q: Do you have a 24/7 security operations capability?**
A: Application monitoring runs 24/7 with automated alerting. Security incident response is handled by on-call personnel during business hours with escalation procedures for after-hours critical incidents. _(SOC capability to be evaluated as company scales.)_

**Q: How do you handle security vulnerability disclosures?**
A: We welcome responsible disclosure at security@agentc2.ai. Critical vulnerabilities are triaged within 24 hours. Remediation SLAs: Critical (7 days), High (30 days), Medium (90 days), Low (next release).

### 7.8 Compliance & Privacy (20 themes)

**Q: Do you have a SOC 2 report?**
A: SOC 2 Type I is in progress, targeted for Q4 2026. SOC 2 Type II is planned for Q2 2027. In the interim, we can provide our Security Overview, control documentation, and penetration test results.

**Q: Are you GDPR compliant?**
A: Yes. AgentC2 has implemented a comprehensive privacy program covering: Privacy Policy, Data Processing Addendum (DPA), Data Subject Request workflow, Records of Processing Activities (RoPA), Data Protection Impact Assessment (DPIA), breach notification procedures, and cross-border transfer mechanisms (Standard Contractual Clauses).

**Q: Are you HIPAA compliant?**
A: AgentC2 is not currently HIPAA-certified. If you require HIPAA compliance, we can discuss a Business Associate Agreement (BAA) and any necessary controls for your use case.

**Q: Are you PCI DSS compliant?**
A: AgentC2 does not directly process payment card data. Payment processing is handled by our payment provider. For PCI DSS scope, AgentC2 is out of scope.

**Q: Do you support GDPR data subject requests?**
A: Yes. We support: right of access (data export), right to rectification, right to erasure, right to data portability, right to restriction, and right to object. Requests can be submitted to privacy@agentc2.ai.

**Q: Where can I find your privacy policy?**
A: Our Privacy Policy is available at [agentc2.ai/privacy]. It covers data collection, use, sharing, retention, international transfers, and individual rights under GDPR, CCPA, and PIPEDA.

**Q: Do you have a Data Processing Addendum (DPA)?**
A: Yes. Our DPA is GDPR-compliant and covers: processing scope, security measures, sub-processor management, breach notification (48-hour SLA), international transfers (SCCs), audit rights, and data deletion. Available upon request.

**Q: How do you handle international data transfers?**
A: We rely on EU Standard Contractual Clauses (SCCs) for transfers from the EU/EEA/UK to the US. Transfer Impact Assessments document the supplementary measures in place (encryption, access controls, audit logging). For Canadian data, we ensure protections comparable to PIPEDA.

### 7.9 Business Continuity (15 themes)

**Q: What is your uptime target/SLA?**
A: AgentC2 targets 99.9% uptime. Formal SLAs are available in enterprise agreements. _(SLA documentation in development.)_

**Q: How do you handle backups?**
A: Database backups are automated via Supabase (daily with point-in-time recovery). Application code is stored in Git with full version history. Deployments include automated rollback to previous builds on failure.

**Q: What are your RTO/RPO targets?**
A: Target RTO: 4 hours. Target RPO: 1 hour. _(Formal RTO/RPO validation through DR testing planned for Q3 2026.)_

**Q: Do you test your disaster recovery plan?**
A: DR testing is scheduled for Q3 2026 and will be conducted annually thereafter. Application-level rollback is tested with every deployment.

**Q: Do you have geographic redundancy?**
A: Database hosting (Supabase/AWS) includes provider-managed redundancy. Application compute is currently single-region. Multi-region deployment is on the roadmap for enterprise tier.

---

_Document maintained by the AgentC2 Security & Compliance team. Updated as certifications and capabilities change._
