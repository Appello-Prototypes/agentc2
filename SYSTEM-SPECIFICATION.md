# Mastra AI Agent Framework - System Specification

**Version:** 1.0.0  
**Last Updated:** February 2026  
**Status:** Production-Ready

> **See also:** [Agent Platform Vision](./docs/agent-platform-vision.md) for the product narrative and strategic direction.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Database Schema](#4-database-schema)
5. [Agent Architecture](#5-agent-architecture)
6. [API Reference](#6-api-reference)
7. [Tool System](#7-tool-system)
8. [MCP Integration](#8-mcp-integration)
9. [Evaluation & Scoring](#9-evaluation--scoring)
10. [Background Jobs](#10-background-jobs)
11. [Observability](#11-observability)
12. [Voice Integration](#12-voice-integration)
13. [Channel Integrations](#13-channel-integrations)
14. [Workspace UI](#14-workspace-ui)
15. [Authentication](#15-authentication)
16. [Environment Variables](#16-environment-variables)
17. [Test Coverage](#17-test-coverage)
18. [Development Commands](#18-development-commands)
19. [Continuous Learning System](#19-continuous-learning-system)

---

## 1. System Overview

The **Mastra AI Agent Framework** is a production-grade Turborepo monorepo for building, deploying, and orchestrating AI agents. It provides:

- **Database-driven agent configuration** with version control and rollback
- **Multi-provider LLM support** (OpenAI, Anthropic, Google)
- **Voice-enabled agents** using ElevenLabs and OpenAI Realtime APIs
- **MCP (Model Context Protocol)** integrations for external tools
- **RAG pipeline** for document ingestion and semantic search
- **Background job processing** with Inngest
- **Comprehensive observability** with automatic tracing
- **Cost tracking and budget controls** per agent
- **Guardrail policies** for safety and content moderation
- **Multi-tenant architecture** with `tenantId` isolation

---

## 2. Technology Stack

### Core Framework

| Technology     | Version | Purpose                                |
| -------------- | ------- | -------------------------------------- |
| **Bun**        | 1.3.4+  | Package manager and JavaScript runtime |
| **Turborepo**  | 2.3.3+  | Monorepo build system                  |
| **Next.js**    | 16.1.0  | React framework with App Router        |
| **React**      | 19.2.3  | UI library                             |
| **TypeScript** | 5.x     | Type-safe JavaScript                   |

### AI & Agent Framework

| Package                    | Version | Purpose                                     |
| -------------------------- | ------- | ------------------------------------------- |
| `@mastra/core`             | latest  | Agent framework, workflows, orchestration   |
| `@mastra/mcp`              | ^1.0.0  | Model Context Protocol client               |
| `@mastra/memory`           | latest  | Conversation memory and semantic recall     |
| `@mastra/observability`    | latest  | Automatic tracing and metrics               |
| `@mastra/pg`               | latest  | PostgreSQL storage backend                  |
| `@mastra/rag`              | ^2.1.0  | Document ingestion, chunking, vector search |
| `@mastra/evals`            | ^1.0.1  | Agent evaluation and scoring                |
| `@mastra/voice-elevenlabs` | ^0.12.0 | ElevenLabs text-to-speech                   |
| `@mastra/voice-openai`     | ^0.12.0 | OpenAI Realtime API                         |
| `ai`                       | ^6.0.64 | Vercel AI SDK for streaming                 |
| `@ai-sdk/openai`           | ^3.0.23 | OpenAI provider                             |

### Database & ORM

| Technology     | Purpose                               |
| -------------- | ------------------------------------- |
| **PostgreSQL** | Primary database (via Supabase)       |
| **Prisma**     | ORM and schema management             |
| `pgvector`     | Vector embeddings for semantic search |

### UI Components

| Technology         | Purpose                             |
| ------------------ | ----------------------------------- |
| **shadcn/ui**      | Component library (base-nova style) |
| **Tailwind CSS 4** | Utility-first CSS                   |
| **HugeIcons**      | Icon library                        |
| **Storybook 8.6**  | Component documentation             |

### Background Jobs & Auth

| Technology      | Purpose                            |
| --------------- | ---------------------------------- |
| **Inngest**     | Event-driven background processing |
| **Better Auth** | Session-based authentication       |
| **Caddy**       | Reverse proxy for local HTTPS      |

---

## 3. Monorepo Structure

```
/
├── apps/
│   ├── agent/                    # AI Agent app (port 3001, basePath: /agent)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── api/agents/   # Agent REST API
│   │       │   ├── demos/        # Demo pages
│   │       │   └── workspace/    # Agent workspace UI
│   │       ├── components/       # React components
│   │       ├── hooks/            # Custom hooks
│   │       └── lib/              # Utilities, Inngest
│   ├── frontend/                 # Main app (port 3000)
│   ├── caddy/                    # Reverse proxy config
│   └── ngrok/                    # Webhook tunneling
│
├── packages/
│   ├── auth/                     # Better Auth configuration
│   ├── database/                 # Prisma schema and client
│   │   └── prisma/
│   │       ├── schema.prisma     # Database schema (880 lines)
│   │       └── seed-agents.ts    # Agent seeding
│   ├── mastra/                   # Core AI package
│   │   └── src/
│   │       ├── agents/           # Agent definitions & resolver
│   │       ├── channels/         # WhatsApp, Telegram, Voice
│   │       ├── mcp/              # MCP client configuration
│   │       ├── orchestrator/     # Goal-based orchestration
│   │       ├── rag/              # RAG pipeline
│   │       ├── scorers/          # Evaluation scorers
│   │       ├── tools/            # Tool registry
│   │       └── workflows/        # Mastra workflows
│   ├── ui/                       # Shared UI components
│   ├── next-config/              # Shared Next.js config
│   └── typescript-config/        # Shared TypeScript configs
│
├── tests/
│   ├── e2e/                      # End-to-end tests
│   ├── integration/              # API and Inngest tests
│   ├── unit/                     # Unit tests
│   ├── fixtures/                 # Test data fixtures
│   └── utils/                    # Test utilities
│
├── docs/                         # Documentation
├── scripts/                      # Development scripts
└── vitest.config.ts              # Test configuration
```

---

## 4. Database Schema

### Enums

```prisma
enum AgentType { SYSTEM, USER }
enum RunStatus { QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED }
enum RunType { TEST, PROD, AB }
enum AlertSeverity { INFO, WARNING, CRITICAL }
enum AlertSource { COST, GUARDRAIL, EVAL, SYSTEM }
enum GuardrailEventType { BLOCKED, MODIFIED, FLAGGED }
```

### Core Models

#### Agent Configuration

| Model          | Purpose           | Key Fields                                                                                                                                                                                                                                                        |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Agent`        | Main agent config | `id`, `slug`, `name`, `instructions`, `instructionsTemplate`, `modelProvider`, `modelName`, `temperature`, `maxTokens`, `modelConfig`, `memoryEnabled`, `memoryConfig`, `maxSteps`, `scorers[]`, `type`, `tenantId`, `ownerId`, `isPublic`, `isActive`, `version` |
| `AgentTool`    | Junction table    | `agentId`, `toolId`, `config`                                                                                                                                                                                                                                     |
| `AgentVersion` | Version history   | `agentId`, `version`, `description`, `instructions`, `modelProvider`, `modelName`, `changesJson`, `snapshot`, `createdBy`                                                                                                                                         |

#### Execution Tracking

| Model            | Purpose           | Key Fields                                                                                                                                                                                   |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AgentRun`       | Execution history | `agentId`, `tenantId`, `runType`, `status`, `inputText`, `outputText`, `durationMs`, `modelProvider`, `modelName`, `promptTokens`, `completionTokens`, `totalTokens`, `costUsd`, `versionId` |
| `AgentTrace`     | Detailed trace    | `runId`, `agentId`, `status`, `stepsJson`, `modelJson`, `tokensJson`, `scoresJson`                                                                                                           |
| `AgentTraceStep` | Individual steps  | `traceId`, `stepNumber`, `type`, `content`, `durationMs`                                                                                                                                     |
| `AgentToolCall`  | Tool call records | `runId`, `traceId`, `toolKey`, `mcpServerId`, `inputJson`, `outputJson`, `success`, `error`, `durationMs`                                                                                    |

#### Evaluation & Feedback

| Model             | Purpose           | Key Fields                                                                          |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `AgentEvaluation` | Scores per run    | `runId`, `agentId`, `scoresJson`, `scorerVersion`                                   |
| `AgentFeedback`   | User feedback     | `runId`, `agentId`, `thumbs`, `rating`, `comment`                                   |
| `AgentTestCase`   | Stored test cases | `agentId`, `name`, `inputText`, `expectedOutput`, `tags[]`                          |
| `AgentTestRun`    | Test results      | `testCaseId`, `agentId`, `versionId`, `outputText`, `passed`, `score`, `durationMs` |

#### Cost & Budget

| Model                 | Purpose          | Key Fields                                                                                 |
| --------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `BudgetPolicy`        | Per-agent limits | `agentId`, `enabled`, `monthlyLimitUsd`, `alertAtPct`, `hardLimit`                         |
| `CostEvent`           | Token tracking   | `runId`, `agentId`, `provider`, `modelName`, `promptTokens`, `completionTokens`, `costUsd` |
| `AgentCostDaily`      | Daily rollups    | `agentId`, `date`, `totalCostUsd`, `promptCostUsd`, `completionCostUsd`, `runs`            |
| `AgentModelCostDaily` | By model         | `agentId`, `modelName`, `date`, `costUsd`, `tokens`, `runs`                                |
| `CostRecommendation`  | Savings tips     | `agentId`, `type`, `title`, `description`, `estimatedSavingsUsd`                           |

#### Guardrails

| Model             | Purpose          | Key Fields                                                                            |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------- |
| `GuardrailPolicy` | Safety config    | `agentId`, `configJson`, `version`, `createdBy`                                       |
| `GuardrailEvent`  | Triggered events | `agentId`, `runId`, `type`, `guardrailKey`, `reason`, `inputSnippet`, `outputSnippet` |

#### Analytics Rollups

| Model                         | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `AgentStatsDaily`             | Daily KPIs (runs, successRate, avgDuration, avgQuality, cost) |
| `AgentMetricDaily`            | Performance metrics                                           |
| `AgentToolMetricDaily`        | Tool usage stats                                              |
| `AgentModelMetricDaily`       | Model comparison                                              |
| `AgentQualityMetricDaily`     | Quality scores by scorer                                      |
| `AgentFeedbackAggregateDaily` | Feedback summaries                                            |
| `AgentVersionStats`           | Per-version performance                                       |
| `EvaluationTheme`             | Feedback theme extraction                                     |
| `Insight`                     | AI-generated insights                                         |

#### Alerts & Audit

| Model        | Purpose          | Key Fields                                                            |
| ------------ | ---------------- | --------------------------------------------------------------------- |
| `AgentAlert` | System alerts    | `agentId`, `severity`, `message`, `source`, `resolvedAt`              |
| `AuditLog`   | Write operations | `tenantId`, `actorId`, `action`, `entityType`, `entityId`, `metadata` |

#### Channel System

| Model                | Purpose                           |
| -------------------- | --------------------------------- |
| `ChannelSession`     | Conversation tracking per channel |
| `ChannelCredentials` | Encrypted channel credentials     |
| `VoiceCallLog`       | Voice call history                |
| `VoiceAgentTrace`    | Voice agent traces                |
| `AgentConversation`  | Multi-turn persistence            |

### Index Strategy

All models include:

- Primary key index (automatic)
- `tenantId` index for tenant isolation
- `agentId` index for agent-scoped queries
- `createdAt` index for time-range filtering
- Composite indexes for common patterns (e.g., `[agentId, createdAt]`)

---

## 5. Agent Architecture

### Agent Resolver

The `AgentResolver` class (`packages/mastra/src/agents/resolver.ts`) provides database-first agent resolution:

```typescript
interface ResolveOptions {
    slug?: string;
    id?: string;
    requestContext?: RequestContext;
    fallbackToSystem?: boolean;
}

interface HydratedAgent {
    agent: Agent; // Mastra Agent instance
    record: AgentRecord; // Database record
    source: "database" | "fallback";
}
```

**Resolution Flow:**

1. Query database by `slug` or `id` (with `isActive: true`)
2. If found, hydrate with tools, memory, and scorers
3. Fallback to code-defined agents in Mastra instance
4. Return `HydratedAgent` with source metadata

### RequestContext

```typescript
interface RequestContext {
    resource?: {
        userId?: string;
        userName?: string;
        tenantId?: string;
    };
    thread?: {
        id?: string;
        sessionId?: string;
    };
    metadata?: Record<string, unknown>;
}
```

Used for:

- Dynamic instruction interpolation (`{{userId}}`, `{{resource.tenantId}}`)
- Memory thread isolation
- Audit trails

### Memory Configuration

```typescript
interface MemoryConfig {
    lastMessages?: number; // Sliding window (default: 10)
    semanticRecall?:
        | {
              topK?: number; // Results to return (default: 5)
              messageRange?: number; // Messages to search (default: 100)
          }
        | false;
    workingMemory?: {
        enabled?: boolean;
        template?: string; // Markdown template
    };
}
```

### Code-Defined Agents

Registered in `packages/mastra/src/mastra.ts`:

| Agent                    | Purpose                      |
| ------------------------ | ---------------------------- |
| `assistant`              | General-purpose assistant    |
| `structured`             | Structured output generation |
| `vision`                 | Image analysis               |
| `research`               | Multi-step research          |
| `evaluated`              | With evaluation scorers      |
| `openai-voice-agent`     | OpenAI Realtime voice        |
| `elevenlabs-voice-agent` | ElevenLabs voice             |
| `hybrid-voice-agent`     | Combined voice               |

### Trip Planner Agents (Database-Driven)

| Agent                 | Responsibility           |
| --------------------- | ------------------------ |
| `destination-agent`   | Destination research     |
| `accommodation-agent` | Hotel/lodging search     |
| `activities-agent`    | Activity recommendations |
| `transport-agent`     | Flight/transport booking |
| `routing-agent`       | Route optimization       |
| `itinerary-agent`     | Itinerary assembly       |
| `budget-agent`        | Budget analysis          |

---

## 6. API Reference

### Base URL

```
/api/agents
```

### Endpoints

#### Agent CRUD

| Method   | Endpoint          | Description                |
| -------- | ----------------- | -------------------------- |
| `GET`    | `/agents`         | List all agents            |
| `POST`   | `/agents`         | Create agent               |
| `GET`    | `/agents/[id]`    | Get agent by ID or slug    |
| `PUT`    | `/agents/[id]`    | Update agent               |
| `DELETE` | `/agents/[id]`    | Delete agent               |
| `POST`   | `/agents/resolve` | Resolve agent with context |

#### Tools & Scorers

| Method | Endpoint          | Description            |
| ------ | ----------------- | ---------------------- |
| `GET`  | `/agents/tools`   | List available tools   |
| `GET`  | `/agents/scorers` | List available scorers |

#### Overview & Stats

| Method | Endpoint                 | Description     |
| ------ | ------------------------ | --------------- |
| `GET`  | `/agents/[id]/overview`  | Dashboard stats |
| `GET`  | `/agents/[id]/analytics` | Analytics data  |

#### Runs

| Method | Endpoint                           | Description            |
| ------ | ---------------------------------- | ---------------------- |
| `GET`  | `/agents/[id]/runs`                | List runs with filters |
| `POST` | `/agents/[id]/runs`                | Create new run         |
| `GET`  | `/agents/[id]/runs/[runId]`        | Get run details        |
| `POST` | `/agents/[id]/runs/[runId]/cancel` | Cancel running         |
| `POST` | `/agents/[id]/runs/[runId]/rerun`  | Re-execute run         |
| `GET`  | `/agents/[id]/runs/[runId]/trace`  | Get execution trace    |

#### Streaming

| Method | Endpoint              | Description           |
| ------ | --------------------- | --------------------- |
| `POST` | `/agents/[id]/stream` | Stream agent response |
| `POST` | `/agents/[id]/chat`   | Chat with memory      |

#### Versions

| Method | Endpoint                                   | Description             |
| ------ | ------------------------------------------ | ----------------------- |
| `GET`  | `/agents/[id]/versions`                    | List version history    |
| `POST` | `/agents/[id]/versions`                    | Create version snapshot |
| `POST` | `/agents/[id]/versions/[version]/rollback` | Rollback to version     |

#### Evaluations & Feedback

| Method | Endpoint                   | Description      |
| ------ | -------------------------- | ---------------- |
| `GET`  | `/agents/[id]/evaluations` | List evaluations |
| `GET`  | `/agents/[id]/feedback`    | List feedback    |

#### Costs & Budget

| Method | Endpoint              | Description          |
| ------ | --------------------- | -------------------- |
| `GET`  | `/agents/[id]/costs`  | Cost summary         |
| `GET`  | `/agents/[id]/budget` | Get budget policy    |
| `PUT`  | `/agents/[id]/budget` | Update budget policy |

#### Guardrails

| Method | Endpoint                         | Description             |
| ------ | -------------------------------- | ----------------------- |
| `GET`  | `/agents/[id]/guardrails`        | Get guardrail config    |
| `PUT`  | `/agents/[id]/guardrails`        | Update guardrail config |
| `GET`  | `/agents/[id]/guardrails/events` | List guardrail events   |

#### Test Cases

| Method | Endpoint                  | Description      |
| ------ | ------------------------- | ---------------- |
| `GET`  | `/agents/[id]/test-cases` | List test cases  |
| `POST` | `/agents/[id]/test-cases` | Create test case |
| `POST` | `/agents/[id]/test`       | Execute test     |

---

## 7. Tool System

### Static Tool Registry

Located in `packages/mastra/src/tools/registry.ts`:

| Tool ID         | Description               |
| --------------- | ------------------------- |
| `date-time`     | Current date/time         |
| `calculator`    | Mathematical calculations |
| `generate-id`   | UUID generation           |
| `web-fetch`     | HTTP requests             |
| `memory-recall` | Semantic memory search    |
| `json-parser`   | JSON parsing/validation   |

### Trip Planner Tools

| Tool             | Purpose               |
| ---------------- | --------------------- |
| `flight-search`  | Search flights        |
| `hotel-search`   | Search accommodations |
| `weather-lookup` | Get weather data      |
| `trip-notes`     | Store/retrieve notes  |

### Tool Resolution

```typescript
// Sync - static tools only
const tools = getToolsByNames(["calculator", "web-fetch"]);

// Async - includes MCP tools
const tools = await getToolsByNamesAsync(["calculator", "hubspot_hubspot-get-contacts"]);
```

---

## 8. MCP Integration

### Configured Servers

| Server ID    | Category      | Description               | Auth Required |
| ------------ | ------------- | ------------------------- | ------------- |
| `playwright` | Web           | Browser automation        | No            |
| `firecrawl`  | Web           | Web scraping              | Yes           |
| `hubspot`    | CRM           | Contacts, deals, pipeline | Yes           |
| `jira`       | Productivity  | Issues, sprints           | Yes           |
| `justcall`   | Communication | Calls, SMS                | Yes           |
| `atlas`      | Automation    | n8n workflows             | Yes           |

### Usage

```typescript
import { mcpClient, executeMcpTool, listMcpToolDefinitions } from "@repo/mastra";

// List available tools
const definitions = await listMcpToolDefinitions();

// Execute a tool
const result = await executeMcpTool("hubspot_hubspot-get-contacts", {
    limit: 10
});
```

### Tool Naming Convention

```
serverName_toolName
```

Examples:

- `hubspot_hubspot-get-contacts`
- `jira_create-issue`
- `playwright_navigate`

### Caching

MCP tools are cached for 1 minute. Invalidate with:

```typescript
await mcpClient.listTools(); // Force refresh
```

---

## 9. Evaluation & Scoring

### Available Scorers

| Scorer ID      | Name             | Description                          | Scale               |
| -------------- | ---------------- | ------------------------------------ | ------------------- |
| `relevancy`    | Answer Relevancy | How well responses address the query | 0-1 (higher better) |
| `toxicity`     | Toxicity         | Harmful content detection            | 0-1 (lower better)  |
| `completeness` | Completeness     | Information coverage                 | 0-1 (higher better) |
| `tone`         | Tone Consistency | Style/formality consistency          | 0-1 (higher better) |

### Scorer Configuration

Per-agent, stored in `Agent.scorers[]`:

```typescript
const scorers = getScorersByNames(["relevancy", "toxicity"]);
// Returns: { relevancy: { scorer, sampling: { type: "ratio", rate: 1.0 }}}
```

### Evaluation Storage

- **Raw scores**: Stored in `AgentEvaluation.scoresJson`
- **Aggregates**: Computed on-demand via API

---

## 10. Background Jobs

### Inngest Functions

| Function ID            | Trigger Event          | Purpose                     |
| ---------------------- | ---------------------- | --------------------------- |
| `execute-goal`         | `goal/submitted`       | Goal-based orchestration    |
| `retry-goal`           | `goal/retry`           | Retry failed goals          |
| `run-completed`        | `run/completed`        | Cost tracking, budget check |
| `evaluation-completed` | `evaluation/completed` | Metrics update              |
| `guardrail-event`      | `guardrail/event`      | Event recording, alerts     |
| `budget-check`         | `budget/check`         | Threshold monitoring        |

### Run Completed Flow

1. **create-cost-event**: Record token usage
2. **check-budget**: Compare against policy, create alerts

### Events

```typescript
import { inngest } from "@/lib/inngest";

await inngest.send({
    name: "run/completed",
    data: { runId, agentId, costUsd }
});
```

---

## 11. Observability

### Configuration

```typescript
const observability = new Observability({
    configs: {
        default: {
            serviceName: "mastra-agent-workspace",
            sampling: { type: SamplingStrategyType.ALWAYS },
            exporters: [new DefaultExporter()],
            spanOutputProcessors: [
                new SensitiveDataFilter({
                    sensitiveFields: [
                        "password",
                        "apiKey",
                        "token",
                        "secret",
                        "authorization",
                        "api_key",
                        "access_token"
                    ]
                })
            ]
        }
    }
});
```

### Trace Storage

Traces automatically stored to PostgreSQL via `@mastra/pg`.

### Sampling

100% sampling in current configuration. Adjust for production:

```typescript
sampling: {
    type: SamplingStrategyType.RATIO,
    rate: 0.1 // 10% sampling
}
```

---

## 12. Voice Integration

### Providers

| Provider        | Package                    | Use Case                        |
| --------------- | -------------------------- | ------------------------------- |
| ElevenLabs      | `@mastra/voice-elevenlabs` | High-quality TTS, voice cloning |
| OpenAI Realtime | `@mastra/voice-openai`     | Low-latency bidirectional       |

### Voice Agents

```typescript
// Conditionally registered based on API keys
if (process.env.OPENAI_API_KEY) {
    agents["openai-voice-agent"] = openaiVoiceAgent;
}
if (process.env.ELEVENLABS_API_KEY) {
    agents["elevenlabs-voice-agent"] = elevenlabsVoiceAgent;
}
```

### ElevenLabs Live Agent

Webhook tools exposed at:

```
/api/demos/live-agent-mcp/tools
```

Requires ngrok for stable URL:

```bash
./scripts/start-ngrok.sh
```

---

## 13. Channel Integrations

### Supported Channels

| Channel        | Client                    | Status    |
| -------------- | ------------------------- | --------- |
| WhatsApp       | `@whiskeysockets/baileys` | Available |
| Telegram       | `grammy`                  | Available |
| Voice (Twilio) | `twilio`                  | Available |

### Channel Session

Each channel maintains sessions in `ChannelSession`:

```typescript
interface ChannelSession {
    channel: "whatsapp" | "telegram" | "voice";
    channelId: string; // Phone/chat ID
    agentSlug: string; // Handling agent
    metadata: object;
}
```

### Routing

Channel router in `packages/mastra/src/channels/routing.ts` maps incoming messages to agents.

---

## 14. Workspace UI

### Pages

| Route                                | Purpose                       |
| ------------------------------------ | ----------------------------- |
| `/workspace`                         | Agent grid with search/filter |
| `/workspace/[agentSlug]`             | Redirect to overview          |
| `/workspace/[agentSlug]/overview`    | Dashboard, KPIs, alerts       |
| `/workspace/[agentSlug]/configure`   | Edit agent settings           |
| `/workspace/[agentSlug]/test`        | Interactive testing           |
| `/workspace/[agentSlug]/runs`        | Execution history             |
| `/workspace/[agentSlug]/analytics`   | Performance metrics           |
| `/workspace/[agentSlug]/traces`      | Debugging traces              |
| `/workspace/[agentSlug]/evaluations` | Quality scores                |
| `/workspace/[agentSlug]/costs`       | Budget controls               |
| `/workspace/[agentSlug]/versions`    | Version history               |
| `/workspace/[agentSlug]/guardrails`  | Safety controls               |

### Layout

Shared layout at `/workspace/[agentSlug]/layout.tsx` provides:

- Agent header with status
- Navigation sidebar
- Not found handling

---

## 15. Authentication

### Better Auth

Session-based authentication with:

- Email/password
- OAuth providers (configurable)
- Cross-app cookie sharing via Caddy

### Models

| Model          | Purpose            |
| -------------- | ------------------ |
| `User`         | User accounts      |
| `Session`      | Active sessions    |
| `Account`      | OAuth connections  |
| `Verification` | Email verification |

### Session Access

```typescript
import { auth } from "@repo/auth";

const session = await auth.api.getSession({
    headers: request.headers
});
```

---

## 16. Environment Variables

### Required

```bash
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXT_PUBLIC_APP_URL="https://catalyst.localhost"
BETTER_AUTH_SECRET="..."

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

### Optional - Voice

```bash
ELEVENLABS_API_KEY="..."
ELEVENLABS_AGENT_ID="..."
ELEVENLABS_WEBHOOK_SECRET="..."
ELEVENLABS_MCP_WEBHOOK_URL="..."
```

### Optional - MCP Servers

```bash
FIRECRAWL_API_KEY="..."
HUBSPOT_ACCESS_TOKEN="..."
JIRA_URL="..."
JIRA_USERNAME="..."
JIRA_API_TOKEN="..."
JUSTCALL_AUTH_TOKEN="..."
ATLAS_N8N_SSE_URL="..."
```

### Optional - Background Jobs

```bash
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."
```

### Optional - Channels

```bash
WHATSAPP_ENABLED="false"
TELEGRAM_BOT_TOKEN="..."
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
```

### Feature Flags

```bash
FEATURE_DB_AGENTS="true"  # Enable database-driven agents
```

---

## 17. Test Coverage

### Test Structure

```
tests/
├── e2e/
│   └── agent-lifecycle.test.ts      # Full lifecycle testing
├── integration/
│   ├── api/
│   │   ├── analytics.test.ts        # Analytics endpoint
│   │   ├── budget.test.ts           # Budget policy CRUD
│   │   ├── evaluations.test.ts      # Evaluation endpoints
│   │   ├── feedback.test.ts         # Feedback endpoints
│   │   ├── guardrails.test.ts       # Guardrail policy & events
│   │   ├── overview.test.ts         # Overview stats
│   │   ├── runs.test.ts             # Run CRUD, cancel, rerun
│   │   ├── stream.test.ts           # Streaming endpoints
│   │   ├── test-cases.test.ts       # Test case CRUD
│   │   └── versions.test.ts         # Version history & rollback
│   └── inngest/
│       ├── budget-check.test.ts     # Budget threshold alerts
│       ├── guardrail-event.test.ts  # Guardrail event handling
│       └── run-completed.test.ts    # Cost event & budget check
├── unit/
│   ├── inngest-functions.test.ts    # Inngest function unit tests
│   └── resolver.test.ts             # AgentResolver logic
├── fixtures/
│   ├── agents.ts                    # Mock agents
│   ├── evaluations.ts               # Mock evaluations, alerts
│   └── runs.ts                      # Mock runs, traces
└── utils/
    ├── api-helpers.ts               # Request/response helpers
    ├── db-mock.ts                   # Prisma mock
    └── inngest-mock.ts              # Inngest step mock
```

### Test Count

| Category            | Tests          |
| ------------------- | -------------- |
| Unit                | 14 tests       |
| Integration API     | 70+ tests      |
| Integration Inngest | 12 tests       |
| E2E                 | 5 tests        |
| **Total**           | **100+ tests** |

### Running Tests

```bash
bun run test           # Run all tests
bun run test:watch     # Watch mode
bun run test:coverage  # With coverage
bun run test:unit      # Unit only
bun run test:integration # Integration only
bun run test:e2e       # E2E only
```

---

## 18. Development Commands

### Core Commands

```bash
bun run dev            # Start with Caddy (HTTPS)
bun run dev:local      # Start without Caddy
bun run build          # Build all apps
bun run lint           # Run ESLint
bun run type-check     # TypeScript checking
bun run format         # Prettier formatting
```

### Database

```bash
bun run db:generate    # Generate Prisma client
bun run db:push        # Push schema changes (dev)
bun run db:migrate     # Create migrations (prod)
bun run db:studio      # Open Prisma Studio
bun run db:seed        # Seed database
```

### UI Development

```bash
bun run add-shadcn <name>  # Add shadcn component
bun run storybook          # Launch Storybook
```

### Testing

```bash
bun run test               # Run all tests
bun run test:coverage      # With coverage report
bun run test:e2e:playwright # Playwright E2E tests
```

---

## 19. Continuous Learning System

The Continuous Learning System enables agents to autonomously improve over time, inspired by Google DeepMind's approach to iterative refinement and self-play.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Continuous Learning Pipeline                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Signal  │───▶│ Proposal │───▶│  A/B     │───▶│ Promote  │  │
│  │Detection │    │Generation│    │ Testing  │    │ Version  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       ▲                                               │         │
│       │                                               │         │
│       └───────────────────────────────────────────────┘         │
│                    Feedback Loop                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Models

| Model                 | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `LearningPolicy`      | Per-agent configuration for continuous learning             |
| `LearningSession`     | A learning cycle from signal detection to promotion         |
| `LearningSignal`      | Individual signals (low score, high latency, user feedback) |
| `LearningProposal`    | Proposed changes with risk classification                   |
| `LearningExperiment`  | A/B test comparing baseline vs candidate                    |
| `LearningApproval`    | Human or auto approval decision                             |
| `LearningMetricDaily` | Aggregated daily metrics for analytics                      |

### Risk Classification

Proposals are classified by risk tier:

| Risk Tier  | Changes Allowed                     | Approval Mode            |
| ---------- | ----------------------------------- | ------------------------ |
| **LOW**    | Instruction-only edits              | Auto-promotion eligible  |
| **MEDIUM** | Tool configuration changes          | Human review recommended |
| **HIGH**   | Model, memory, or guardrail changes | Human approval required  |

### Trigger Modes

1. **Threshold-based**: Triggers when signal count exceeds threshold (default: 5 signals in 60 minutes)
2. **Scheduled**: Cron-based backstop (default: every 6 hours)
3. **Manual**: User-initiated via UI

### Shadow A/B Testing

Real production traffic is split between baseline and candidate versions:

- Default split: 90% baseline, 10% candidate
- Runs are tagged with `experimentId` and `experimentGroup`
- Experiment evaluation triggered when:
    - Minimum runs per group reached (default: 20)
    - Maximum total runs reached (default: 200)
    - Maximum duration reached (default: 72 hours)

### Configuration

All thresholds are centralized in `apps/agent/src/lib/learning-config.ts`:

```typescript
SIGNAL_THRESHOLDS: {
  signalCount: 5,
  signalWindowMinutes: 60,
  lowScoreThreshold: 0.5
}

TRAFFIC_SPLIT: {
  defaultCandidateSplit: 0.1,
  minRunsPerGroup: 20,
  maxRunsPerExperiment: 200,
  maxExperimentDurationHours: 72
}

AUTO_PROMOTION: {
  enabled: false,
  minWinRate: 0.55,
  minConfidenceScore: 0.7,
  minRunsBeforeAutoPromotion: 50
}
```

### API Endpoints

| Endpoint                                | Method   | Description                    |
| --------------------------------------- | -------- | ------------------------------ |
| `/api/agents/[id]/learning/policy`      | GET/POST | Get or update learning policy  |
| `/api/agents/[id]/learning/pause`       | POST     | Pause or resume learning       |
| `/api/agents/[id]/learning/experiments` | GET      | List active/recent experiments |
| `/api/agents/[id]/learning`             | GET      | Learning dashboard data        |
| `/api/agents/[id]/learning/metrics`     | GET      | Historical learning metrics    |

### Inngest Functions

| Function                              | Trigger          | Purpose                                |
| ------------------------------------- | ---------------- | -------------------------------------- |
| `learningSignalDetectorFunction`      | `run/completed`  | Detect signals from run results        |
| `scheduledLearningTriggerFunction`    | Cron (every 6h)  | Backstop trigger for learning sessions |
| `learningSessionStartFunction`        | Event            | Start a learning session               |
| `learningSignalExtractionFunction`    | Event            | Extract patterns from signals          |
| `learningProposalGenerationFunction`  | Event            | Generate improvement proposals         |
| `learningExperimentRunFunction`       | Event            | Run A/B experiment                     |
| `experimentEvaluationCheckerFunction` | Cron (every 15m) | Check and evaluate running experiments |
| `learningApprovalHandlerFunction`     | Event            | Handle approval decisions              |
| `learningVersionPromotionFunction`    | Event            | Promote winning versions               |
| `dailyMetricsRollupFunction`          | Cron (daily)     | Aggregate learning metrics             |

### Alerting

The system sends alerts via Slack (when configured) for:

- **Regression detected**: Candidate performs worse than baseline
- **Auto-promotion**: Low-risk proposal automatically promoted
- **Experiment timeout**: Experiment ended with inconclusive results

Environment variables:

- `SLACK_ALERTS_CHANNEL`: Slack channel for alerts
- `SLACK_BOT_TOKEN`: Slack bot token (reuses existing config)

### UI Components

The Learning page (`/workspace/[agentSlug]/learning`) provides:

- **Sessions tab**: View learning session history
- **Proposals tab**: Review and approve/reject proposals
- **Metrics tab**: View learning KPIs and trends
- **Settings tab**: Configure learning policy

The Overview page includes a Learning widget showing:

- Continuous learning status (active/paused/inactive)
- Active experiment count
- Auto vs manual promotion counts
- Link to Learning page

---

## Appendix: Data Retention

| Data Type              | Retention |
| ---------------------- | --------- |
| Raw traces, tool calls | Permanent |
| Runs, cost events      | Permanent |
| Evaluations, feedback  | Permanent |
| Aggregated metrics     | Permanent |
| Versions, configs      | Permanent |
| Audit logs             | Permanent |

---

## Appendix: Deployment

### Target: Vercel

- SSE for real-time (not WebSocket)
- Inngest for long-running work
- Edge functions where applicable

### Pre-Push Checklist

1. `bun run type-check`
2. `bun run lint`
3. `bun run format`
4. `bun run build`
5. `bun run test`
6. `git status` - review changes
7. `git diff --staged` - verify diff

---

_End of System Specification_
