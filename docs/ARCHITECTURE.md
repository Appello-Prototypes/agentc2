# AgentC2 — Platform Architecture

**Version:** 1.0
**Date:** February 2026
**Classification:** Internal — Executive Technical Review

---

## Executive Summary

AgentC2 is a **multi-tenant AI agent platform** that enables businesses to build, deploy, and orchestrate intelligent agents that connect to 50+ enterprise tools, operate across voice and text channels, and automate complex business processes — all governed by enterprise-grade security, compliance, and cost controls.

The platform is built as a TypeScript monorepo, deployed on DigitalOcean, and designed for worldwide production at 99.9% uptime.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET                                    │
│    Web Browser  │  Slack  │  WhatsApp  │  Phone  │  API Client     │
└────────┬────────┴────┬────┴─────┬──────┴────┬────┴────┬────────────┘
         │             │          │           │         │
    ┌────▼─────────────▼──────────▼───────────▼─────────▼────┐
    │                  CLOUDFLARE CDN                          │
    │     DDoS Protection · Edge Caching · Brotli · WAF       │
    └────────────────────────┬────────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────────┐
    │                  CADDY REVERSE PROXY                     │
    │     Auto HTTPS · Routing · Security Headers · SSE       │
    │                                                          │
    │   /             → Agent App (3001)                       │
    │   /admin*       → Admin App (3003)                       │
    │   /docs, /terms → Frontend App (3000)                    │
    │   /embed/*      → Agent App (3001) [relaxed framing]     │
    │   /*            → Agent App (3001)                       │
    └───┬──────────────────┬───────────────────┬──────────────┘
        │                  │                   │
   ┌────▼────┐       ┌────▼────┐         ┌────▼────┐
   │ Frontend │       │  Agent  │         │  Admin  │
   │  App     │       │  App    │         │  App    │
   │ (3000)   │       │ (3001)  │         │ (3003)  │
   │ 2 inst.  │       │ 4 inst. │         │ 1 inst. │
   └────┬─────┘       └────┬────┘         └────┬────┘
        │                  │                    │
        └─────────┬────────┴────────────┬───────┘
                  │                     │
    ┌─────────────▼──────────┐   ┌─────▼───────────────┐
    │   @repo/agentc2        │   │  @repo/database      │
    │   Core Agent Framework │   │  Prisma ORM          │
    │   Tools · Workflows    │   │  100+ Models         │
    │   Networks · RAG       │   │                      │
    │   MCP · Channels       │   └─────┬───────────────┘
    │   Guardrails · Budget  │         │
    └─────────┬──────────────┘   ┌─────▼───────────────┐
              │                  │  PostgreSQL          │
              │                  │  (Supabase)          │
    ┌─────────▼──────────┐       │  PITR · HA · Pool   │
    │  50+ MCP Servers   │       └─────────────────────┘
    │  HubSpot · Jira    │
    │  Slack · GitHub     │       ┌─────────────────────┐
    │  Gmail · Drive      │       │  Upstash Redis      │
    │  Firecrawl · etc.   │       │  Rate Limiting      │
    └────────────────────┘       │  Circuit Breakers   │
                                  │  Session State      │
    ┌────────────────────┐       └─────────────────────┘
    │  AI Providers       │
    │  OpenAI · Anthropic │       ┌─────────────────────┐
    │  Google · Groq      │       │  Inngest            │
    │  DeepSeek · xAI     │       │  Background Jobs    │
    │  10+ providers      │       │  Learning · Cron    │
    └────────────────────┘       └─────────────────────┘
```

---

## 2. Technology Stack

### 2.1 Core Runtime

| Component    | Technology | Version | Purpose                                           |
| ------------ | ---------- | ------- | ------------------------------------------------- |
| Runtime      | Bun        | 1.3.4+  | Package management, script execution, test runner |
| Build System | Turborepo  | 2.3.3+  | Monorepo orchestration, build caching             |
| Framework    | Next.js    | 16.1    | Server-side rendering, API routes, App Router     |
| UI Library   | React      | 19.2    | Component rendering                               |
| Language     | TypeScript | 5.x     | Type safety across entire codebase                |

### 2.2 AI & Agent Stack

| Component       | Technology                  | Purpose                                              |
| --------------- | --------------------------- | ---------------------------------------------------- |
| Agent Framework | Mastra Core                 | Agent lifecycle, tool binding, streaming             |
| MCP Client      | @mastra/mcp                 | Model Context Protocol for external tool integration |
| Memory          | @mastra/memory              | Conversation history, semantic recall                |
| RAG             | @mastra/rag                 | Document ingestion, vector search, generation        |
| Evaluation      | @mastra/evals               | Automated quality scoring                            |
| Voice (TTS/STT) | ElevenLabs, OpenAI Realtime | Voice synthesis, real-time voice agents              |
| AI SDK          | Vercel AI SDK               | Streaming protocol, provider abstraction             |

### 2.3 Data Layer

| Component     | Technology               | Purpose                                            |
| ------------- | ------------------------ | -------------------------------------------------- |
| Database      | PostgreSQL (Supabase)    | Primary data store, 100+ models                    |
| ORM           | Prisma 6                 | Type-safe queries, migrations, schema management   |
| Vector Store  | pgvector (via Mastra PG) | Semantic search for RAG pipeline                   |
| Cache / State | Upstash Redis            | Rate limiting, circuit breakers, distributed state |

### 2.4 Infrastructure

| Component       | Technology            | Purpose                                         |
| --------------- | --------------------- | ----------------------------------------------- |
| Compute         | DigitalOcean Droplets | Application hosting (32GB/8vCPU)                |
| Reverse Proxy   | Caddy                 | HTTPS, routing, security headers, SSE streaming |
| Process Manager | PM2                   | Cluster mode, auto-restart, log management      |
| CDN             | Cloudflare            | Static asset caching, DDoS protection, WAF      |
| IaC             | Terraform             | Reproducible infrastructure provisioning        |
| CI/CD           | GitHub Actions        | Automated testing, deployment pipeline          |

### 2.5 Observability

| Component          | Technology               | Purpose                                             |
| ------------------ | ------------------------ | --------------------------------------------------- |
| Structured Logging | pino                     | JSON logs, field redaction, child loggers           |
| Error Tracking     | Sentry                   | Client + server error capture, stack traces, alerts |
| Metrics            | Prometheus (prom-client) | HTTP, agent, MCP, workflow counters/histograms      |
| Status Page        | Betterstack              | Public uptime monitoring, incident management       |
| Health Checks      | Custom endpoints         | Liveness, readiness, detailed subsystem status      |

### 2.6 Security & Compliance

| Component          | Technology             | Purpose                                               |
| ------------------ | ---------------------- | ----------------------------------------------------- |
| Authentication     | Better Auth            | Session-based auth, OAuth, API keys, organizations    |
| Rate Limiting      | Upstash Redis + custom | Per-endpoint, per-user, distributed                   |
| Encryption         | AES-256-GCM            | OAuth tokens, credentials at rest                     |
| Secrets Management | Doppler                | Secret storage, rotation, audit trail                 |
| Compliance         | Custom implementation  | GDPR erasure/export/consent, DSR tracking, audit logs |

---

## 3. Application Architecture

### 3.1 Monorepo Structure

```
agentc2/
├── apps/
│   ├── agent/          ← Primary app: Agent UI, APIs, webhooks (port 3001)
│   ├── frontend/       ← Marketing: Docs, blog, legal, auth (port 3000)
│   ├── admin/          ← Internal: Platform admin portal (port 3003)
│   ├── caddy/          ← Reverse proxy configuration
│   ├── inngest/        ← Background job dev server (port 8288)
│   └── ngrok/          ← Webhook tunnel for voice agents
│
├── packages/
│   ├── agentc2/        ← Core: Agents, tools, workflows, MCP, RAG, channels
│   ├── database/       ← Prisma schema and client (100+ models)
│   ├── auth/           ← Better Auth configuration
│   ├── ui/             ← Shared UI components (shadcn/ui, Tailwind 4)
│   ├── next-config/    ← Shared Next.js configuration, security headers
│   └── typescript-config/  ← Shared TypeScript configurations
│
├── infrastructure/
│   └── terraform/      ← IaC for DigitalOcean (Droplets, LB, firewall)
│
├── tests/
│   ├── unit/           ← Unit tests
│   ├── integration/    ← API integration tests
│   └── load/           ← k6 performance tests (baseline, spike, stress, soak)
│
├── docs/
│   ├── operations/     ← SLA targets, DR runbook, HA architecture
│   ├── compliance/     ← GDPR, SOC 2, data residency, accessibility
│   └── security/       ← Pen test scope, security policies
│
└── scripts/            ← Setup scripts (Cloudflare, Doppler, Betterstack)
```

### 3.2 Package Dependency Graph

```
apps/agent ──────┐
apps/frontend ───┤
apps/admin ──────┤
                 ├── @repo/agentc2 ──── @repo/database
                 ├── @repo/auth ─────── @repo/database
                 └── @repo/ui
```

All apps import shared packages. No app-to-app HTTP calls. Shared database, shared auth, shared business logic.

### 3.3 Multi-Tenancy Model

```
Organization (tenant boundary)
├── Workspace(s)
│   ├── Agents
│   │   ├── Tools (MCP + built-in)
│   │   ├── Schedules & Triggers
│   │   ├── Runs & Traces
│   │   └── Budget Policies
│   ├── Workflows
│   ├── Networks
│   ├── Skills & Documents (RAG)
│   └── Integration Connections (encrypted credentials)
├── Members (owner / admin / member roles)
├── Audit Logs
├── Cost Events
└── Guardrail Policies
```

Every database query is scoped to `organizationId`. A user in Org A cannot access Org B's data at any API endpoint.

---

## 4. Agent Execution Architecture

### 4.1 Request Flow

```
User Message
    │
    ▼
┌────────────────┐
│ Proxy Middleware│ ← Session validation, CSRF, X-Request-ID injection
└───────┬────────┘
        ▼
┌────────────────┐
│ Rate Limiter   │ ← Redis-backed, per-user per-endpoint limits
└───────┬────────┘
        ▼
┌────────────────┐
│ Auth Check     │ ← authenticateRequest() → userId, organizationId
└───────┬────────┘
        ▼
┌────────────────┐
│ Agent Resolver │ ← Load agent config from DB, attach tools, configure memory
└───────┬────────┘
        ▼
┌────────────────┐
│ Budget Check   │ ← Verify org/agent hasn't exceeded spending limit
└───────┬────────┘
        ▼
┌────────────────┐
│ Input Guardrail│ ← Prompt injection detection, content policy
└───────┬────────┘
        ▼
┌────────────────┐
│ Model Router   │ ← Classify complexity → select model tier
└───────┬────────┘
        ▼
┌────────────────┐
│ Mastra Agent   │ ← Generate response, invoke tools as needed
│                │
│  ┌──────────┐  │
│  │ MCP Tool │──┼──→ HubSpot / Jira / Slack / etc.
│  │  Call    │  │     (credentials decrypted per-org)
│  └──────────┘  │
└───────┬────────┘
        ▼
┌────────────────┐
│ Output Guardrail│ ← PII detection, content safety
└───────┬────────┘
        ▼
┌────────────────┐
│ Stream Response│ ← SSE via Caddy (flush_interval -1)
└───────┬────────┘
        ▼
┌────────────────┐
│ Post-Processing│ ← Cost recording, trace logging, metric increment
└────────────────┘
```

### 4.2 Model Provider Strategy

| Tier     | Models                                | When Used                       | Cost/1M tokens |
| -------- | ------------------------------------- | ------------------------------- | -------------- |
| Fast     | GPT-4o-mini, Gemini Flash, Groq Llama | Simple queries, classification  | $0.15-0.30     |
| Standard | GPT-4o, Claude 3.5 Sonnet             | General conversation, tool use  | $2.50-5.00     |
| Premium  | Claude 4 Opus, o3, GPT-4.1            | Complex reasoning, long context | $10-75         |

Model routing classifies each request and selects the cheapest model capable of handling it. Reduces AI costs by 40-60% compared to always using premium models.

### 4.3 MCP Integration Architecture

```
┌─────────────────────────────────────┐
│          Agent (Runtime)            │
│                                     │
│  "Search for open deals in HubSpot" │
│         │                           │
│         ▼                           │
│  ┌─────────────────┐               │
│  │  Tool Registry   │               │
│  │  (per-agent)     │               │
│  └────────┬────────┘               │
│           ▼                         │
│  ┌─────────────────┐               │
│  │  MCP Client      │               │
│  │  (per-org cache) │               │
│  └────────┬────────┘               │
└───────────┼─────────────────────────┘
            │
     ┌──────▼──────┐
     │ Decrypt Creds│ ← AES-256-GCM from IntegrationConnection
     └──────┬──────┘
            │
     ┌──────▼──────────────────┐
     │  MCP Server (HubSpot)   │
     │  hubspot-search-deals   │
     │  hubspot-get-contact    │
     │  hubspot-create-deal    │
     │  ...40+ tools           │
     └─────────────────────────┘
```

**50+ integration servers** across CRM, project management, communication, file storage, automation, payments, developer tools, and more.

Key architectural decisions:

- **Per-org client caching** (60s TTL) — avoids reconnection overhead
- **Error isolation** — one failing MCP server doesn't affect others
- **Stale fallback** — tool list cached for 10 minutes if server becomes unreachable
- **Circuit breaker** — 5 failures in 60s opens the circuit, rejecting calls for 30s

---

## 5. Data Architecture

### 5.1 Database Schema (100+ Models)

| Domain               | Model Count | Key Models                                           |
| -------------------- | ----------- | ---------------------------------------------------- |
| Auth & Multi-Tenancy | 11          | User, Organization, Workspace, Membership            |
| Agents               | 25+         | Agent, AgentTool, AgentRun, AgentTrace, AgentVersion |
| Workflows            | 7           | Workflow, WorkflowRun, WorkflowRunStep               |
| Networks             | 7           | Network, NetworkRun, NetworkRunStep                  |
| Integrations         | 5           | IntegrationProvider, IntegrationConnection           |
| Budget & Cost        | 7           | BudgetPolicy, CostEvent, AgentCostDaily              |
| Guardrails           | 3           | GuardrailPolicy, GuardrailEvent                      |
| Learning             | 8           | LearningSession, LearningSignal, LearningProposal    |
| Channels & Voice     | 4           | ChannelSession, VoiceCallLog                         |
| Communication        | 5           | EmailThread, ChatMessage, MeetingTranscript          |
| Compliance           | 3           | ConsentRecord, DataSubjectRequest, WebhookDeadLetter |
| BIM (Industry)       | 8           | BimModel, BimElement, BimTakeoff                     |
| Marketplace          | 5           | Playbook, PlaybookVersion, PlaybookPurchase          |
| Observability        | 10+         | AuditLog, AgentStatsDaily, AgentHealthScore          |

### 5.2 Data Flow

```
User Input → Agent Run → Turn(s) → Trace → TraceStep(s) → ToolCall(s)
                │                                              │
                ▼                                              ▼
          CostEvent                                    AuditLog entry
                │
                ▼
     AgentCostDaily (aggregated)
```

Every interaction produces a complete audit trail: what the user asked, what the agent decided, which tools it called, what each tool returned, how much it cost, and how long it took.

---

## 6. Deployment Architecture

### 6.1 Production Topology

```
┌──────────────────────────────────────────────────────┐
│                 Cloudflare CDN                        │
│            (DDoS · WAF · Edge Cache)                  │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│            DO Load Balancer                           │
│         (Health check: /api/health every 10s)         │
└──────────┬────────────────────────────┬──────────────┘
           │                            │
┌──────────▼──────────┐    ┌───────────▼──────────┐
│   Droplet 1 (Prod)  │    │   Droplet 2 (Prod)   │
│   32GB · 8vCPU      │    │   32GB · 8vCPU       │
│                     │    │                      │
│   Caddy (HTTPS)     │    │   Caddy (HTTPS)      │
│   PM2 Cluster:      │    │   PM2 Cluster:       │
│    agent ×4          │    │    agent ×4           │
│    frontend ×2       │    │    frontend ×2        │
│    admin ×1          │    │    admin ×1           │
└──────────┬──────────┘    └───────────┬──────────┘
           │                            │
           └──────────┬─────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   Supabase PostgreSQL      │
        │   (HA · PITR · PgBouncer)  │
        └────────────────────────────┘
```

### 6.2 CI/CD Pipeline

```
git push main
    │
    ▼
┌────────────────────────────────────┐
│  GitHub Actions: security-gates    │
│   1. Type check (bun run type-check)│
│   2. Lint (bun run lint)           │
│   3. Tests (bun run test)          │
│   4. Security scan (gitleaks)      │
└───────────────┬────────────────────┘
                │ All pass
                ▼
┌────────────────────────────────────┐
│  GitHub Actions: deploy-do         │
│   1. SSH to production server      │
│   2. git pull origin main          │
│   3. bun install                   │
│   4. bun run db:generate           │
│   5. bun run db:push               │
│   6. Backup current .next builds   │
│   7. Build (24GB heap, Turbo cache)│
│   8. pm2 reload (zero-downtime)    │
│   9. Health check verification     │
│  10. Slack notification            │
└────────────────────────────────────┘
```

### 6.3 Disaster Recovery

| Metric                         | Target                       |
| ------------------------------ | ---------------------------- |
| RTO (Recovery Time Objective)  | < 1 hour                     |
| RPO (Recovery Point Objective) | < 15 minutes                 |
| Uptime SLA                     | 99.9% (< 8.7h downtime/year) |

Recovery path: Terraform recreates infrastructure → Supabase PITR restores database → Deploy latest code → Verify health checks → Update DNS.

---

## 7. Security Architecture

### 7.1 Defense in Depth

```
Layer 1: Cloudflare      ← DDoS protection, WAF rules, bot management
Layer 2: Caddy           ← TLS 1.3, HSTS, CSP, X-Frame-Options
Layer 3: Rate Limiting   ← Per-endpoint, per-user, Redis-backed
Layer 4: Authentication  ← Better Auth sessions, API keys, OAuth
Layer 5: Authorization   ← Org isolation, role-based access, resource-level checks
Layer 6: Input Validation← Zod schemas on every API endpoint
Layer 7: Guardrails      ← AI-specific: prompt injection, PII detection
Layer 8: Encryption      ← AES-256-GCM for credentials, TLS for transit
Layer 9: Audit Logging   ← Every mutation logged with actor, before/after
Layer 10: Circuit Breakers← Graceful degradation on external failures
```

### 7.2 Credential Security

- OAuth tokens encrypted at rest with AES-256-GCM
- Encryption key stored in Doppler (not in .env on server)
- Per-organization RSA key pairs for federation signing
- API keys hashed before storage (bcrypt)
- Automatic secret redaction in all log output

---

## 8. Compliance Posture

| Framework         | Status          | Key Controls                                                                                       |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| **GDPR**          | Implemented     | Right to erasure, data portability, consent management, DSR tracking, data residency documentation |
| **CCPA**          | Implemented     | Right to delete, right to know, "Do Not Sell" link, notice at collection                           |
| **SOC 2 Type I**  | Ready for audit | Access controls, audit logging, encryption, change management, incident response                   |
| **WCAG 2.1 AA**   | Prep complete   | Accessibility audit documentation, axe-core integration plan                                       |
| **AI Governance** | Implemented     | Content watermarking, decision logging, model provenance, guardrails                               |

---

## 9. Observability Stack

```
┌─────────────────────────────────────────────┐
│              Application                     │
│                                              │
│  pino (structured JSON logs)                 │──→ Grafana Loki / Logtail
│  prom-client (Prometheus metrics)            │──→ Grafana / Prometheus
│  @sentry/nextjs (error tracking)             │──→ Sentry
│  X-Request-ID (request correlation)          │
│  Health endpoints (/api/health/*)            │──→ Betterstack Status Page
│                                              │
│  Key Metrics:                                │
│   • http_requests_total{route,method,status} │
│   • agent_runs_total{agent,status,source}    │
│   • mcp_tool_calls_total{server,tool,status} │
│   • active_sse_connections                   │
└─────────────────────────────────────────────┘
```

### Alert Escalation

| Severity | Condition                                    | Channel          | Response     |
| -------- | -------------------------------------------- | ---------------- | ------------ |
| SEV1     | App down, error rate > 5%, DB pool exhausted | Page (PagerDuty) | Immediate    |
| SEV2     | Error rate > 1%, P99 > 5s, MCP failure       | Slack #alerts    | 15 minutes   |
| SEV3     | Elevated errors, slow queries, rate limiting | Email digest     | Daily review |

---

## 10. Performance Characteristics

### 10.1 Capacity (per Droplet)

| Metric                     | Target                |
| -------------------------- | --------------------- |
| API latency (P50)          | < 200ms               |
| API latency (P95)          | < 1s                  |
| API latency (P99)          | < 3s                  |
| Chat time-to-first-token   | < 2s (P95)            |
| Concurrent SSE connections | 200+ per instance     |
| PM2 cluster instances      | Agent ×4, Frontend ×2 |

### 10.2 Load Testing

Four k6 scenarios validate performance:

| Scenario | Description               | Threshold                         |
| -------- | ------------------------- | --------------------------------- |
| Baseline | 10-25 VUs, normal traffic | P95 < 1s, errors < 1%             |
| Spike    | Sudden 10x (100 VUs)      | P95 < 3s, errors < 5%             |
| Stress   | Ramp to 500 VUs           | Find breaking point               |
| Soak     | 24h sustained load        | No memory leaks, no latency drift |

---

## 11. Cost Structure

### 11.1 Recurring Infrastructure

| Service                          | Monthly Cost     | Purpose                    |
| -------------------------------- | ---------------- | -------------------------- |
| DigitalOcean (2× Prod + Staging) | ~$288            | Compute                    |
| Supabase Pro                     | ~$25             | Database with HA and PITR  |
| Upstash Redis                    | ~$10-50          | Distributed state          |
| Cloudflare                       | Free-$20         | CDN and DDoS               |
| Sentry Team                      | ~$26             | Error tracking             |
| Betterstack                      | ~$20             | Status page and monitoring |
| Doppler Team                     | ~$18/user        | Secrets management         |
| **Total**                        | **~$400-450/mo** |                            |

### 11.2 One-Time Costs

| Item                      | Cost           | Timeline                |
| ------------------------- | -------------- | ----------------------- |
| Penetration test          | $5,000-20,000  | Before go-live          |
| SOC 2 Type I audit        | $15,000-50,000 | Before enterprise sales |
| Accessibility audit       | $3,000-10,000  | Before go-live          |
| Legal counsel (GDPR/CCPA) | $5,000-15,000  | Before go-live          |

---

## 12. Key Architectural Decisions

| Decision                           | Rationale                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Monorepo over microservices**    | Shared types, shared DB, simpler deployment. Microservices add network complexity without benefit at current scale. |
| **Caddy over Nginx**               | Automatic HTTPS, simpler config, built-in reverse proxy. Eliminates cert management entirely.                       |
| **PM2 cluster over Kubernetes**    | Right-sized for current scale. K8s adds operational complexity that isn't justified below ~20 instances.            |
| **Supabase over self-hosted PG**   | Managed backups, PITR, connection pooling, dashboard. Eliminates DBA toil.                                          |
| **Upstash over self-hosted Redis** | Serverless REST API, global replication, zero ops. Works from edge/serverless contexts.                             |
| **Better Auth over Clerk/Auth0**   | Self-hosted, no vendor lock-in, native organizations, lower cost at scale.                                          |
| **Mastra over LangChain**          | TypeScript-native, built-in MCP support, streaming, memory. Better DX for our stack.                                |
| **pino over Winston**              | 5-10x faster (async, non-blocking). Critical when logging every request in production.                              |

---

## 13. Scaling Path

### Current (Phase 1): Single-Region HA

2 Droplets + Load Balancer in NYC3. Handles 100-500 concurrent users.

### Near-Term (Phase 2): Multi-Region

Add EU Droplet for data residency compliance. Cloudflare DNS-based routing. EU Supabase project for EU org data.

### Future (Phase 3): Container Orchestration

When scale exceeds ~20 instances, migrate from PM2 to Kubernetes (DOKS). Terraform already defines infrastructure; adding K8s manifests is incremental.

---

_This document should be reviewed and updated quarterly as the platform evolves._
