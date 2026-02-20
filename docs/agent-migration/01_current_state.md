# Agent Migration - Current State

## Overview

The Mastra Experiment project currently has **two parallel agent architectures** that need to be unified:

1. **Code-Defined Agents**: TypeScript files in `packages/agentc2/src/agents/*.ts`, registered via `mastra.ts`
2. **Stored Agents**: Database-backed via Prisma `StoredAgent` model, created via CRUD API

This document describes the current state of both systems.

---

## Architecture Diagram

```mermaid
flowchart TB
    subgraph frontend [Frontend Routes]
        Chat[/chat]
        Demos[/demos/agents]
        Manage[/demos/agents/manage]
        Voice[/demos/voice]
        MCP[/demos/mcp]
    end

    subgraph apiLayer [API Layer]
        ChatAPI["/api/chat - uses assistant"]
        DemoAPI["/api/demos/agents/* - hardcoded agents"]
        CrudAPI["/api/agents/* - stored agents"]
    end

    subgraph resolution [Agent Resolution - Two Paths]
        MastraGet["mastra.getAgent(key)"]
        Factory["createAgentFromConfig()"]
    end

    subgraph storage [Storage - Two Sources]
        CodeAgents["Code-Defined: packages/agentc2/src/agents/*.ts"]
        DBAgents["StoredAgent Table: Prisma/PostgreSQL"]
    end

    Chat --> ChatAPI
    Demos --> DemoAPI
    Manage --> CrudAPI

    ChatAPI --> MastraGet
    DemoAPI --> MastraGet
    CrudAPI --> Factory

    MastraGet --> CodeAgents
    Factory --> DBAgents
```

---

## Code-Defined Agents (8 total)

These agents are defined in TypeScript files and registered in `mastra.ts` via the `buildAgents()` function.

### Agent Inventory

| Registration Key         | Agent ID                 | Name                    | File            | Model                                | Features                                                       |
| ------------------------ | ------------------------ | ----------------------- | --------------- | ------------------------------------ | -------------------------------------------------------------- |
| `assistant`              | `assistant`              | AI Assistant            | `assistant.ts`  | `anthropic/claude-sonnet-4-20250514` | Memory, extended tools (datetime, calculator, web-fetch, etc.) |
| `structured`             | `structured-output`      | Structured Output Agent | `structured.ts` | `anthropic/claude-sonnet-4-20250514` | Zod schema output, no tools                                    |
| `vision`                 | `vision-analyst`         | Vision Analyst          | `vision.ts`     | `anthropic/claude-sonnet-4-20250514` | Image analysis, no tools                                       |
| `research`               | `research-assistant`     | Research Assistant      | `research.ts`   | `anthropic/claude-sonnet-4-20250514` | Multi-step, webSearch + takeNote tools                         |
| `evaluated`              | `evaluated-agent`        | Fully Evaluated Agent   | `evaluated.ts`  | `anthropic/claude-sonnet-4-20250514` | All scorers (relevancy, toxicity, completeness, tone)          |
| `openai-voice-agent`     | `openai-voice-agent`     | OpenAI Voice Agent      | `voice.ts`      | `anthropic/claude-sonnet-4-20250514` | OpenAI TTS/STT (requires `OPENAI_API_KEY`)                     |
| `elevenlabs-voice-agent` | `elevenlabs-voice-agent` | ElevenLabs Voice Agent  | `voice.ts`      | `anthropic/claude-sonnet-4-20250514` | ElevenLabs TTS (requires `ELEVENLABS_API_KEY`)                 |
| `hybrid-voice-agent`     | `hybrid-voice-agent`     | Hybrid Voice Agent      | `voice.ts`      | `anthropic/claude-sonnet-4-20250514` | OpenAI STT + ElevenLabs TTS                                    |

### Agent Registration in mastra.ts

```typescript
// packages/agentc2/src/mastra.ts

function buildAgents(): Record<string, Agent> {
    const agents: Record<string, Agent> = {
        assistant: assistantAgent,
        structured: structuredAgent,
        vision: visionAgent,
        research: researchAgent,
        evaluated: evaluatedAgent
    };

    // Voice agents conditionally added based on API keys
    if (openaiVoiceAgent) {
        agents["openai-voice-agent"] = openaiVoiceAgent;
    }
    if (elevenlabsVoiceAgent) {
        agents["elevenlabs-voice-agent"] = elevenlabsVoiceAgent;
    }
    if (hybridVoiceAgent) {
        agents["hybrid-voice-agent"] = hybridVoiceAgent;
    }

    return agents;
}
```

### Access Pattern

```typescript
// To get an agent:
import { mastra } from "@repo/agentc2";
const agent = mastra.getAgent("assistant"); // Uses registration key
```

---

## Stored Agents (Database-Backed)

A newer system for database-backed agents with CRUD operations.

### Database Schema

```prisma
// packages/database/prisma/schema.prisma

model StoredAgent {
    id            String   @id @default(cuid())
    name          String
    description   String?
    instructions  String   @db.Text
    modelProvider String // "openai", "anthropic", etc.
    modelName     String // "gpt-4o", "claude-sonnet", etc.
    temperature   Float?   @default(0.7)
    tools         String[] // Tool names to attach
    memory        Boolean  @default(false)
    metadata      Json?
    isActive      Boolean  @default(true)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    @@map("stored_agent")
}
```

