# 01 -- Fix Relevancy Scorer

**Priority:** TIER 1 (Bug Fix)
**Effort:** Medium (2-4 hours)
**Dependencies:** None

## Problem Statement

The relevancy scorer returns 0% for correct answers across ALL agents. Examples:

- Assistant answers "Paris" for "What is the capital of France?" -- relevancy: 0%
- Email-triage correctly classifies and triages 270 real emails (98% success rate) -- relevancy: 12%
- Every evaluated run generates false "critical quality" insights that pollute the platform

This is a **configuration bug**, not a quality problem. It poisons the entire evaluation/learning pipeline.

## Root Cause Analysis

There are TWO relevancy calculations in the system, both flawed:

### 1. Mastra Evals `createAnswerRelevancyScorer` (LLM-based, Tier 1 scorer)

**File:** `packages/mastra/src/scorers/index.ts` (lines 32-34)

```typescript
export const relevancyScorer = createAnswerRelevancyScorer({
    model: "openai/gpt-4o-mini"
});
```

**Called from:** `apps/agent/src/app/api/agents/[id]/evaluations/route.ts` (lines 377-384)

```typescript
const result = await scorerMap[key].run(scorerInput);
// where scorerInput = { input: string, output: string }
```

**Why it returns 0%:** The `createAnswerRelevancyScorer` from `@mastra/evals` uses a "question generation" approach:

1. It generates N questions that the output would answer
2. It checks cosine similarity between generated questions and the original input
3. For short answers like "Paris" or Slack-formatted triage summaries, it generates questions that don't semantically match the original input

This approach fundamentally fails for:

- Short factual answers (no meaningful questions can be generated from "Paris")
- Format-transformed outputs (email in -> Slack triage out)
- Tool-heavy responses (output is tool results, not text answering a question)

### 2. Tier 1 Heuristic Word Overlap (pre-screen)

**File:** `packages/mastra/src/scorers/tier1.ts` (lines 112-126)

```typescript
const inputWords = new Set(
    input
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
);
const outputWords = output.toLowerCase().split(/\s+/);
const overlap = outputWords.filter((w) => inputWords.has(w)).length;
const relevance = inputWords.size > 0 ? Math.min(overlap / inputWords.size, 1.0) : 0.5;
scores.relevance = Math.max(relevance, 0.2);
```

**Why it scores low:** Pure word overlap. Filters words <= 3 chars. For email-triage:

- Input: raw email body with sender info, subject, snippet
- Output: Slack-formatted triage summary with emoji, category labels, action items
- Almost zero word overlap expected, so relevancy = floor of 0.2

## Implementation Plan

### Step 1: Replace the LLM-based relevancy scorer

**File:** `packages/mastra/src/scorers/index.ts`

Replace `createAnswerRelevancyScorer` with a custom scorer that evaluates whether the output is a reasonable response to the input, rather than using the reverse-question-generation approach.

**Option A (Recommended):** Create a custom LLM-based relevancy scorer with a better prompt:

```typescript
import { createScorer } from "@mastra/evals/scorers";

export const relevancyScorer = createScorer({
    name: "relevancy",
    description: "Evaluates whether the output appropriately addresses the input",
    model: "openai/gpt-4o-mini",
    prompt: `You are evaluating whether an AI agent's output is relevant to the input it received.

IMPORTANT: Relevancy means the output addresses what the input asked for or required. It does NOT mean the output contains the same words as the input.

Examples of HIGH relevancy:
- Input: "What is the capital of France?" Output: "Paris" (directly answers the question)
- Input: [raw email] Output: [triage classification to Slack] (fulfills the agent's purpose)
- Input: "Schedule a meeting" Output: [calendar event created] (completes the requested action)

Score 0.0-1.0 where:
- 1.0 = Output directly and completely addresses what the input required
- 0.7 = Output mostly addresses the input with minor gaps
- 0.4 = Output partially relevant but missing key aspects
- 0.1 = Output barely related to input
- 0.0 = Output completely unrelated to input

Input: {{input}}
Output: {{output}}

Return only a JSON object: {"score": <number>, "reasoning": "<brief explanation>"}`
});
```

**Option B (Simpler):** Use `createCompletenessScorer` as a proxy for relevancy, since completeness already measures whether the output addresses the input requirements. Then rename the existing relevancy scorer or remove it.

### Step 2: Fix Tier 1 heuristic relevancy

**File:** `packages/mastra/src/scorers/tier1.ts` (lines 112-126)

Replace the word-overlap approach with a lightweight semantic check:

```typescript
// 6. Input/output relevance (lightweight semantic check)
if (input.length > 0 && output.length > 0) {
    // For tool-heavy agents, output format differs from input.
    // Use a combination of: (a) output is non-trivial, (b) no error patterns,
    // (c) basic structural relevance checks.

    // If output has structure (lists, headers, emoji, formatting),
    // it's likely a processed response, not noise
    const hasStructure =
        /[\*\-\#\:emoji\|]/.test(output) || output.includes("\n") || output.length > 100;

    // Check if output contains ANY key terms from input (relaxed threshold)
    const inputWords = new Set(
        input
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2) // lowered from 3 to 2
    );
    const outputWords = output.toLowerCase().split(/\s+/);
    const overlap = outputWords.filter((w) => inputWords.has(w)).length;
    const wordRelevance =
        inputWords.size > 0
            ? Math.min(overlap / Math.min(inputWords.size, 10), 1.0) // cap denominator at 10
            : 0.5;

    // Structured, non-empty responses get a base score of 0.5
    // Word overlap adds up to 0.5 more
    scores.relevance = hasStructure
        ? Math.max(0.5, 0.5 + wordRelevance * 0.5)
        : Math.max(wordRelevance, 0.3);
} else {
    scores.relevance = 0.5;
}
```

### Step 3: Verify the fix with known examples

After implementation, manually verify against these cases:

1. Assistant: "What is the capital of France?" -> "Paris" (should score > 0.8)
2. Email-triage: raw email -> Slack triage summary (should score > 0.6)
3. Workspace-concierge: "List my agents" -> agent list (should score > 0.7)

### Step 4: Re-run evaluations on recent runs

After deploying the fix, re-run evaluations on the last 10 runs for `assistant` and `email-triage` to verify scores are reasonable. Use the evaluation API:

```
POST /api/agents/{id}/evaluations
{ "limit": 10 }
```

## Files to Modify

| File                                                      | Change                                                   |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `packages/mastra/src/scorers/index.ts`                    | Replace `createAnswerRelevancyScorer` with custom scorer |
| `packages/mastra/src/scorers/tier1.ts`                    | Fix word-overlap relevancy (lines 112-126)               |
| `apps/agent/src/app/api/agents/[id]/evaluations/route.ts` | No change needed (uses scorer via registry)              |

## Acceptance Criteria

- [ ] Assistant answering "Paris" to "What is the capital of France?" scores > 0.8 relevancy
- [ ] Email-triage runs score > 0.5 relevancy on average
- [ ] No more false "critical relevancy" insights generated
- [ ] `bun run type-check` passes
- [ ] `bun run build` passes
