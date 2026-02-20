# Agent Migration - Migration Plan

## Overview

This document outlines the step-by-step migration from the current dual-architecture system to a unified database-driven agent system.

**Key Principles:**

- Non-breaking changes first
- Feature flags for gradual rollout
- Fallback mechanisms during transition
- Comprehensive testing at each phase

---

## Phase 1: Schema & Seed (Non-Breaking)

### Objective

Add new database models and seed existing code-defined agents without breaking current functionality.

### Steps

#### 1.1 Update Prisma Schema

**File:** `packages/database/prisma/schema.prisma`

Add the following models (keeping existing `StoredAgent` for backwards compatibility):

```prisma
model Agent {
    id                   String         @id @default(cuid())
    slug                 String         @unique
    name                 String
    description          String?
    instructions         String         @db.Text
    instructionsTemplate String?        @db.Text
    modelProvider        String
    modelName            String
    temperature          Float?         @default(0.7)
    maxTokens            Int?
    modelConfig          Json?
    tools                AgentTool[]
    memoryEnabled        Boolean        @default(false)
    memoryConfig         Json?
    maxSteps             Int?           @default(5)
    scorers              String[]       @default([])
    type                 AgentType      @default(USER)
    ownerId              String?
    owner                User?          @relation(fields: [ownerId], references: [id])
    isPublic             Boolean        @default(false)
    metadata             Json?
    isActive             Boolean        @default(true)
    version              Int            @default(1)
    createdAt            DateTime       @default(now())
    updatedAt            DateTime       @updatedAt
    createdBy            String?
    versions             AgentVersion[]

    @@index([slug])
    @@index([ownerId])
    @@index([type])
    @@map("agent")
}

enum AgentType {
    SYSTEM
    USER
}

model AgentTool {
    id      String @id @default(cuid())
    agentId String
    agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)
    toolId  String
    config  Json?

    @@unique([agentId, toolId])
    @@map("agent_tool")
}

model AgentVersion {
    id            String   @id @default(cuid())
    agentId       String
    agent         Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
    version       Int
    instructions  String   @db.Text
    modelProvider String
    modelName     String
    snapshot      Json
    createdAt     DateTime @default(now())
    createdBy     String?

    @@unique([agentId, version])
    @@map("agent_version")
}
```

Also add the relation to the User model:

```prisma
model User {
    // ... existing fields ...
    agents Agent[]
}
```

#### 1.2 Run Migration

```bash
cd packages/database
bunx prisma migrate dev --name add_agent_models
```

#### 1.3 Create Seed Script

**File:** `packages/database/prisma/seed-agents.ts`

This script populates SYSTEM agents from code-defined agents:

```typescript
import { prisma } from "../src";

const systemAgents = [
    {
        slug: "assistant",
        name: "AI Assistant",
        description: "General-purpose assistant with memory and tools",
        instructions: `You are a helpful, knowledgeable...`, // Full instructions
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: ["date-time", "calculator", "generate-id", "web-fetch", "json-parser"],
        memoryEnabled: true,
        memoryConfig: {
            lastMessages: 20,
            semanticRecall: { topK: 10 },
            workingMemory: { enabled: true }
        },
        scorers: [],
        type: "SYSTEM"
    }
    // ... other agents
];

async function seedAgents() {
    for (const agent of systemAgents) {
        await prisma.agent.upsert({
            where: { slug: agent.slug },
            update: agent,
            create: agent
        });
    }
}
```

#### 1.4 Verify Seed Data

```bash
bun run db:seed
bunx prisma studio
# Verify 8 SYSTEM agents exist with correct data
```

### Validation Checklist

- [ ] Migration runs without errors
- [ ] All 8 SYSTEM agents seeded correctly
- [ ] Existing `StoredAgent` table unchanged
- [ ] Application continues to work with code-defined agents

---

## Phase 2: AgentResolver (Parallel Path)

### Objective

Create the `AgentResolver` class that can resolve agents from database, with fallback to code-defined agents.

### Steps

#### 2.1 Create Scorer Registry

**File:** `packages/agentc2/src/scorers/registry.ts`

```typescript
import { relevancyScorer, toxicityScorer, completenessScorer, toneScorer } from "./index";

export const scorerRegistry = {
    relevancy: relevancyScorer,
    toxicity: toxicityScorer,
    completeness: completenessScorer,
    tone: toneScorer
    // Add more as needed
};

export function getScorersByNames(names: string[]) {
    const result: Record<string, { scorer: unknown; sampling: { type: string; rate: number } }> =
        {};
    for (const name of names) {
        if (scorerRegistry[name]) {
            result[name] = {
                scorer: scorerRegistry[name],
                sampling: { type: "ratio", rate: 1.0 }
            };
        }
    }
    return result;
}
```

#### 2.2 Create AgentResolver

**File:** `packages/agentc2/src/agents/resolver.ts`

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { prisma } from "@repo/database";
import { mastra } from "../mastra";
import { storage } from "../storage";
import { getToolsByNames } from "../tools/registry";
import { getScorersByNames } from "../scorers/registry";

