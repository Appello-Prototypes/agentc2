# AgentC2 Security Hardening Analysis

**Date:** February 21, 2026
**Scope:** Full-stack security audit against the "agent as potential adversary" model described in the agentic web thesis. Code-level findings from actual codebase review.

---

## The Threat Model Shift

The video makes a critical point: **every serious security approach treats the agent as a potential adversary, not a trusted employee.** This is the right model. Our agents:

- Execute arbitrary tool calls based on LLM output (which can be manipulated)
- Access credentials for external services (which can be exfiltrated)
- Invoke other agents (which can escalate privileges)
- Read/write files (which can escape boundaries)
- Search the web (which can be redirected to adversarial content)
- Will soon have wallets and payment capabilities (which can be drained)

The security posture of "trusted agent with guardrails" must shift to "untrusted agent in a containment architecture." Every capability is simultaneously an attack surface.

---

## Critical Findings (Fix Immediately)

### CRIT-1: Cross-Tenant Data Leakage via RAG

**File:** `packages/agentc2/src/rag/pipeline.ts:204-208`

RAG queries only _warn_ when `organizationId` is missing — they don't enforce it:

```typescript
if (!organizationId) {
    console.warn("[queryRag] No organizationId -- results are unscoped (cross-tenant risk)");
}
```

**Impact:** Any code path that calls `queryRag()` without passing `organizationId` returns documents from ALL tenants. This is a data breach waiting to happen.

**Fix:** Throw an error if `organizationId` is missing in production. Add a required parameter or validate at the function boundary.

---

### CRIT-2: Agent Secret Exposure in Outputs

**Files:** `apps/agent/src/app/api/agents/[id]/invoke/route.ts`, tool outputs

Agent responses are returned directly to users without secret scanning:

```typescript
return NextResponse.json({
    success: true,
    output: responseText // Could contain API keys, credentials, env vars
});
```

A prompt injection attack could instruct the agent to reveal its system prompt, API keys from tool outputs, or credentials injected into sandbox environments.

**Impact:** API keys, OAuth tokens, and internal credentials could leak in agent responses.

**Fix:** Add output scanning for secret patterns (API key formats, token prefixes like `sk-`, `ghp_`, `xoxb-`, `pat-`) before returning any agent response. Block or redact matches.

---

### CRIT-3: Unsandboxed Code Execution Fallback

**File:** `packages/agentc2/src/tools/sandbox-tools.ts:521-538`

When Docker is unavailable, code execution falls back to `child_process` with host privileges:

- No memory/CPU limits
- No network isolation
- Full access to host filesystem (within workspace path)
- Controlled by `SANDBOX_ALLOW_UNSANDBOXED_FALLBACK` env var

**Impact:** If Docker goes down in production and fallback is enabled, agents execute arbitrary code with server-level privileges.

**Fix:** Disable unsandboxed fallback in production (`SANDBOX_ALLOW_UNSANDBOXED_FALLBACK=false`). Add a health check that alerts when Docker is unavailable. Fail closed — refuse code execution rather than run unsandboxed.

---

### CRIT-4: Budget Enforcement Race Condition

**Files:** `packages/agentc2/src/agents/resolver.ts:833-857`, `apps/agent/src/lib/run-recorder.ts:428-444`

Budget is checked _before_ execution but cost is recorded _after_:

```
Request 1: Check budget (OK, $8 remaining) → Execute → Record cost ($5)
Request 2: Check budget (OK, $8 remaining) → Execute → Record cost ($5)
// Total: $10 spent against $8 budget
```

**Impact:** Concurrent requests can exceed budget limits. For agents with payment capabilities, this becomes a financial risk.

**Fix:** Use database-level atomic budget checks with `UPDATE ... WHERE remaining >= cost` patterns, or add distributed locking (Redis SETNX) around budget checks.

---

## High Severity Findings

### HIGH-1: Agent-to-Agent Invocation Without Permission Checks

**File:** `packages/agentc2/src/tools/agent-operations-tools.ts:220-246`

The `agent-invoke-dynamic` tool lets any agent invoke any other agent:

- No permission checks on target agent
- No recursion depth limit
- Caller's budget not checked against invoked agent's costs
- No audit trail for cross-agent invocations

