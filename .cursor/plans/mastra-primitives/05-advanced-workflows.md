# Phase 5: Build Advanced Workflows

## Objective

Create workflows demonstrating all Mastra workflow control flow patterns: parallel execution, conditional branching, looping, and human-in-the-loop approval with suspend/resume.

## Documentation References

| Feature            | Source      | URL                                                                            |
| ------------------ | ----------- | ------------------------------------------------------------------------------ |
| Workflows Overview | Mastra Docs | https://mastra.ai/docs/workflows/overview                                      |
| Control Flow       | Mastra Docs | https://mastra.ai/docs/workflows/control-flow                                  |
| Parallel Execution | Mastra Docs | https://mastra.ai/docs/workflows/control-flow#simultaneous-steps-with-parallel |
| Branching          | Mastra Docs | https://mastra.ai/docs/workflows/control-flow#conditional-logic-with-branch    |
| Foreach Loops      | Mastra Docs | https://mastra.ai/docs/workflows/control-flow#looping-with-foreach             |
| DoWhile Loops      | Mastra Docs | https://mastra.ai/docs/workflows/control-flow#looping-with-dowhile             |
| Suspend & Resume   | Mastra Docs | https://mastra.ai/docs/workflows/suspend-and-resume                            |
| Human-in-the-Loop  | Mastra Docs | https://mastra.ai/docs/workflows/human-in-the-loop                             |
| Workflow Reference | Mastra Docs | https://mastra.ai/reference/workflows/workflow                                 |
| Step Reference     | Mastra Docs | https://mastra.ai/reference/workflows/step                                     |

## Implementation Steps

### Step 1: Create Parallel Processing Workflow

Create `packages/mastra/src/workflows/parallel.ts`:

```typescript
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const formatStep = createStep({
    id: "format",
    description: "Format the input text to uppercase",
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        formatted: z.string()
    }),
    execute: async ({ inputData }) => ({
        formatted: inputData.text.toUpperCase()
    })
});

const analyzeStep = createStep({
    id: "analyze",
    description: "Analyze text statistics",
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        wordCount: z.number(),
        charCount: z.number(),
        avgWordLength: z.number()
    }),
    execute: async ({ inputData }) => {
        const words = inputData.text.split(/\s+/).filter((w) => w.length > 0);
        const wordCount = words.length;
        const charCount = inputData.text.length;
        const avgWordLength =
            wordCount > 0 ? words.reduce((sum, w) => sum + w.length, 0) / wordCount : 0;

        return { wordCount, charCount, avgWordLength: Math.round(avgWordLength * 10) / 10 };
    }
});

const detectLanguageStep = createStep({
    id: "detect-language",
    description: "Detect the language of the text",
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        language: z.string(),
        confidence: z.number()
    }),
    execute: async ({ inputData }) => {
        const hasEnglishPattern = /^[a-zA-Z\s.,!?]+$/.test(inputData.text);
        return {
            language: hasEnglishPattern ? "English" : "Unknown",
            confidence: hasEnglishPattern ? 0.95 : 0.5
        };
    }
});

const combineStep = createStep({
    id: "combine",
    description: "Combine results from parallel processing",
    inputSchema: z.object({
        format: z.object({ formatted: z.string() }),
        analyze: z.object({
            wordCount: z.number(),
            charCount: z.number(),
            avgWordLength: z.number()
        }),
        "detect-language": z.object({
            language: z.string(),
            confidence: z.number()
        })
    }),
    outputSchema: z.object({
        formatted: z.string(),
        stats: z.object({
            words: z.number(),
            characters: z.number(),
            avgWordLength: z.number()
        }),
        language: z.object({
            detected: z.string(),
            confidence: z.number()
        })
    }),
    execute: async ({ inputData }) => ({
        formatted: inputData["format"].formatted,
        stats: {
            words: inputData["analyze"].wordCount,
            characters: inputData["analyze"].charCount,
            avgWordLength: inputData["analyze"].avgWordLength
        },
        language: {
            detected: inputData["detect-language"].language,
            confidence: inputData["detect-language"].confidence
        }
    })
});

export const parallelWorkflow = createWorkflow({
    id: "parallel-processing",
    description: "Process text with parallel operations: format, analyze, and detect language",
    inputSchema: z.object({
        text: z.string().describe("Text to process")
    }),
    outputSchema: z.object({
        formatted: z.string(),
        stats: z.object({
            words: z.number(),
            characters: z.number(),
            avgWordLength: z.number()
        }),
        language: z.object({
            detected: z.string(),
            confidence: z.number()
        })
    })
})
    .parallel([formatStep, analyzeStep, detectLanguageStep])
    .then(combineStep)
    .commit();
```