export interface RequestContext {
    userId?: string;
    userName?: string;
    tenantId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
}

export interface ResolveOptions {
    slug?: string;
    id?: string;
    requestContext?: RequestContext;
    fallbackToSystem?: boolean;
}

export interface HydratedAgent {
    agent: Agent;
    record: AgentRecord | null;
    source: "database" | "fallback";
}

export class AgentResolver {
    async resolve(options: ResolveOptions): Promise<HydratedAgent> {
        const { slug, id, requestContext, fallbackToSystem = true } = options;

        // Try database first
        const record = await prisma.agent.findFirst({
            where: slug ? { slug, isActive: true } : { id, isActive: true },
            include: { tools: true }
        });

        if (record) {
            const agent = this.hydrate(record, requestContext);
            return { agent, record, source: "database" };
        }

        // Fallback to code-defined
        if (fallbackToSystem && slug) {
            try {
                const agent = mastra.getAgent(slug);
                return { agent, record: null, source: "fallback" };
            } catch {
                // Agent not found in either place
            }
        }

        throw new Error(`Agent not found: ${slug || id}`);
    }

    private hydrate(record: AgentRecord, context?: RequestContext): Agent {
        // Interpolate instructions
        const instructions = record.instructionsTemplate
            ? this.interpolateInstructions(record.instructionsTemplate, context || {})
            : record.instructions;

        // Build memory
        const memory = record.memoryEnabled ? this.buildMemory(record.memoryConfig) : undefined;

        // Get tools
        const toolNames = record.tools.map((t) => t.toolId);
        const tools = getToolsByNames(toolNames);

        // Get scorers
        const scorers = getScorersByNames(record.scorers);

        return new Agent({
            id: record.id,
            name: record.name,
            instructions,
            model: `${record.modelProvider}/${record.modelName}`,
            tools: Object.keys(tools).length > 0 ? tools : undefined,
            memory,
            scorers: Object.keys(scorers).length > 0 ? scorers : undefined
        });
    }

    private interpolateInstructions(template: string, context: RequestContext): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            if (key in context) {
                return String(context[key as keyof RequestContext]);
            }
            if (context.metadata && key in context.metadata) {
                return String(context.metadata[key]);
            }
            return match;
        });
    }

    private buildMemory(config?: unknown): Memory {
        const memConfig = config as MemoryConfig | null;
        return new Memory({
            storage,
            options: {
                lastMessages: memConfig?.lastMessages ?? 10,
                semanticRecall: memConfig?.semanticRecall ?? false,
                workingMemory: memConfig?.workingMemory ?? undefined
            }
        });
    }

    async listForUser(userId: string): Promise<AgentRecord[]> {
        return prisma.agent.findMany({
            where: {
                isActive: true,
                OR: [{ type: "SYSTEM" }, { ownerId: userId }, { isPublic: true }]
            },
            include: { tools: true }
        });
    }

    async listSystem(): Promise<AgentRecord[]> {
        return prisma.agent.findMany({
            where: { type: "SYSTEM", isActive: true },
            include: { tools: true }
        });
    }

    async exists(slug: string): Promise<boolean> {
        const count = await prisma.agent.count({
            where: { slug, isActive: true }
        });
        return count > 0;
    }
}

export const agentResolver = new AgentResolver();
```

#### 2.3 Create Test Endpoint

**File:** `apps/agent/src/app/api/agents/resolve/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { agentResolver } from "@repo/agentc2";

export async function POST(request: NextRequest) {
    const { slug, requestContext } = await request.json();

    try {
        const { agent, record, source } = await agentResolver.resolve({
            slug,
            requestContext
        });

        return NextResponse.json({
            success: true,
            source,
            agent: {
                id: agent.id,
                name: agent.name
            },
            record: record
                ? {
                      id: record.id,
                      slug: record.slug,
                      type: record.type
                  }
                : null
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 404 });
    }
}
```

#### 2.4 Validate Resolver

Test that resolver returns identical behavior:

```bash
# Test resolution via API
curl -X POST http://localhost:3001/agent/api/agents/resolve \
  -H "Content-Type: application/json" \
  -d '{"slug": "assistant"}'
```

### Validation Checklist

- [ ] AgentResolver resolves SYSTEM agents from database
- [ ] AgentResolver falls back to code-defined if not in DB
- [ ] Dynamic instructions interpolation works
- [ ] Memory configuration applied correctly
- [ ] Scorers instantiated from names

---

## Phase 3: Migrate Endpoints (One by One)

### Objective

Replace `mastra.getAgent()` calls with `agentResolver.resolve()`, starting with low-risk endpoints.

### Migration Order

1. `/api/demos/agents/list` - List endpoint (read-only)
2. `/api/demos/agents/[id]/config` - Config endpoint (read-only)
3. `/api/demos/agents/research` - Demo endpoint
4. `/api/demos/agents/structured` - Demo endpoint
5. `/api/demos/agents/vision` - Demo endpoint
6. `/api/chat` - Main chat (highest risk, last)

### Feature Flag

Add to `.env`:

```
FEATURE_DB_AGENTS=false  # Set to true to enable
```

### Migration Pattern

```typescript
// Before
const agent = mastra.getAgent("assistant");

