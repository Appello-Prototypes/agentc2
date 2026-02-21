# AgentC2 Agent Threat Model

## Overview

This document formalizes the threat model for the AgentC2 platform, treating agents as potentially adversarial actors rather than trusted extensions of their operators. As agents gain financial capabilities, autonomous decision-making, and cross-organization communication, the attack surface expands significantly.

## Threat Categories

### 1. Prompt Injection & Instruction Manipulation

**Threat:** An external agent, user, or data source injects instructions that cause an agent to deviate from its configured behavior.

**Attack Vectors:**

- Indirect prompt injection via web content fetched by `web-fetch` or search tools
- Cross-agent instruction injection via A2A protocol messages
- Malicious skill instructions injected through the skill marketplace
- RAG poisoning — embedding adversarial content into the knowledge base

**Mitigations:**

- Agent instructions include identity anchoring (slug, ID, name injected at resolution time)
- Guardrail policies (`GuardrailPolicy`, `OrgGuardrailPolicy`) evaluate inputs/outputs against configurable rules
- RAG documents are isolated per organization (`tenantId` on all vector embeddings)
- Skill marketplace will require review/approval before installation

---

### 2. Financial Exploitation

**Threat:** An agent is manipulated into initiating unauthorized financial transactions or exceeding spending limits.

**Attack Vectors:**

- Prompt injection causing agent to execute Stripe ACS or Coinbase tools
- Accumulated micro-transactions that individually pass per-action limits
- Approval bypass through social engineering of human approvers
- Agent self-escalation — agent convincing operators to increase its spending tier

**Mitigations:**

- **Spending tiers** (`BudgetPolicy.spendingTier`): `read_only`, `spend_with_approval`, `spend_autonomous`
- **Per-action limits** (`BudgetPolicy.maxPerActionUsd`): Hard cap on individual financial operations
- **Per-session limits** (`BudgetPolicy.maxPerSessionUsd`): Aggregate cap per run
- **Financial approval workflow** (reuses `ApprovalRequest`): Human-in-the-loop for all spend-tier actions
- **Financial audit trail** (reuses `AuditLog` with `financial.*` action types): Complete record of all financial tool invocations
- **Tool permission scoping** (`AgentToolPermission`): Per-agent overrides for financial tool access

---

### 3. Data Exfiltration

**Threat:** An agent accesses sensitive data and transmits it to unauthorized external endpoints.

**Attack Vectors:**

- Agent uses `web-fetch` or search tools to send data to attacker-controlled URLs
- Cross-tenant data access through multi-tenant isolation failures
- RAG queries returning documents from wrong organization
- MCP tool credentials leaking through agent responses

**Mitigations:**

- **Network egress controls** (`NetworkEgressPolicy`): Org-level domain allowlist/denylist
- **SSRF protection** in `web-fetch`: Private IP blocking, DNS rebinding protection, redirect validation
- **Tenant isolation**: All database queries include `tenantId`/`organizationId` filters
- **Credential encryption**: All API keys stored with AES-256-GCM encryption (`CREDENTIAL_ENCRYPTION_KEY`)
- **Tool access matrix** (`MCP_TOOL_ACCESS`): Role-based access control on all tools

---

### 4. Identity & Trust Exploitation

**Threat:** An agent impersonates another agent or organization, or a compromised agent builds undeserved trust.

**Attack Vectors:**

- Forged agent identity claims in A2A protocol
- Trust score manipulation through fabricated successful runs
- Reputation laundering — creating agents solely to build trust for later exploitation
- Key compromise enabling agent impersonation

**Mitigations:**

- **Agent identity** (`AgentIdentity`): Ed25519 cryptographic identity per agent
- **Signed actions**: `signAgentAction()` cryptographically signs agent operations
- **Reputation scoring** (`AgentReputation`): Based on actual run metrics, not self-reported
- **Graduated autonomy**: Trust score maps to spending permissions — new agents start supervised
- **Organization key pairs** (`OrganizationKeyPair`): Platform-level identity verification with key rotation

---

### 5. Skill Supply Chain Attacks

**Threat:** Malicious skills distributed through the marketplace compromise agents that install them.

**Attack Vectors:**

- Skill with hidden instructions that activate under specific conditions
- Skill that requests tools beyond its stated purpose
- Version update that introduces malicious behavior (trojan update)
- Dependency confusion — skill slug collision across workspaces

**Mitigations:**

- **Skill versioning** (`SkillVersion`): Complete version history with change tracking
- **Pinned versions** (`AgentSkill.pinnedVersion`): Lock agents to specific skill versions
- **Per-workspace slug uniqueness**: Skills are scoped to workspaces, preventing slug collision
- **Skill tool declarations** (`SkillTool`): Explicit tool requirements visible at attachment time
- **Version rollback**: UI controls to revert to previous known-good versions

---

### 6. Resource Exhaustion & Denial of Service

**Threat:** An agent consumes excessive compute, API calls, or storage, impacting platform availability.

**Attack Vectors:**

- Recursive agent invocations creating infinite loops
- Large-scale parallel search queries exhausting API quotas
- RAG ingestion of massive documents filling vector storage
- Token-intensive prompts designed to maximize cost

**Mitigations:**

- **Budget enforcement** (`BudgetEnforcementService`): Multi-level cascade (Subscription → Org → User → Agent)
- **Monthly budget limits** (`BudgetPolicy.monthlyLimitUsd`): Hard caps with alerting
- **Max steps per run** (`Agent.maxSteps`): Configurable limit on agent reasoning steps
- **Rate limiting** (`RATE_LIMIT_POLICIES`): Per-endpoint rate limits
- **Storage quotas** (`Organization.maxStorageBytes`): Per-org storage limits
- **Content truncation**: `web-fetch` maxLength (25K), search result limits

---

### 7. MCP Server Compromise

**Threat:** A malicious or compromised MCP server returns harmful tool outputs or captures sensitive inputs.

**Attack Vectors:**

- Man-in-the-middle on MCP SSE connections
- Compromised hosted MCP server (e.g., `mcp.stripe.com` substitute)
- MCP tool returning crafted output that causes prompt injection
- Credential theft via malicious MCP server

**Mitigations:**

- **HTTPS-only MCP connections**: All remote MCP servers use TLS
- **Credential isolation**: MCP credentials encrypted per-organization
- **Tool result truncation** (`truncateMcpResult`): Limits MCP response size
- **Organization-scoped MCP clients**: Each org gets its own MCP client instance

---

## Security Architecture Principles

1. **Defense in depth**: Multiple independent layers (budget, guardrails, permissions, egress, identity)
2. **Least privilege**: Agents start with `read_only` spending, `supervised` autonomy
3. **Audit everything**: Financial actions, tool invocations, approval decisions all logged
4. **Fail closed**: Missing policies default to most restrictive (deny by default)
5. **Cryptographic identity**: Agent actions are verifiable via Ed25519 signatures
6. **Tenant isolation**: Organization boundaries enforced at database, MCP, and API layers
7. **Human in the loop**: Critical actions (financial, destructive) require approval workflow

## Revision History

| Date       | Author       | Changes              |
| ---------- | ------------ | -------------------- |
| 2026-02-21 | AgentC2 Team | Initial threat model |