### Access Pattern

```typescript
// To create an agent from stored config:
import { createAgentFromConfig, StoredAgentConfig } from "@repo/agentc2";

const config: StoredAgentConfig = await prisma.storedAgent.findUnique({ where: { id } });
const agent = createAgentFromConfig(config);
```

---

## Tool Registry

Both systems use a shared tool registry for available tools.

### Available Tools

| Tool ID         | Description                           |
| --------------- | ------------------------------------- |
| `date-time`     | Get current date/time in any timezone |
| `calculator`    | Perform mathematical calculations     |
| `generate-id`   | Generate unique identifiers           |
| `web-fetch`     | Fetch content from URLs               |
| `memory-recall` | Recall information from memory        |
| `json-parser`   | Parse and transform JSON data         |

### Registry Location

```typescript
// packages/agentc2/src/tools/registry.ts

export const toolRegistry: Record<string, Tool> = {
    "date-time": dateTimeTool,
    calculator: calculatorTool,
    "generate-id": generateIdTool,
    "web-fetch": webFetchTool,
    "memory-recall": memoryRecallTool,
    "json-parser": jsonParserTool
};
```

---

## API Endpoints

### Code-Defined Agent Endpoints

| Endpoint                        | Method | Agent Used   | Description                          |
| ------------------------------- | ------ | ------------ | ------------------------------------ |
| `/api/chat`                     | POST   | `assistant`  | Main chat endpoint                   |
| `/api/demos/agents/list`        | GET    | Multiple     | List all code-defined agents         |
| `/api/demos/agents/[id]/config` | GET    | By ID        | Get agent config by registration key |
| `/api/demos/agents/research`    | POST   | `research`   | Research agent demo                  |
| `/api/demos/agents/structured`  | POST   | `structured` | Structured output demo               |
| `/api/demos/agents/vision`      | POST   | `vision`     | Vision analysis demo                 |
| `/api/demos/evals/*`            | POST   | `evaluated`  | Evaluation demo                      |
| `/api/demos/live-agent-mcp/*`   | POST   | MCP Agent    | Live agent with MCP tools            |
| `/api/demos/voice/*`            | POST   | Voice agents | Voice agent demos                    |

### Stored Agent Endpoints (CRUD)

| Endpoint                | Method | Description                     |
| ----------------------- | ------ | ------------------------------- |
| `/api/agents`           | GET    | List all stored agents          |
| `/api/agents`           | POST   | Create a new stored agent       |
| `/api/agents/[id]`      | GET    | Get stored agent by ID          |
| `/api/agents/[id]`      | PUT    | Update stored agent             |
| `/api/agents/[id]`      | DELETE | Delete stored agent             |
| `/api/agents/[id]/test` | POST   | Test stored agent with prompt   |
| `/api/agents/tools`     | GET    | List available tools and models |

---

## Current Limitations

### 1. Dual Resolution Paths

- No single source of truth for agent definitions
- Inconsistent access patterns between code-defined and stored agents

### 2. No Dynamic Instructions

- Code-defined agents have static instructions
- No support for runtime context injection

### 3. Limited Memory Configuration

- Binary `memory: true/false` for stored agents
- No granular control over `lastMessages`, `semanticRecall`, `workingMemory`

### 4. No Scorers for Stored Agents

- Only the `evaluated` code-defined agent has scorers
- Cannot configure scorers via database

### 5. No Versioning

- No history of agent configuration changes
- No rollback capability

### 6. Missing Features

- No `maxSteps` configuration for stored agents
- No `instructionsTemplate` for dynamic instructions
- No provider-specific model options (`reasoning`, `toolChoice`)

---

## Files Reference

### Agent Definition Files

| File                                       | Purpose                                    |
| ------------------------------------------ | ------------------------------------------ |
| `packages/agentc2/src/agents/assistant.ts`  | Main AI Assistant with memory and tools    |
| `packages/agentc2/src/agents/structured.ts` | Structured output agent with Zod schemas   |
| `packages/agentc2/src/agents/vision.ts`     | Image analysis agent                       |
| `packages/agentc2/src/agents/research.ts`   | Multi-step research agent                  |
| `packages/agentc2/src/agents/evaluated.ts`  | Agent with all scorers                     |
| `packages/agentc2/src/agents/voice.ts`      | Voice agents (OpenAI, ElevenLabs, Hybrid)  |
| `packages/agentc2/src/agents/factory.ts`    | Factory for creating agents from DB config |
| `packages/agentc2/src/agents/index.ts`      | Agent exports                              |

### Core Files

| File                                     | Purpose                   |
| ---------------------------------------- | ------------------------- |
| `packages/agentc2/src/mastra.ts`          | Mastra singleton instance |
| `packages/agentc2/src/tools/registry.ts`  | Tool registry             |
| `packages/database/prisma/schema.prisma` | Database schema           |
