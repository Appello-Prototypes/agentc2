# AgentC2 — Product Overview

**AI Workforce Command & Control**

---

## The Problem

Most AI agent frameworks stop at "it works in a notebook." Real businesses need agents that run 24/7, connect to live systems, operate across every channel, and do it all with the governance, auditability, and security that enterprise demands. The missing layer isn't intelligence — it's operations.

---

## What AgentC2 Is

AgentC2 is the **agent operations platform** — infrastructure for building, deploying, and operating AI agents at enterprise scale. Agents are deployed in seconds, connected to any tool via MCP, invoked like APIs, and governed with full observability and audit trails.

**Design. Deploy. Orchestrate. Scale.**

---

## Core Capabilities

### Agents That Actually Do Things

Database-driven agents resolved at runtime with configurable models (OpenAI, Anthropic), memory, tools, and instructions. No redeployment required. Agents don't just generate text — they act on live business systems through 16+ MCP connectors and 7 native OAuth integrations.

### Connectors That Work

| Category               | Integrations                                                |
| ---------------------- | ----------------------------------------------------------- |
| **CRM**                | HubSpot                                                     |
| **Project Management** | Jira, Linear, Asana, Notion                                 |
| **Communication**      | Slack, Microsoft Teams, Gmail, Outlook                      |
| **Productivity**       | Google Calendar, Google Drive, Dropbox, Microsoft Calendar  |
| **Knowledge**          | Fathom (meetings), GitHub, YouTube Transcripts              |
| **Automation**         | n8n (ATLAS), Firecrawl (web scraping), Playwright (browser) |
| **Voice & Telephony**  | Twilio, ElevenLabs, JustCall                                |

Every connector uses per-organization encrypted credentials (AES-256-GCM), automatic OAuth token refresh, and tenant-isolated MCP clients. One org's failure never affects another.

### Any Channel, One Platform

Agents operate natively across **Slack**, **Web Chat**, **Email** (Gmail + Outlook), **Voice** (Twilio + ElevenLabs), **WhatsApp**, and **Telegram**. Same agent, same memory, same tools — different channel. Channel bindings support trigger configuration, keyword routing, and per-channel access control.

### Multi-Agent Networks

Compose agents into networks with LLM-based routing. A routing agent delegates to the right primitive — agent, workflow, or tool — based on context. Mesh mode enables direct agent-to-agent communication via session scratchpads. Topology visualization included.

### Workflows with Human-in-the-Loop

Nine workflow step types: agent invocation, tool calls, nested workflows, conditional branching, parallel execution, foreach loops, human approval gates, data transforms, and delays. Workflows suspend mid-execution for human review and resume on approval.

---

## Built for Enterprise

### Governance

- **RBAC** — Owner, admin, member, viewer roles with tool-level permissions (read/write/spend)
- **Agent versioning** — Every change auto-creates a version snapshot; full rollback via API
- **Approval workflows** — Agents can require human approval before execution; Slack reactions trigger approve/reject
- **Financial spending policies** — Configurable autonomy tiers: read-only, spend-with-approval, spend-autonomous
- **107+ audit action types** — Every write operation attributed to an actor, scoped to a tenant, timestamped

### Observability

- **Execution traces** — Every run records input, output, duration, tokens, cost, model, source channel, and individual trace steps (LLM calls, tool calls, memory lookups, guardrail checks)
- **Health scores** — Composite daily score (0.0–1.0) from eval scores, feedback, tool success rates, improvement velocity
- **Health endpoints** — Liveness, readiness, and detailed subsystem probes
- **Admin dashboard** — Platform-wide metrics: MRR, costs, top tenants, failed runs, daily aggregates

### Security

- **Encryption** — AES-256-GCM at rest, TLS 1.2+ in transit, Ed25519 org key pairs with rotation
- **Rate limiting** — Redis-backed distributed limiting with per-endpoint policies
- **Security headers** — HSTS, CSP, X-Frame-Options via Caddy reverse proxy
- **CI/CD security gates** — Automated secret detection and dependency auditing

### Multi-Tenancy

Organization → Workspace → Agent hierarchy. Dev/staging/prod environments. Every query, tool call, and MCP connection is tenant-scoped. API key management, feature flags with per-tenant overrides, and pricing/subscription models built in.

---

## Self-Improving Agents

AgentC2's closed-loop learning system is what moves it from platform to operating system:

1. **Signal extraction** — Analyzes completed runs for low scores, tool failures, guardrail hits, latency spikes, and recurring patterns
2. **Proposal generation** — Creates concrete improvement proposals: instruction diffs, tool changes, memory config updates — each risk-tiered (low/medium/high)
3. **A/B testing** — Runs experiments between baseline and candidate versions with configurable traffic splits and real-traffic shadow testing
4. **Auto-promotion** — Low-risk, winning proposals auto-promote; high-risk changes require human approval

Backed by a two-tier evaluation system: fast heuristic pre-screening + AI auditor with custom scorecards, After Action Reviews, and calibration checks against human feedback.

---

## RAG & Memory

**RAG Pipeline** — Document ingestion with four chunking strategies, hybrid search (vector + full-text via Reciprocal Rank Fusion), optional LLM re-ranking, tenant-isolated indices, and source attribution.

**Memory** — Three layers: recent message history, working memory (persistent structured context with auto-consolidation), and semantic recall (vector search across older conversations). Thread-scoped and resource-scoped.

---

## Production Infrastructure

| Component              | Detail                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Runtime**            | Bun + Next.js 16, Turborepo monorepo                                                                                           |
| **Database**           | PostgreSQL (Supabase), Prisma 6 ORM                                                                                            |
| **Process Management** | PM2 cluster (7 processes, auto-restart, health checks)                                                                         |
| **Reverse Proxy**      | Caddy with Let's Encrypt, security headers, SSE streaming                                                                      |
| **CI/CD**              | GitHub Actions: type-check → lint → build → rollback safety → crash-loop detection → health verification → Slack notifications |
| **Background Jobs**    | Inngest event-driven processing                                                                                                |

---

## Why It Matters for Zerosone

AgentC2 is the infrastructure layer that AI consulting needs but doesn't exist yet. For Zerosone's clients:

- **Deploy agents in seconds** — not weeks of custom integration work
- **Connect to any system** — MCP-native means one protocol for every tool, not one-off integrations
- **Govern everything** — audit trails, approval flows, versioning, and RBAC satisfy enterprise compliance requirements out of the box
- **Operate across any channel** — Slack, email, voice, WhatsApp, web chat, Telegram — same agent, same governance
- **Agents that get better** — closed-loop learning means agents improve from their own runs, not just from manual tuning
- **Multi-tenant by default** — serve multiple clients from one platform with full isolation

AgentC2 isn't a framework to build on top of. It's the platform that's already built — so consulting engagements focus on strategy and agent design, not infrastructure.

---

**agentc2.ai**
