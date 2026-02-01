# Agent Migration - Test Plan

## Overview

This document outlines the testing strategy for the agent database migration, including test matrices, seed data validation, and regression testing.

---

## Test Categories

### 1. Unit Tests

- AgentResolver methods
- Factory functions
- Interpolation logic
- Scorer/Memory builders

### 2. Integration Tests

- Database operations
- API endpoint responses
- Agent generation

### 3. End-to-End Tests

- Full user journeys
- Feature flag behavior
- Fallback mechanisms

### 4. Regression Tests

- Existing functionality unchanged
- API response compatibility
- Frontend behavior

---

## Test Matrix

### Phase 1: Schema & Seed

| Test Case                                | Expected Result               | Priority |
| ---------------------------------------- | ----------------------------- | -------- |
| Migration runs successfully              | No errors, tables created     | P0       |
| Agent table has correct columns          | All columns match schema      | P0       |
| AgentTool table has correct columns      | All columns match schema      | P0       |
| AgentVersion table has correct columns   | All columns match schema      | P0       |
| Seed script creates 8 SYSTEM agents      | 8 agents in database          | P0       |
| Seeded agents have correct slugs         | Slugs match registration keys | P0       |
| Seeded agents have correct instructions  | Instructions match code       | P1       |
| Seeded agents have correct tools         | Tool arrays match             | P1       |
| Seeded agents have correct memory config | Memory config matches         | P1       |
| Seeded agents have correct scorers       | Scorer arrays match           | P1       |
| Existing StoredAgent table unchanged     | No data loss                  | P0       |
| Application starts after migration       | No startup errors             | P0       |

### Phase 2: AgentResolver

| Test Case                                      | Expected Result         | Priority |
| ---------------------------------------------- | ----------------------- | -------- |
| resolve() finds agent by slug                  | Returns agent from DB   | P0       |
| resolve() finds agent by id                    | Returns agent from DB   | P0       |
| resolve() falls back if not in DB              | Uses code-defined agent | P0       |
| resolve() throws if agent not found            | Error with message      | P0       |
| interpolateInstructions() replaces {{userId}}  | Correct substitution    | P0       |
| interpolateInstructions() handles missing keys | Keeps placeholder       | P1       |
| buildMemory() creates Memory with config       | Correct Memory instance | P0       |
| buildScorers() creates scorer map              | Correct scorers         | P0       |
| listForUser() returns SYSTEM + user agents     | Combined list           | P0       |
| listSystem() returns only SYSTEM               | Filtered list           | P0       |
| exists() returns true for existing             | Boolean true            | P1       |
| exists() returns false for non-existing        | Boolean false           | P1       |

### Phase 3: Endpoint Migration

| Endpoint                        | Test Case                       | Expected Result            | Priority |
| ------------------------------- | ------------------------------- | -------------------------- | -------- |
| `/api/demos/agents/list`        | Returns agents with DB enabled  | Same format, DB source     | P0       |
| `/api/demos/agents/list`        | Returns agents with DB disabled | Same format, code source   | P0       |
| `/api/demos/agents/[id]/config` | Returns config with DB enabled  | Agent config from DB       | P0       |
| `/api/demos/agents/research`    | Agent generates response        | Valid response             | P0       |
| `/api/demos/agents/structured`  | Agent returns structured output | Valid JSON                 | P0       |
| `/api/demos/agents/vision`      | Agent analyzes image            | Valid analysis             | P0       |
| `/api/chat`                     | Chat with assistant agent       | Streaming response         | P0       |
| `/api/chat`                     | Chat with memory enabled        | Context preserved          | P0       |
| All endpoints                   | Feature flag toggle             | Switches resolution source | P0       |

### Phase 4: Frontend Migration

| Page         | Test Case             | Expected Result            | Priority |
| ------------ | --------------------- | -------------------------- | -------- |
| Agent List   | Displays all agents   | SYSTEM + user agents shown | P0       |
| Agent List   | Click agent navigates | Correct detail page        | P0       |
| Agent Detail | Shows agent info      | Correct name, description  | P0       |
| Agent Create | Form submits          | Agent created in DB        | P0       |
| Agent Edit   | Form updates          | Agent updated in DB        | P0       |
| Agent Delete | Delete USER agent     | Agent removed              | P0       |
| Agent Delete | Cannot delete SYSTEM  | Error shown                | P0       |
| Chat Page    | Agent selector works  | Selected agent used        | P0       |
| Chat Page    | Memory persists       | Context across messages    | P0       |

---

## Seed Data Validation

### Expected SYSTEM Agents

