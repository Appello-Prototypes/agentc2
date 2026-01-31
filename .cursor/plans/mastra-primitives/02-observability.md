# Phase 2: Add Observability and Tracing

## Objective

Enable tracing and observability to monitor agent runs, LLM calls, tool executions, and workflow steps, providing visibility into AI operations for debugging and optimization.

## Documentation References

| Feature                 | Source      | URL                                                     |
| ----------------------- | ----------- | ------------------------------------------------------- |
| Tracing Overview        | Mastra Docs | https://mastra.ai/docs/observability/tracing            |
| OtelConfig Reference    | Mastra Docs | https://mastra.ai/reference/observability/otel-config   |
| Observability Providers | Mastra Docs | https://mastra.ai/reference/observability/providers/    |
| Memory Debugging        | Mastra Docs | https://mastra.ai/docs/memory/overview#debugging-memory |

## Documentation Corrections

**IMPORTANT**: The original plan used `@mastra/observability` package with `Observability`, `DefaultExporter`, and `SensitiveDataFilter` classes. According to the official documentation, **Mastra uses OpenTelemetry Protocol (OTLP)** directly via the `telemetry` configuration on the Mastra instance, NOT a separate observability package.

### Corrected Implementation Approach

The documentation shows telemetry is configured directly in the Mastra constructor:

```typescript
export const mastra = new Mastra({
    // ... other config
    telemetry: {
        serviceName: "my-app",
        enabled: true,
        sampling: {
            type: "always_on"
        },
        export: {
            type: "otlp",
            endpoint: "http://localhost:4318"
        }
    }
});
```

## Implementation Steps

### Step 1: Configure Telemetry in Mastra Instance

Update `packages/mastra/src/mastra.ts`:

```typescript
import { Mastra } from "@mastra/core/mastra";
import { storage } from "./storage";
import { assistantAgent } from "./agents";
import { analysisWorkflow } from "./workflows";

declare global {
    var mastraInstance: Mastra | undefined;
}

function getMastra(): Mastra {
    if (!global.mastraInstance) {
        const isDev = process.env.NODE_ENV !== "production";

        global.mastraInstance = new Mastra({
            agents: {
                assistant: assistantAgent
            },
            workflows: {
                "analysis-workflow": analysisWorkflow
            },
            storage,
            telemetry: {
                serviceName: "mastra-experiment",
                enabled: true,
                sampling: {
                    type: isDev ? "always_on" : "ratio",
                    probability: isDev ? undefined : 0.1
                },
                export: {
                    type: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? "otlp" : "console",
                    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
                    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
                        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
                        : undefined
                }
            }
        });
    }

    return global.mastraInstance;
}

export const mastra = getMastra();
```

- Doc reference: https://mastra.ai/docs/observability/tracing

### Step 2: Add Environment Variables (Optional)