- Doc reference: https://mastra.ai/docs/workflows/control-flow#simultaneous-steps-with-parallel

### Step 2: Create Conditional Branching Workflow

Create `packages/mastra/src/workflows/branch.ts`:

```typescript
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const classifyStep = createStep({
    id: "classify",
    description: "Classify the input request type",
    inputSchema: z.object({
        request: z.string()
    }),
    outputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    execute: async ({ inputData }) => {
        const request = inputData.request.toLowerCase();
        let type: "question" | "command" | "statement" = "statement";

        if (
            request.includes("?") ||
            request.startsWith("what") ||
            request.startsWith("how") ||
            request.startsWith("why")
        ) {
            type = "question";
        } else if (
            request.startsWith("do") ||
            request.startsWith("please") ||
            request.includes("need to") ||
            request.includes("want to")
        ) {
            type = "command";
        }

        return { request: inputData.request, type, confidence: 0.85 };
    }
});

const handleQuestionStep = createStep({
    id: "handle-question",
    inputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string()
    }),
    execute: async ({ inputData }) => ({
        response: `I understand you're asking: "${inputData.request}". Let me find the answer...`,
        action: "search_and_answer"
    })
});

const handleCommandStep = createStep({
    id: "handle-command",
    inputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string()
    }),
    execute: async ({ inputData }) => ({
        response: `I'll help you with: "${inputData.request}". Processing your request...`,
        action: "execute_command"
    })
});

const handleStatementStep = createStep({
    id: "handle-statement",
    inputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string()
    }),
    execute: async ({ inputData }) => ({
        response: `I acknowledge: "${inputData.request}". How can I help further?`,
        action: "acknowledge_and_prompt"
    })
});

const finalizeStep = createStep({
    id: "finalize",
    inputSchema: z.object({
        "handle-question": z.object({ response: z.string(), action: z.string() }).optional(),
        "handle-command": z.object({ response: z.string(), action: z.string() }).optional(),
        "handle-statement": z.object({ response: z.string(), action: z.string() }).optional()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string(),
        branch: z.string()
    }),
    execute: async ({ inputData }) => {
        const result =
            inputData["handle-question"] ||
            inputData["handle-command"] ||
            inputData["handle-statement"];

        const branch = inputData["handle-question"]
            ? "question"
            : inputData["handle-command"]
              ? "command"
              : "statement";

        return {
            response: result?.response || "Unknown request type",
            action: result?.action || "none",
            branch
        };
    }
});

export const branchWorkflow = createWorkflow({
    id: "conditional-branch",
    description: "Route requests to different handlers based on type",
    inputSchema: z.object({
        request: z.string().describe("User request to process")
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string(),
        branch: z.string()
    })
})
    .then(classifyStep)
    .branch([
        [async ({ inputData }) => inputData.type === "question", handleQuestionStep],
        [async ({ inputData }) => inputData.type === "command", handleCommandStep],
        [async ({ inputData }) => inputData.type === "statement", handleStatementStep]
    ])
    .then(finalizeStep)
    .commit();
