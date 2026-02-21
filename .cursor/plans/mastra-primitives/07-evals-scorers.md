# Phase 7: Add Evals and Scorers

## Objective

Implement evaluation and scoring for AI outputs using Mastra's built-in scorers and custom scorers for measuring relevancy, toxicity, helpfulness, and code quality.

## Documentation References

| Feature                  | Source      | URL                                                            |
| ------------------------ | ----------- | -------------------------------------------------------------- |
| Scorers Overview         | Mastra Docs | https://mastra.ai/docs/evals/overview                          |
| Built-in Scorers         | Mastra Docs | https://mastra.ai/docs/evals/built-in-scorers                  |
| Custom Scorers           | Mastra Docs | https://mastra.ai/docs/evals/custom-scorers                    |
| Live Evaluations         | Mastra Docs | https://mastra.ai/docs/evals/overview#live-evaluations         |
| Adding Scorers to Agents | Mastra Docs | https://mastra.ai/docs/evals/overview#adding-scorers-to-agents |
| Trace Evaluations        | Mastra Docs | https://mastra.ai/docs/evals/overview#trace-evaluations        |

## Documentation Corrections

**IMPORTANT**: The original plan used incorrect imports and APIs. According to official documentation:

1. Built-in scorers are imported from `@mastra/evals/scorers/prebuilt`
2. The factory pattern is `createAnswerRelevancyScorer({ model: "..." })`
3. Scorers are added to agents via the `scorers` property with sampling config

## Implementation Steps

### Step 1: Install Evals Package

```bash
cd packages/agentc2
bun add @mastra/evals
```

### Step 2: Create Scorers Module

Create `packages/agentc2/src/scorers/index.ts`:

````typescript
import {
    createAnswerRelevancyScorer,
    createToxicityScorer,
    createCompletenessScorer,
    createToneConsistencyScorer
} from "@mastra/evals/scorers/prebuilt";
import { createScorer } from "@mastra/evals";
import { z } from "zod";

/**
 * Answer Relevancy Scorer
 *
 * Evaluates how well responses address the input query.
 * Score: 0-1 (higher is better)
 */
export const relevancyScorer = createAnswerRelevancyScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Toxicity Scorer
 *
 * Detects harmful, offensive, or inappropriate content.
 * Score: 0-1 (lower is better - 0 means no toxicity)
 */
export const toxicityScorer = createToxicityScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Completeness Scorer
 *
 * Checks if responses include all necessary information.
 * Score: 0-1 (higher is better)
 */
export const completenessScorer = createCompletenessScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Tone Consistency Scorer
 *
 * Measures consistency in formality, complexity, and style.
 * Score: 0-1 (higher is better)
 */
export const toneScorer = createToneConsistencyScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Custom Helpfulness Scorer
 *
 * Evaluates how helpful and actionable the response is.
 * Uses heuristic-based scoring for demonstration.
 */
export const helpfulnessScorer = createScorer({
    id: "helpfulness",
    name: "Helpfulness Scorer",
    description: "Evaluates how helpful and actionable the response is",

    inputSchema: z.object({
        input: z.string().describe("The original query"),
        output: z.string().describe("The agent's response")
    }),

    outputSchema: z.object({
        score: z.number().min(0).max(1),
        reasoning: z.string()
    }),

    execute: async ({ input, output }) => {
        let score = 0.5;
        const reasoning: string[] = [];

        // Check for actionable content
        const actionWords = [
            "here's how",
            "follow these steps",
            "you can",
            "try this",
            "to do this"
        ];
        const hasActions = actionWords.some((word) => output.toLowerCase().includes(word));
        if (hasActions) {
            score += 0.2;
            reasoning.push("Contains actionable guidance");
        }

        // Check for examples
        const hasExamples =
            output.includes("example") || output.includes("for instance") || output.includes("```");
        if (hasExamples) {
            score += 0.15;
            reasoning.push("Includes examples or code");
        }

        // Check for structure (lists, headers)
        const hasStructure =
            output.includes("1.") || output.includes("- ") || output.includes("##");
        if (hasStructure) {
            score += 0.1;
            reasoning.push("Well-structured response");
        }

        // Check response length (not too short)
        if (output.length > 200) {
            score += 0.05;
            reasoning.push("Sufficient detail");
        }

        score = Math.min(score, 1.0);

        return {
            score,
            reasoning:
                reasoning.length > 0
                    ? reasoning.join("; ")
                    : "Basic response without special features"
        };
    }
});

/**
 * Custom Code Quality Scorer
 *
 * For evaluating responses that contain code.
 */
