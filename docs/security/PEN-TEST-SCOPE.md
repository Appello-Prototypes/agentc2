# Penetration Test Scope Document

## Engagement Overview

**Application:** AgentC2 AI Agent Framework
**Type:** Full application penetration test
**Environment:** Staging (`staging.agentc2.ai`)
**Duration:** 2-3 weeks

## In Scope

### 1. Authentication & Session Management

- Login/signup flows (Better Auth)
- Session token generation and validation
- Session fixation / hijacking
- Password reset flow
- OAuth2 flows (Google, Microsoft, Dropbox)
- API key authentication
- Cross-app session sharing (Caddy proxy)

### 2. Authorization & Tenant Isolation

- Role-based access control (owner, admin, member)
- Organization isolation — verify user A cannot access org B data
- Workspace isolation within organizations
- Agent-level access controls
- API endpoint authorization audit (every route)
- Privilege escalation attempts

### 3. API Security

- SQL injection (Prisma ORM parameterized queries)
- NoSQL injection (JSON fields)
- Mass assignment / parameter tampering
- IDOR (Insecure Direct Object Reference) on all resource endpoints
- Rate limiting bypass attempts
- CSRF protection validation
- Input validation (Zod schemas)
- Response data leakage

### 4. AI-Specific Attack Vectors

- **Prompt injection:** Attempt to override agent system instructions via user messages
- **Data exfiltration via agent:** Attempt to extract sensitive data through agent tool calls
- **Tool abuse:** Attempt to invoke unauthorized tools or escalate tool permissions
- **MCP server exploitation:** Test MCP tool call boundaries and credential isolation
- **Agent persona hijacking:** Attempt to make agent reveal system prompts or internal state

### 5. File Upload Security

- Upload malicious files (polyglots, oversized files)
- Path traversal in file handling
- Server-side file processing vulnerabilities (PDF, images)

### 6. Webhook Security

- Signature verification bypass (Slack, ElevenLabs, Inngest)
- Replay attacks
- Payload injection

### 7. Infrastructure

- TLS configuration (Caddy, Cloudflare)
- Security headers validation
- Exposed services / ports
- Server hardening (SSH, firewall rules)
- PM2 process isolation

## Out of Scope

- Third-party services (Supabase, OpenAI, Anthropic, ElevenLabs) — test only our integration points
- Physical security
- Social engineering
- DDoS testing (coordinate separately with Cloudflare)

## Test Accounts

- Regular user account (member role)
- Admin user account (admin role)
- Owner user account (owner role)
- Public/unauthenticated access
- API key access

## Deliverables

1. Executive summary with risk rating
2. Detailed findings report with CVSS scores
3. Proof-of-concept for each finding
4. Remediation recommendations
5. Retest verification after fixes

## Recommended Firms

- **HackerOne** — Bug bounty platform with pentest services
- **Cobalt** — Pentest-as-a-service, fast turnaround
- **NCC Group** — Enterprise-grade, compliance-focused
- **Bishop Fox** — AI/ML security specialty

## Timeline

1. **Week 1:** Scoping call, account provisioning, reconnaissance
2. **Weeks 2-3:** Active testing
3. **Week 4:** Report delivery
4. **Weeks 5-6:** Remediation
5. **Week 7:** Retest of critical/high findings
