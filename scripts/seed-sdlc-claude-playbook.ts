/**
 * Seed script for the Claude Code SDLC Flywheel playbook.
 *
 * Creates within the AgentC2 org:
 * 1. Three Claude SDLC Workflows: sdlc-triage-claude, sdlc-bugfix-claude, sdlc-feature-claude
 *    (near-copies of the Cursor variants with tool IDs and prompt text swapped)
 * 2. SDLC Triage Network (Claude): sdlc-triage-network-claude
 * 3. Updates shared agents:
 *    - Planner: generalizes "Cursor Cloud Agent" → "the autonomous coding agent"
 *    - Auditor: adds "claude-launch-agent" to guardrail blockedTools
 * 4. Packages everything into the "SDLC Flywheel (Claude Code)" playbook
 *
 * Idempotent: safe to re-run.
 *
 * Usage: bun run scripts/seed-sdlc-claude-playbook.ts
 */

import { prisma } from "../packages/database/src/index";

const ORG_SLUG = "agentc2";
const orgSlug = (base: string) => `${base}-${ORG_SLUG}`;

/* ─── Main ─────────────────────────────────────────────────────────── */

async function main() {
    console.log("Seeding Claude Code SDLC Flywheel playbook...\n");

    // 1. Find AgentC2 org + workspace + system user
    const org = await prisma.organization.findUnique({
        where: { slug: "agentc2" }
    });
    if (!org) throw new Error("AgentC2 org not found. Run seed-sdlc-playbook.ts first.");
    console.log("AgentC2 org:", org.id);

    const workspace = await prisma.workspace.findFirst({
        where: { organizationId: org.id, slug: orgSlug("platform") }
    });
    if (!workspace)
        throw new Error("Platform workspace not found. Run seed-sdlc-playbook.ts first.");
    console.log("Platform workspace:", workspace.id);

    let systemUser = await prisma.user.findFirst({
        where: { email: "system@agentc2.ai" }
    });
    if (!systemUser) throw new Error("System user not found. Run seed-sdlc-playbook.ts first.");
    console.log("System user:", systemUser.id);

    // 2. Find existing SDLC agents
    const agentSlugs = [
        orgSlug("sdlc-classifier"),
        orgSlug("sdlc-planner"),
        orgSlug("sdlc-auditor"),
        orgSlug("sdlc-reviewer")
    ];
    const agents: Record<string, { id: string; slug: string }> = {};
    for (const slug of agentSlugs) {
        const agent = await prisma.agent.findFirst({ where: { slug } });
        if (!agent) throw new Error(`Agent "${slug}" not found. Run seed-sdlc-playbook.ts first.`);
        agents[slug] = { id: agent.id, slug: agent.slug };
    }
    console.log("Found all 4 SDLC agents\n");

    // ─── 3. Update shared agents ──────────────────────────────────────

    // 3a. Generalize Planner instructions
    const planner = await prisma.agent.findFirst({
        where: { slug: orgSlug("sdlc-planner") }
    });
    if (planner && planner.instructions.includes("Cursor Cloud Agent")) {
        await prisma.agent.update({
            where: { id: planner.id },
            data: {
                instructions: planner.instructions.replace(
                    /Cursor Cloud Agent/g,
                    "the autonomous coding agent"
                )
            }
        });
        console.log("Updated Planner instructions: generalized to 'autonomous coding agent'");
    } else {
        console.log("Planner instructions already generalized or not found");
    }

    // 3b. Expand Auditor guardrail blockedTools
    const auditor = await prisma.agent.findFirst({
        where: { slug: orgSlug("sdlc-auditor") }
    });
    if (auditor) {
        const guardrail = await prisma.guardrailPolicy.findFirst({
            where: { agentId: auditor.id }
        });
        if (guardrail) {
            const config = guardrail.configJson as Record<string, unknown>;
            const blockedTools = (config.blockedTools as string[]) || [];
            if (!blockedTools.includes("claude-launch-agent")) {
                blockedTools.push("claude-launch-agent");
                await prisma.guardrailPolicy.update({
                    where: { id: guardrail.id },
                    data: {
                        configJson: { ...config, blockedTools }
                    }
                });
                console.log("Updated Auditor guardrail: added claude-launch-agent to blockedTools");
            } else {
                console.log("Auditor guardrail already includes claude-launch-agent");
            }
        }
    }

    // ─── 4. Create Claude SDLC Workflows ──────────────────────────────

    const inputSchema = {
        type: "object",
        properties: {
            title: { type: "string", description: "Ticket/issue title" },
            description: { type: "string", description: "Full description" },
            repository: {
                type: "string",
                description: "Target repo (owner/repo)"
            },
            labels: {
                type: "array",
                items: { type: "string" },
                description: "Labels to apply"
            },
            sourceTicketId: {
                type: "string",
                description: "Original ticket ID"
            },
            pipelineRunId: {
                type: "string",
                description: "Pipeline run ID for linking"
            },
            existingIssueUrl: {
                type: "string",
                description: "Existing GitHub issue URL (skip creation)"
            },
            existingIssueNumber: {
                type: "number",
                description: "Existing GitHub issue number"
            }
        },
        required: ["title", "description", "repository"]
    };

    // ─── Bugfix Workflow (Claude) ──────────────────────────────────────

    const bugfixClaudeWorkflowDef = {
        steps: [
            {
                id: "intake",
                type: "tool",
                name: "Create GitHub Issue",
                config: {
                    toolId: "ticket-to-github-issue",
                    parameters: {
                        title: "{{input.title}}",
                        description: "{{input.description}}",
                        repository: "{{input.repository}}",
                        labels: ["bug"],
                        sourceTicketId: "{{input.sourceTicketId}}",
                        existingIssueUrl: "{{input.existingIssueUrl}}",
                        existingIssueNumber: "{{input.existingIssueNumber}}"
                    }
                }
            },
            {
                id: "analyze-launch",
                type: "tool",
                name: "Launch Code Analysis",
                config: {
                    toolId: "claude-launch-agent",
                    parameters: {
                        prompt: "You are performing a root cause analysis for a bug report. Do NOT implement any fix — analysis and planning only.\n\n## Bug Report\n\nTitle: {{input.title}}\n\n{{input.description}}\n\nGitHub Issue: {{steps.intake.issueUrl}}\nRepository: {{input.repository}}\n\n## Your Task\n\n1. **Search the codebase** to find all code related to this bug. Use grep, semantic search, and file reading to thoroughly understand the relevant code.\n\n2. **Root Cause Analysis**: Identify the exact root cause with specific file paths, function names, and line numbers.\n\n3. **Impact Assessment**: What other parts of the system are affected?\n\n4. **Fix Plan**: Create a detailed, step-by-step fix plan:\n   - Specific files to modify and what changes to make\n   - Any new files or tests needed\n   - Risk assessment (low/medium/high)\n   - Estimated complexity\n\nOutput your complete analysis as a structured markdown document. Be thorough — your analysis will be reviewed by an auditor and a human before any code is written.",
                        repository: "https://github.com/{{input.repository}}"
                    }
                }
            },
            {
                id: "analyze-wait",
                type: "tool",
                name: "Wait for Analysis",
                config: {
                    toolId: "claude-poll-until-done",
                    parameters: {
                        agentId: "{{steps['analyze-launch'].agentId}}",
                        maxWaitMinutes: 15
                    }
                }
            },
            {
                id: "analyze-result",
                type: "tool",
                name: "Get Analysis Results",
                config: {
                    toolId: "claude-get-conversation",
                    parameters: {
                        agentId: "{{steps['analyze-launch'].agentId}}"
                    }
                }
            },
            {
                id: "post-analysis",
                type: "tool",
                name: "Post Analysis to Issue",
                config: {
                    toolId: "github-add-issue-comment",
                    parameters: {
                        body: "## Root Cause Analysis\n\n_Performed by Claude Code Agent with full codebase access._\n\n{{steps['analyze-wait'].summary}}\n\n---\n_Analysis completed in {{steps['analyze-wait'].durationMs}}ms | Agent: {{steps['analyze-launch'].agentId}}_",
                        repository: "{{input.repository}}",
                        issueNumber: "{{steps.intake.issueNumber}}"
                    }
                }
            },
            {
                id: "audit-cycle",
                type: "dowhile",
                name: "Audit & Approval Cycle",
                config: {
                    maxIterations: 3,
                    conditionExpression:
                        "steps['fix-review']?.approved !== true && steps['fix-review']?.rejected !== true",
                    steps: [
                        {
                            id: "fix-audit",
                            type: "agent",
                            name: "Audit Fix Plan",
                            config: {
                                agentSlug: orgSlug("sdlc-auditor"),
                                outputFormat: "json",
                                promptTemplate:
                                    "Audit this bugfix analysis and plan. It was produced by a Claude Code Agent with full codebase access.\n\n## Analysis Summary\n{{steps['analyze-wait'].summary}}\n\n## Full Conversation\n{{json(steps['analyze-result'].messages)}}\n\n{{#if steps['fix-audit']}}## Previous Audit Issues\nYour previous audit found these issues: {{helpers.json(steps['fix-audit'].issues)}}\nVerify whether they have been addressed in the revised analysis.{{/if}}\n\n{{#if steps['fix-review']}}## Human Feedback\n{{steps['fix-review'].feedback}}{{/if}}\n\nEvaluate:\n- Is the root cause correctly identified with specific file paths and code references?\n- Is the fix plan complete and correctly sequenced?\n- Are edge cases and risks addressed?\n- Is test coverage planned?"
                            }
                        },
                        {
                            id: "fix-verdict-route",
                            type: "branch",
                            name: "Route by Audit Verdict",
                            config: {
                                branches: [
                                    {
                                        id: "passed",
                                        condition: "steps['fix-audit']?.verdict === 'PASS'",
                                        steps: [
                                            {
                                                id: "fix-review",
                                                type: "human",
                                                name: "Final Approval",
                                                config: {
                                                    prompt: "The auditor has APPROVED the analysis and fix plan. Review the code analysis (posted on the GitHub issue) and approve to proceed with implementation, provide feedback for changes, or reject."
                                                }
                                            }
                                        ]
                                    }
                                ],
                                defaultBranch: [
                                    {
                                        id: "fix-audit-notes",
                                        type: "tool",
                                        name: "Post Audit Feedback",
                                        config: {
                                            toolId: "github-add-issue-comment",
                                            parameters: {
                                                body: "## SDLC Audit: Revision Required\n\n**Verdict:** {{steps['fix-audit'].verdict}}\n**Severity:** {{steps['fix-audit'].severity}}\n\n**Summary:** {{steps['fix-audit'].summary}}\n\n**Issues:**\n{{helpers.json(steps['fix-audit'].issues)}}\n\n**Positives:**\n{{helpers.json(steps['fix-audit'].positives)}}\n\nA revised analysis will be generated automatically.",
                                                repository: "{{input.repository}}",
                                                issueNumber: "{{steps.intake.issueNumber}}"
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                id: "implement-launch",
                type: "tool",
                name: "Implement Fix",
                config: {
                    toolId: "claude-launch-agent",
                    parameters: {
                        prompt: "Implement the following approved bugfix.\n\n## Bug\nTitle: {{input.title}}\nGitHub Issue: {{steps.intake.issueUrl}}\n\n## Approved Fix Plan\n{{steps['analyze-wait'].summary}}\n\n## Instructions\n1. Implement the fix according to the approved plan on the current branch (do NOT create a new branch)\n2. Add or update tests as needed\n3. Run linting and type-checking to verify\n4. Commit with a conventional commit message: fix: <description>\n5. Push the branch. Do NOT merge or create a PR — the system handles PR creation automatically.",
                        repository: "https://github.com/{{input.repository}}",
                        autoCreatePr: true
                    }
                }
            },
            {
                id: "implement-wait",
                type: "tool",
                name: "Wait for Implementation",
                config: {
                    toolId: "claude-poll-until-done",
                    parameters: {
                        agentId: "{{steps['implement-launch'].agentId}}",
                        maxWaitMinutes: 30,
                        repository: "{{input.repository}}"
                    }
                }
            },
            {
                id: "merge-review",
                type: "human",
                name: "Review PR on GitHub",
                config: {
                    prompt: "A pull request has been created:\n\n{{steps['implement-wait'].prUrl}}\n\nReview the code changes on GitHub. Approve to merge, or reject."
                }
            },
            {
                id: "merge",
                type: "tool",
                name: "Merge PR",
                config: {
                    toolId: "merge-pull-request",
                    parameters: {
                        prNumber: "{{steps['implement-wait'].prNumber}}",
                        repository: "{{input.repository}}",
                        mergeMethod: "squash"
                    }
                }
            },
            {
                id: "output-summary",
                type: "transform",
                name: "Output Summary",
                inputMapping: {
                    issueUrl: "{{steps.intake.issueUrl}}",
                    issueNumber: "{{steps.intake.issueNumber}}",
                    analysisSummary: "{{steps['analyze-wait'].summary}}",
                    analysisAgentId: "{{steps['analyze-launch'].agentId}}",
                    analysisDurationMs: "{{steps['analyze-wait'].durationMs}}",
                    auditVerdict: "{{steps['fix-audit'].verdict}}",
                    auditSeverity: "{{steps['fix-audit'].severity}}",
                    auditSummary: "{{steps['fix-audit'].summary}}",
                    implementationSummary: "{{steps['implement-wait'].summary}}",
                    implementationBranch: "{{steps['implement-wait'].branchName}}",
                    implementationAgentId: "{{steps['implement-launch'].agentId}}",
                    implementationDurationMs: "{{steps['implement-wait'].durationMs}}",
                    prUrl: "{{steps['implement-wait'].prUrl}}",
                    prNumber: "{{steps['implement-wait'].prNumber}}",
                    mergeCommitSha: "{{steps.merge.sha}}",
                    repository: "{{input.repository}}"
                }
            }
        ]
    };

    // ─── Feature Workflow (Claude) ─────────────────────────────────────

    const featureClaudeWorkflowDef = {
        steps: [
            {
                id: "intake",
                type: "tool",
                name: "Create GitHub Issue",
                config: {
                    toolId: "ticket-to-github-issue",
                    parameters: {
                        title: "{{input.title}}",
                        description: "{{input.description}}",
                        repository: "{{input.repository}}",
                        labels: ["feature"],
                        sourceTicketId: "{{input.sourceTicketId}}",
                        existingIssueUrl: "{{input.existingIssueUrl}}",
                        existingIssueNumber: "{{input.existingIssueNumber}}"
                    }
                }
            },
            {
                id: "classify",
                type: "agent",
                name: "Feature Analysis",
                config: {
                    agentSlug: orgSlug("sdlc-classifier"),
                    promptTemplate:
                        "Analyze this feature request:\n\nTitle: {{input.title}}\nDescription: {{input.description}}\n\nGitHub Issue: {{steps.intake.issueUrl}}\n\nAssess scope, complexity, dependencies, and affected areas.",
                    outputFormat: "json"
                }
            },
            {
                id: "design-launch",
                type: "tool",
                name: "Launch Design Analysis",
                config: {
                    toolId: "claude-launch-agent",
                    parameters: {
                        prompt: "You are creating a technical design for a feature request. Do NOT implement anything — design and analysis only.\n\n## Feature Request\n\nTitle: {{input.title}}\n\n{{input.description}}\n\nScope: {{steps.classify.complexity}} | Priority: {{steps.classify.priority}}\nGitHub Issue: {{steps.intake.issueUrl}}\nRepository: {{input.repository}}\n\n## Your Task\n\n1. **Search the codebase** to understand the relevant architecture, patterns, and existing implementations.\n2. **Technical Design**: Create a comprehensive design document including architecture changes, new components, data model changes, API changes, and integration points.\n3. **Impact Assessment**: What existing functionality is affected? What are the risks?\n4. **Phased Approach**: Break the feature into deliverable phases with clear milestones.\n\nOutput your complete design as a structured markdown document.",
                        repository: "https://github.com/{{input.repository}}"
                    }
                }
            },
            {
                id: "design-wait",
                type: "tool",
                name: "Wait for Design",
                config: {
                    toolId: "claude-poll-until-done",
                    parameters: {
                        agentId: "{{steps['design-launch'].agentId}}",
                        maxWaitMinutes: 20
                    }
                }
            },
            {
                id: "design-result",
                type: "tool",
                name: "Get Design Results",
                config: {
                    toolId: "claude-get-conversation",
                    parameters: {
                        agentId: "{{steps['design-launch'].agentId}}"
                    }
                }
            },
            {
                id: "post-design",
                type: "tool",
                name: "Post Design to Issue",
                config: {
                    toolId: "github-add-issue-comment",
                    parameters: {
                        body: "## Technical Design\n\n_Performed by Claude Code Agent with full codebase access._\n\n{{steps['design-wait'].summary}}\n\n---\n_Design completed in {{steps['design-wait'].durationMs}}ms | Agent: {{steps['design-launch'].agentId}}_",
                        repository: "{{input.repository}}",
                        issueNumber: "{{steps.intake.issueNumber}}"
                    }
                }
            },
            {
                id: "design-review",
                type: "human",
                name: "Design Review",
                config: {
                    prompt: "Review the technical design below. Approve to proceed with implementation, provide feedback for revision, or reject.",
                    contextMapping: {
                        issueUrl: "{{steps.intake.issueUrl}}",
                        issueNumber: "{{steps.intake.issueNumber}}",
                        repository: "{{steps.intake.repository}}",
                        classification: "{{steps.classify.classification}}",
                        priority: "{{steps.classify.priority}}",
                        complexity: "{{steps.classify.complexity}}",
                        rationale: "{{steps.classify.rationale}}",
                        designSummary: "{{steps['design-wait'].summary}}",
                        prUrl: "{{steps['design-wait'].prUrl}}",
                        prNumber: "{{steps['design-wait'].prNumber}}",
                        designDurationMs: "{{steps['design-wait'].durationMs}}"
                    }
                }
            },
            {
                id: "plan-cycle",
                type: "dowhile",
                name: "Implementation Plan Cycle",
                config: {
                    maxIterations: 3,
                    conditionExpression:
                        "steps['feature-plan-review']?.approved !== true && steps['feature-plan-review']?.rejected !== true",
                    steps: [
                        {
                            id: "feature-plan",
                            type: "agent",
                            name: "Phased Plan",
                            config: {
                                agentSlug: orgSlug("sdlc-planner"),
                                promptTemplate:
                                    "Create a phased implementation plan for this feature.\n\nTechnical design (from Claude Code Agent with full codebase access):\n{{steps['design-wait'].summary}}\n\nFeature: {{input.title}}\nScope: {{steps.classify.complexity}}\n\nBreak into deliverable phases with clear milestones, file paths, and estimated complexity.\n\n{{#if steps['feature-plan-audit']}}Previous audit feedback: {{steps['feature-plan-audit'].summary}}\nIssues to address: {{helpers.json(steps['feature-plan-audit'].issues)}}{{/if}}\n\n{{#if steps['feature-plan-review']}}Human feedback: {{steps['feature-plan-review'].feedback}}{{/if}}"
                            }
                        },
                        {
                            id: "feature-plan-audit",
                            type: "agent",
                            name: "Audit Plan",
                            config: {
                                agentSlug: orgSlug("sdlc-auditor"),
                                promptTemplate:
                                    "Audit this phased implementation plan:\n\n{{steps['feature-plan'].text}}\n\nOriginal design:\n{{steps['design-wait'].summary}}\n\nVerify: completeness, correct phasing, edge cases, testing coverage, risk assessment.",
                                outputFormat: "json"
                            }
                        },
                        {
                            id: "feature-verdict-route",
                            type: "branch",
                            name: "Route by Audit Verdict",
                            config: {
                                branches: [
                                    {
                                        id: "passed",
                                        condition:
                                            "steps['feature-plan-audit']?.verdict === 'PASS'",
                                        steps: [
                                            {
                                                id: "feature-plan-review",
                                                type: "human",
                                                name: "Review Plan",
                                                config: {
                                                    prompt: "The auditor has APPROVED the phased implementation plan. Review and approve to begin implementation, provide feedback for changes, or reject."
                                                }
                                            }
                                        ]
                                    }
                                ],
                                defaultBranch: [
                                    {
                                        id: "feature-audit-notes",
                                        type: "tool",
                                        name: "Post Audit Feedback",
                                        config: {
                                            toolId: "github-add-issue-comment",
                                            parameters: {
                                                body: "## SDLC Audit: Plan Revision Required\n\n**Verdict:** {{steps['feature-plan-audit'].verdict}}\n**Severity:** {{steps['feature-plan-audit'].severity}}\n\n**Summary:** {{steps['feature-plan-audit'].summary}}\n\n**Issues:**\n{{helpers.json(steps['feature-plan-audit'].issues)}}\n\nA revised plan will be generated automatically.",
                                                repository: "{{input.repository}}",
                                                issueNumber: "{{steps.intake.issueNumber}}"
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                id: "implement-launch",
                type: "tool",
                name: "Implement Feature",
                config: {
                    toolId: "claude-launch-agent",
                    parameters: {
                        prompt: "Implement the following approved feature plan.\n\n## Feature\nTitle: {{input.title}}\nGitHub Issue: {{steps.intake.issueUrl}}\n\n## Approved Implementation Plan\n{{steps['feature-plan'].text}}\n\n## Instructions\n1. Implement the feature according to the approved phased plan on the current branch (do NOT create a new branch)\n2. Add comprehensive tests\n3. Run linting and type-checking to verify\n4. Commit with conventional commit messages: feat: <description>\n5. Push the branch. Do NOT merge or create a PR — the system handles PR creation automatically.",
                        repository: "https://github.com/{{input.repository}}",
                        autoCreatePr: true
                    }
                }
            },
            {
                id: "implement-wait",
                type: "tool",
                name: "Wait for Implementation",
                config: {
                    toolId: "claude-poll-until-done",
                    parameters: {
                        agentId: "{{steps['implement-launch'].agentId}}",
                        maxWaitMinutes: 30,
                        repository: "{{input.repository}}"
                    }
                }
            },
            {
                id: "merge-review",
                type: "human",
                name: "Review PR on GitHub",
                config: {
                    prompt: "A pull request has been created:\n\n{{steps['implement-wait'].prUrl}}\n\nReview the code changes on GitHub. Approve to merge, or reject."
                }
            },
            {
                id: "merge",
                type: "tool",
                name: "Merge PR",
                config: {
                    toolId: "merge-pull-request",
                    parameters: {
                        prNumber: "{{steps['implement-wait'].prNumber}}",
                        repository: "{{input.repository}}",
                        mergeMethod: "squash"
                    }
                }
            }
        ]
    };

    // ─── Triage Workflow (Claude) ──────────────────────────────────────

    const triageClaudeWorkflowDef = {
        steps: [
            {
                id: "intake",
                type: "tool",
                name: "Create GitHub Issue",
                config: {
                    toolId: "ticket-to-github-issue",
                    parameters: {
                        title: "{{input.title}}",
                        description: "{{input.description}}",
                        repository: "{{input.repository}}",
                        labels: "{{input.labels}}",
                        sourceTicketId: "{{input.sourceTicketId}}",
                        existingIssueUrl: "{{input.existingIssueUrl}}",
                        existingIssueNumber: "{{input.existingIssueNumber}}"
                    }
                }
            },
            {
                id: "classify",
                type: "agent",
                name: "Classify Ticket",
                config: {
                    agentSlug: orgSlug("sdlc-classifier"),
                    outputFormat: "json",
                    promptTemplate:
                        "Classify this ticket:\n\nTitle: {{input.title}}\nDescription: {{input.description}}\n\nGitHub Issue: {{steps.intake.issueUrl}}\nRepository: {{input.repository}}\n\nProvide classification, priority, complexity, and suggested route."
                }
            },
            {
                id: "post-classification",
                type: "tool",
                name: "Post Classification to Issue",
                config: {
                    toolId: "github-add-issue-comment",
                    parameters: {
                        body: "## SDLC Triage\n\n**Classification:** {{steps.classify.classification}}\n**Priority:** {{steps.classify.priority}}\n**Complexity:** {{steps.classify.complexity}}\n**Route:** {{steps.classify.suggestedRoute}}\n\n**Rationale:** {{steps.classify.rationale}}\n\n**Affected Areas:** {{helpers.json(steps.classify.affectedAreas)}}\n\n---\n_Classified by sdlc-classifier-agentc2 (Claude Code pipeline)_",
                        repository: "{{input.repository}}",
                        issueNumber: "{{steps.intake.issueNumber}}"
                    }
                }
            },
            {
                id: "route",
                type: "branch",
                name: "Route by Classification",
                config: {
                    branches: [
                        {
                            id: "bug-route",
                            condition: "steps.classify?.classification === 'bug'",
                            steps: [
                                {
                                    id: "run-bugfix",
                                    type: "workflow",
                                    name: "Execute Bugfix Workflow",
                                    config: {
                                        workflowId: orgSlug("sdlc-bugfix-claude"),
                                        input: {
                                            title: "{{input.title}}",
                                            description: "{{input.description}}",
                                            repository: "{{input.repository}}",
                                            labels: ["bug"],
                                            sourceTicketId: "{{input.sourceTicketId}}",
                                            existingIssueUrl: "{{steps.intake.issueUrl}}",
                                            existingIssueNumber: "{{steps.intake.issueNumber}}"
                                        }
                                    }
                                }
                            ]
                        },
                        {
                            id: "feature-route",
                            condition: "steps.classify?.classification === 'feature'",
                            steps: [
                                {
                                    id: "run-feature",
                                    type: "workflow",
                                    name: "Execute Feature Workflow",
                                    config: {
                                        workflowId: orgSlug("sdlc-feature-claude"),
                                        input: {
                                            title: "{{input.title}}",
                                            description: "{{input.description}}",
                                            repository: "{{input.repository}}",
                                            labels: ["feature"],
                                            sourceTicketId: "{{input.sourceTicketId}}",
                                            existingIssueUrl: "{{steps.intake.issueUrl}}",
                                            existingIssueNumber: "{{steps.intake.issueNumber}}"
                                        }
                                    }
                                }
                            ]
                        }
                    ],
                    defaultBranch: [
                        {
                            id: "kb-generate",
                            type: "agent",
                            name: "Generate KB Article",
                            config: {
                                agentSlug: orgSlug("sdlc-planner"),
                                promptTemplate:
                                    "The ticket '{{input.title}}' was classified as: {{steps.classify.classification}}\n\nThis is not a bug or feature request. Generate a knowledge base article or explanation that addresses the user's question/issue.\n\nDescription: {{input.description}}\n\nClassification rationale: {{steps.classify.rationale}}\n\nProvide a clear, helpful response that explains the correct usage, common mistakes, or relevant documentation."
                            }
                        },
                        {
                            id: "kb-post",
                            type: "tool",
                            name: "Post KB Article to Issue",
                            config: {
                                toolId: "github-add-issue-comment",
                                parameters: {
                                    body: "## Knowledge Base Response\n\n{{steps['kb-generate'].text}}\n\n---\n_Generated by sdlc-planner-agentc2 | Classification: {{steps.classify.classification}} (Claude Code pipeline)_",
                                    repository: "{{input.repository}}",
                                    issueNumber: "{{steps.intake.issueNumber}}"
                                }
                            }
                        }
                    ]
                }
            }
        ]
    };

    // ─── Create the workflows ─────────────────────────────────────────

    const workflowDefs = [
        {
            slug: orgSlug("sdlc-triage-claude"),
            name: "SDLC Triage (Claude Code)",
            description:
                "Single entry point for all SDLC tickets via Claude Code. Classifies incoming tickets and routes to the correct Claude sub-workflow: bugfix (bugs), feature (features), or inline KB article.",
            definitionJson: triageClaudeWorkflowDef,
            isActive: true,
            isPublished: true
        },
        {
            slug: orgSlug("sdlc-bugfix-claude"),
            name: "SDLC Bugfix (Claude Code)",
            description:
                "GitHub-centric SDLC bugfix workflow powered by Claude Code Agent. AgentC2 orchestrates root cause analysis, audit cycles, implementation, PR creation, review, and merge.",
            definitionJson: bugfixClaudeWorkflowDef,
            isActive: true,
            isPublished: true
        },
        {
            slug: orgSlug("sdlc-feature-claude"),
            name: "SDLC Feature (Claude Code)",
            description:
                "GitHub-centric SDLC feature workflow powered by Claude Code Agent. AgentC2 orchestrates design, phased planning (with audit revision cycles), implementation, PR review, and merge.",
            definitionJson: featureClaudeWorkflowDef,
            isActive: true,
            isPublished: true
        }
    ];

    const workflows: Record<string, { id: string; slug: string }> = {};
    for (const wfDef of workflowDefs) {
        let existing = await prisma.workflow.findFirst({
            where: { slug: wfDef.slug }
        });
        if (!existing) {
            existing = await prisma.workflow.create({
                data: {
                    slug: wfDef.slug,
                    name: wfDef.name,
                    description: wfDef.description,
                    definitionJson: wfDef.definitionJson,
                    inputSchemaJson: inputSchema,
                    maxSteps: 50,
                    isActive: wfDef.isActive,
                    isPublished: wfDef.isPublished,
                    workspaceId: workspace.id
                }
            });
            console.log("Created workflow:", existing.slug);
        } else {
            await prisma.workflow.update({
                where: { id: existing.id },
                data: {
                    definitionJson: wfDef.definitionJson,
                    description: wfDef.description,
                    isActive: wfDef.isActive,
                    isPublished: wfDef.isPublished
                }
            });
            console.log("Updated workflow:", existing.slug);
        }
        workflows[wfDef.slug] = { id: existing.id, slug: existing.slug };
    }

    // ─── 5. Create Claude SDLC Triage Network ────────────────────────

    console.log("\nCreating Claude SDLC Triage network...");

    const claudeNetworkSlug = orgSlug("sdlc-triage-network-claude");

    let claudeNetwork = await prisma.network.findUnique({
        where: { workspaceId_slug: { workspaceId: workspace.id, slug: claudeNetworkSlug } }
    });

    if (!claudeNetwork) {
        claudeNetwork = await prisma.network.create({
            data: {
                slug: claudeNetworkSlug,
                name: "SDLC Triage Network (Claude Code)",
                description:
                    "Multi-agent network that mirrors the Claude Code SDLC triage workflow topology. " +
                    "Provides a fallback execution path via the network engine when workflow-execute is unavailable.",
                instructions:
                    "You are the SDLC Triage router (Claude Code variant). Given an incoming ticket, first delegate to the Classifier agent " +
                    "to determine type/priority/complexity. Then route based on classification:\n" +
                    "- 'bug' → delegate to the Planner agent for root cause analysis and fix plan\n" +
                    "- 'feature' → delegate to the Planner agent for design and phased implementation plan\n" +
                    "- anything else → delegate to the Planner agent for a KB article or user guidance\n\n" +
                    "After the Planner produces output, delegate to the Auditor for quality review. " +
                    "Report the full pipeline result including classification, plan, and audit verdict.",
                modelProvider: "openai",
                modelName: "gpt-4o",
                temperature: 0.3,
                topologyJson: {
                    nodes: [
                        { id: "classifier", label: "Classifier", type: "agent" },
                        { id: "planner", label: "Planner", type: "agent" },
                        { id: "auditor", label: "Auditor", type: "agent" },
                        { id: "reviewer", label: "Reviewer", type: "agent" }
                    ],
                    edges: [
                        { from: "classifier", to: "planner" },
                        { from: "planner", to: "auditor" },
                        { from: "auditor", to: "reviewer" }
                    ]
                },
                memoryConfig: {
                    lastMessages: 40,
                    semanticRecall: false
                },
                maxSteps: 12,
                isPublished: true,
                isActive: true,
                workspaceId: workspace.id,
                visibility: "ORGANIZATION",
                createdBy: "seed-sdlc-claude-playbook"
            }
        });

        const primitiveAgents = [
            {
                slug: orgSlug("sdlc-classifier"),
                desc: "Classifies tickets by type, priority, and complexity"
            },
            {
                slug: orgSlug("sdlc-planner"),
                desc: "Analyzes codebases and creates implementation plans"
            },
            {
                slug: orgSlug("sdlc-auditor"),
                desc: "Reviews plans and code for quality and completeness"
            },
            { slug: orgSlug("sdlc-reviewer"), desc: "Reviews PRs and calculates trust scores" }
        ];

        for (const pa of primitiveAgents) {
            const agentRecord = agents[pa.slug];
            if (agentRecord) {
                await prisma.networkPrimitive.create({
                    data: {
                        networkId: claudeNetwork.id,
                        primitiveType: "agent",
                        agentId: agentRecord.id,
                        description: pa.desc
                    }
                });
            }
        }

        console.log("Created Claude SDLC Triage network:", claudeNetwork.slug);
    } else {
        console.log("Claude SDLC Triage network exists:", claudeNetwork.slug);
    }

    // ─── 6. Package as Playbook ───────────────────────────────────────

    console.log("\nPackaging Claude Code SDLC Flywheel playbook...");

    let playbook = await prisma.playbook.findUnique({
        where: { slug: "sdlc-flywheel-claude" }
    });

    const { packagePlaybook } = await import("../packages/agentc2/src/playbooks/packager");

    if (!playbook) {
        const result = await packagePlaybook({
            name: "SDLC Flywheel (Claude Code)",
            slug: "sdlc-flywheel-claude",
            description:
                "Autonomous software development lifecycle powered by Claude Code Agent SDK. " +
                "Includes ticket classification, code analysis, implementation planning " +
                "with revision cycles, automated coding, PR review with trust scores, " +
                "and deployment — all with human-in-the-loop controls.",
            category: "development",
            tags: ["sdlc", "claude-code", "coding-pipeline", "autonomous", "flywheel"],
            entryNetworkId: claudeNetwork.id,
            includeWorkflows: [
                workflows[orgSlug("sdlc-triage-claude")].id,
                workflows[orgSlug("sdlc-bugfix-claude")].id,
                workflows[orgSlug("sdlc-feature-claude")].id
            ],
            organizationId: org.id,
            userId: systemUser.id,
            pricingModel: "FREE"
        });
        playbook = result.playbook;
        console.log("Created Claude SDLC Flywheel playbook:", playbook.id);
        console.log("Warnings:", result.warnings.length > 0 ? result.warnings : "none");
    } else {
        console.log("Claude SDLC Flywheel playbook exists:", playbook.id);
    }

    // 7. Update playbook metadata
    const CLAUDE_SDLC_TAGLINE =
        "Autonomous software development with Claude Code Agent SDK. From ticket to deploy with human-in-the-loop controls.";

    const CLAUDE_SDLC_LONG_DESCRIPTION = `## What's Inside

The SDLC Flywheel (Claude Code) gives your organization an end-to-end autonomous software development pipeline powered by the Claude Agent SDK. AI agents handle classification, planning, coding, and review — while humans maintain control at every critical decision point.

### Agents (Shared with Cursor Playbook)

- **SDLC Classifier** (GPT-4o) — Analyzes incoming tickets, classifies by type/priority/complexity, routes to the right workflow
- **SDLC Planner** (Claude Sonnet) — Analyzes codebases, generates development options, creates detailed implementation plans
- **SDLC Auditor** (Claude Sonnet) — Reviews plans and code for quality, completeness, gaps, and potential issues
- **SDLC Reviewer** (Claude Sonnet) — Reviews PRs, calculates trust scores (0-100), makes merge recommendations

### Workflows

- **SDLC Triage (Claude Code)** (entry point) — Classify → route to bugfix, feature, or generate KB article
- **SDLC Bugfix (Claude Code)** — Root cause analysis (Claude Code) → audit cycle → human approval → implement → PR → merge
- **SDLC Feature (Claude Code)** — Technical design (Claude Code) → human design review → phased plan (with audit) → implement → PR → merge

### Skills & Knowledge

- 5 reusable skills with attached tools and document templates
- 4 document templates (coding standards, architecture, testing, deployment) — customize with your own content
- All agents have memory enabled for cross-run learning

### Human-in-the-Loop Controls

Every critical step includes a revision cycle powered by the \`dowhile\` workflow primitive:
1. Agent generates work product
2. Auditor reviews for quality
3. Human approves, requests revision (with feedback), or rejects
4. If revised, the cycle repeats with the feedback incorporated

### Required Integrations

- **GitHub** — Repository access, issue creation, PR management
- **Claude Code** — Autonomous coding agent (Claude Agent SDK)

### After Installation

1. Replace document templates with your organization's standards
2. Configure \`RepositoryConfig\` for your repos
3. Set up \`PipelinePolicy\` with your Dark Factory thresholds
4. Connect GitHub and Claude Code in the integrations page
5. Dispatch your first ticket!`;

    await prisma.playbook.update({
        where: { id: playbook.id },
        data: {
            tagline: CLAUDE_SDLC_TAGLINE,
            longDescription: CLAUDE_SDLC_LONG_DESCRIPTION,
            requiredIntegrations: ["github", "claude-code"]
        }
    });
    console.log("Updated playbook metadata");

    // Inject setupConfig into the latest version manifest
    const latestVersion = await prisma.playbookVersion.findFirst({
        where: { playbookId: playbook.id },
        orderBy: { version: "desc" }
    });
    if (latestVersion) {
        const manifest = latestVersion.manifest as Record<string, unknown>;
        manifest.setupConfig = {
            headline: "Set up your Dark Software Factory (Claude Code)",
            description:
                "Connect your integrations, select a repository, and create a webhook to start autonomous development with Claude Code.",
            steps: [
                {
                    id: "select-repo",
                    type: "repo-select",
                    label: "Select Repository",
                    description: "Pick the GitHub repository where the SDLC pipeline will operate",
                    provider: "github"
                },
                {
                    id: "create-webhook",
                    type: "webhook-create",
                    label: "Create Webhook",
                    description:
                        "Auto-create a GitHub webhook so labeled issues trigger the pipeline",
                    provider: "github"
                }
            ]
        };
        await prisma.playbookVersion.update({
            where: { id: latestVersion.id },
            data: { manifest: manifest as any }
        });
        console.log("Injected setupConfig into manifest");
    }

    // 8. Publish
    if (playbook.status !== "PUBLISHED") {
        await prisma.playbook.update({
            where: { id: playbook.id },
            data: { status: "PUBLISHED" }
        });
        console.log("Published Claude SDLC Flywheel playbook");
    } else {
        console.log("Playbook already published");
    }

    console.log("\n✔ Claude Code SDLC Flywheel seed complete!");
    console.log("  Organization:", org.slug, "(", org.id, ")");
    console.log("  Workspace:", workspace.slug, "(", workspace.id, ")");
    console.log("  Workflows:", Object.keys(workflows).join(", "));
    console.log("  Network:", claudeNetwork.slug, "(", claudeNetwork.id, ")");
    console.log("  Playbook:", playbook.slug, "(", playbook.id, ")");
    console.log("\n  Shared agent updates:");
    console.log("    - Planner: generalized instructions");
    console.log('    - Auditor: blockedTools includes "claude-launch-agent"');
}

main().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
});
