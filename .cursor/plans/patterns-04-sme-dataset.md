---
name: "Patterns Book — Plan 4: SME Review & Dataset Platform"
overview: "Build a dedicated SME labeling UI for annotating agent outputs, create structured annotation workflows with failure mode tagging, implement dataset versioning and export, and add observability integrations. Addresses Patterns 15 (Have SMEs Label Data) and 16 (Create Datasets from Production Data)."
todos:
    - id: phase-1-labeling-ui
      content: "Phase 1: SME labeling UI — review agent outputs with rendered views and failure mode tagging"
      status: pending
    - id: phase-2-annotation-workflow
      content: "Phase 2: Structured annotation workflow — multi-annotator, inter-rater reliability, annotation campaigns"
      status: pending
    - id: phase-3-dataset-management
      content: "Phase 3: Dataset management — versioning, lineage, curated datasets from labeled data"
      status: pending
    - id: phase-4-export-import
      content: "Phase 4: Dataset export/import — JSONL, CSV, standard eval formats"
      status: pending
    - id: phase-5-observability
      content: "Phase 5: Observability integrations — OpenTelemetry trace export, optional LangSmith/Langfuse"
      status: pending
isProject: false
---

# Plan 4: SME Review & Dataset Platform

**Book Patterns:** 15 (Have SMEs Label Data), 16 (Create Datasets from Production Data)

**Priority:** Medium — requires Plan 3 Phase 1 (failure taxonomy) as a foundation

**Dependency:** Plan 3 Phase 3.1 provides the `FailureModeType` enum used throughout this plan

---

## Phase 1: SME Labeling UI

**Problem:** The book says: "Software engineers are not your domain experts" and recommends an "intuitive review UI" where SMEs see the full trace with less-important details collapsed, and outputs rendered as they would appear to the user. AgentC2 has `AgentFeedback` (thumbs up/down + comment) but no structured labeling UI.

### 1.1 Schema additions

**File:** `packages/database/prisma/schema.prisma`

```prisma
model AgentAnnotation {
    id       String   @id @default(cuid())
    runId    String
    run      AgentRun @relation(fields: [runId], references: [id], onDelete: Cascade)
    turnId   String?
    agentId  String
    agent    Agent    @relation(fields: [agentId], references: [id])
    tenantId String?

    // Annotation content
    overallGrade    String // "correct", "partially_correct", "incorrect"
    failureModes    FailureModeType[] // From Plan 3 taxonomy
    notes           String?           @db.Text
    tags            String[] // Free-form tags for discovery
    correctedOutput String?           @db.Text // What the correct output should have been

    // Annotator info
    annotatorId   String
    annotatorName String
    annotatorRole String? // "domain_expert", "engineer", "qa"

    // Metadata
    reviewDurationMs Int? // How long the SME spent reviewing
    createdAt        DateTime @default(now())
    updatedAt        DateTime @updatedAt

    @@index([agentId, tenantId])
    @@index([runId])
}
```

### 1.2 Labeling API

**File:** `apps/agent/src/app/api/agents/[id]/annotations/route.ts` (new)

- **GET**: List annotations for an agent, with filters (grade, failureMode, annotator, dateRange)
- **POST**: Create annotation (requires runId, overallGrade; optional failureModes, notes, correctedOutput)
- **PATCH** `/:annotationId`: Update annotation
- **DELETE** `/:annotationId`: Remove annotation

**File:** `apps/agent/src/app/api/agents/[id]/annotations/queue/route.ts` (new)

- **GET**: Return the next N runs that need annotation (prioritized by: no annotations yet, low eval scores, negative feedback, recent)
- Query params: `limit`, `priority` (score_ascending, feedback_negative, random)

### 1.3 Labeling page

**File:** `apps/agent/src/app/agents/[agentSlug]/annotations/page.tsx` (new)

Build a focused review interface:

**Layout:**

- Left panel: Run list (queue of runs needing review)
- Center panel: Run detail with rendered output
- Right panel: Annotation form

**Center panel — Run detail:**

