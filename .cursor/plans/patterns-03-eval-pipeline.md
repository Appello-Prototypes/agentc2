---
name: "Patterns Book — Plan 3: Eval Pipeline Maturation"
overview: "Build a structured failure mode taxonomy, add CI/CD eval gates to the build pipeline, create cross-reference visualization between failure modes and metrics, improve LLM-as-judge calibration, and lay groundwork for simulation-based parameter tuning. Addresses Patterns 10 (List Failure Modes), 12 (Cross-Reference), 13 (Iterate Against Evals), 14 (Create Eval Test Suite), 17 (Evaluate Production Data), and 22 (Simulations)."
todos:
    - id: phase-1-failure-taxonomy
      content: "Phase 1: Structured failure mode taxonomy with classification pipeline"
      status: pending
    - id: phase-2-cicd-eval
      content: "Phase 2: CI/CD eval gates — automated benchmark runs on PR + merge blocking"
      status: pending
    - id: phase-3-cross-reference
      content: "Phase 3: Cross-reference visualization — failure modes ↔ success metrics matrix"
      status: pending
    - id: phase-4-judge-calibration
      content: "Phase 4: LLM-as-judge calibration — binary/categorical scoring, agreement metrics"
      status: pending
    - id: phase-5-simulations
      content: "Phase 5: Simulation framework for agent parameter tuning"
      status: pending
isProject: false
---

# Plan 3: Eval Pipeline Maturation

**Book Patterns:** 10 (List Failure Modes), 12 (Cross-Reference Failures & Metrics), 13 (Iterate Against Evals), 14 (Create Eval Test Suite), 17 (Evaluate Production Data), 22 (Simulations)

**Priority:** High — differentiates production agents from abandoned prototypes

---

## Phase 1: Structured Failure Mode Taxonomy

**Problem:** Current failure classification is operational (`BUDGET_EXCEEDED`, `EXECUTION_ERROR`, `TIMEOUT`, etc.) and signal-based (`LOW_SCORE`, `TOOL_FAILURE`, etc.). Neither answers **why** the agent produced a bad output. The book emphasizes that understanding failure modes (hallucination, wrong tool selection, reasoning error, data quality) is foundational to all downstream eval work.

### 1.1 Define failure taxonomy enum

**File:** `packages/database/prisma/schema.prisma`

Add a new enum and link it to evaluations:

```prisma
enum FailureModeType {
    // Reasoning failures
    HALLUCINATION // Agent stated something not supported by context
    WRONG_TOOL_SELECTION // Agent chose the wrong tool for the task
    REASONING_ERROR // Logical reasoning was flawed
    INSTRUCTION_VIOLATION // Agent violated its own instructions

    // Data failures
    DATA_EXTRACTION_ERROR // Failed to extract correct info from tool results
    STALE_DATA // Used outdated information
    MISSING_CONTEXT // Didn't have enough info to answer correctly

    // Execution failures
    TOOL_PARAMETER_ERROR // Called tool with wrong parameters
    TOOL_DEPENDENCY_FAIL // Tool worked but returned bad data
    LOOP_DETECTED // Agent entered a repetitive loop
    PREMATURE_COMPLETION // Agent stopped before task was complete

    // Quality failures
    TONE_MISMATCH // Tone didn't match requirements
    FORMAT_ERROR // Output format was wrong
    INCOMPLETE_RESPONSE // Missing required elements
    OVER_VERBOSE // Unnecessarily long response

    // Safety failures
    PII_LEAK // PII in output
    PROMPT_INJECTION // Agent followed injected instructions
    UNAUTHORIZED_ACTION // Agent attempted action beyond its scope
}
```

Add to `AgentEvaluation`:

```prisma
model AgentEvaluation {
    // ... existing fields
    failureModes     FailureModeType[] // Classified failure modes for this run
    failureModeNotes String?           @db.Text // SME notes on failure classification
}
```

### 1.2 Auto-classify failure modes in Tier 2 evaluation

**File:** `packages/agentc2/src/scorers/auditor.ts`

Extend the Tier 2 auditor prompt to include failure mode classification:

Add to the `generateObject` output schema:

```typescript
failureModes: z.array(
    z.object({
        type: z.enum([
            /* FailureModeType values */
        ]),
        evidence: z.string(),
        severity: z.enum(["critical", "major", "minor"]),
        step: z.number().optional()
    })
).describe("Classified failure modes observed in this run");
```

Update the auditor system prompt to include the taxonomy with descriptions and examples for each failure mode, so the LLM can classify accurately.

### 1.3 Store failure mode classifications

**File:** `apps/agent/src/lib/inngest-functions.ts`

In `runEvaluationFunction`, after the auditor returns:

- Extract `failureModes` from the auditor response
- Store in `AgentEvaluation.failureModes`

### 1.4 Failure mode dashboard

**File:** `apps/agent/src/app/agents/[agentSlug]/analytics/`

Add a "Failure Analysis" tab to the analytics page:

