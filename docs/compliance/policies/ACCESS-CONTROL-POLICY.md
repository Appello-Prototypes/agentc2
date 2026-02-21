# Access Control Policy

**Document Classification:** INTERNAL  
**Policy ID:** ACP-001  
**Version:** 1.0  
**Effective Date:** [DATE]  
**Approved By:** [CEO/CTO NAME]  
**Document Owner:** CISO  
**Review Cadence:** Annually  
**Framework Reference:** SOC 2 CC6.1-6.3 / ISO 27001 A.5.15-5.18, A.8.1-8.5 / NIST CSF PR.AC

---

## 1. Purpose

This policy establishes requirements for controlling access to AgentC2 information systems, applications, and data to prevent unauthorized access and ensure accountability.

## 2. Scope

All information systems, applications, databases, infrastructure, and data owned or operated by AgentC2.

## 3. Principles

- **Least Privilege:** Users receive the minimum access necessary to perform their duties.
- **Separation of Duties:** Critical functions are divided among multiple individuals where feasible.
- **Need-to-Know:** Access to data is restricted to those with a business need.
- **Defense in Depth:** Multiple layers of access control are implemented.

## 4. Authentication

### 4.1 User Authentication

| Requirement           | Standard                                                 |
| --------------------- | -------------------------------------------------------- |
| Authentication method | Session-based authentication with secure cookies         |
| Password complexity   | Minimum 12 characters, mix of character types            |
| MFA                   | Required for all administrative and privileged access    |
| Session timeout       | 30-minute idle timeout; automatic session expiration     |
| Account lockout       | After 10 failed attempts, temporary lockout (15 minutes) |
| Cookie security       | HTTP-only, Secure, SameSite=Lax attributes               |

### 4.2 API Authentication

| Requirement           | Standard                                                  |
| --------------------- | --------------------------------------------------------- |
| Authentication method | API key (X-API-Key header) or session cookie              |
| Key storage           | AES-256-GCM encrypted at rest                             |
| Key rotation          | Administrators can rotate keys; recommend 90-day rotation |
| Key scope             | Scoped to organization                                    |

### 4.3 Infrastructure Authentication

| Requirement     | Standard                                             |
| --------------- | ---------------------------------------------------- |
| SSH access      | Key-based authentication only (no password auth)     |
| Database access | Connection strings restricted to application servers |
| Admin panels    | Session authentication with MFA                      |

## 5. Authorization

### 5.1 Role-Based Access Control

| Role       | Platform Permissions                                                               | Scope              |
| ---------- | ---------------------------------------------------------------------------------- | ------------------ |
| **Owner**  | Full organization control including billing, member management, settings, deletion | Organization-wide  |
| **Admin**  | Agent management, integration management, configuration, member invites            | Organization-wide  |
| **Member** | Agent usage, document upload, conversation access                                  | Assigned resources |
| **Viewer** | Read-only access to agents, conversations, and dashboards                          | Assigned resources |

### 5.2 Agent-Level Access Control

| Control                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| **Tool Permissions**   | Per-agent tool access: read_only, write, spend, full |
| **Budget Controls**    | Per-agent, per-org, per-user spending limits         |
| **Guardrail Policies** | Per-agent and organization-level content filtering   |
| **Egress Policies**    | Organization-level domain allowlist/denylist         |

## 6. Access Lifecycle

### 6.1 Provisioning

1. Access request submitted with business justification.
2. Approved by hiring manager (employee) or project lead (contractor).
3. Role assigned based on documented role requirements.
4. MFA enrolled before accessing any system.
5. Access documented in audit log.

### 6.2 Modification

1. Role changes require written approval from manager.
2. Previous role access revoked before new role access granted.
3. Change documented in audit log.

### 6.3 Revocation

1. Access revoked within 24 hours of:
    - Employment/contract termination
    - Role change that no longer requires access
    - Security incident involving the user
2. All active sessions terminated.
3. API keys associated with the user revoked.
4. OAuth tokens for personal integrations revoked.
5. Revocation documented in audit log.

## 7. Access Reviews

| Review Type               | Frequency     | Scope                                  | Reviewer          |
| ------------------------- | ------------- | -------------------------------------- | ----------------- |
| User access review        | Quarterly     | All user accounts and roles            | CISO + team leads |
| Privileged access review  | Quarterly     | Admin, Owner, infrastructure access    | CISO              |
| Service account review    | Semi-annually | API keys, service credentials          | CTO               |
| Third-party access review | Quarterly     | Vendor access, integration connections | CISO              |

### Review Process

1. Generate list of all users and their roles/permissions.
2. Each reviewer validates access is still required for each user.
3. Remove access for users who no longer require it.
4. Document review results and actions taken.
5. File evidence for SOC 2 audit.

## 8. Monitoring

- All authentication events are logged (login, logout, failed attempts).
- All authorization decisions are logged in the audit trail.
- Suspicious activity triggers alerts (excessive failed logins, unusual access patterns).
- Privileged operations are logged with enhanced detail.

---

**Approval:**

| Role    | Name | Signature | Date |
| ------- | ---- | --------- | ---- |
| CEO/CTO |      |           |      |
| CISO    |      |           |      |
