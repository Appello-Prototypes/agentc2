---
name: ""
overview: ""
todos: []
isProject: false
---

# Agent, Workflow, and Network Workspaces Architecture

## Executive Summary

This document provides comprehensive research into building a production-grade platform with three first-class workspace environments: **Agent Workspace** (existing), **Workflow Workspace** (new), and **Network Workspace** (new). Each workspace supports authoring, execution, monitoring, iteration, and deployment lifecycle management with full observability.

---

## Part 1: Mastra Network Model Deep Dive

### 1.1 What Are Networks?

Based on official Mastra documentation and codebase analysis:

**Networks are LLM-orchestrated multi-primitive coordination systems** where a routing agent dynamically decides which primitives (sub-agents, workflows, tools) to execute based on natural language reasoning.

| Characteristic    | Workflows                     | Networks                           |
| ----------------- | ----------------------------- | ---------------------------------- |
| **Orchestration** | Predefined DAG, static paths  | LLM-reasoned, dynamic paths        |
| **Control Flow**  | Developer-defined conditions  | LLM decides based on descriptions  |
| **Primitives**    | Steps with execute functions  | Agents, Workflows, AND Tools       |
| **Memory**        | Optional                      | **Required** (stores task history) |
| **Determinism**   | High (same input → same path) | Lower (LLM reasoning varies)       |
| **When Complete** | All steps finished            | LLM determines task completion     |

### 1.2 Network Architecture (from @mastra/core)

```typescript
// A Network is an Agent with sub-agents, workflows, and tools
const routingAgent = new Agent({
  id: "routing-agent",
  name: "Routing Agent",
  instructions: "...",  // Routing behavior
  model: "openai/gpt-4o",

  // The "network" of primitives
  agents: {
    researchAgent,    // Sub-agent
    writingAgent,     // Sub-agent
  },
  workflows: {
    cityWorkflow,     // Mastra workflow
  },
  tools: {
    weatherTool,      // Mastra tool
  },

  // Memory is REQUIRED for networks
  memory: new Memory({ ... }),
});

// Execute via .network() method
const result = await routingAgent.network(
  "Research AI trends and write a report",
  { maxSteps, memory, structuredOutput }
);
```

### 1.3 How Network Execution Works

1. **User sends message** → Routing agent receives it
2. **LLM reasoning** → Based on primitive descriptions + schemas, decides what to call
3. **Primitive execution** → Calls agent/workflow/tool with appropriate inputs
4. **Memory update** → Stores task history
5. **Iteration** → LLM decides if task is complete or needs more steps
6. **Completion** → Returns final result

### 1.4 Network Event Stream Types

```
routing-agent-start          → Routing agent begins processing
routing-agent-end            → Routing decision made

agent-execution-start        → Sub-agent begins
agent-execution-event-*      → Sub-agent streaming events
agent-execution-end          → Sub-agent completes

workflow-execution-start     → Workflow begins
workflow-execution-event-*   → Workflow step events
workflow-execution-end       → Workflow completes

tool-execution-start         → Tool begins
tool-execution-end           → Tool completes

network-execution-event-step-finish  → Network step completed
network-object               → Structured output partial
network-object-result        → Structured output final
```

### 1.5 Current Implementation Analysis

**Location**: `packages/agentc2/src/agents/network-resolver.ts`

**Current State**:

- ✅ Database-driven sub-agents (resolved via AgentResolver)
- ✅ Code-defined workflows (trip-planner workflows)
- ✅ Code-defined tools (trip-planner tools)
- ✅ Memory configuration
- ✅ 5-minute cache with TTL
- ⚠️ Only one network implemented (Trip Planner)
- ⚠️ `.network()` typed as `any` (experimental API)
- ⚠️ Network topology hardcoded in code

**Sub-Agents in Trip Planner Network**:

- `trip-destination` - Destination research
- `trip-transport` - Transportation options
- `trip-accommodation` - Hotels and lodging
- `trip-activities` - Attractions and experiences
- `trip-budget` - Cost calculations
- `trip-itinerary` - Day-by-day planning

---

## Part 2: Workspace Model Architecture

