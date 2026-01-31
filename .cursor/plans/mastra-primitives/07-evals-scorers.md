# Phase 7: Add Evals and Scorers

**Status**: Pending  
**Dependencies**: Phases 1-2 (observability for trace scoring)  
**Estimated Complexity**: Medium

## Objective

Implement evaluation and scoring for AI outputs using Mastra's built-in scorers:
1. **Answer Relevancy** - Measures how well responses address the query
2. **Toxicity** - Detects harmful or inappropriate content
3. **Custom Scorer** - Create a domain-specific scorer

## What are Scorers?

Scorers are automated tests that evaluate agent outputs using:
- **Model-graded methods** - LLM judges the output
- **Rule-based methods** - Algorithmic scoring
- **Statistical methods** - Numerical analysis

Scores are typically 0-1 values that quantify output quality.

## Implementation Steps

### Step 1: Install Evals Package

```bash
cd packages/mastra
bun add @mastra/evals
```

### Step 2: Create Scorers Module

Create `packages/mastra/src/scorers/index.ts`:

```typescript
import {
  createAnswerRelevancyScorer,
  createToxicityScorer,
  createCompletenessScorer,
  createToneConsistencyScorer,
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
  model: "openai/gpt-4.1-nano", // Fast, cheap model for evaluation
});

/**
 * Toxicity Scorer
 * 
 * Detects harmful, offensive, or inappropriate content.
 * Score: 0-1 (lower is better - 0 means no toxicity)
 */
export const toxicityScorer = createToxicityScorer({
  model: "openai/gpt-4.1-nano",
});

/**
 * Completeness Scorer
 * 
 * Checks if responses include all necessary information.
 * Score: 0-1 (higher is better)
 */
export const completenessScorer = createCompletenessScorer({
  model: "openai/gpt-4.1-nano",
});

/**
 * Tone Consistency Scorer
 * 
 * Measures consistency in formality, complexity, and style.
 * Score: 0-1 (higher is better)
 */
export const toneScorer = createToneConsistencyScorer({
  model: "openai/gpt-4.1-nano",
});

/**
 * Custom Helpfulness Scorer
 * 
 * Evaluates how helpful and actionable the response is.
 * Uses a custom prompt for evaluation.
 */
export const helpfulnessScorer = createScorer({
  id: "helpfulness",
  name: "Helpfulness Scorer",
  description: "Evaluates how helpful and actionable the response is",
  
  // Input schema for the scorer
  inputSchema: z.object({
    input: z.string().describe("The original query"),
    output: z.string().describe("The agent's response"),
  }),
  
  // Output schema for the score
  outputSchema: z.object({
    score: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
  
  // Scoring logic
  execute: async ({ input, output }) => {
    // Simple heuristic-based scoring for demonstration
    let score = 0.5; // Base score
    const reasoning: string[] = [];

    // Check for actionable content
    const actionWords = ["here's how", "follow these steps", "you can", "try this", "to do this"];
    const hasActions = actionWords.some(word => 
      output.toLowerCase().includes(word)
    );
    if (hasActions) {
      score += 0.2;
      reasoning.push("Contains actionable guidance");
    }

    // Check for examples
    const hasExamples = output.includes("example") || 
                        output.includes("for instance") || 
                        output.includes("```");
    if (hasExamples) {
      score += 0.15;
      reasoning.push("Includes examples or code");
    }

    // Check for structure (lists, headers)
    const hasStructure = output.includes("1.") || 
                         output.includes("- ") || 
                         output.includes("##");
    if (hasStructure) {
      score += 0.1;
      reasoning.push("Well-structured response");
    }

    // Check response length (not too short)
    if (output.length > 200) {
      score += 0.05;
      reasoning.push("Sufficient detail");
    }

    // Cap at 1.0
    score = Math.min(score, 1.0);

    return {
      score,
      reasoning: reasoning.length > 0 
        ? reasoning.join("; ") 
        : "Basic response without special features",
    };
  },
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
    output: z.string(),
  }),
  
  outputSchema: z.object({
    score: z.number().min(0).max(1),
    hasCode: z.boolean(),
    codeBlocks: z.number(),
    hasComments: z.boolean(),
    hasErrorHandling: z.boolean(),
  }),
  
  execute: async ({ input, output }) => {
    // Check for code blocks
    const codeBlockMatches = output.match(/```[\s\S]*?```/g) || [];
    const codeBlocks = codeBlockMatches.length;
    const hasCode = codeBlocks > 0;

    if (!hasCode) {
      return {
        score: 0,
        hasCode: false,
        codeBlocks: 0,
        hasComments: false,
        hasErrorHandling: false,
      };
    }

    let score = 0.5; // Base score for having code
    
    // Check for comments
    const hasComments = codeBlockMatches.some(block => 
      block.includes("//") || block.includes("/*") || block.includes("#")
    );
    if (hasComments) score += 0.2;

    // Check for error handling
    const hasErrorHandling = codeBlockMatches.some(block =>
      block.includes("try") || 
      block.includes("catch") || 
      block.includes("throw") ||
      block.includes("Error")
    );
    if (hasErrorHandling) score += 0.2;

    // Bonus for multiple code examples
    if (codeBlocks > 1) score += 0.1;

    return {
      score: Math.min(score, 1.0),
      hasCode,
      codeBlocks,
      hasComments,
      hasErrorHandling,
    };
  },
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
  codeQuality: codeQualityScorer,
};
```

### Step 3: Add Scorers to Agents

Update `packages/mastra/src/agents/assistant.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import { memory } from "../memory";
import { extendedTools } from "../tools";
import { relevancyScorer, toxicityScorer, helpfulnessScorer } from "../scorers";