```

- Doc reference: https://mastra.ai/docs/workflows/control-flow#conditional-logic-with-branch

### Step 3: Create Loop Processing Workflows

Create `packages/mastra/src/workflows/loop.ts`:

```typescript
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const processItemStep = createStep({
    id: "process-item",
    description: "Process a single item in the list",
    inputSchema: z.object({
        value: z.string(),
        index: z.number().optional()
    }),
    outputSchema: z.object({
        original: z.string(),
        processed: z.string(),
        length: z.number()
    }),
    execute: async ({ inputData }) => ({
        original: inputData.value,
        processed: inputData.value.toUpperCase().trim(),
        length: inputData.value.length
    })
});

const aggregateStep = createStep({
    id: "aggregate",
    description: "Aggregate all processed items",
    inputSchema: z.array(
        z.object({
            original: z.string(),
            processed: z.string(),
            length: z.number()
        })
    ),
    outputSchema: z.object({
        items: z.array(
            z.object({
                original: z.string(),
                processed: z.string()
            })
        ),
        count: z.number(),
        totalLength: z.number(),
        avgLength: z.number()
    }),
    execute: async ({ inputData }) => ({
        items: inputData.map((item) => ({
            original: item.original,
            processed: item.processed
        })),
        count: inputData.length,
        totalLength: inputData.reduce((sum, item) => sum + item.length, 0),
        avgLength:
            inputData.length > 0
                ? Math.round(
                      inputData.reduce((sum, item) => sum + item.length, 0) / inputData.length
                  )
                : 0
    })
});

const prepareStep = createStep({
    id: "prepare",
    description: "Prepare items for processing",
    inputSchema: z.object({
        items: z.array(z.string())
    }),
    outputSchema: z.array(
        z.object({
            value: z.string(),
            index: z.number()
        })
    ),
    execute: async ({ inputData }) => inputData.items.map((value, index) => ({ value, index }))
});

export const foreachWorkflow = createWorkflow({
    id: "foreach-loop",
    description: "Process each item in an array with optional parallel execution",
    inputSchema: z.object({
        items: z.array(z.string()).describe("Items to process")
    }),
    outputSchema: z.object({
        items: z.array(
            z.object({
                original: z.string(),
                processed: z.string()
            })
        ),
        count: z.number(),
        totalLength: z.number(),
        avgLength: z.number()
    })
})
    .then(prepareStep)
    .foreach(processItemStep, { concurrency: 3 })
    .then(aggregateStep)
    .commit();

const incrementStep = createStep({
    id: "increment",
    description: "Increment counter",
    inputSchema: z.object({
        count: z.number(),
        target: z.number()
    }),
    outputSchema: z.object({
        count: z.number(),
        target: z.number(),
        progress: z.number()
    }),
    execute: async ({ inputData }) => ({
        count: inputData.count + 1,
        target: inputData.target,
        progress: Math.round(((inputData.count + 1) / inputData.target) * 100)
    })
});

export const doWhileWorkflow = createWorkflow({
    id: "dowhile-loop",
    description: "Count up to a target using dowhile loop",
    inputSchema: z.object({
        count: z.number().default(0),
        target: z.number().describe("Target count to reach")
    }),
    outputSchema: z.object({
        count: z.number(),
        target: z.number(),
        progress: z.number()
    })
})
    .dowhile(incrementStep, async ({ inputData }) => inputData.count < inputData.target)
    .commit();
```

- Doc reference: https://mastra.ai/docs/workflows/control-flow#looping-with-foreach

### Step 4: Create Human-in-the-Loop Approval Workflow

Create `packages/mastra/src/workflows/human-approval.ts`:

```typescript
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const prepareActionStep = createStep({
    id: "prepare-action",
    description: "Prepare the action that requires approval",
    inputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string()
    }),
    outputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        preview: z.string(),
        requiresApproval: z.boolean()
    }),
    execute: async ({ inputData }) => ({
        ...inputData,
        preview: `Action: ${inputData.action}\nTo: ${inputData.recipient}\nMessage: ${inputData.message}`,
        requiresApproval: true
    })
});