### 2.1 Three-Workspace Platform Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MASTRA PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐│
│  │   AGENT WORKSPACE   │  │  WORKFLOW WORKSPACE │  │   NETWORK    ││
│  │                     │  │                     │  │   WORKSPACE  ││
│  │  • Configure agents │  │  • Design workflows │  │              ││
│  │  • Test & iterate   │  │  • Visual canvas    │  │  • Topology  ││
│  │  • Evaluate quality │  │  • Step config      │  │    designer  ││
│  │  • Monitor runs     │  │  • Execute & debug  │  │  • Agent     ││
│  │  • Cost management  │  │  • Promote to prod  │  │    selection ││
│  │  • Version control  │  │  • Version control  │  │  • Execute   ││
│  │  • Continuous       │  │                     │  │    & observe ││
│  │    learning         │  │                     │  │              ││
│  └─────────────────────┘  └─────────────────────┘  └──────────────┘│
│            │                        │                     │        │
│            ▼                        ▼                     ▼        │
│  ┌─────────────────────────────────────────────────────────────────┤
│  │                    SHARED INFRASTRUCTURE                        │
│  ├─────────────────────────────────────────────────────────────────┤
│  │  • Observability (Tracing, Logging, Metrics)                   │
│  │  • Execution Engine                                            │
│  │  • Storage (PostgreSQL + Vector)                               │
│  │  • Deployment & Versioning                                     │
│  │  • AI-Native Generation                                        │
│  └─────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Workspace Capabilities Matrix

| Capability        | Agent Workspace                       | Workflow Workspace               | Network Workspace                   |
| ----------------- | ------------------------------------- | -------------------------------- | ----------------------------------- |
| **Authoring**     | ✅ Existing                           | 🆕 Visual Builder                | 🆕 Topology Designer                |
| **Configuration** | ✅ Instructions, Model, Tools, Memory | 🆕 Steps, Branches, Loops, Human | 🆕 Agents, Workflows, Tools, Memory |
| **Testing**       | ✅ Test page, Simulations             | 🆕 Step-by-step execution        | 🆕 Network execution with routing   |
| **Monitoring**    | ✅ Runs, Traces                       | 🆕 Workflow runs, Step traces    | 🆕 Network runs, Primitive traces   |
| **Evaluation**    | ✅ Scorers, Feedback                  | 🆕 Workflow-level metrics        | 🆕 Network-level metrics            |
| **Versioning**    | ✅ Version history                    | 🆕 Workflow versions             | 🆕 Network topology versions        |
| **Deployment**    | Partial                               | 🆕 Promote to production         | 🆕 Promote to production            |
| **Learning**      | ✅ Continuous learning                | 🆕 Workflow optimization         | 🆕 Network optimization             |

### 2.3 Agent Workspace (Existing - Reference Architecture)

**Current Routes**:

```
/workspace                      → Main dashboard
/workspace/[agentSlug]/overview → Health dashboard
/workspace/[agentSlug]/configure → CRUD configuration
/workspace/[agentSlug]/runs     → Execution history
/workspace/[agentSlug]/traces   → Time-travel debugging
/workspace/[agentSlug]/evaluations → Quality metrics
/workspace/[agentSlug]/analytics → Performance stats
/workspace/[agentSlug]/costs    → Cost tracking
/workspace/[agentSlug]/versions → Version history
/workspace/[agentSlug]/guardrails → Policy management
/workspace/[agentSlug]/learning → Continuous learning
/workspace/[agentSlug]/test     → Test execution
/workspace/[agentSlug]/simulations → Batch testing
```

**Key Models**:

- `Agent` - Configuration
- `AgentRun` - Execution records
- `AgentTrace` / `AgentTraceStep` - Detailed traces
- `AgentEvaluation` - Scores
- `AgentVersion` - Version history
- `LearningSession` / `LearningProposal` - Continuous learning

### 2.4 Workflow Workspace (New)

**Proposed Routes**:

```
/workflows                        → Workflow dashboard
/workflows/new                    → Create new workflow
/workflows/[workflowSlug]         → Overview
/workflows/[workflowSlug]/design  → Visual canvas builder
/workflows/[workflowSlug]/runs    → Execution history
/workflows/[workflowSlug]/traces  → Step-by-step traces
/workflows/[workflowSlug]/test    → Test execution
/workflows/[workflowSlug]/versions → Version history
/workflows/[workflowSlug]/deploy  → Deployment management
```

**Required Models** (see Part 3):

- `Workflow` - Definition + visual graph
- `WorkflowRun` - Execution records
- `WorkflowStep` - Step execution traces
- `WorkflowVersion` - Version history

### 2.5 Network Workspace (New)

**Proposed Routes**:

```
/networks                         → Network dashboard
/networks/new                     → Create new network
/networks/[networkSlug]           → Overview
/networks/[networkSlug]/topology  → Visual topology designer
/networks/[networkSlug]/primitives → Configure agents/workflows/tools
/networks/[networkSlug]/runs      → Execution history
/networks/[networkSlug]/traces    → Multi-primitive traces
/networks/[networkSlug]/test      → Test execution
/networks/[networkSlug]/versions  → Version history
/networks/[networkSlug]/deploy    → Deployment management
```