export const assistantAgent = new Agent({
  id: "assistant",
  name: "AI Assistant",
  instructions: `You are a helpful, knowledgeable, and friendly AI assistant.
  // ... rest of instructions ...
  `,
  model: "anthropic/claude-sonnet-4-20250514",
  memory,
  tools: extendedTools,
  
  // Add scorers for live evaluation
  scorers: {
    relevancy: {
      scorer: relevancyScorer,
      sampling: { type: "ratio", rate: 0.5 }, // Score 50% of responses
    },
    toxicity: {
      scorer: toxicityScorer,
      sampling: { type: "ratio", rate: 1.0 }, // Score all responses for safety
    },
    helpfulness: {
      scorer: helpfulnessScorer,
      sampling: { type: "ratio", rate: 0.25 }, // Score 25% of responses
    },
  },
});
```

### Step 4: Create Evaluated Agent for Demo

Create `packages/mastra/src/agents/evaluated.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import { 
  relevancyScorer, 
  toxicityScorer, 
  completenessScorer,
  helpfulnessScorer,
  codeQualityScorer,
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
  
  // All scorers enabled at 100% sampling for demo
  scorers: {
    relevancy: {
      scorer: relevancyScorer,
      sampling: { type: "ratio", rate: 1.0 },
    },
    toxicity: {
      scorer: toxicityScorer,
      sampling: { type: "ratio", rate: 1.0 },
    },
    completeness: {
      scorer: completenessScorer,
      sampling: { type: "ratio", rate: 1.0 },
    },
    helpfulness: {
      scorer: helpfulnessScorer,
      sampling: { type: "ratio", rate: 1.0 },
    },
    codeQuality: {
      scorer: codeQualityScorer,
      sampling: { type: "ratio", rate: 1.0 },
    },
  },
});
```

### Step 5: Update Exports

Update `packages/mastra/src/agents/index.ts`:

```typescript
export { assistantAgent } from "./assistant";
export { structuredAgent, schemas } from "./structured";
export { visionAgent, visionAnalysisSchema } from "./vision";
export { researchAgent, researchTools } from "./research";
export { evaluatedAgent } from "./evaluated";
```

Update `packages/mastra/src/index.ts`:

```typescript
// Scorers
export {
  relevancyScorer,
  toxicityScorer,
  completenessScorer,
  toneScorer,
  helpfulnessScorer,
  codeQualityScorer,
  scorers,
} from "./scorers";

