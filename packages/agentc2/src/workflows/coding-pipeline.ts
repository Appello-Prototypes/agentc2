/**
 * Coding Pipeline Workflow Definitions (Dark Factory)
 *
 * Standard and internal variants of the autonomous coding pipeline.
 * These definitions are seeded into the database and executed by the
 * DB workflow runtime (executeWorkflowDefinition).
 *
 * Key Dark Factory features:
 * - lookup-pipeline-config: Loads per-org PipelinePolicy and per-repo RepositoryConfig
 * - Risk-gated branch steps: Auto-approve plan/PR when risk is below org threshold
 * - Dynamic build commands: Uses RepositoryConfig.installCommand/buildCommand instead of hardcoded bun commands
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
            id: "lookup-pipeline-config",
            type: "tool",
            name: "Load pipeline policy and repo config",
            description:
                "Loads per-org risk thresholds and per-repo build commands from the database",
            config: {
                toolId: "lookup-pipeline-config"
            },
            inputMapping: {
                organizationId: "{{ input.organizationId }}",
                repositoryUrl: "{{ input.repository }}"
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
Description: {{ steps.ingest-ticket.title }}
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
            name: "Update pipeline status with risk level",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "awaiting_plan_approval",
                riskLevel: "{{ steps.classify-risk.riskLevel }}"
            }
        },
        {
            id: "plan-approval-gate",
            type: "branch",
            name: "Risk-gated plan approval",
            description:
                "Auto-approve if Dark Factory is enabled and risk is below threshold, otherwise require human approval",
            config: {
                branches: [
                    {
                        id: "auto-approve-plan",
                        condition:
                            "steps['lookup-pipeline-config'].policy.enabled && helpers.riskBelow(steps['classify-risk'].riskLevel, steps['lookup-pipeline-config'].policy.autoApprovePlanBelow)",
                        steps: [
                            {
                                id: "auto-approve-plan-status",
                                type: "tool",
                                name: "Log auto-approval of plan",
                                config: {
                                    toolId: "update-pipeline-status"
                                },
                                inputMapping: {
                                    pipelineRunId: "{{ input.pipelineRunId }}",
                                    status: "coding"
                                }
                            }
                        ]
                    }
                ],
                defaultBranch: [
                    {
                        id: "human-approve-plan",
                        type: "human",
                        name: "Review and approve implementation plan",
                        config: {
                            prompt: "Review the implementation plan and approve or reject it. Risk level: {{ steps.classify-risk.riskLevel }}",
                            formSchema: {
                                approved: {
                                    type: "boolean",
                                    description: "Approve this plan?"
                                },
                                feedback: {
                                    type: "string",
                                    description: "Optional feedback or modifications"
                                }
                            }
                        }
                    },
                    {
                        id: "human-approve-plan-status",
                        type: "tool",
                        name: "Update status after human approval",
                        config: {
                            toolId: "update-pipeline-status"
                        },
                        inputMapping: {
                            pipelineRunId: "{{ input.pipelineRunId }}",
                            status: "coding"
                        }
                    }
                ]
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
            id: "provision-build-env",
            type: "tool",
            name: "Provision build environment",
            description:
                "Spin up an ephemeral droplet in the customer's DO account for build verification",
            config: {
                toolId: "provision-compute"
            },
            inputMapping: {
                region: "nyc3",
                size: "medium",
                ttlMinutes: 60,
                pipelineRunId: "{{ input.pipelineRunId }}",
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "remote-clone",
            type: "tool",
            name: "Clone repository on build server",
            description: "Git clone the branch on the remote droplet",
            config: {
                toolId: "remote-execute"
            },
            inputMapping: {
                resourceId: "{{ steps.provision-build-env.resourceId }}",
                command:
                    "git clone --branch {{ steps.poll-cursor.branchName }} --single-branch {{ input.repository }} /workspace/repo",
                workingDir: "/workspace",
                timeout: 120,
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "remote-install",
            type: "tool",
            name: "Install dependencies on build server",
            config: {
                toolId: "remote-execute"
            },
            inputMapping: {
                resourceId: "{{ steps.provision-build-env.resourceId }}",
                command:
                    "source /root/.bashrc && {{ steps.lookup-pipeline-config.repoConfig.installCommand }}",
                workingDir: "/workspace/repo",
                timeout: 300,
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "remote-build",
            type: "tool",
            name: "Run build verification on build server",
            description: "Verify the code compiles and passes checks on isolated compute",
            config: {
                toolId: "remote-execute"
            },
            inputMapping: {
                resourceId: "{{ steps.provision-build-env.resourceId }}",
                command:
                    "source /root/.bashrc && {{ steps.lookup-pipeline-config.repoConfig.buildCommand }}",
                workingDir: "/workspace/repo",
                timeout: 600,
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "run-scenarios",
            type: "tool",
            name: "Run behavioral scenarios",
            description: "Execute non-holdout scenarios against the built codebase",
            config: {
                toolId: "run-scenarios"
            },
            inputMapping: {
                repositoryUrl: "{{ input.repository }}",
                organizationId: "{{ input.organizationId }}",
                pipelineRunId: "{{ input.pipelineRunId }}",
                includeHoldout: false,
                resourceId: "{{ steps.provision-build-env.resourceId }}"
            }
        },
        {
            id: "run-holdout-scenarios",
            type: "tool",
            name: "Run holdout scenarios",
            description: "Execute hidden holdout scenarios to prevent AI overfitting",
            config: {
                toolId: "run-scenarios"
            },
            inputMapping: {
                repositoryUrl: "{{ input.repository }}",
                organizationId: "{{ input.organizationId }}",
                pipelineRunId: "{{ input.pipelineRunId }}",
                includeHoldout: true,
                resourceId: "{{ steps.provision-build-env.resourceId }}"
            }
        },
        {
            id: "teardown-build-env",
            type: "tool",
            name: "Tear down build environment",
            description: "Destroy the ephemeral droplet after verification completes",
            config: {
                toolId: "teardown-compute"
            },
            inputMapping: {
                resourceId: "{{ steps.provision-build-env.resourceId }}",
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "verify-checks",
            type: "tool",
            name: "Wait for GitHub CI checks",
            description: "Also wait for any GitHub Actions checks on the branch",
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
            id: "calculate-trust",
            type: "tool",
            name: "Calculate trust score",
            description:
                "Combine scenario, holdout, CI, and build results into a single trust score",
            config: {
                toolId: "calculate-trust-score"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                scenarioPassRate: "{{ steps.run-scenarios.passRate }}",
                holdoutPassRate: "{{ steps.run-holdout-scenarios.passRate }}",
                ciPassed: true,
                buildPassed: true
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
            id: "pr-review-gate",
            type: "branch",
            name: "Risk-gated PR review",
            description:
                "Auto-approve PR if Dark Factory is enabled and risk is below threshold, otherwise require human review",
            config: {
                branches: [
                    {
                        id: "auto-approve-pr",
                        condition:
                            "steps['lookup-pipeline-config'].policy.enabled && helpers.riskBelow(steps['classify-risk'].riskLevel, steps['lookup-pipeline-config'].policy.autoApprovePrBelow)",
                        steps: [
                            {
                                id: "auto-approve-pr-status",
                                type: "tool",
                                name: "Log auto-approval of PR",
                                config: {
                                    toolId: "update-pipeline-status"
                                },
                                inputMapping: {
                                    pipelineRunId: "{{ input.pipelineRunId }}",
                                    status: "merged"
                                }
                            }
                        ]
                    }
                ],
                defaultBranch: [
                    {
                        id: "human-review-pr",
                        type: "human",
                        name: "Review pull request",
                        config: {
                            prompt: "Review the generated code changes and approve or request modifications. Risk level: {{ steps.classify-risk.riskLevel }}",
                            formSchema: {
                                approved: {
                                    type: "boolean",
                                    description: "Approve this PR?"
                                },
                                feedback: {
                                    type: "string",
                                    description: "Optional feedback"
                                }
                            }
                        }
                    }
                ]
            }
        },
        {
            id: "merge-pr",
            type: "tool",
            name: "Merge pull request",
            description: "Merge the PR via GitHub API using squash merge",
            config: {
                toolId: "merge-pull-request"
            },
            inputMapping: {
                repository: "{{ input.repository }}",
                prNumber: "{{ steps.poll-cursor.prNumber }}",
                mergeMethod: "squash",
                organizationId: "{{ input.organizationId }}"
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
        },
        {
            id: "await-deployment",
            type: "tool",
            name: "Wait for deployment to complete",
            description: "Poll the deployment workflow on main branch after merge",
            config: {
                toolId: "await-deploy"
            },
            inputMapping: {
                repository: "{{ input.repository }}",
                branch: "main",
                maxWaitMinutes: 30,
                organizationId: "{{ input.organizationId }}"
            }
        },
        {
            id: "update-status-deployed",
            type: "tool",
            name: "Update pipeline status to deployed",
            config: {
                toolId: "update-pipeline-status"
            },
            inputMapping: {
                pipelineRunId: "{{ input.pipelineRunId }}",
                status: "deployed"
            }
        }
    ]
};

// Internal variant: uses agentc2-developer for planning with CLAUDE.md standards
export const CODING_PIPELINE_INTERNAL_DEFINITION: WorkflowDefinition = {
    steps: [
        // First 4 steps identical (ingest, config lookup, status, analyze)
        ...CODING_PIPELINE_DEFINITION.steps.slice(0, 4),
        {
            id: "plan-implementation",
            type: "agent",
            name: "Plan implementation (internal)",
            description:
                "Create a detailed implementation plan using deep knowledge of the AgentC2 codebase",
            config: {
                agentSlug: "agentc2-developer",
                promptTemplate: `You are planning a change to the AgentC2 platform codebase (agentc2 monorepo).

Ticket: {{ steps.ingest-ticket.title }}
Description: {{ steps.ingest-ticket.description }}
Analysis: {{ steps.analyze-codebase }}

CRITICAL: Follow these coding standards:
- Turborepo monorepo: apps/agent (port 3001), apps/frontend (port 3000), packages/agentc2, packages/database
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
        // Remaining steps identical (risk classify through PR review gate)
        ...CODING_PIPELINE_DEFINITION.steps.slice(5)
    ]
};

export const CODING_PIPELINE_WORKFLOW_SEED = {
    slug: "coding-pipeline",
    name: "Autonomous Coding Pipeline (Dark Factory)",
    description:
        "Orchestrates the full coding lifecycle: ticket analysis → planning → " +
        "risk classification → risk-gated approval → Cursor Cloud Agent coding → " +
        "build verification → CI checks → risk-gated PR review. " +
        "Supports per-org PipelinePolicy for auto-approval thresholds and " +
        "per-repo RepositoryConfig for custom build commands. " +
        "Triggers: SupportTicket, BacklogTask, GitHub Issue.",
    maxSteps: 25,
    definitionJson: CODING_PIPELINE_DEFINITION
};

export const CODING_PIPELINE_INTERNAL_WORKFLOW_SEED = {
    slug: "coding-pipeline-internal",
    name: "Internal Coding Pipeline (Self-Development, Dark Factory)",
    description:
        "Stricter variant of the coding pipeline for AgentC2 self-development. " +
        "Uses agentc2-developer agent with deep codebase knowledge, " +
        "enforces CLAUDE.md standards, and supports Dark Factory auto-approval.",
    maxSteps: 25,
    definitionJson: CODING_PIPELINE_INTERNAL_DEFINITION
};