- User input (rendered as a chat message)
- Agent output (rendered as it would appear to the user — markdown, structured data, etc.)
- Expandable sections (collapsed by default):
    - Tool calls and results (show tool name, input summary, output summary)
    - Full agent reasoning trace
    - Raw JSON response
- If the run has existing eval scores, show them as badges

**Right panel — Annotation form:**

- Overall grade: radio buttons (Correct / Partially Correct / Incorrect)
- Failure modes: multi-select checkboxes from `FailureModeType` enum (only shown when grade is not "correct")
- "Add new failure mode" button if SME discovers something not in taxonomy
- Notes: free text for subjective feedback
- Corrected output: text area for what the right answer should have been
- Tags: tag input for free-form categorization
- Submit button → advances to next run in queue

**Keyboard shortcuts:**

- `1/2/3` for grade selection
- `Enter` to submit and advance
- `←/→` to navigate between runs

### 1.4 Review metrics

On the annotations page, show aggregate stats:

- Total annotated / total in queue
- Grade distribution (pie chart)
- Most common failure modes (bar chart)
- Average review time
- Annotations per annotator

---

## Phase 2: Structured Annotation Workflow

**Problem:** The book recommends multiple annotators labeling each data point with inter-rater reliability metrics. AgentC2 currently has no multi-annotator support or annotation campaigns.

### 2.1 Annotation campaign model

**File:** `packages/database/prisma/schema.prisma`

```prisma
model AnnotationCampaign {
    id       String  @id @default(cuid())
    agentId  String
    agent    Agent   @relation(fields: [agentId], references: [id])
    tenantId String?

    name        String
    description String?
    status      String  @default("active") // active, paused, completed

    // Configuration
    targetRunCount    Int // How many runs to annotate
    annotatorsPerRun  Int      @default(1) // For multi-annotator
    selectionCriteria Json? // date range, score filter, feedback filter
    annotatorIds      String[] // Assigned annotators

    // Progress
    completedCount Int    @default(0)
    agreementScore Float? // Inter-rater reliability (Cohen's Kappa or Krippendorff's Alpha)

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([agentId, tenantId])
}
```

### 2.2 Inter-rater reliability calculation

**File:** `packages/agentc2/src/annotations/agreement.ts` (new)

```typescript
export function computeInterRaterReliability(
    annotations: { runId: string; annotatorId: string; grade: string }[]
): {
    cohensKappa: number;
    krippendorffsAlpha: number;
    pairwiseAgreement: Record<string, Record<string, number>>;
    disagreements: { runId: string; grades: string[] }[];
} {
    // Group by runId, compute agreement across annotators
    // Cohen's Kappa for pairs, Krippendorff's Alpha for groups
}
```

### 2.3 Campaign management UI

**File:** `apps/agent/src/app/agents/[agentSlug]/annotations/campaigns/page.tsx` (new)

- Create campaign: select agent, target count, annotators, selection criteria
- Campaign dashboard: progress bar, agreement score, annotator leaderboard
- Disagreement resolution: list runs where annotators disagreed → allow a senior SME to make final call

### 2.4 Campaign queue integration

When a campaign is active, the annotation queue (Phase 1.2) pulls from the campaign's selection criteria and assigns runs to annotators based on `annotatorsPerRun`.

---

## Phase 3: Dataset Management

**Problem:** `LearningDataset` exists but is tightly coupled to the learning system. There's no general-purpose dataset management with versioning, lineage, or curation. The book says datasets should be versioned and stored at cloud scale.

### 3.1 Consolidate dataset models — extend existing, don't duplicate

**AUDIT CORRECTION:** Three dataset-like models already exist:

1. `AgentTestCase` — `inputText`, `expectedOutput`, `tags`, `agentId` (schema lines 1733–1752)
2. `LearningDataset` — `runIds`, `datasetHash`, `selectionCriteria` (schema lines 2243–2260)
3. The plan originally proposed a third `EvalDataset` — this creates unnecessary fragmentation

**Strategy:** Extend `AgentTestCase` to serve as the unified dataset entry, and add a new `TestSuite` grouping model (not a third dataset concept).