**Required Models** (see Part 3):

- `Network` - Topology definition
- `NetworkPrimitive` - Junction table for agents/workflows/tools
- `NetworkRun` - Execution records
- `NetworkStep` - Routing + primitive execution traces
- `NetworkVersion` - Version history

---

## Part 3: Database Schema Design

### 3.1 Workflow Models

```prisma
// Workflow Definition
model Workflow {
    id          String  @id @default(cuid())
    slug        String  @unique
    name        String
    description String? @db.Text

    // Visual definition (React Flow compatible)
    definitionJson Json // { nodes: [], edges: [], viewport: {} }

    // Compiled representation (cached)
    compiledJson Json? // Mastra workflow structure
    compiledAt   DateTime?
    compiledHash String? // Hash of definition for cache invalidation

    // Schemas
    inputSchemaJson  Json? // Zod schema as JSON Schema
    outputSchemaJson Json? // Zod schema as JSON Schema

    // Configuration
    maxSteps    Int   @default(50)
    timeout     Int? // Max execution time in seconds
    retryConfig Json? // { maxRetries, backoff }

    // Status
    isPublished Boolean @default(false)
    isActive    Boolean @default(true)
    version     Int     @default(1)

    // Tenancy
    workspaceId String?
    workspace   Workspace?   @relation(fields: [workspaceId], references: [id])
    ownerId     String?
    type        WorkflowType @default(USER)

    // Audit
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    createdBy String?

    // Relations
    versions          WorkflowVersion[]
    runs              WorkflowRun[]
    // Used by networks
    networkPrimitives NetworkPrimitive[]

    @@index([slug])
    @@index([workspaceId])
    @@index([isPublished])
    @@map("workflow")
}

enum WorkflowType {
    SYSTEM // Code-defined, protected
    USER // User-created
}

// Workflow Version History
model WorkflowVersion {
    id             String   @id @default(cuid())
    workflowId     String
    workflow       Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
    version        Int
    definitionJson Json // Snapshot of visual definition
    description    String?  @db.Text
    createdAt      DateTime @default(now())
    createdBy      String?

    @@unique([workflowId, version])
    @@index([workflowId])
    @@map("workflow_version")
}

// Workflow Execution
model WorkflowRun {
    id         String    @id @default(cuid())
    workflowId String
    workflow   Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)
    status     RunStatus @default(QUEUED)

    // Input/Output
    inputJson  Json
    outputJson Json?

    // Suspension (human-in-the-loop)
    suspendedAt     DateTime?
    suspendedStep   String?
    suspendDataJson Json?
    resumedAt       DateTime?
    resumeDataJson  Json?

    // Execution stats
    durationMs  Int?
    startedAt   DateTime  @default(now())
    completedAt DateTime?

    // Version tracking
    versionId String?

    // Source tracking
    source       String? // "api", "test", "network", "trigger"
    triggerId    String? // If triggered by schedule/webhook
    networkRunId String? // If executed by network
    networkRun   NetworkRun? @relation(fields: [networkRunId], references: [id])

    // Relations
    steps WorkflowRunStep[]

    @@index([workflowId, createdAt])
    @@index([status])
    @@map("workflow_run")
}

// Workflow Step Execution
model WorkflowRunStep {
    id    String      @id @default(cuid())
    runId String
    run   WorkflowRun @relation(fields: [runId], references: [id], onDelete: Cascade)

    stepId   String // Node ID from definition
    stepType String // "step", "branch", "parallel", "foreach", "human"
    stepName String?

    status     RunStatus @default(QUEUED)
    inputJson  Json?
    outputJson Json?
    errorJson  Json?

    // For loops
    iterationIndex Int?

    // Timing
    startedAt   DateTime?
    completedAt DateTime?
    durationMs  Int?

    // Nested execution
    agentRunId String? // If step called an agent

    @@index([runId])
    @@index([stepId])
    @@map("workflow_run_step")
}
```

### 3.2 Network Models

