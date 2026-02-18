/**
 * Coding Pipeline Workflow Definitions
 *
 * Standard and internal variants of the autonomous coding pipeline.
 * These definitions can be seeded into the database or created via API.
 */

import type { WorkflowDefinition } from "./builder/types";

export const CODING_PIPELINE_DEFINITION: WorkflowDefinition = {
    steps: [
        {
            id: "ingest-ticket",
            type: "tool",
            name: "Ingest and enrich ticket",
            description: "Fetch ticket details and normalize into a common format",
            config: {
                toolId: "ingest-ticket"
            },
            inputMapping: {
                sourceType: "{{ input.sourceType }}",
                sourceId: "{{ input.sourceId }}",
                repository: "{{ input.repository }}",
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "update-status-analyzing",
            type: "tool",
            name: "Update pipeline status",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "running"
            }
        },
        {
            id: "analyze-codebase",
            type: "agent",
            name: "Analyze codebase",
            description:
                "Analyze the codebase to understand architecture, affected files, and risks",
            config: {
                agentSlug: "assistant",
                promptTemplate: `Analyze the following ticket and determine what codebase changes are needed.

Ticket: {{ steps.ingest-ticket.title }}
Description: {{ steps.ingest-ticket.description }}
Repository: {{ input.repository }}

Use the GitHub tools to:
1. Search the codebase for relevant files
2. Read the key files that would need to change
3. Understand the project structure and conventions

Return a JSON analysis with:
- affectedFiles: list of files that need to change
- architecture: brief description of the relevant system architecture
- risks: potential risks or complications
- complexity: "trivial", "low", "medium", "high", or "critical"
- approach: recommended implementation approach`,
                maxSteps: 10,
                outputFormat: "json"
            }
        },
        {
            id: "plan-implementation",
            type: "agent",
            name: "Plan implementation",
            description: "Create a detailed implementation plan based on the analysis",
            config: {
                agentSlug: "assistant",
                promptTemplate: `Based on the following ticket and codebase analysis, create a detailed implementation plan.

Ticket: {{ steps.ingest-ticket.title }}
Description: {{ steps.ingest-ticket.description }}
Repository: {{ input.repository }}
Analysis: {{ steps.analyze-codebase }}

Create a step-by-step implementation plan that a coding agent can follow. Include:
- Specific files to create or modify (with paths)
- What changes to make in each file
- Any new dependencies to add
- Test strategy
- Estimated effort

Be specific and actionable. The plan will be passed directly to an autonomous coding agent.`,
                maxSteps: 5,
                outputFormat: "json"
            }
        },
        {
            id: "classify-risk",
            type: "agent",
            name: "Classify change risk",
            description: "Determine the risk level for governance decisions",
            config: {
                agentSlug: "assistant",
                promptTemplate: `Classify the risk level of this change:

Plan: {{ steps.plan-implementation }}
Analysis: {{ steps.analyze-codebase }}

Risk levels:
- trivial: Typo fix, doc update, comment changes
- low: Test coverage, dependency patch, minor refactor
- medium: Bug fix, small feature, non-breaking API change
- high: Schema change, auth change, breaking API change
- critical: Deployment config, security change, infrastructure

Respond with ONLY a JSON object: { "riskLevel": "trivial|low|medium|high|critical", "reason": "brief explanation" }`,
                maxSteps: 1,
                outputFormat: "json"
            }
        },
        {
            id: "update-status-plan",
            type: "tool",
            name: "Update pipeline status",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "awaiting_plan_approval"
            }
        },
        {
            id: "approve-plan",
            type: "human",
            name: "Review and approve implementation plan",
            description: "Human reviews the implementation plan before coding begins",
            config: {
                prompt: "Review the implementation plan and approve or reject it.",
                formSchema: {
                    approved: { type: "boolean", description: "Approve this plan?" },
                    feedback: {
                        type: "string",
                        description: "Optional feedback or modifications"
                    }
                }
            }
        },
        {
            id: "update-status-coding",
            type: "tool",
            name: "Update pipeline status to coding",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "coding"
            }
        },
        {
            id: "dispatch-cursor",
            type: "tool",
            name: "Dispatch to Cursor Cloud Agent",
            description: "Launch a Cursor Cloud Agent with the approved implementation plan",
            config: {
                toolId: "cursor-launch-agent"
            },
            inputMapping: {
                repository: "{{ input.repository }}",
                prompt: "{{ steps.plan-implementation }}",
                ref: "{{ input.branch }}",
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "poll-cursor",
            type: "tool",
            name: "Wait for Cursor Agent to complete",
            description: "Poll the Cursor Cloud Agent until it finishes coding",
            config: {
                toolId: "cursor-poll-until-done"
            },
            inputMapping: {
                agentId: "{{ steps.dispatch-cursor.agentId }}",
                maxWaitMinutes: 30,
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "update-cursor-info",
            type: "tool",
            name: "Record Cursor agent details",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "verifying",
                cursorAgentId: "{{ steps.dispatch-cursor.agentId }}",
                targetBranch: "{{ steps.poll-cursor.branchName }}"
            }
        },
        {
            id: "verify-build",
            type: "tool",
            name: "Verify branch builds successfully",
            description: "Run type-check, lint, and build against the generated branch",
            config: {
                toolId: "wait-for-checks"
            },
            inputMapping: {
                repository: "{{ input.repository }}",
                ref: "{{ steps.poll-cursor.branchName }}",
                maxWaitMinutes: 15,
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "update-status-review",
            type: "tool",
            name: "Update pipeline status to review",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "awaiting_pr_review"
            }
        },
        {
            id: "review-pr",
            type: "human",
            name: "Review pull request",
            description: "Human reviews the generated code changes",
            config: {
                prompt: "Review the generated code changes and approve or request modifications.",
                formSchema: {
                    approved: { type: "boolean", description: "Approve this PR?" },
                    feedback: {
                        type: "string",
                        description: "Optional feedback"
                    }
                }
            }
        },
        {
            id: "update-status-merged",
            type: "tool",
            name: "Update pipeline status to merged",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "merged"
            }
        }
    ]
};