export const codeQualityScorer = createScorer({
    id: "code-quality",
    name: "Code Quality Scorer",
    description: "Evaluates code responses for quality and completeness",

    inputSchema: z.object({
        input: z.string(),
        output: z.string()
    }),

    outputSchema: z.object({
        score: z.number().min(0).max(1),
        hasCode: z.boolean(),
        codeBlocks: z.number(),
        hasComments: z.boolean(),
        hasErrorHandling: z.boolean()
    }),

    execute: async ({ input, output }) => {
        const codeBlockMatches = output.match(/```[\s\S]*?```/g) || [];
        const codeBlocks = codeBlockMatches.length;
        const hasCode = codeBlocks > 0;

        if (!hasCode) {
            return {
                score: 0,
                hasCode: false,
                codeBlocks: 0,
                hasComments: false,
                hasErrorHandling: false
            };
        }

        let score = 0.5;

        const hasComments = codeBlockMatches.some(
            (block) => block.includes("//") || block.includes("/*") || block.includes("#")
        );
        if (hasComments) score += 0.2;

        const hasErrorHandling = codeBlockMatches.some(
            (block) =>
                block.includes("try") ||
                block.includes("catch") ||
                block.includes("throw") ||
                block.includes("Error")
        );
        if (hasErrorHandling) score += 0.2;

        if (codeBlocks > 1) score += 0.1;

        return {
            score: Math.min(score, 1.0),
            hasCode,
            codeBlocks,
            hasComments,
            hasErrorHandling
        };
    }
});

/**
 * All scorers bundled for agent configuration
 */
export const scorers = {
    relevancy: relevancyScorer,
    toxicity: toxicityScorer,
    completeness: completenessScorer,
    tone: toneScorer,
    helpfulness: helpfulnessScorer,
    codeQuality: codeQualityScorer
};
````

- Doc reference: https://mastra.ai/docs/evals/overview#adding-scorers-to-agents

### Step 3: Create Evaluated Agent

Create `packages/agentc2/src/agents/evaluated.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import {
    relevancyScorer,
    toxicityScorer,
    completenessScorer,
    helpfulnessScorer,
    codeQualityScorer
} from "../scorers";

/**
 * Fully Evaluated Agent
 *
 * Demonstrates comprehensive scoring with all available scorers.
 * Useful for development and testing where you want full visibility.
 */
export const evaluatedAgent = new Agent({
    id: "evaluated-agent",
    name: "Fully Evaluated Agent",
    instructions: `You are a helpful assistant. Your responses are being evaluated for:
- Relevancy to the question
- Completeness of information
- Helpfulness and actionability
- Absence of toxic content
- Code quality (when providing code)

Strive to provide excellent responses that score well on all metrics.`,
    model: "anthropic/claude-sonnet-4-20250514",

    scorers: {
        relevancy: {
            scorer: relevancyScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        toxicity: {
            scorer: toxicityScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        completeness: {
            scorer: completenessScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        helpfulness: {
            scorer: helpfulnessScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        codeQuality: {
            scorer: codeQualityScorer,
            sampling: { type: "ratio", rate: 1.0 }
        }
    }
});
```

- Doc reference: https://mastra.ai/docs/evals/overview#adding-scorers-to-agents

### Step 4: Update Agent Exports

Update `packages/agentc2/src/agents/index.ts`:

```typescript
export { assistantAgent } from "./assistant";
export { structuredAgent, schemas } from "./structured";
export { visionAgent, visionAnalysisSchema } from "./vision";
export { researchAgent, researchTools } from "./research";
export { evaluatedAgent } from "./evaluated";
```

### Step 5: Update Mastra Instance

Update `packages/agentc2/src/mastra.ts` to register scorers and evaluated agent:

```typescript
import { evaluatedAgent } from "./agents";
import { scorers } from "./scorers";

// In getMastra():
global.mastraInstance = new Mastra({
    agents: {
        // ... existing agents
        evaluated: evaluatedAgent
    },
    // Register scorers at instance level for trace evaluation
    scorers: {
        answerRelevancy: scorers.relevancy,
        toxicity: scorers.toxicity,
        helpfulness: scorers.helpfulness,
        codeQuality: scorers.codeQuality
    }
    // ... rest of config
});
```

### Step 6: Update Main Exports

Update `packages/agentc2/src/index.ts`:

```typescript
// Scorers
export {
    relevancyScorer,
    toxicityScorer,
    completenessScorer,
    toneScorer,
    helpfulnessScorer,
    codeQualityScorer,
    scorers
} from "./scorers";

// Agents
export { evaluatedAgent } from "./agents";
```

## Documentation Deviations

| Deviation                                  | Status               | Justification                                                          |
| ------------------------------------------ | -------------------- | ---------------------------------------------------------------------- |
| Using `openai/gpt-4.1-nano` for evaluation | **Recommended**      | Fast, cheap model suitable for evaluation tasks                        |
| Custom heuristic-based scorers             | **Experimental**     | Demonstrates custom scorer pattern; LLM-based preferred for production |
| 100% sampling in evaluated agent           | **Development only** | Production should use lower sampling rates                             |