**Attack vector:** A low-privilege agent invokes a high-privilege agent (with access to financial tools, admin operations, etc.) to perform restricted actions. Or creates an infinite invocation loop to exhaust resources.

**Fix:**

- Add permission checks: target agent must allow invocation from caller
- Add recursion depth limit (max 3-5 levels)
- Track cumulative cost across invocation chains
- Log all cross-agent invocations in audit log

### HIGH-2: MCP Tool Execution Without Input Validation

**File:** `packages/agentc2/src/mcp/client.ts:4654-4772`

MCP tool parameters are passed directly to execution without schema validation:

```typescript
await (tool as any).execute({ context: parameters });
```

- No parameter validation against tool schema
- No output sanitization
- No execution timeout
- No audit logging

**Attack vector:** Malicious or manipulated parameters could exploit vulnerabilities in MCP servers (SQL injection in database tools, command injection in shell tools, path traversal in file tools).

**Fix:** Validate parameters against the tool's Zod schema before execution. Add execution timeouts. Log all MCP tool executions with parameters and results.

### HIGH-3: SSRF via DNS Rebinding in Web Fetch

**File:** `packages/agentc2/src/tools/web-fetch.ts`

Web fetch resolves DNS _then_ fetches, creating a TOCTOU gap:

1. DNS resolves to public IP (passes check)
2. Attacker DNS server returns private IP for the actual fetch
3. Fetch hits internal service

Additionally:

- `fetch()` follows redirects automatically — initial URL passes checks, redirect goes to internal endpoint
- IPv6 private ranges not fully covered
- No fetch timeout configured

**Fix:** Use a custom DNS resolver that pins IPs. Disable automatic redirect following and validate each redirect target. Add explicit fetch timeout (10s). Block all IPv6 unless explicitly needed.

### HIGH-4: No Tool Access Control (ACL)

**File:** `packages/agentc2/src/tools/registry.ts`

Any agent can use any tool attached to it. There's no permission model distinguishing between:

- Read-only tools (safe: `web-search`, `rag-query`)
- Write tools (dangerous: `agent-delete`, `workflow-delete`)
- Financial tools (critical: future wallet/payment tools)
- System tools (admin: `agent-create`, budget tools)

**Attack vector:** An agent with tools attached for convenience can use destructive tools if a prompt injection occurs.

**Fix:** Implement tool permission tiers:

- `read` — safe, no side effects
- `write` — modifies state, requires confirmation or elevated trust
- `financial` — involves money, requires human approval above thresholds
- `admin` — system-level, requires explicit admin grant

### HIGH-5: Single Encryption Key for All Credentials

**File:** `packages/agentc2/src/crypto/encryption.ts`

All OAuth tokens, API keys, and webhook secrets are encrypted with a single `CREDENTIAL_ENCRYPTION_KEY`. No key rotation mechanism exists. No key versioning.

**Impact:** Compromise of this one key exposes every credential for every tenant on the platform.

**Fix:**

- Implement key versioning (add version prefix to encrypted payloads)
- Add key rotation mechanism (re-encrypt with new key on access)
- Consider per-tenant encryption keys derived from master key via HKDF
- Move to a proper secrets manager (HashiCorp Vault, AWS Secrets Manager) for production

### HIGH-6: Webhook Routes Without Mandatory Signature Verification

**File:** `apps/agent/src/app/api/webhooks/[path]/route.ts:16-37`

Generic webhook endpoint makes signature verification optional — if `webhookSecret` is not configured, requests are accepted without authentication.

**Impact:** Unauthenticated webhook calls can trigger agent actions, inject data, or cause denial of service.

**Fix:** Fail closed — reject webhook calls when no secret is configured. Log and alert on unsigned webhook attempts.

---

## Medium Severity Findings

### MED-1: Incomplete Audit Logging

Many critical operations lack audit trails:

- Agent configuration updates (PUT `/api/agents/[id]`)
- Cost event creation
- Tool credential access and decryption
- MCP tool executions
- Cross-agent invocations
- Budget policy changes

Without complete audit logs, detecting and investigating breaches is severely limited.

**Fix:** Add audit logging to all write operations. Log credential access events. Add monitoring for audit log failures (currently silently caught).

### MED-2: Prompt Injection Detection is Regex-Only