export const CODING_PIPELINE_INTERNAL_DEFINITION: WorkflowDefinition = {
    steps: [
        ...CODING_PIPELINE_DEFINITION.steps.slice(0, 3),
        {
            id: "plan-implementation",
            type: "agent",
            name: "Plan implementation (internal)",
            description:
                "Create a detailed implementation plan using deep knowledge of the AgentC2 codebase",
            config: {
                agentSlug: "agentc2-developer",
                promptTemplate: `You are planning a change to the AgentC2 platform codebase (mastra-experiment monorepo).

Ticket: {{ steps.ingest-ticket.title }}
Description: {{ steps.ingest-ticket.description }}
Analysis: {{ steps.analyze-codebase }}

CRITICAL: Follow these coding standards:
- Turborepo monorepo: apps/agent (port 3001), apps/frontend (port 3000), packages/mastra, packages/database
- TypeScript 5, Next.js 16, React 19, Prisma 6
- 4-space indent, no semicolons, double quotes
- Import order: React/Next → External packages → Internal packages (@repo/*) → Relative imports
- Pre-push: bun run type-check && bun run lint && bun run build
- Never commit .env or secrets

Create a step-by-step implementation plan. Be extremely specific about file paths and changes.`,
                maxSteps: 10,
                outputFormat: "json"
            }
        },
        ...CODING_PIPELINE_DEFINITION.steps.slice(4)
    ]
};

export const CODING_PIPELINE_WORKFLOW_SEED = {
    slug: "coding-pipeline",
    name: "Autonomous Coding Pipeline",
    description:
        "Orchestrates the full coding lifecycle: ticket analysis → planning → " +
        "Cursor Cloud Agent coding → verification → QA → human review → deployment. " +
        "Supports SupportTicket, BacklogTask, and GitHub Issue triggers.",
    maxSteps: 20,
    definitionJson: CODING_PIPELINE_DEFINITION
};

export const CODING_PIPELINE_INTERNAL_WORKFLOW_SEED = {
    slug: "coding-pipeline-internal",
    name: "Internal Coding Pipeline (Self-Development)",
    description:
        "Stricter variant of the coding pipeline for AgentC2 self-development. " +
        "Uses deep codebase knowledge, enforces CLAUDE.md standards, and " +
        "includes deployment verification to Digital Ocean.",
    maxSteps: 25,
    definitionJson: CODING_PIPELINE_INTERNAL_DEFINITION
};