| Slug               | Name                    | Model Provider | Model Name               | Tools                                                      | Memory | Scorers                                 |
| ------------------ | ----------------------- | -------------- | ------------------------ | ---------------------------------------------------------- | ------ | --------------------------------------- |
| `assistant`        | AI Assistant            | anthropic      | claude-sonnet-4-20250514 | date-time, calculator, generate-id, web-fetch, json-parser | Yes    | None                                    |
| `structured`       | Structured Output Agent | anthropic      | claude-sonnet-4-20250514 | None                                                       | No     | None                                    |
| `vision`           | Vision Analyst          | anthropic      | claude-sonnet-4-20250514 | None                                                       | No     | None                                    |
| `research`         | Research Assistant      | anthropic      | claude-sonnet-4-20250514 | web-search, take-note                                      | No     | None                                    |
| `evaluated`        | Fully Evaluated Agent   | anthropic      | claude-sonnet-4-20250514 | None                                                       | No     | relevancy, toxicity, completeness, tone |
| `openai-voice`     | OpenAI Voice Agent      | anthropic      | claude-sonnet-4-20250514 | None                                                       | No     | None                                    |
| `elevenlabs-voice` | ElevenLabs Voice Agent  | anthropic      | claude-sonnet-4-20250514 | None                                                       | No     | None                                    |
| `hybrid-voice`     | Hybrid Voice Agent      | anthropic      | claude-sonnet-4-20250514 | None                                                       | No     | None                                    |

### Validation Script

```typescript
// scripts/validate-seed.ts

import { prisma } from "@repo/database";

const expectedAgents = [
    { slug: "assistant", toolCount: 5, memory: true, scorerCount: 0 },
    { slug: "structured", toolCount: 0, memory: false, scorerCount: 0 },
    { slug: "vision", toolCount: 0, memory: false, scorerCount: 0 },
    { slug: "research", toolCount: 2, memory: false, scorerCount: 0 },
    { slug: "evaluated", toolCount: 0, memory: false, scorerCount: 4 },
    { slug: "openai-voice", toolCount: 0, memory: false, scorerCount: 0 },
    { slug: "elevenlabs-voice", toolCount: 0, memory: false, scorerCount: 0 },
    { slug: "hybrid-voice", toolCount: 0, memory: false, scorerCount: 0 }
];

async function validate() {
    let passed = 0;
    let failed = 0;

    for (const expected of expectedAgents) {
        const agent = await prisma.agent.findUnique({
            where: { slug: expected.slug },
            include: { tools: true }
        });

        if (!agent) {
            console.error(`❌ Agent ${expected.slug} not found`);
            failed++;
            continue;
        }

        const checks = [
            { name: "type", actual: agent.type, expected: "SYSTEM" },
            { name: "toolCount", actual: agent.tools.length, expected: expected.toolCount },
            { name: "memory", actual: agent.memoryEnabled, expected: expected.memory },
            { name: "scorerCount", actual: agent.scorers.length, expected: expected.scorerCount }
        ];

        let agentPassed = true;
        for (const check of checks) {
            if (check.actual !== check.expected) {
                console.error(
                    `❌ ${expected.slug}.${check.name}: expected ${check.expected}, got ${check.actual}`
                );
                agentPassed = false;
            }
        }

        if (agentPassed) {
            console.log(`✅ Agent ${expected.slug} validated`);
            passed++;
        } else {
            failed++;
        }
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

validate();
```

---

## Regression Test Suite

### API Response Compatibility

Ensure new endpoints return compatible response formats:

```typescript
// tests/regression/api-compatibility.test.ts

describe("API Response Compatibility", () => {
    describe("/api/demos/agents/list", () => {
        it("returns agents array with expected shape", async () => {
            const response = await fetch("/api/demos/agents/list");
            const data = await response.json();

            expect(data.agents).toBeDefined();
            expect(Array.isArray(data.agents)).toBe(true);

            for (const agent of data.agents) {
                expect(agent).toHaveProperty("id");
                expect(agent).toHaveProperty("name");
                expect(agent).toHaveProperty("registrationKey");
            }
        });
    });

    describe("/api/chat", () => {
        it("returns streaming response", async () => {
            const response = await fetch("/api/chat", {
                method: "POST",
                body: JSON.stringify({ message: "Hello" })
            });

            expect(response.headers.get("content-type")).toContain("text/event-stream");
        });
    });
});
```

### Feature Flag Behavior