**Flag**: Custom scorers (helpfulness, codeQuality) use rule-based logic. For production, consider LLM-graded versions using `createScorer` with model calls.

## Demo Page Spec

- **Route**: `/demos/evals`
- **Inputs**:
    - Input query textarea
    - Output response textarea (or generate button)
    - Scorer selector (checkboxes for which scorers to run)
- **Outputs**:
    - Score cards with 0-100% values
    - Score reasoning/explanation
    - Pass/fail indicators based on thresholds
- **Sample data**:
    - Good response: Detailed answer with examples and structure
    - Poor response: Short, vague answer
    - Toxic response: For toxicity testing (simulated)

### Sample Inputs/Test Data

```typescript
const evalExamples = {
    goodResponse: {
        input: "How do I create a React component?",
        output: `Here's how to create a React component:

## Functional Component

\`\`\`tsx
function MyComponent() {
  return <div>Hello World</div>;
}
\`\`\`

1. Create a function that returns JSX
2. Export the component
3. Import and use it in your app

For example, you can use it like this:
\`\`\`tsx
<MyComponent />
\`\`\``,
        expectedScores: { relevancy: 0.9, helpfulness: 0.85, codeQuality: 0.8 }
    },
    poorResponse: {
        input: "What is TypeScript?",
        output: "It's a language.",
        expectedScores: { relevancy: 0.4, helpfulness: 0.3, completeness: 0.2 }
    }
};
```

### Error State Handling

- Display "Scorer failed" with error message
- Show partial results if some scorers succeed
- Handle timeout for slow LLM-based scorers

### Loading States

- Individual spinner per scorer
- Overall progress indicator
- Score cards show skeleton while loading

## Dependency Map

- **Requires**: Phase 2 (observability for trace scoring), OPENAI_API_KEY (for LLM scorers)
- **Enables**: Quality monitoring, CI/CD integration
- **Standalone**: Partial - can run manual evals without traces

## Acceptance Criteria

- [ ] User can evaluate a response using built-in relevancy scorer
- [ ] User can evaluate a response using built-in toxicity scorer
- [ ] Scores are numeric values between 0 and 1
- [ ] Custom helpfulness scorer returns score with reasoning
- [ ] Custom code quality scorer detects code blocks and features
- [ ] Evaluated agent automatically scores responses at 100% sampling
- [ ] Scores are stored in mastra_scorers table (with observability)
- [ ] Scorers are registered at Mastra instance level for trace evaluation

## Test Plan

### Frontend

- [ ] Evals demo page renders with input/output areas
- [ ] Generate button creates agent response
- [ ] Scorer checkboxes allow selection
- [ ] Score cards display after evaluation
- [ ] Scores show as percentages (0-100%)
- [ ] Reasoning displays for custom scorers
- [ ] Loading states show during evaluation

### Backend

- [ ] `/api/demos/evals` accepts input and output, returns scores
- [ ] `/api/demos/evals/generate` uses evaluated agent
- [ ] Relevancy scorer returns expected range for test cases
- [ ] Toxicity scorer returns low scores for clean content
- [ ] Custom scorers execute without errors
- [ ] Missing input/output returns 400 error

### Integration

- [ ] End-to-end: generate response → evaluate → display scores
- [ ] Evaluated agent records scores in traces (requires Phase 2)
- [ ] Multiple scorers run in parallel
- [ ] Scores persist to storage for historical analysis
- [ ] Trace evaluation works in Mastra Studio

## Built-in Scorers Reference

| Scorer               | What it Measures                  | Score Meaning              |
| -------------------- | --------------------------------- | -------------------------- |
| `answer-relevancy`   | How well response addresses query | 0-1, higher = better       |
| `toxicity`           | Harmful/inappropriate content     | 0-1, lower = better        |
| `completeness`       | Includes all necessary info       | 0-1, higher = better       |
| `tone-consistency`   | Formality and style consistency   | 0-1, higher = better       |
| `faithfulness`       | Accuracy to provided context      | 0-1, higher = better       |
| `hallucination`      | Unsupported claims                | 0-1, lower = better        |
| `content-similarity` | Textual similarity                | 0-1, higher = more similar |

## Files Changed

| File                                       | Action              |
| ------------------------------------------ | ------------------- |
| `packages/agentc2/package.json`            | Add @mastra/evals   |
| `packages/agentc2/src/scorers/index.ts`    | Create              |
| `packages/agentc2/src/agents/evaluated.ts` | Create              |
| `packages/agentc2/src/agents/index.ts`     | Update              |
| `packages/agentc2/src/mastra.ts`           | Update with scorers |
| `packages/agentc2/src/index.ts`            | Update              |