```prisma
// Network Definition
model Network {
    id          String  @id @default(cuid())
    slug        String  @unique
    name        String
    description String? @db.Text

    // Routing agent configuration
    instructions  String @db.Text
    modelProvider String
    modelName     String
    temperature   Float? @default(0.7)

    // Visual topology
    topologyJson Json // { nodes: [], edges: [], layout: {} }

    // Memory configuration (required for networks)
    memoryConfig Json // { lastMessages, semanticRecall, workingMemory }

    // Execution settings
    maxSteps Int @default(10)

    // Status
    isPublished Boolean @default(false)
    isActive    Boolean @default(true)
    version     Int     @default(1)

    // Tenancy
    workspaceId String?
    workspace   Workspace?  @relation(fields: [workspaceId], references: [id])
    ownerId     String?
    type        NetworkType @default(USER)

    // Audit
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    createdBy String?

    // Relations
    primitives NetworkPrimitive[]
    versions   NetworkVersion[]
    runs       NetworkRun[]

    @@index([slug])
    @@index([workspaceId])
    @@index([isPublished])
    @@map("network")
}

enum NetworkType {
    SYSTEM
    USER
}

// Network Primitive Junction
model NetworkPrimitive {
    id        String  @id @default(cuid())
    networkId String
    network   Network @relation(fields: [networkId], references: [id], onDelete: Cascade)

    primitiveType String // "agent", "workflow", "tool"

    // Reference (one of these will be set)
    agentId    String?
    agent      Agent?    @relation(fields: [agentId], references: [id], onDelete: Cascade)
    workflowId String?
    workflow   Workflow? @relation(fields: [workflowId], references: [id], onDelete: Cascade)
    toolId     String? // Tool registry key

    // Override description for routing
    description String? @db.Text

    // Position in visual topology
    position Json? // { x, y }

    createdAt DateTime @default(now())

    @@unique([networkId, agentId])
    @@unique([networkId, workflowId])
    @@unique([networkId, toolId])
    @@index([networkId])
    @@map("network_primitive")
}

// Network Version History
model NetworkVersion {
    id             String   @id @default(cuid())
    networkId      String
    network        Network  @relation(fields: [networkId], references: [id], onDelete: Cascade)
    version        Int
    topologyJson   Json // Snapshot
    primitivesJson Json // Snapshot of primitive configuration
    description    String?  @db.Text
    createdAt      DateTime @default(now())
    createdBy      String?

    @@unique([networkId, version])
    @@index([networkId])
    @@map("network_version")
}

// Network Execution
model NetworkRun {
    id        String    @id @default(cuid())
    networkId String
    network   Network   @relation(fields: [networkId], references: [id], onDelete: Cascade)
    status    RunStatus @default(QUEUED)

    // Input/Output
    inputText  String  @db.Text
    outputText String? @db.Text
    outputJson Json? // If structured output

    // Thread/Memory
    threadId   String?
    resourceId String?

    // Stats
    stepsExecuted Int?
    durationMs    Int?
    startedAt     DateTime  @default(now())
    completedAt   DateTime?

    // Token usage
    totalTokens  Int?
    totalCostUsd Float?

    // Version tracking
    versionId String?

    // Source
    source String? // "api", "test", "trigger"

    // Relations
    steps        NetworkRunStep[]
    workflowRuns WorkflowRun[] // Workflows triggered by this network

    @@index([networkId, createdAt])
    @@index([status])
    @@index([threadId])
    @@map("network_run")
}

// Network Step Execution
model NetworkRunStep {
    id    String     @id @default(cuid())
    runId String
    run   NetworkRun @relation(fields: [runId], references: [id], onDelete: Cascade)

    stepNumber Int
    stepType   String // "routing", "agent", "workflow", "tool"

    // What was executed
    primitiveType String? // "agent", "workflow", "tool"
    primitiveId   String? // Agent slug, workflow slug, or tool key

    // Routing decision (for routing steps)
    routingDecision Json? // { selectedPrimitive, reasoning }

    // Execution details
    inputJson  Json?
    outputJson Json?
    errorJson  Json?

    status      RunStatus @default(QUEUED)
    startedAt   DateTime?
    completedAt DateTime?
    durationMs  Int?

    // Token usage for this step
    tokens  Int?
    costUsd Float?

    @@index([runId])
    @@index([stepNumber])
    @@map("network_run_step")
}
```

### 3.3 Add Relations to Existing Models

```prisma
// Add to Agent model
model Agent {
    // ... existing fields ...

    // Network relations
    networkPrimitives NetworkPrimitive[]
}

// Add to Workspace model
model Workspace {
    // ... existing fields ...

    workflows Workflow[]
    networks  Network[]
}
```

---

## Part 4: Full Observability Layer

### 4.1 Observability Requirements