// After
const USE_DB_AGENTS = process.env.FEATURE_DB_AGENTS === "true";

const agent = USE_DB_AGENTS
    ? (await agentResolver.resolve({ slug: "assistant", requestContext })).agent
    : mastra.getAgent("assistant");
```

### Per-Endpoint Migration

#### 3.1 `/api/demos/agents/list`

```typescript
export async function GET(request: NextRequest) {
    const USE_DB_AGENTS = process.env.FEATURE_DB_AGENTS === "true";

    if (USE_DB_AGENTS) {
        const agents = await agentResolver.listSystem();
        return NextResponse.json({
            agents: agents.map((a) => ({
                id: a.id,
                slug: a.slug,
                name: a.name,
                description: a.description
            }))
        });
    }

    // Existing code-defined logic
    // ...
}
```

#### 3.2 Continue for each endpoint...

### Validation per Endpoint

- [ ] API returns same response structure
- [ ] Feature flag toggle works
- [ ] No regressions with flag off
- [ ] Logging shows resolution source

---

## Phase 4: Migrate Frontend

### Objective

Update frontend routes to use the unified agent API and add UI for new configuration options.

### Steps

#### 4.1 Update Agent List Pages

**File:** `apps/agent/src/app/demos/agents/page.tsx`

- Fetch from `/api/agents` instead of `/api/demos/agents/list`
- Display agent slugs instead of registration keys
- Link to `/demos/agents/[slug]` routes

#### 4.2 Update Agent Management Page

**File:** `apps/agent/src/app/demos/agents/manage/page.tsx`

Add UI for new fields:

- Memory configuration (lastMessages, semanticRecall, workingMemory)
- Scorers selection
- maxSteps slider
- instructionsTemplate with preview

#### 4.3 Update Chat Page

**File:** `apps/agent/src/app/chat/page.tsx`

- Add agent selector dropdown
- Use query param `?agent=slug` for agent selection
- Pass session context for RequestContext

### Validation Checklist

- [ ] Agent list shows all agents (SYSTEM + user)
- [ ] Agent detail pages load correctly
- [ ] Create/Edit forms work with new fields
- [ ] Chat works with selected agent
- [ ] Existing URLs still work

---

## Phase 5: Remove Fallback

### Objective

Remove code-defined agents and fallback logic, making database the single source of truth.

### Prerequisites

- [ ] All endpoints migrated and tested
- [ ] All SYSTEM agents verified in database
- [ ] Feature flag enabled in production for 2+ weeks
- [ ] No fallback usage in logs

### Steps

#### 5.1 Remove Fallback Logic

**File:** `packages/agentc2/src/agents/resolver.ts`

```typescript
// Remove fallbackToSystem option
// Throw error if agent not found in database
```

#### 5.2 Archive Code-Defined Agents

Move files to `packages/agentc2/src/agents/_archive/`:

- `assistant.ts`
- `structured.ts`
- `vision.ts`
- `research.ts`
- `evaluated.ts`
- `voice.ts`

Or delete if confident in database state.

#### 5.3 Update mastra.ts

```typescript
// Remove buildAgents() and agent registration
// Mastra instance no longer has agents property
```

#### 5.4 Remove Feature Flag

Remove `FEATURE_DB_AGENTS` from all endpoints.

### Validation Checklist

- [ ] Application works without code-defined agents
- [ ] All tests pass
- [ ] No references to old agent files
- [ ] Monitoring shows healthy state

---

## Rollback Plan

### During Migration (Phases 1-4)

1. Set `FEATURE_DB_AGENTS=false` to disable DB agents
2. Code-defined agents remain functional
3. No data loss - DB records preserved

### After Phase 5

1. Re-add code-defined agent files from git history
2. Restore `buildAgents()` in `mastra.ts`
3. Re-add fallback logic to resolver
4. Deploy

---

## Timeline Estimate

| Phase                      | Duration | Risk   |
| -------------------------- | -------- | ------ |
| Phase 1: Schema & Seed     | 1-2 days | Low    |
| Phase 2: AgentResolver     | 2-3 days | Low    |
| Phase 3: Migrate Endpoints | 3-5 days | Medium |
| Phase 4: Migrate Frontend  | 3-5 days | Medium |
| Phase 5: Remove Fallback   | 1 day    | High   |

**Total: 10-16 days**

---

## Monitoring

### Metrics to Track

1. **Resolution Source**
    - `agent.resolution.database` - Count of DB resolutions
    - `agent.resolution.fallback` - Count of fallback resolutions

2. **Resolution Latency**
    - `agent.resolution.latency_ms` - Time to resolve agent

3. **Errors**
    - `agent.resolution.not_found` - Agent not found errors
    - `agent.resolution.error` - Other resolution errors

### Alerts

- Alert if fallback usage > 1% after Phase 3
- Alert if resolution latency > 100ms
- Alert if error rate > 0.1%