// Agents
export { 
  assistantAgent, 
  structuredAgent, 
  // ... other agents
  evaluatedAgent,
} from "./agents";
```

### Step 6: Register Scorers in Mastra

Update `packages/mastra/src/mastra.ts`:

```typescript
import { Mastra } from "@mastra/core/mastra";
import { 
  assistantAgent, 
  structuredAgent, 
  visionAgent, 
  researchAgent,
  evaluatedAgent,
} from "./agents";
import { workflows } from "./workflows";
import { storage } from "./storage";
import { observability } from "./observability";
import { scorers } from "./scorers";

declare global {
  var mastraInstance: Mastra | undefined;
}

function getMastra(): Mastra {
  if (!global.mastraInstance) {
    global.mastraInstance = new Mastra({
      agents: {
        assistant: assistantAgent,
        structured: structuredAgent,
        vision: visionAgent,
        research: researchAgent,
        evaluated: evaluatedAgent,
      },
      workflows,
      storage,
      observability,
      
      // Register scorers at instance level for trace evaluation
      scorers: {
        answerRelevancy: scorers.relevancy,
        toxicity: scorers.toxicity,
        helpfulness: scorers.helpfulness,
        codeQuality: scorers.codeQuality,
      },
    });
  }

  return global.mastraInstance;
}

export const mastra = getMastra();
```

## Built-in Scorers Reference

| Scorer | What it Measures | Score Meaning |
|--------|------------------|---------------|
| `answer-relevancy` | How well response addresses query | 0-1, higher = better |
| `toxicity` | Harmful/inappropriate content | 0-1, lower = better |
| `completeness` | Includes all necessary info | 0-1, higher = better |
| `tone-consistency` | Formality and style consistency | 0-1, higher = better |
| `faithfulness` | Accuracy to provided context | 0-1, higher = better |
| `hallucination` | Unsupported claims | 0-1, lower = better |
| `content-similarity` | Textual similarity | 0-1, higher = more similar |

## Viewing Scores

### In Traces (Observability)
When tracing is enabled, scores appear in the trace metadata:

```json
{
  "spanType": "agent_run",
  "scores": {
    "relevancy": 0.85,
    "toxicity": 0.02,
    "helpfulness": 0.78
  }
}
```

### In Mastra Studio
Scores are visible in the Studio UI under the Observability section.

### Programmatic Access
Access scores from the response:

```typescript
const response = await evaluatedAgent.generate("How do I use TypeScript?");
console.log("Response:", response.text);

// Scores are stored asynchronously in the mastra_scorers table
// Access via observability traces or Studio
```

## Verification Checklist

- [ ] `@mastra/evals` package installed
- [ ] Built-in scorers configured (relevancy, toxicity)
- [ ] Custom scorers created (helpfulness, codeQuality)
- [ ] Scorers added to assistant agent
- [ ] Evaluated agent created with all scorers
- [ ] Scorers registered at Mastra instance level
- [ ] Scores appearing in traces

## Testing Examples

### Manual Scoring

```typescript
import { relevancyScorer, helpfulnessScorer } from "@repo/mastra";

// Test relevancy
const relevancyResult = await relevancyScorer.score({
  input: "What is TypeScript?",
  output: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
});
console.log("Relevancy:", relevancyResult.score); // ~0.9

// Test helpfulness
const helpfulnessResult = await helpfulnessScorer.score({
  input: "How do I create a React component?",
  output: "Here's how to create a React component:\n\n```tsx\nfunction MyComponent() {\n  return <div>Hello</div>;\n}\n```",
});
console.log("Helpfulness:", helpfulnessResult.score); // ~0.85
```

### Agent with Live Scoring

```typescript
const agent = mastra.getAgent("evaluated");
const response = await agent.generate("Explain async/await in JavaScript");
// Scores are automatically computed and stored
```

## Files Changed

| File | Action |
|------|--------|
| `packages/mastra/package.json` | Add @mastra/evals |
| `packages/mastra/src/scorers/index.ts` | Create |
| `packages/mastra/src/agents/assistant.ts` | Update with scorers |
| `packages/mastra/src/agents/evaluated.ts` | Create |
| `packages/mastra/src/agents/index.ts` | Update |
| `packages/mastra/src/mastra.ts` | Update with scorers |
| `packages/mastra/src/index.ts` | Update |