| Layer            | Agent                 | Workflow               | Network                     |
| ---------------- | --------------------- | ---------------------- | --------------------------- |
| **Tracing**      | ✅ AgentTrace + Steps | 🆕 WorkflowRun + Steps | 🆕 NetworkRun + Steps       |
| **Logging**      | ✅ Via trace steps    | 🆕 Step-level logs     | 🆕 Routing + primitive logs |
| **Evaluations**  | ✅ Scorers per run    | 🆕 Workflow metrics    | 🆕 Network metrics          |
| **Metrics**      | ✅ Daily aggregates   | 🆕 Workflow aggregates | 🆕 Network aggregates       |
| **Debug Replay** | ✅ Time-travel        | 🆕 Step replay         | 🆕 Full network replay      |
| **Versioning**   | ✅ AgentVersion       | 🆕 WorkflowVersion     | 🆕 NetworkVersion           |
| **Rollback**     | ✅ Supported          | 🆕 Supported           | 🆕 Supported                |

### 4.2 Unified Tracing Architecture

```
NetworkRun
├── NetworkRunStep (type: "routing")
│   └── routingDecision: { selected: "trip-destination", reasoning: "..." }
├── NetworkRunStep (type: "agent")
│   └── AgentRun
│       └── AgentTrace
│           └── AgentTraceStep[]
├── NetworkRunStep (type: "workflow")
│   └── WorkflowRun
│       └── WorkflowRunStep[]
└── NetworkRunStep (type: "tool")
    └── toolCallJson: { input, output, duration }
```

### 4.3 Metrics & Aggregates

**New Daily Aggregate Models**:

```prisma
model WorkflowMetricDaily {
    id               String   @id @default(cuid())
    workflowId       String
    date             DateTime @db.Date
    runs             Int      @default(0)
    successRate      Float?
    avgDurationMs    Float?
    suspensionRate   Float? // % of runs that suspended
    avgStepsExecuted Float?

    @@unique([workflowId, date])
    @@map("workflow_metric_daily")
}

model NetworkMetricDaily {
    id                  String   @id @default(cuid())
    networkId           String
    date                DateTime @db.Date
    runs                Int      @default(0)
    successRate         Float?
    avgDurationMs       Float?
    avgStepsExecuted    Float?
    avgRoutingDecisions Float?
    totalCostUsd        Float?

    // Primitive usage breakdown
    agentCallCount    Int @default(0)
    workflowCallCount Int @default(0)
    toolCallCount     Int @default(0)

    @@unique([networkId, date])
    @@map("network_metric_daily")
}
```

### 4.4 Observability UI Components

**Time-Travel Debugger (Enhanced)**:

- Step-by-step replay with pause/play
- Show LLM reasoning at each routing decision
- Visualize data flow between primitives
- Side-by-side comparison with previous runs

**Topology Execution View**:

- Real-time highlighting of active nodes
- Edge animations showing data flow
- Status badges on each node
- Expandable details panel

---

## Part 5: AI-Native Workflow/Network Generation