```typescript
// tests/regression/feature-flags.test.ts

describe("Feature Flag Behavior", () => {
    describe("FEATURE_DB_AGENTS=false", () => {
        beforeAll(() => {
            process.env.FEATURE_DB_AGENTS = "false";
        });

        it("uses code-defined agents", async () => {
            // Test that agents are resolved from code
        });
    });

    describe("FEATURE_DB_AGENTS=true", () => {
        beforeAll(() => {
            process.env.FEATURE_DB_AGENTS = "true";
        });

        it("uses database agents", async () => {
            // Test that agents are resolved from DB
        });

        it("falls back to code-defined if not in DB", async () => {
            // Test fallback behavior
        });
    });
});
```

---

## Manual Testing Checklist

### Pre-Migration Baseline

Before starting migration, document current behavior:

- [ ] Screenshot agent list page
- [ ] Record response from `/api/demos/agents/list`
- [ ] Record response from `/api/chat` (first message)
- [ ] Test each demo agent works
- [ ] Note any existing issues

### Post-Phase Testing

#### After Phase 1 (Schema & Seed)

- [ ] Run `bunx prisma studio` and verify tables
- [ ] Run validation script
- [ ] Application starts without errors
- [ ] Existing functionality works unchanged

#### After Phase 2 (AgentResolver)

- [ ] Test resolve endpoint with each slug
- [ ] Verify dynamic instructions work
- [ ] Check memory configuration applied
- [ ] Confirm scorers instantiated

#### After Phase 3 (Endpoints)

- [ ] Test each migrated endpoint
- [ ] Toggle feature flag and verify behavior
- [ ] Compare responses to baseline
- [ ] Check logs for resolution source

#### After Phase 4 (Frontend)

- [ ] Navigate through all agent pages
- [ ] Create a new agent via UI
- [ ] Edit an existing agent
- [ ] Delete a user agent
- [ ] Attempt to delete SYSTEM agent (should fail)
- [ ] Chat with different agents

#### After Phase 5 (Fallback Removed)

- [ ] All tests pass
- [ ] No fallback usage in logs
- [ ] Performance acceptable
- [ ] No regressions

---

## Performance Testing

### Resolution Latency

Measure agent resolution time:

```typescript
// scripts/perf-test.ts

const slugs = ["assistant", "structured", "vision", "research", "evaluated"];

async function measureResolution() {
    const results: Record<string, number[]> = {};

    for (const slug of slugs) {
        results[slug] = [];

        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            await agentResolver.resolve({ slug });
            const end = performance.now();
            results[slug].push(end - start);
        }
    }

    for (const [slug, times] of Object.entries(results)) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
        console.log(`${slug}: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`);
    }
}
```

### Acceptance Criteria

| Metric                 | Threshold |
| ---------------------- | --------- |
| Resolution avg latency | < 50ms    |
| Resolution p95 latency | < 100ms   |
| API response time      | < 200ms   |
| Memory usage increase  | < 10%     |

---

## Rollback Testing

### Scenario 1: Disable Feature Flag

1. Set `FEATURE_DB_AGENTS=false`
2. Restart application
3. Verify all functionality works with code-defined agents

### Scenario 2: Database Unavailable

1. Stop database
2. Verify graceful degradation or clear error
3. Restart database
4. Verify automatic recovery

### Scenario 3: Corrupt Agent Data

1. Manually corrupt an agent record
2. Verify resolver handles error gracefully
3. Verify fallback to code-defined works

---

## Test Environment Setup

### Local Development

```bash
# Start dependencies
docker compose up -d

# Run migrations
bun run db:migrate

# Seed agents
bun run db:seed

# Validate seed
bun run scripts/validate-seed.ts

# Start dev server
bun run dev
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml

jobs:
    test:
        steps:
            - name: Start database
              run: docker compose up -d postgres

            - name: Run migrations
              run: bun run db:migrate

            - name: Seed agents
              run: bun run db:seed

            - name: Validate seed
              run: bun run scripts/validate-seed.ts

            - name: Run tests
              run: bun run test

            - name: Run e2e tests
              run: bun run test:e2e
```

---

## Sign-Off Criteria

### Phase 1 Complete When

- [ ] All schema tests pass
- [ ] Seed validation passes
- [ ] No existing functionality broken

### Phase 2 Complete When

- [ ] All resolver unit tests pass
- [ ] Integration tests pass
- [ ] Performance within thresholds

### Phase 3 Complete When

- [ ] All endpoint tests pass
- [ ] Feature flag works correctly
- [ ] No regressions from baseline

### Phase 4 Complete When

- [ ] All frontend tests pass
- [ ] Manual testing checklist complete
- [ ] User acceptance testing passed

### Phase 5 Complete When

- [ ] All tests pass without fallback
- [ ] Monitoring shows healthy metrics
- [ ] 2 weeks stable in production