For external OTEL collectors like SigNoz, Jaeger, or Honeycomb:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS={"x-api-key":"your-api-key"}
```

- Doc reference: https://mastra.ai/docs/observability/tracing#environment-variables

### Step 3: Update turbo.json

Add telemetry env vars to globalEnv:

```json
{
    "globalEnv": [
        "DATABASE_URL",
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "OTEL_EXPORTER_OTLP_HEADERS"
    ]
}
```

## Documentation Deviations

| Deviation                                                   | Status        | Justification                                                           |
| ----------------------------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| Original plan used `@mastra/observability` package          | **INCORRECT** | Docs show telemetry is built into `@mastra/core` via `telemetry` config |
| Original plan used `DefaultExporter`, `SensitiveDataFilter` | **INCORRECT** | These classes do not exist in current API                               |
| Using `telemetry` config in Mastra constructor              | **CORRECT**   | Per official docs                                                       |

**Flag**: The original plan's implementation strategy contradicts documentation. This has been corrected above.

## Demo Page Spec

- **Route**: `/demos/observability` (or integrated into existing demos)
- **Inputs**:
    - Agent query input
    - Workflow trigger button
- **Outputs**:
    - Trace ID display after each operation
    - Trace timeline visualization (if using external provider)
    - Token usage statistics
    - Latency metrics
- **Sample data**:
    - Run agent query: "What time is it?"
    - Trigger workflow: Analysis workflow with sample input
    - Display resulting trace IDs and metrics

### Demo Visibility

Since traces are typically viewed in external tools (Mastra Studio, SigNoz, Jaeger), the demo should:

1. Display trace IDs after each operation
2. Link to Mastra Studio for trace inspection
3. Show console output if `export.type: "console"` is configured

### Error State Handling

- Display warning if OTEL endpoint unreachable
- Graceful degradation if telemetry disabled
- Show sampling rate indicator (e.g., "Sampling 10% of traces")

### Loading States

- Brief indicator when trace is being submitted
- No blocking behavior - telemetry is async

## Dependency Map

- **Requires**: None (can be added independently)
- **Enables**: Phase 7 (Evals - trace scoring requires observability), Phase 9 (Demo pages can show trace IDs)
- **Standalone**: Yes - can be enabled without other phases

## Acceptance Criteria

- [ ] Telemetry is enabled and traces are generated for agent runs
- [ ] LLM calls include token usage in trace metadata
- [ ] Tool executions appear as child spans with input/output
- [ ] Workflow runs generate traces with step-by-step spans
- [ ] Traces export to console when no OTEL endpoint configured
- [ ] Traces export to OTEL endpoint when configured
- [ ] Sampling rate is configurable (100% dev, 10% prod)
- [ ] Memory operations (semantic recall) appear in traces

## Test Plan

### Frontend

- [ ] Agent chat displays trace ID after each message
- [ ] Workflow demo displays trace ID after execution
- [ ] No UI errors when telemetry is disabled
- [ ] Trace ID is copyable for external lookup

### Backend

- [ ] `telemetry.enabled: true` generates traces
- [ ] `telemetry.enabled: false` produces no traces
- [ ] `sampling.type: "ratio"` with `probability: 0.5` samples ~50%
- [ ] Console exporter outputs readable JSON traces
- [ ] OTLP exporter sends to configured endpoint
- [ ] Sensitive data (API keys) not included in trace output

### Integration

- [ ] End-to-end agent interaction generates complete trace hierarchy
- [ ] Trace includes: agent_run → llm_call → tool_execution spans
- [ ] Workflow trace includes all step executions
- [ ] Traces are queryable in Mastra Studio (if configured)
- [ ] Token usage aggregates correctly across all LLM calls

## Viewing Traces

### Option 1: Console Output (Development)

When `export.type: "console"`, traces log to stdout:

```
Agent Run: assistant
├── LLM Call: anthropic/claude-sonnet-4-20250514
│   ├── tokens: { input: 150, output: 200 }
│   ├── duration: 1.2s
│   └── model: claude-sonnet-4-20250514
├── Tool Call: get-datetime
│   ├── input: { timezone: "America/New_York" }
│   ├── output: { datetime: "...", ... }
│   └── duration: 5ms
└── Memory Operation: semantic-recall
    ├── query: "user's question"
    ├── results: 3
    └── duration: 150ms
```

### Option 2: Mastra Studio

Run Mastra development server and access Studio at the configured port.

### Option 3: External OTEL Collector

Configure endpoint to send traces to SigNoz, Jaeger, Honeycomb, or other providers.

## Sampling Strategies

| Strategy       | Configuration                                          | Use Case                          |
| -------------- | ------------------------------------------------------ | --------------------------------- |
| `always_on`    | `{ type: "always_on" }`                                | Development - capture every trace |
| `always_off`   | `{ type: "always_off" }`                               | Disable tracing entirely          |
| `ratio`        | `{ type: "ratio", probability: 0.1 }`                  | Production - sample 10%           |
| `parent_based` | `{ type: "parent_based", root: { probability: 0.1 } }` | Inherit sampling from parent span |

## Files Changed

| File                            | Action                                     |
| ------------------------------- | ------------------------------------------ |
| `packages/mastra/src/mastra.ts` | Update with telemetry config               |
| `turbo.json`                    | Add OTEL env vars to globalEnv             |
| `.env`                          | Add OTEL_EXPORTER_OTLP_ENDPOINT (optional) |