### 5.1 Design Philosophy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI-FIRST AUTHORING FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐     ┌────────────────┐     ┌─────────────────┐  │
│  │  User Intent  │ ──► │ AI Generation  │ ──► │ Human Validation│  │
│  │  (Natural     │     │ (Workflow/     │     │ (Review, Tweak, │  │
│  │   Language)   │     │  Network JSON) │     │  Approve)       │  │
│  └───────────────┘     └────────────────┘     └─────────────────┘  │
│         │                      │                      │            │
│         ▼                      ▼                      ▼            │
│  ┌───────────────┐     ┌────────────────┐     ┌─────────────────┐  │
│  │   Execution   │ ──► │ Observability  │ ──► │  AI Refinement  │  │
│  │   (Run the    │     │ (What worked,  │     │  (Propose       │  │
│  │    workflow)  │     │  what didn't)  │     │   improvements) │  │
│  └───────────────┘     └────────────────┘     └─────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Workflow Generation Pipeline

```typescript
interface WorkflowGenerationRequest {
    intent: string; // Natural language description
    context?: {
        availableAgents: AgentSummary[]; // Agents user has access to
        availableTools: ToolSummary[]; // MCP tools available
        existingWorkflows: WorkflowSummary[]; // For composition
    };
    constraints?: {
        mustIncludeHuman?: boolean; // Require human-in-the-loop
        maxSteps?: number;
        preferredAgents?: string[];
    };
}

interface WorkflowGenerationResult {
    workflow: {
        name: string;
        description: string;
        inputSchema: JsonSchema;
        outputSchema: JsonSchema;
        nodes: WorkflowNode[];
        edges: WorkflowEdge[];
    };
    reasoning: string; // Explain why this design
    alternatives?: WorkflowSummary[]; // Other approaches considered
    warnings?: string[]; // Potential issues
}
```

### 5.3 Intention Capture Layer

Inspired by the Opus Prompt Intention Framework:

```typescript
interface WorkflowIntention {
    // Extracted signals from user query
    primaryGoal: string;
    subGoals: string[];

    // Data flow analysis
    inputs: { name: string; type: string; source: string }[];
    outputs: { name: string; type: string; destination: string }[];

    // Required capabilities
    requiredCapabilities: Array<
        | { type: "agent"; capability: string }
        | { type: "tool"; capability: string }
        | { type: "human"; reason: string }
    >;

    // Control flow hints
    controlFlow: {
        hasConditionals: boolean;
        hasParallelism: boolean;
        hasLoops: boolean;
        hasHumanApproval: boolean;
    };

    // Quality requirements
    qualityHints: {
        latencySensitive: boolean;
        costSensitive: boolean;
        requiresExplanation: boolean;
    };
}
```

### 5.4 Validation & Safety Layers

```typescript
interface WorkflowValidation {
    // Structural validation
    hasStartNode: boolean;
    hasEndNode: boolean;
    allNodesReachable: boolean;
    noCycles: boolean; // Unless intentional loops

    // Schema validation
    inputOutputCompatible: boolean;
    allSchemasValid: boolean;

    // Runtime validation
    allAgentsExist: boolean;
    allToolsAvailable: boolean;
    credentialsConfigured: boolean;

    // Safety checks
    humanApprovalBeforeExternalActions: boolean;
    noInfiniteLoopRisk: boolean;
    budgetLimitsSet: boolean;
}
```

### 5.5 Iterative Improvement Loop

```typescript
// After execution
const analysisPrompt = `
Analyze this workflow execution:

Input: ${run.input}
Output: ${run.output}
Duration: ${run.durationMs}ms
Status: ${run.status}
Errors: ${run.errors}

Step breakdown:
${run.steps.map((s) => `- ${s.name}: ${s.status} (${s.durationMs}ms)`).join("\n")}

User feedback: ${run.feedback}

Suggest improvements to:
1. Reduce latency
2. Improve reliability
3. Better handle edge cases
4. Simplify the workflow
`;
```

---

## Part 6: Workflow Builder UX Design

### 6.1 N8N-Style Visual Canvas

**Core Components**:

```typescript
// Canvas with React Flow
interface WorkflowCanvas {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport: { x: number; y: number; zoom: number };

    // Canvas operations
    onNodeAdd: (type: NodeType, position: Position) => void;
    onNodeDelete: (nodeId: string) => void;
    onConnect: (source: string, target: string) => void;
    onNodeSelect: (nodeId: string) => void;
}

// Node types
type NodeType =
    | "start"
    | "end"
    | "agent" // Call an agent
    | "tool" // Call a tool
    | "workflow" // Nested workflow
    | "code" // Custom code step
    | "branch" // Conditional
    | "parallel" // Parallel execution
    | "foreach" // Loop over array
    | "human" // Human-in-the-loop
    | "delay" // Wait
    | "webhook" // External trigger
    | "transform"; // Data transformation
```

### 6.2 Node Configuration Panel

```typescript
interface NodeConfigPanel {
    node: WorkflowNode;

    // Common config
    name: string;
    description: string;

    // Type-specific config
    agentConfig?: {
        agentSlug: string;
        promptTemplate: string;
        outputFormat: "text" | "json";
        outputSchema?: JsonSchema;
    };

    toolConfig?: {
        toolKey: string;
        parameterMappings: Record<string, string>;
    };

    branchConfig?: {
        conditions: Array<{
            expression: string;
            targetNodeId: string;
        }>;
        defaultTarget: string;
    };

    humanConfig?: {
        title: string;
        description: string;
        formSchema: JsonSchema;
        timeout?: number;
    };
}
```

### 6.3 Data Mapper Component

```typescript
interface DataMapper {
    // Available data from previous steps
    availableData: {
        workflowInput: JsonSchema;
        stepOutputs: Record<string, JsonSchema>;
        variables: Record<string, JsonSchema>;
    };

    // Target schema
    targetSchema: JsonSchema;

    // Mappings
    mappings: Array<{
        targetPath: string;
        sourceExpression: string; // e.g., "{{steps.fetchData.result.name}}"
    }>;

    // Expression builder
    onBuildExpression: (path: string) => string;
}
```

### 6.4 AI Chat Integration

```typescript
interface WorkflowBuilderChat {
    // Current workflow state
    workflow: WorkflowDefinition;

    // Chat history
    messages: Message[];

    // AI capabilities
    commands: {
        "/generate": "Create workflow from description";
        "/explain": "Explain what this workflow does";
        "/optimize": "Suggest optimizations";
        "/debug": "Help debug execution issue";
        "/add": "Add a step that does X";
        "/connect": "Connect these nodes";
    };

    // AI actions that modify workflow
    onAIAction: (action: AIAction) => void;
}

type AIAction =
    | { type: "add_node"; node: WorkflowNode; position: Position }
    | { type: "remove_node"; nodeId: string }
    | { type: "add_edge"; source: string; target: string }
    | { type: "update_config"; nodeId: string; config: NodeConfig }
    | { type: "replace_workflow"; workflow: WorkflowDefinition };
```

### 6.5 Network Topology Designer

Similar to workflow builder but specialized for networks:

```typescript
interface NetworkTopologyDesigner {
    // Network configuration
    network: NetworkDefinition;

    // Primitive palette
    palette: {
        agents: AgentSummary[]; // Available agents
        workflows: WorkflowSummary[]; // Available workflows
        tools: ToolSummary[]; // Available tools
    };

    // Routing agent config
    routingConfig: {
        instructions: string;
        model: ModelConfig;
        memory: MemoryConfig;
    };

    // Primitive configuration
    primitives: NetworkPrimitive[];

    // Execution preview
    onTestRoute: (message: string) => RoutingPreview;
}
```

---

## Part 7: Execution & Deployment Lifecycle

### 7.1 Environment Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENT LIFECYCLE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Development          Staging            Production                │
│  ┌───────────┐       ┌───────────┐      ┌───────────┐             │
│  │ • Draft   │  ──►  │ • Testing │  ──► │ • Live    │             │
│  │ • Debug   │       │ • Review  │      │ • Monitor │             │
│  │ • Iterate │       │ • Approve │      │ • Scale   │             │
│  └───────────┘       └───────────┘      └───────────┘             │
│       │                   │                   │                    │
│       ▼                   ▼                   ▼                    │
│  Version: DRAFT      Version: RC-1       Version: v1.0.0          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Deployment Status Model

```prisma
enum DeploymentStatus {
    DRAFT // Being edited
    TESTING // In test environment
    PENDING_REVIEW // Awaiting approval
    APPROVED // Ready for production
    DEPLOYED // Live in production
    DEPRECATED // Superseded by newer version
    ARCHIVED // No longer in use
}

model Deployment {
    id String @id @default(cuid())

    // What is being deployed
    entityType String // "agent", "workflow", "network"
    entityId   String
    versionId  String

    // Environment
    environment String // "development", "staging", "production"
    status      DeploymentStatus @default(DRAFT)

    // Approval
    approvedBy String?
    approvedAt DateTime?

    // Traffic
    trafficPercent Float? // For gradual rollout

    // Rollback
    previousDeploymentId String?

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@unique([entityType, entityId, environment])
    @@index([entityType, entityId])
    @@map("deployment")
}
```

### 7.3 Execution Modes

| Mode           | Purpose                | Observability      | Side Effects   |
| -------------- | ---------------------- | ------------------ | -------------- |
| **Preview**    | Quick test in editor   | Minimal            | Mocked         |
| **Test**       | Full test with tracing | Full               | Mocked or real |
| **Debug**      | Step-by-step execution | Full + breakpoints | Mocked         |
| **Production** | Live execution         | Full               | Real           |

### 7.4 API Routes

```typescript
// Workflow Execution
POST /api/workflows/:slug/execute
POST /api/workflows/:slug/execute/stream  // Streaming
POST /api/workflows/:slug/runs/:runId/resume  // Resume suspended

// Network Execution
POST /api/networks/:slug/execute
POST /api/networks/:slug/execute/stream  // Streaming

// Deployment Management
POST /api/deployments
PUT  /api/deployments/:id
POST /api/deployments/:id/promote
POST /api/deployments/:id/rollback
```

---

## Part 8: Implementation Roadmap

### Phase 1: Foundation (Database & Core Models)

- Add Workflow models to Prisma schema
- Add Network models to Prisma schema
- Add Deployment model
- Create migrations
- Implement CRUD APIs for workflows
- Implement CRUD APIs for networks

### Phase 2: Workflow Workspace MVP

- Create /workflows routes structure
- Build workflow list/dashboard page
- Implement visual canvas with React Flow
- Build node palette (agent, tool, branch, parallel, human)
- Implement node configuration panel
- Build data mapper component
- Create workflow execution API
- Build run history UI

### Phase 3: Network Workspace MVP

- Create /networks routes structure
- Build network list/dashboard page
- Implement topology designer
- Build primitive selection/configuration
- Implement routing agent configuration
- Create network execution API (wrap .network())
- Build run history with routing visibility

### Phase 4: Observability Enhancement

- Unified trace viewer (agent + workflow + network)
- Step-by-step replay for workflows
- Network routing visualization
- Daily metrics aggregation jobs
- Alert configuration for workflows/networks

### Phase 5: AI-Native Generation

- Natural language → workflow JSON generator
- Intention capture layer
- Validation & safety checks
- AI chat integration in builder
- Iterative improvement suggestions

### Phase 6: Deployment & Lifecycle

- Environment management UI
- Approval workflow
- Gradual rollout support
- Rollback capability
- Version comparison

### Phase 7: Polish & Integration

- Workflow templates library
- Network templates library
- Cross-workspace search
- Unified dashboard
- Documentation

---

## Part 9: Key Decisions & Trade-offs

### 9.1 Networks vs Workflows - When to Use Each

| Use Case                         | Recommendation                |
| -------------------------------- | ----------------------------- |
| Fixed, deterministic process     | **Workflow**                  |
| Dynamic routing based on content | **Network**                   |
| Human-in-the-loop approval       | **Workflow** (suspend/resume) |
| Multi-agent collaboration        | **Network**                   |
| Batch processing                 | **Workflow** (foreach)        |
| Conversational task completion   | **Network**                   |
| API automation                   | **Workflow**                  |
| Research + synthesis             | **Network**                   |

### 9.2 Visual Builder vs AI Generation

**Recommendation**: Support both, with AI as the primary mode

1. AI generates initial workflow from natural language
2. Human reviews in visual builder
3. Human makes tweaks using visual editor
4. AI can be invoked for help at any point

### 9.3 Code-First vs Database-First

**Current State**:

- Agents: Database-first ✅
- Workflows: Code-first (in packages/agentc2/src/workflows)
- Networks: Hybrid (NetworkResolver loads agents from DB, workflows from code)

**Recommendation**: Move to database-first for workflows and networks

- Store visual definitions in database
- Compile to Mastra primitives at runtime
- Keep code-defined versions for system/core workflows

---

## Appendix A: File Locations Reference

### Existing Agent Workspace

```
apps/agent/src/app/workspace/           # Workspace pages
apps/agent/src/app/api/agents/          # Agent APIs
apps/agent/src/app/api/workspace/       # Workspace APIs
packages/database/prisma/schema.prisma  # Database schema
packages/agentc2/src/agents/             # Agent implementations
```

### Proposed Workflow Workspace

```
apps/agent/src/app/workflows/           # Workflow pages
apps/agent/src/app/api/workflows/       # Workflow APIs
apps/agent/src/components/workflow-builder/  # Builder components
packages/agentc2/src/workflows/builder/  # Workflow compiler
```

### Proposed Network Workspace

```
apps/agent/src/app/networks/            # Network pages
apps/agent/src/app/api/networks/        # Network APIs
apps/agent/src/components/network-builder/  # Topology designer
packages/agentc2/src/networks/           # Network runtime
```

---

## Appendix B: Existing Workflow Visualization

You already have a workflow visualizer at:

- `apps/agent/src/components/workflows/WorkflowVisualizer.tsx`
- `apps/agent/src/components/workflows/WorkflowCanvas.tsx`
- `apps/agent/src/components/workflows/WorkflowNode.tsx`

This can be enhanced to become the full workflow builder.

---

## Appendix C: Mastra Network API Reference

```typescript
// From @mastra/core
const result = await agent.network(messages, {
  maxSteps?: number;
  memory?: {
    thread: string | { id: string; metadata?: Record<string, any> };
    resource: string;
    options?: MemoryConfig;
  };
  structuredOutput?: {
    schema: ZodSchema | JSONSchema7;
    model?: MastraModelConfig;
    instructions?: string;
  };
  modelSettings?: {
    temperature?: number;
    maxOutputTokens?: number;
    // ...
  };
});

// Returns stream of events
for await (const chunk of result) {
  switch (chunk.type) {
    case "routing-agent-start": // ...
    case "agent-execution-start": // ...
    case "workflow-execution-start": // ...
    case "tool-execution-start": // ...
    case "network-execution-event-step-finish": // ...
    case "network-object": // Structured output partial
    case "network-object-result": // Structured output final
  }
}
```