const approvalStep = createStep({
    id: "human-approval",
    description: "Wait for human approval before proceeding",
    inputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        preview: z.string(),
        requiresApproval: z.boolean()
    }),
    outputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional()
    }),
    resumeSchema: z.object({
        approved: z.boolean(),
        approvedBy: z.string().optional()
    }),
    suspendSchema: z.object({
        reason: z.string(),
        preview: z.string(),
        actionType: z.string()
    }),
    execute: async ({ inputData, resumeData, suspend }) => {
        if (resumeData?.approved !== undefined) {
            return {
                action: inputData.action,
                recipient: inputData.recipient,
                message: inputData.message,
                approved: resumeData.approved,
                approvedBy: resumeData.approvedBy,
                approvedAt: new Date().toISOString()
            };
        }

        return await suspend({
            reason: "Human approval required before proceeding",
            preview: inputData.preview,
            actionType: inputData.action
        });
    }
});

const executeActionStep = createStep({
    id: "execute-action",
    description: "Execute the action if approved",
    inputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        executed: z.boolean(),
        result: z.string(),
        details: z.object({
            action: z.string(),
            recipient: z.string(),
            approved: z.boolean(),
            approvedBy: z.string().optional()
        })
    }),
    execute: async ({ inputData }) => {
        if (!inputData.approved) {
            return {
                success: false,
                executed: false,
                result: "Action was rejected by human reviewer",
                details: {
                    action: inputData.action,
                    recipient: inputData.recipient,
                    approved: false,
                    approvedBy: inputData.approvedBy
                }
            };
        }

        console.log(`Executing ${inputData.action} to ${inputData.recipient}`);

        return {
            success: true,
            executed: true,
            result: `Successfully sent ${inputData.action} to ${inputData.recipient}`,
            details: {
                action: inputData.action,
                recipient: inputData.recipient,
                approved: true,
                approvedBy: inputData.approvedBy
            }
        };
    }
});

export const humanApprovalWorkflow = createWorkflow({
    id: "human-approval",
    description: "Send a message after getting human approval",
    inputSchema: z.object({
        action: z.enum(["email", "slack", "sms"]).describe("Type of message to send"),
        recipient: z.string().describe("Recipient email/phone/channel"),
        message: z.string().describe("Message content")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        executed: z.boolean(),
        result: z.string(),
        details: z.object({
            action: z.string(),
            recipient: z.string(),
            approved: z.boolean(),
            approvedBy: z.string().optional()
        })
    })
})
    .then(prepareActionStep)
    .then(approvalStep)
    .then(executeActionStep)
    .commit();