**File:** `packages/database/prisma/schema.prisma`

Extend `AgentTestCase` with new optional fields:

```prisma
model AgentTestCase {
    // ... existing fields (id, agentId, tenantId, name, inputText, expectedOutput, tags, createdBy, createdAt, updatedAt)

    // NEW: Dataset grouping
    suiteId String?
    suite   TestSuite? @relation(fields: [suiteId], references: [id])

    // NEW: From annotations
    annotationId String?
    failureModes FailureModeType[]
    grade        String? // "correct", "partially_correct", "incorrect"

    // NEW: From production
    sourceRunId String? // Source AgentRun ID
    sourceScore Float? // Original eval score

    // NEW: Metadata
    metadata Json?

    testRuns AgentTestRun[]

    @@index([agentId, tenantId])
    @@index([suiteId])
}
```

Add a grouping model:

```prisma
model TestSuite {
    id       String  @id @default(cuid())
    agentId  String
    agent    Agent   @relation(fields: [agentId], references: [id])
    tenantId String?

    name        String
    description String?
    version     Int         @default(1)
    parentId    String? // Previous version for lineage
    parent      TestSuite?  @relation("SuiteVersions", fields: [parentId], references: [id])
    children    TestSuite[] @relation("SuiteVersions")

    source         String // "manual", "production", "annotation", "import"
    sourceMetadata Json?

    testCases AgentTestCase[]

    createdAt DateTime @default(now())
    createdBy String?

    @@unique([agentId, name, version])
    @@index([agentId, tenantId])
}
```

This approach:

- `AgentTestCase` remains the single test case model (no duplication)
- `TestSuite` groups test cases with versioning and lineage
- `LearningDataset` continues to serve its purpose (run snapshots for learning sessions)
- No third dataset concept needed

### 3.2 Dataset API

**File:** `apps/agent/src/app/api/agents/[id]/datasets/route.ts` (new)

- **GET**: List datasets for agent (with version history)
- **POST**: Create dataset (manual, from annotations, from production runs)
- **POST** `/:datasetId/version`: Create new version (fork from existing)
- **GET** `/:datasetId/entries`: List entries with pagination
- **POST** `/:datasetId/entries`: Add entries
- **DELETE** `/:datasetId/entries/:entryId`: Remove entry

### 3.3 Create dataset from annotations

**File:** `packages/agentc2/src/annotations/to-dataset.ts` (new)

```typescript
export async function createDatasetFromAnnotations(options: {
    agentId: string;
    campaignId?: string;
    gradeFilter?: string[]; // e.g., ["correct"] for golden dataset
    failureModeFilter?: FailureModeType[];
    name: string;
}): Promise<EvalDataset> {
    // 1. Query annotations matching filters
    // 2. For each: use run input as inputText, correctedOutput (or original output if correct) as expectedOutput
    // 3. Create EvalDataset + EvalDatasetEntry records
    // 4. Return the dataset
}
```

### 3.4 Create dataset from production data

**File:** `packages/agentc2/src/annotations/from-production.ts` (new)

```typescript
export async function createDatasetFromProduction(options: {
    agentId: string;
    dateRange: { from: Date; to: Date };
    scoreFilter?: { min?: number; max?: number }; // e.g., low-scoring runs for failure dataset
    feedbackFilter?: "positive" | "negative";
    sampleSize?: number;
    name: string;
}): Promise<EvalDataset>;
```

### 3.5 Dataset management UI

**File:** `apps/agent/src/app/agents/[agentSlug]/datasets/page.tsx` (new)

- List datasets with version numbers, entry counts, source
- Create dataset: choose source (manual, annotations, production)
- View entries with search and filter
- Edit entries inline
- Version comparison: diff between dataset versions
- Link to eval runner: "Run eval suite against this dataset"

---

## Phase 4: Dataset Export/Import

**Problem:** No way to export datasets to standard formats or import external datasets.

### 4.1 Export formats

**File:** `packages/agentc2/src/datasets/export.ts` (new)