- Bar chart: failure mode frequency (last 7/30/90 days)
- Trend lines per failure mode
- Drill-down: click a failure mode → see the runs that exhibited it
- Filter by severity (critical/major/minor)

### 1.5 Failure mode API

**File:** `apps/agent/src/app/api/agents/[id]/failure-modes/route.ts` (new)

- **GET**: Aggregate failure modes for an agent with counts, trends, and severity breakdown
- Query params: `from`, `to`, `severity`, `type`

---

## Phase 2: CI/CD Eval Gates

**Problem:** Despite having `AgentTestCase` and `AgentTestRun` models, there's no automated eval execution on code changes. The book's Pattern 13 says: "Measure against a test dataset in CI to surface and guard against code regressions."

**Current CI:** `.github/workflows/deploy-do.yml` has a `test` job that runs `type-check` and `lint`. `.github/workflows/security-gates.yml` runs `bun run test`. Neither includes eval runs.

### 2.1 Create an eval runner CLI

**File:** `packages/agentc2/src/evals/runner.ts` (new)

```typescript
export async function runEvalSuite(options: {
    agentSlug: string;
    datasetId?: string;      // specific dataset, or use all test cases
    threshold?: number;       // minimum pass rate (default 0.9)
    scorers?: string[];       // specific scorers to run
    output?: "json" | "table";
}): Promise<EvalSuiteResult> {
    // 1. Load test cases for the agent
    const testCases = await prisma.agentTestCase.findMany({
        where: { agent: { slug: options.agentSlug } }
    });

    // 2. Resolve the agent
    const { agent } = await agentResolver.resolve({ slug: options.agentSlug });

    // 3. Run each test case
    const results: TestRunResult[] = [];
    for (const tc of testCases) {
        const response = await agent.generate([{ role: "user", content: tc.inputText }]);
        const score = await evaluateResponse(response.text, tc.expectedOutput, scorers);
        results.push({ testCaseId: tc.id, passed: score >= threshold, score, output: response.text });

        // Store the run
        await prisma.agentTestRun.create({ data: { ... } });
    }

    // 4. Compute aggregate metrics
    const passRate = results.filter(r => r.passed).length / results.length;
    return { passRate, threshold, passed: passRate >= threshold, results };
}
```

### 2.2 Create a CLI command

**File:** `packages/agentc2/src/evals/cli.ts` (new)

```typescript
// Usage: bun run eval --agent=assistant --threshold=0.9
```

This reads args, calls `runEvalSuite`, and exits with code 0 (pass) or 1 (fail).

### 2.3 Add eval step to CI pipeline

**File:** `.github/workflows/deploy-do.yml`

Add to the `test` job, after lint and type-check:

```yaml
- name: Run agent eval suite
  run: |
      bun run eval --agent=assistant --threshold=0.9 --output=json
  env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**Considerations:**

- Eval runs cost money (LLM calls). Run only on PRs to `main`, not every push
- Use a test-specific database or read-only connection
- Set a cost cap per eval run
- Cache results for unchanged agent configurations

### 2.4 Add eval status to PR checks

**File:** `.github/workflows/eval-gates.yml` (new)

Create a dedicated workflow that:

- Triggers on `pull_request` to `main`
- Runs eval suite for all agents that have test cases
- Posts results as a PR comment (pass rate, regressions, new failures)
- Blocks merge if pass rate drops below the configured threshold per agent

### 2.5 Populate test cases

**File:** `apps/agent/src/app/api/agents/[id]/test-cases/route.ts`

Add PATCH and DELETE methods (currently only GET and POST exist):

- **PATCH** `/:testCaseId`: Update `inputText`, `expectedOutput`, `tags`
- **DELETE** `/:testCaseId`: Remove test case

Add a bulk import endpoint:

- **POST** `/import`: Accept CSV/JSONL with `name`, `inputText`, `expectedOutput`, `tags`

---

## Phase 3: Cross-Reference Visualization

**Problem:** The book describes a workflow: SME reviews → PM cross-references failure modes with metrics → Eng iterates → PM validates. AgentC2 has the data (evaluations, failure modes, scores) but no visualization connecting them.

### 3.1 Cross-reference API

**File:** `apps/agent/src/app/api/agents/[id]/cross-reference/route.ts` (new)

Returns a matrix of failure modes vs. scorecard criteria:

```typescript
// Response shape:
{
    matrix: {
        [failureMode: string]: {
            [scorerCriterion: string]: {
                count: number;          // How many runs had this failure mode
                avgScore: number;       // Average score on this criterion when this failure mode is present
                impact: number;         // Score delta vs. runs without this failure mode
            }
        }
    },
    topCorrelations: [
        { failureMode, criterion, correlation, sampleSize }
    ]
}
```

### 3.2 Cross-reference visualization component

**File:** `apps/agent/src/app/agents/[agentSlug]/analytics/cross-reference.tsx` (new)

Build a heatmap component:

- Y-axis: failure modes
- X-axis: scorecard criteria / business metrics
- Cell color: impact (red = high negative impact, green = no impact)
- Cell value: count of runs
- Click a cell → see the specific runs

### 3.3 Add to analytics page

**File:** `apps/agent/src/app/agents/[agentSlug]/analytics/page.tsx`

Add "Cross-Reference" as a new tab in the analytics page, rendering the heatmap and top correlations.

---

## Phase 4: LLM-as-Judge Calibration

**Problem:** The book recommends binary or categorical scoring over numerical. AgentC2 uses numerical (0.0–1.0) throughout. There's also no judge calibration or agreement metrics.

### 4.1 Add categorical scoring option

**File:** `packages/agentc2/src/scorers/types.ts`

Extend `ScorecardCriterion`:

```typescript
export interface ScorecardCriterion {
    // ... existing fields
    scoringMethod?: "numerical" | "binary" | "categorical"; // default: "numerical"
    categories?: string[]; // e.g., ["good", "fair", "poor"] for categorical
}
```

### 4.2 Update auditor for categorical scoring

**File:** `packages/agentc2/src/scorers/auditor.ts`

When `scoringMethod` is "binary":

- Ask the judge: "Does this response pass or fail on {criterion}? Answer: pass or fail."
- Map: pass = 1.0, fail = 0.0

When `scoringMethod` is "categorical":

- Ask: "Rate this response on {criterion}: good, fair, or poor."
- Map: good = 1.0, fair = 0.5, poor = 0.0

### 4.3 Judge agreement metrics

**File:** `packages/agentc2/src/scorers/calibration.ts` (new)

Implement inter-judge agreement:

```typescript
export async function calibrateJudge(options: {
    agentSlug: string;
    sampleSize: number; // default: 20
    judges: string[]; // model names to compare, e.g., ["gpt-4o", "claude-sonnet-4-20250514"]
}): Promise<CalibrationResult> {
    // 1. Sample N runs with existing evaluations
    // 2. Re-evaluate each with each judge model
    // 3. Compute Cohen's Kappa for each pair of judges
    // 4. Compute Krippendorff's Alpha across all judges
    // 5. Flag criteria with low agreement (< 0.6 Kappa)
}
```

### 4.4 Judge calibration UI

**File:** `apps/agent/src/app/agents/[agentSlug]/analytics/calibration.tsx` (new)

Add a "Judge Calibration" section to analytics:

- Run calibration on demand
- Show agreement matrix (judge × judge × criterion)
- Flag low-agreement criteria with recommendations (improve rubric, add examples)

---

## Phase 5: Simulation Framework

**Problem:** The book predicts simulations will become common for finding optimal agent parameters. AgentC2 has A/B testing via the learning system but no parameter sweep / simulation capability.

### 5.1 Define simulation parameters

**File:** `packages/agentc2/src/simulations/types.ts` (new)

```typescript
export interface SimulationConfig {
    agentSlug: string;
    parameters: SimulationParameter[];
    testCaseIds: string[]; // Which test cases to evaluate
    scorers: string[]; // Which scorers to use
    maxCombinations?: number; // Budget cap
}

export interface SimulationParameter {
    name: string; // e.g., "temperature", "modelName", "topK"
    values: (string | number)[]; // e.g., [0.3, 0.5, 0.7, 0.9]
    path: string; // JSON path in agent config
}
```

### 5.2 Simulation runner

**File:** `packages/agentc2/src/simulations/runner.ts` (new)

```typescript
export async function runSimulation(config: SimulationConfig): Promise<SimulationResult> {
    const combinations = generateCombinations(config.parameters);

    for (const combo of combinations) {
        // 1. Create a temporary agent config with this parameter set
        // 2. Run all test cases against it
        // 3. Score with configured scorers
        // 4. Record results
    }

    // Return ranked results: best parameter combination → worst
    return rankByCombinedScore(results);
}
```

### 5.3 Simulation Inngest function

**File:** `apps/agent/src/lib/inngest-functions.ts`

Register a new event `simulation/run` that:

- Accepts `SimulationConfig`
- Runs the simulation in background (can be long-running)
- Stores results in a new `Simulation` model
- Sends notification when complete

### 5.4 Simulation UI

**File:** `apps/agent/src/app/agents/[agentSlug]/simulations/page.tsx` (new)

- Configure simulation parameters (temperature range, model options, etc.)
- Select test cases and scorers
- Run simulation
- View results as a ranked table with score comparisons
- "Apply best" button to update agent configuration with winning parameters

---

## Verification

After completing all phases:

1. Verify failure modes are automatically classified on new runs by running a test agent
2. Create a GitHub PR → confirm eval gate runs and posts results
3. View cross-reference heatmap with real evaluation data
4. Run judge calibration with 2 models → confirm agreement metrics are computed
5. Run a simulation with temperature=[0.3, 0.5, 0.7] → confirm results are ranked
6. Run `bun run type-check && bun run lint && bun run build`