```

- Doc reference: https://mastra.ai/docs/workflows/suspend-and-resume

### Step 5: Update Workflow Exports

Update `packages/mastra/src/workflows/index.ts`:

```typescript
export { analysisWorkflow } from "./example-workflow";
export { parallelWorkflow } from "./parallel";
export { branchWorkflow } from "./branch";
export { foreachWorkflow, doWhileWorkflow } from "./loop";
export { humanApprovalWorkflow } from "./human-approval";
```

### Step 6: Update Mastra Instance

Update `packages/mastra/src/mastra.ts` to register all workflows.

## Documentation Deviations

| Deviation                                    | Status        | Justification                                                          |
| -------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| Using `bail` for rejection in execute-action | **Removed**   | Docs show returning result directly; bail is for early exit with error |
| Branch step output structure                 | **Corrected** | Per docs, branch outputs are keyed by step ID with optional fields     |

## Demo Page Spec

- **Route**: `/demos/workflows`
- **Inputs**:
    - Workflow type selector (tabs: Parallel, Branch, Foreach, Approval)
    - Text input for parallel workflow
    - Request input for branch workflow
    - Comma-separated items for foreach
    - Action/recipient/message for approval workflow
- **Outputs**:
    - Step-by-step execution visualization
    - Final result JSON
    - Suspend/Resume UI for approval workflow
- **Sample data**:
    - Parallel: "Hello World"
    - Branch: "How do I do this?" (question), "Please help me" (command)
    - Foreach: "apple, banana, cherry"
    - Approval: email, user@example.com, "Hello!"

### Sample Inputs/Test Data

```typescript
const workflowExamples = {
  parallel: {
    input: { text: "Hello World" },
    expected: { formatted: "HELLO WORLD", stats: { words: 2, characters: 11 } }
  },
  branch: [
    { input: { request: "How do I do this?" }, expectedBranch: "question" },
    { input: { request: "Please help me" }, expectedBranch: "command" },
    { input: { request: "The sky is blue" }, expectedBranch: "statement" },
  ],
  foreach: {
    input: { items: ["apple", "banana", "cherry"] },
    expected: { count: 3, items: [{ processed: "APPLE" }, ...] }
  },
  humanApproval: {
    input: { action: "email", recipient: "user@example.com", message: "Hello" },
    suspendPayload: { reason: "Human approval required...", actionType: "email" }
  }
};
```

### Error State Handling

- Display workflow execution errors with step identification
- Show "Workflow suspended" state with resume options
- Handle timeout for long-running workflows

### Loading States

- Step execution progress bar
- Current step indicator
- Suspended state with approve/reject buttons

## Dependency Map

- **Requires**: None (workflows are standalone primitives)
- **Enables**: Phase 4 (workflow trigger tool), Phase 9 (demo pages)
- **Standalone**: Yes - can be demoed independently

## Acceptance Criteria

- [ ] Parallel workflow executes all 3 steps simultaneously (not sequentially)
- [ ] Parallel workflow combine step receives outputs keyed by step ID
- [ ] Branch workflow routes to correct handler based on classification
- [ ] Only one branch executes per run
- [ ] Foreach workflow processes all items with configurable concurrency
- [ ] DoWhile workflow loops until condition is false
- [ ] Human approval workflow suspends at approval step
- [ ] Suspended workflow can be resumed with approve/reject decision
- [ ] Rejected actions do not execute
- [ ] All workflows are registered and accessible via mastra.getWorkflow()

## Test Plan

### Frontend

- [ ] Workflow demo page renders all 4 workflow types
- [ ] Parallel results show all 3 operations completed
- [ ] Branch shows which handler was selected
- [ ] Foreach shows item-by-item progress
- [ ] Approval workflow shows suspend state with approve/reject buttons
- [ ] Resume triggers workflow continuation
- [ ] Error states display workflow failures

### Backend

- [ ] `/api/demos/workflows` accepts workflowType and input
- [ ] `/api/demos/workflows/resume` accepts runId, step, resumeData
- [ ] Parallel workflow completes faster than sequential (verify timing)
- [ ] Branch conditions evaluate correctly
- [ ] Foreach concurrency limits are respected
- [ ] Suspended runs can be retrieved by runId
- [ ] Resume with invalid runId returns 404

### Integration

- [ ] End-to-end parallel workflow execution
- [ ] Branch classification → correct handler → finalize
- [ ] Foreach with 10+ items completes successfully
- [ ] Human approval: start → suspend → resume → complete
- [ ] Workflow traces show step-by-step execution (requires Phase 2)
- [ ] Workflow runs persist to storage for resume capability

## Files Changed

| File                                              | Action |
| ------------------------------------------------- | ------ |
| `packages/mastra/src/workflows/parallel.ts`       | Create |
| `packages/mastra/src/workflows/branch.ts`         | Create |
| `packages/mastra/src/workflows/loop.ts`           | Create |
| `packages/mastra/src/workflows/human-approval.ts` | Create |
| `packages/mastra/src/workflows/index.ts`          | Update |
| `packages/mastra/src/mastra.ts`                   | Update |