**File:** `packages/agentc2/src/guardrails/index.ts:57-64`

Detection relies on pattern matching:

```typescript
/ignore\s+(all\s+)?previous\s+instructions/i
/disregard\s+(all\s+)?prior\s+instructions/i
```

Trivially bypassed with:

- Base64 encoding
- Unicode substitution
- Indirect phrasing ("What would happen if you ignored your instructions?")
- Multi-turn attacks (split injection across messages)
- Language mixing

Additionally, agents can disable guardrails via `bypassOrgGuardrails` config flag.

**Fix:**

- Add LLM-based injection classification (use a small, fast model as a classifier)
- Normalize inputs before checking (decode Base64, URL encoding, Unicode)
- Remove or restrict the bypass option to admin-only
- Add output guardrails to detect instruction leakage

### MED-3: No Rate Limiting on Auth Endpoints

**File:** `apps/agent/src/lib/rate-limit.ts`

Auth endpoints (`/api/auth/*`) have no rate limiting. Agent invocation routes have rate limiting defined in policy but inconsistently applied.

**Fix:** Add rate limiting to all auth endpoints (max 20 attempts per 15 minutes). Implement account lockout after repeated failures. Add CAPTCHA for web-based auth after 5 failures.

### MED-4: Symlink Traversal in File Operations

**File:** `packages/agentc2/src/tools/sandbox-tools.ts:121-152`

Path validation uses `resolve()` which follows symlinks. If a workspace contains a symlink pointing outside the workspace, `resolveWorkspacePath()` could allow access to arbitrary files.

**Fix:** Use `realpath()` to resolve symlinks before validating the path starts with the workspace prefix. Or disallow symlinks entirely in workspace directories.

### MED-5: Missing Security Headers