```typescript
export async function exportDataset(
    datasetId: string,
    format: "jsonl" | "csv" | "mastra"
): Promise<string | Buffer> {
    const entries = await prisma.evalDatasetEntry.findMany({ where: { datasetId } });

    switch (format) {
        case "jsonl":
            // One JSON object per line: { input, expected_output, metadata, tags }
            return entries
                .map((e) =>
                    JSON.stringify({
                        input: e.inputText,
                        expected_output: e.expectedOutput,
                        metadata: e.metadata,
                        failure_modes: e.failureModes,
                        grade: e.grade
                    })
                )
                .join("\n");

        case "csv":
            // Standard CSV with headers
            return toCsv(entries, ["inputText", "expectedOutput", "grade", "failureModes"]);

        case "mastra":
            // Mastra eval format compatible with @mastra/evals
            return JSON.stringify({
                version: 1,
                agent: datasetId,
                entries: entries.map((e) => ({
                    input: e.inputText,
                    expectedOutput: e.expectedOutput,
                    metadata: e.metadata
                }))
            });
    }
}
```

### 4.2 Import formats

**File:** `packages/agentc2/src/datasets/import.ts` (new)

```typescript
export async function importDataset(
    agentId: string,
    name: string,
    data: string,
    format: "jsonl" | "csv"
): Promise<EvalDataset>;
```

### 4.3 Export/import API

**File:** `apps/agent/src/app/api/agents/[id]/datasets/[datasetId]/export/route.ts` (new)
**File:** `apps/agent/src/app/api/agents/[id]/datasets/import/route.ts` (new)

### 4.4 UI buttons

Add export/import buttons to the dataset management UI:

- Export: dropdown with format options, downloads file
- Import: file upload with format auto-detection

---

## Phase 5: Observability Integrations

**Problem:** No trace export to external observability tools. OpenTelemetry packages are in `bun.lock` but not wired.

### 5.1 OpenTelemetry trace export

**File:** `packages/agentc2/src/observability/otel.ts` (new)

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export function initOtelTracing(options: {
    endpoint?: string; // OTEL collector endpoint
    serviceName?: string;
    enabled?: boolean;
}) {
    if (!options.enabled) return;

    const sdk = new NodeSDK({
        traceExporter: new OTLPTraceExporter({ url: options.endpoint }),
        serviceName: options.serviceName ?? "agentc2"
    });
    sdk.start();
}
```

### 5.2 Instrument agent execution

**File:** `packages/agentc2/src/observability/agent-instrumentation.ts` (new)

Create spans for:

- Agent resolution: `agent.resolve` span with attributes (slug, model, toolCount)
- Agent generation: `agent.generate` span with attributes (inputTokens, outputTokens, durationMs)
- Tool calls: `agent.tool.{toolName}` span with attributes (success, durationMs)
- Memory operations: `agent.memory.recall` span
- RAG queries: `agent.rag.query` span
- Evaluations: `agent.eval` span with attributes (tier, overallScore)

### 5.3 Environment configuration

```bash
# .env
OTEL_ENABLED="false"                         # Enable OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT="http://..."     # Collector endpoint
OTEL_SERVICE_NAME="agentc2"                  # Service name
```

### 5.4 Optional: LangSmith/Langfuse adapters

These are lower priority but straightforward once OTEL is in place. Both tools accept OTEL traces or have their own SDKs.

**File:** `packages/agentc2/src/observability/langfuse.ts` (new) — optional
**File:** `packages/agentc2/src/observability/langsmith.ts` (new) — optional

Only implement if there's a specific customer request. OTEL covers the 80% case.

---

## Verification

After completing all phases:

1. Create 5 annotations via the labeling UI → confirm they appear with correct failure modes
2. Create a campaign with 2 annotators → annotate 10 runs → confirm agreement score is computed
3. Create a dataset from annotations → export as JSONL → import back → confirm round-trip fidelity
4. Create a dataset from production data (last 7 days, score < 0.7) → confirm entries match criteria
5. Enable OTEL → run an agent → confirm traces appear in collector
6. Run `bun run type-check && bun run lint && bun run build`