No `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, or `Strict-Transport-Security` headers are set.

**Fix:** Add security headers via Caddy config or Next.js middleware:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### MED-6: No MFA / Two-Factor Authentication

Better Auth is configured with email/password and OAuth but no TOTP/MFA support. Account takeover via credential stuffing or phishing gives full platform access.

**Fix:** Add TOTP-based MFA. Make it required for admin accounts. Better Auth supports 2FA plugins.

---

## Low Severity Findings

### LOW-1: Public Token Predictability

Public chat tokens are UUIDs — 128 bits of entropy is sufficient, but there's no rotation mechanism and no per-token rate limiting beyond IP-based limits.

### LOW-2: CORS Defaults

`ALLOWED_ORIGINS` defaults to empty, which may permit cross-origin requests if not explicitly configured.

### LOW-3: In-Memory Rate Limit Fallback

Rate limiting falls back to an in-memory Map when Redis is unavailable, which doesn't share state across instances.

### LOW-4: Legacy Plaintext Credential Support

`decryptJson()` returns unencrypted data as-is for backward compatibility, meaning some credentials may still be stored unencrypted.

---

## Hardening Roadmap

### Phase 1: Stop the Bleeding (This Week)

| #   | Finding                            | Fix                                                                 | Effort  |
| --- | ---------------------------------- | ------------------------------------------------------------------- | ------- |
| 1   | CRIT-1: RAG cross-tenant leakage   | Enforce `organizationId` in `queryRag()` — throw error if missing   | 1 hour  |
| 2   | CRIT-2: Secret exposure in outputs | Add output scanning for API key patterns before returning responses | 4 hours |
| 3   | CRIT-3: Unsandboxed fallback       | Set `SANDBOX_ALLOW_UNSANDBOXED_FALLBACK=false` in production env    | 10 min  |
| 4   | HIGH-6: Unsigned webhooks          | Fail closed when `webhookSecret` is not configured                  | 1 hour  |
| 5   | MED-5: Security headers            | Add headers via Caddy config                                        | 30 min  |

### Phase 2: Structural Hardening (This Month)

| #   | Finding                           | Fix                                                          | Effort   |
| --- | --------------------------------- | ------------------------------------------------------------ | -------- |
| 6   | CRIT-4: Budget race condition     | Add distributed locking (Redis) for budget checks            | 1-2 days |
| 7   | HIGH-1: Agent-to-agent invocation | Add permission checks, recursion limits, cost tracking       | 2-3 days |
| 8   | HIGH-2: MCP input validation      | Validate parameters against Zod schemas before execution     | 1-2 days |
| 9   | HIGH-3: SSRF protections          | Pin DNS, disable redirects, add timeouts                     | 1 day    |
| 10  | MED-1: Audit logging              | Add audit logs to all write operations and credential access | 2-3 days |
| 11  | MED-3: Auth rate limiting         | Add rate limits to auth endpoints, account lockout           | 1 day    |

### Phase 3: Defense in Depth (This Quarter)

| #   | Finding                  | Fix                                                          | Effort    |
| --- | ------------------------ | ------------------------------------------------------------ | --------- |
| 12  | HIGH-4: Tool ACLs        | Implement tool permission tiers (read/write/financial/admin) | 1-2 weeks |
| 13  | HIGH-5: Key rotation     | Add credential key versioning and rotation                   | 1 week    |
| 14  | MED-2: Prompt injection  | Add LLM-based classifier, normalize inputs                   | 1 week    |
| 15  | MED-4: Symlink traversal | Use `realpath()` in path validation                          | 2 hours   |
| 16  | MED-6: MFA               | Add TOTP support via Better Auth plugin                      | 2-3 days  |
| 17  | —                        | Formal agent threat model document                           | 2-3 days  |
| 18  | —                        | Penetration testing (external)                               | 1-2 weeks |

### Phase 4: Agent Economy Security (When Adding Wallets/Payments)

| #   | Capability                        | Security Requirement                                                             |
| --- | --------------------------------- | -------------------------------------------------------------------------------- |
| 19  | Agent wallets (Coinbase AgentKit) | Per-agent spending limits, human approval above thresholds, read-only by default |
| 20  | Autonomous transactions           | Transaction signing requires human approval for first N transactions             |
| 21  | Financial tool access             | Separate permission tier, explicit opt-in, full audit trail                      |
| 22  | x402 content payments             | Budget deduction before payment, cost attribution per content access             |
| 23  | Agent-earned revenue              | Separate holding account, withdrawal requires human approval                     |

---

## Security Architecture: Target State

```
                              ┌─────────────────────┐
                              │   Input Guardrails   │
                              │ • Injection detection │
                              │ • Input normalization │
                              │ • Secret scanning     │
                              └──────────┬────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │    Agent Execution     │
                              │ • Tenant-isolated      │
                              │ • Budget-enforced      │
                              │ • Audit-logged         │
                              └──────────┬────────────┘
                                         │
                    ┌────────────────────┼─────────────────────┐
                    │                    │                     │
         ┌──────────▼──────┐  ┌──────────▼──────┐  ┌──────────▼──────┐
         │   Tool ACL      │  │   MCP Sandbox   │  │  Code Sandbox   │
         │ • Permission    │  │ • Schema valid. │  │ • Docker only   │
         │   tiers         │  │ • Output scan   │  │ • Network off   │
         │ • Approval flow │  │ • Timeout       │  │ • CPU/mem limit │
         └──────────┬──────┘  └──────────┬──────┘  └──────────┬──────┘
                    │                    │                     │
                    └────────────────────┼─────────────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │  Output Guardrails    │
                              │ • Secret scanning     │
                              │ • Content filtering   │
                              │ • Instruction leakage │
                              └──────────┬────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │    Audit & Monitor    │
                              │ • Full action log     │
                              │ • Anomaly detection   │
                              │ • Cost attribution    │
                              └───────────────────────┘
```

---

## Key Principle: Defense in Depth for Agents

The video's IronClaw, OpenAI, and Coinbase examples all follow the same pattern:

1. **Assume compromise** — The agent will be manipulated. Build containment, not prevention.
2. **Isolate capabilities** — Each tool runs in its own sandbox. Credentials are scoped. Networks are restricted.
3. **Enforce budgets atomically** — Check-and-deduct in one operation. No TOCTOU gaps.
4. **Log everything** — Every tool call, every credential access, every cross-agent invocation. You can't investigate what you can't see.
5. **Human gates for irreversible actions** — Delete, pay, transfer, deploy — all require human approval until trust is established.

AgentC2 has strong foundations (budget controls, guardrails, sandbox tools, audit models). The gaps are in consistent enforcement and the shift from "trusted agent" to "contained agent" as the default posture.
