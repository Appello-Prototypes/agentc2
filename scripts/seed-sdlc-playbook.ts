/**
 * Seed script for the SDLC Flywheel playbook.
 *
 * Creates within the AgentC2 org:
 * 1. SDLC Skills: code-analysis, implementation-planning, audit-review, ticket-triage, pr-review
 * 2. SDLC Documents: coding-standards, architecture-overview, testing-procedures, deployment-runbook
 * 3. SDLC Agents: sdlc-planner, sdlc-auditor, sdlc-classifier, sdlc-reviewer
 *    (each with tools, scorecards, test cases, guardrails, memory config)
 * 4. SDLC Workflows: sdlc-triage (entry), sdlc-bugfix, sdlc-feature
 *    (sdlc-standard created as DEPRECATED for migration)
 * 5. Packages everything into the "SDLC Flywheel" playbook
 * 6. Publishes the playbook
 *
 * Idempotent: safe to re-run.
 *
 * Usage: bun run scripts/seed-sdlc-playbook.ts
 */

import { prisma } from "../packages/database/src/index";
import { randomBytes } from "crypto";

const ORG_SLUG = "agentc2";
const orgSlug = (base: string) => `${base}-${ORG_SLUG}`;

/* ─── Instructions ─────────────────────────────────────────────────── */

const PLANNER_INSTRUCTIONS = `You are the SDLC Planner agent. You create detailed implementation plans from codebase analysis provided by Cursor Cloud Agent.

## Responsibilities
1. **Implementation Planning**: Create step-by-step implementation plans with file-level specificity from analysis output
2. **Phased Delivery**: Break complex work into deliverable phases with clear milestones
3. **Revision Handling**: When feedback is provided from auditors or human reviewers, revise your plan accordingly

## Output Standards
- Always provide structured, numbered plans
- Include file paths and estimated complexity for each step
- Flag risks, dependencies, and potential breaking changes
- Include effort estimates and risk levels
- Specify test coverage needed for each change

## Context
You receive codebase analysis from Cursor Cloud Agent (which has full repository access). Your job is to turn that analysis into a clear, actionable plan — not to re-analyze the codebase.`;

const AUDITOR_INSTRUCTIONS = `You are the SDLC Auditor agent. You review plans, analyses, and code changes for quality, completeness, and potential issues.

## Responsibilities
1. **Plan Audit**: Verify implementation plans are complete, correctly sequenced, and handle edge cases
2. **Analysis Audit**: Verify root cause analyses correctly identify the issue with specific code references
3. **Gap Detection**: Identify missing steps, untested scenarios, and potential regressions
4. **Quality Gate**: Serve as the quality checkpoint before human review

## Output Format
Always output structured JSON:
{
    "verdict": "PASS" | "NEEDS_REVISION" | "FAIL",
    "severity": "none" | "minor" | "major" | "critical",
    "issues": [
        { "severity": "critical|major|minor", "area": "...", "description": "...", "suggestedFix": "..." }
    ],
    "positives": ["What was done well"],
    "summary": "One-paragraph overall assessment",
    "checklist": {
        "requirementsAddressed": true | false,
        "edgeCasesConsidered": true | false,
        "errorHandlingPresent": true | false,
        "noBreakingChanges": true | false,
        "securityReviewed": true | false,
        "performanceAssessed": true | false,
        "testingCovered": true | false
    }
}

## Verdict Criteria
- **PASS**: All checklist items satisfied, no critical or major issues. Minor issues acceptable if noted.
- **NEEDS_REVISION**: Major issues found that need addressing, or critical checklist items not met. Provide specific fixes.
- **FAIL**: Fundamental design flaws, security vulnerabilities, or completely missing requirements. Requires restart.

## Rules
- Always populate the issues array, even on PASS (use minor observations)
- Always populate positives to acknowledge good work
- The summary must reference the verdict and key reasoning
- For NEEDS_REVISION, suggestedFix on each issue must be actionable and specific
- You receive all context through the prompt — audit what is presented, do not attempt to read external sources`;

const CLASSIFIER_INSTRUCTIONS = `You are the SDLC Classifier agent. You analyze incoming tickets to determine type, priority, complexity, and routing.

## Responsibilities
1. **Classification**: Categorize tickets as bug, feature, user_error, documentation, or infrastructure
2. **Priority Assessment**: Determine urgency based on impact, affected users, and business context
3. **Complexity Estimation**: Rate implementation complexity (trivial, low, medium, high, critical)
4. **Routing**: Recommend the appropriate SDLC workflow based on classification

## Output Format
Always output structured JSON:
{
    "classification": "bug" | "feature" | "user_error" | "documentation" | "infrastructure",
    "priority": "trivial" | "low" | "medium" | "high" | "critical",
    "complexity": "trivial" | "low" | "medium" | "high" | "critical",
    "affectedAreas": ["area1", "area2"],
    "suggestedRoute": "sdlc-bugfix" | "sdlc-feature" | "sdlc-triage",
    "rationale": "Explanation of classification decision"
}`;

const REVIEWER_INSTRUCTIONS = `You are the SDLC Reviewer agent. You review pull requests, calculate trust scores, and make merge recommendations.

## Responsibilities
1. **PR Review**: Examine code changes for quality, style, and correctness
2. **Trust Score**: Calculate a 0-100 trust score based on test coverage, code quality, review depth, and risk factors
3. **CI/CD Verification**: Check build status, test results, and deployment readiness
4. **Merge Recommendation**: Provide APPROVE, REQUEST_CHANGES, or BLOCK recommendation

## Trust Score Rubric
- **Test Coverage (0-25)**: Does the PR include appropriate tests?
- **Code Quality (0-25)**: Follows coding standards, clean patterns, no smells?
- **Review Depth (0-25)**: Has the PR been thoroughly reviewed with all concerns addressed?
- **Risk Assessment (0-25)**: What is the deployment risk level?

## Output Format
{
    "recommendation": "APPROVE" | "REQUEST_CHANGES" | "BLOCK",
    "trustScore": 0-100,
    "breakdown": { "testCoverage": 0-25, "codeQuality": 0-25, "reviewDepth": 0-25, "riskAssessment": 0-25 },
    "issues": [{ "severity": "critical|major|minor", "description": "..." }],
    "summary": "Overall assessment"
}

## Standing Rule
Never recommend merging to production without human approval. Always flag production merges as requiring human sign-off.`;

/* ─── Document Templates ───────────────────────────────────────────── */

const CODING_STANDARDS_TEMPLATE = `# Coding Standards

*Replace this template with your organization's coding standards.*

## General
- Use TypeScript strict mode
- Follow conventional commits for commit messages
- All PRs require at least one review

## Style
- 4-space indentation
- No semicolons (configured via Prettier)
- Double quotes for strings

## Testing
- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

## Security
- No secrets in code
- Parameterized database queries
- Input validation on all API endpoints`;

const ARCHITECTURE_TEMPLATE = `# Architecture Overview

*Replace this template with your project's architecture documentation.*

## System Architecture
Describe your system's high-level architecture here.

## Technology Stack
List your key technologies, frameworks, and tools.

## Key Patterns
Document the architectural patterns used in your codebase.

## Directory Structure
Describe your project's directory organization.

## Data Flow
Explain how data flows through your system.`;

const TESTING_TEMPLATE = `# Testing Procedures

*Replace this template with your organization's testing procedures.*

## Testing Strategy
- Unit tests: Jest / Vitest
- Integration tests: Supertest
- E2E tests: Playwright

## Coverage Requirements
- Minimum 80% line coverage for new code
- Critical paths require 95% coverage

## Test Naming Convention
\`describe("ComponentName", () => { it("should do X when Y", ...) })\`

## CI/CD Integration
- Tests run on every PR
- Coverage gates block merge if thresholds not met`;

const DEPLOYMENT_TEMPLATE = `# Deployment Runbook

*Replace this template with your organization's deployment procedures.*

## Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Code review approved
- [ ] Staging verification complete
- [ ] Database migrations tested

## Deployment Steps
1. Merge PR to main
2. CI/CD pipeline triggers automatically
3. Verify deployment in production
4. Monitor error rates for 30 minutes

## Rollback Procedure
1. Revert the merge commit
2. Push to main
3. Verify rollback in production`;

/* ─── Main ─────────────────────────────────────────────────────────── */

async function main() {
    console.log("Seeding SDLC Flywheel playbook...\n");

    // 1. Find or create AgentC2 org + workspace
    let org = await prisma.organization.findUnique({
        where: { slug: "agentc2" }
    });
    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: "AgentC2",
                slug: "agentc2",
                description: "AgentC2 Platform Organization",
                status: "active"
            }
        });
        console.log("Created AgentC2 org:", org.id);
    } else {
        console.log("AgentC2 org exists:", org.id);
    }

    let workspace = await prisma.workspace.findFirst({
        where: { organizationId: org.id, slug: orgSlug("platform") }
    });
    if (!workspace) {
        workspace = await prisma.workspace.create({
            data: {
                organizationId: org.id,
                name: "Platform",
                slug: orgSlug("platform"),
                environment: "production",
                isDefault: true
            }
        });
        console.log("Created Platform workspace:", workspace.id);
    } else {
        console.log("Platform workspace exists:", workspace.id);
    }

    let systemUser = await prisma.user.findFirst({
        where: { email: "system@agentc2.ai" }
    });
    if (!systemUser) {
        systemUser = await prisma.user.create({
            data: {
                name: "AgentC2 System",
                email: "system@agentc2.ai",
                emailVerified: true
            }
        });
        console.log("Created system user:", systemUser.id);
    } else {
        console.log("System user exists:", systemUser.id);
    }

    // ─── 2. Create Documents ────────────────────────────────────────

    const docDefs = [
        {
            slug: "sdlc-coding-standards",
            name: "Coding Standards",
            description: "Template for organization coding standards. Replace with your own.",
            content: CODING_STANDARDS_TEMPLATE,
            category: "sdlc",
            tags: ["sdlc", "standards", "template"]
        },
        {
            slug: "sdlc-architecture-overview",
            name: "Architecture Overview",
            description: "Template for project architecture documentation. Replace with your own.",
            content: ARCHITECTURE_TEMPLATE,
            category: "sdlc",
            tags: ["sdlc", "architecture", "template"]
        },
        {
            slug: "sdlc-testing-procedures",
            name: "Testing Procedures",
            description: "Template for testing procedures. Replace with your own.",
            content: TESTING_TEMPLATE,
            category: "sdlc",
            tags: ["sdlc", "testing", "template"]
        },
        {
            slug: "sdlc-deployment-runbook",
            name: "Deployment Runbook",
            description: "Template for deployment procedures. Replace with your own.",
            content: DEPLOYMENT_TEMPLATE,
            category: "sdlc",
            tags: ["sdlc", "deployment", "template"]
        }
    ];

    const documents: Record<string, { id: string; slug: string }> = {};
    for (const doc of docDefs) {
        let existing = await prisma.document.findFirst({
            where: { slug: doc.slug, organizationId: org.id }
        });
        if (!existing) {
            existing = await prisma.document.create({
                data: {
                    ...doc,
                    contentType: "markdown",
                    workspaceId: workspace.id,
                    organizationId: org.id
                }
            });
            console.log("Created document:", existing.slug);
        } else {
            console.log("Document exists:", existing.slug);
        }
        documents[doc.slug] = { id: existing.id, slug: existing.slug };
    }

    // ─── 3. Create Skills ───────────────────────────────────────────

    const skillDefs = [
        {
            slug: orgSlug("code-analysis"),
            name: "Code Analysis",
            description:
                "Instructions and tools for analyzing codebases, understanding architecture, and identifying relevant files.",
            instructions:
                "Analyze the target codebase thoroughly. Identify the architecture, key patterns, file organization, and relevant sections for the change being discussed. Use GitHub MCP tools to read files and search code. Cross-reference with the architecture overview document.",
            category: "sdlc",
            tags: ["sdlc", "analysis", "code"],
            tools: ["github_search_code", "github_get_file_contents", "github_list_commits"],
            documents: ["sdlc-coding-standards", "sdlc-architecture-overview"]
        },
        {
            slug: orgSlug("implementation-planning"),
            name: "Implementation Planning",
            description:
                "Planning methodology for generating development options and detailed implementation plans.",
            instructions:
                "Generate implementation plans that are structured, specific, and actionable. Always present multiple options when asked. Include file paths, estimated complexity, risk assessment, and dependencies. Reference the architecture overview for consistency.",
            category: "sdlc",
            tags: ["sdlc", "planning", "implementation"],
            tools: ["github_search_code", "github_get_file_contents"],
            documents: ["sdlc-architecture-overview"]
        },
        {
            slug: orgSlug("audit-review"),
            name: "Audit & Review",
            description:
                "Review checklists, quality criteria, and patterns for auditing plans and code changes.",
            instructions:
                "Audit all work products against the coding standards and testing procedures. Check for completeness, correctness, security implications, and edge cases. Provide structured verdict with specific issues and suggested fixes.",
            category: "sdlc",
            tags: ["sdlc", "audit", "review", "quality"],
            tools: ["github_get_file_contents"],
            documents: ["sdlc-coding-standards", "sdlc-testing-procedures"]
        },
        {
            slug: orgSlug("ticket-triage"),
            name: "Ticket Triage",
            description:
                "Classification criteria and cross-system query patterns for ticket analysis.",
            instructions:
                "Classify incoming tickets by analyzing the description, querying related systems for context, and applying the classification criteria. Consider affected areas, user impact, and historical patterns from memory.",
            category: "sdlc",
            tags: ["sdlc", "triage", "classification"],
            tools: ["memory-recall"],
            documents: []
        },
        {
            slug: orgSlug("pr-review"),
            name: "PR Review",
            description:
                "Review standards, trust scoring rubric, and CI/CD verification procedures.",
            instructions:
                "Review pull requests thoroughly. Calculate trust scores based on the rubric. Verify CI/CD status. Never recommend production merges without human sign-off. Reference coding standards and testing procedures.",
            category: "sdlc",
            tags: ["sdlc", "pr", "review", "trust-score"],
            tools: ["github_get_file_contents", "github_list_commits"],
            documents: [
                "sdlc-coding-standards",
                "sdlc-testing-procedures",
                "sdlc-deployment-runbook"
            ]
        }
    ];

    const skills: Record<string, { id: string; slug: string }> = {};
    for (const skill of skillDefs) {
        let existing = await prisma.skill.findFirst({
            where: { slug: skill.slug }
        });
        if (!existing) {
            existing = await prisma.skill.create({
                data: {
                    slug: skill.slug,
                    name: skill.name,
                    description: skill.description,
                    instructions: skill.instructions,
                    category: skill.category,
                    tags: skill.tags,
                    workspaceId: workspace.id
                }
            });
            console.log("Created skill:", existing.slug);

            // Attach tools
            for (const toolId of skill.tools) {
                await prisma.skillTool.create({
                    data: { skillId: existing.id, toolId }
                });
            }

            // Attach documents
            for (const docSlug of skill.documents) {
                const doc = documents[docSlug];
                if (doc) {
                    await prisma.skillDocument.create({
                        data: { skillId: existing.id, documentId: doc.id }
                    });
                }
            }
        } else {
            console.log("Skill exists:", existing.slug);
        }
        skills[skill.slug] = { id: existing.id, slug: existing.slug };
    }

    // ─── 4. Create Agents ───────────────────────────────────────────

    const agentDefs = [
        {
            slug: orgSlug("sdlc-classifier"),
            name: "SDLC Classifier",
            description: "Classifies incoming tickets by type, priority, and complexity.",
            instructions: CLASSIFIER_INSTRUCTIONS,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            maxSteps: 3,
            skills: [orgSlug("ticket-triage")],
            tools: ["memory-recall"],
            scorecard: {
                criteria: [
                    {
                        name: "Classification Accuracy",
                        weight: 30,
                        description: "Correctly identifies ticket type"
                    },
                    {
                        name: "Context Usage",
                        weight: 25,
                        description: "Uses cross-system context effectively"
                    },
                    {
                        name: "Rationale Clarity",
                        weight: 25,
                        description: "Provides clear classification reasoning"
                    },
                    {
                        name: "Priority Calibration",
                        weight: 20,
                        description: "Accurate priority assessment"
                    }
                ]
            },
            testCases: [
                {
                    name: "Bug classification",
                    inputText:
                        "The login button does not respond when clicked on mobile Safari. Users are unable to sign in.",
                    expectedOutput: 'classification: "bug", priority: "high"'
                },
                {
                    name: "Feature classification",
                    inputText: "We need to add dark mode support to the settings page.",
                    expectedOutput: 'classification: "feature", priority: "medium"'
                }
            ],
            guardrail: {
                maxTokensPerRun: 10000,
                blockedTools: [],
                requireHumanApproval: false
            }
        },
        {
            slug: orgSlug("sdlc-planner"),
            name: "SDLC Planner",
            description: "Analyzes codebases and creates detailed implementation plans.",
            instructions: PLANNER_INSTRUCTIONS,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-6",
            temperature: 0.5,
            maxSteps: 5,
            skills: [orgSlug("code-analysis"), orgSlug("implementation-planning")],
            tools: [],
            scorecard: {
                criteria: [
                    {
                        name: "Plan Quality",
                        weight: 30,
                        description: "Structured, actionable, file-level specificity"
                    },
                    {
                        name: "Completeness",
                        weight: 25,
                        description: "All requirements addressed, edge cases considered"
                    },
                    {
                        name: "Feasibility",
                        weight: 25,
                        description: "Plans are technically sound and implementable"
                    },
                    {
                        name: "Risk Identification",
                        weight: 20,
                        description: "Risks and dependencies correctly identified"
                    }
                ]
            },
            testCases: [
                {
                    name: "Simple plan generation",
                    inputText: "Create a plan to add a loading spinner to the dashboard page.",
                    expectedOutput:
                        "A numbered plan with file paths, component identification, and testing steps"
                }
            ],
            guardrail: {
                maxTokensPerRun: 50000,
                blockedTools: ["merge-pull-request"],
                requireHumanApproval: false
            }
        },
        {
            slug: orgSlug("sdlc-auditor"),
            name: "SDLC Auditor",
            description: "Reviews plans and code for quality, completeness, and potential issues.",
            instructions: AUDITOR_INSTRUCTIONS,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-6",
            temperature: 0.3,
            maxSteps: 3,
            skills: [orgSlug("audit-review"), orgSlug("code-analysis")],
            tools: ["memory-recall"],
            scorecard: {
                criteria: [
                    {
                        name: "Gap Detection Accuracy",
                        weight: 30,
                        description: "Identifies real issues without false positives"
                    },
                    {
                        name: "False Positive Rate",
                        weight: 20,
                        description: "Does not flag non-issues"
                    },
                    {
                        name: "Thoroughness",
                        weight: 30,
                        description: "Checks all aspects of the audit checklist"
                    },
                    {
                        name: "Actionability",
                        weight: 20,
                        description: "Suggestions are specific and implementable"
                    }
                ]
            },
            testCases: [
                {
                    name: "Plan audit with missing tests",
                    inputText:
                        "Review this plan: 1. Add button component 2. Wire click handler 3. Deploy to production",
                    expectedOutput: "Should flag missing test step and missing staging verification"
                }
            ],
            guardrail: {
                maxTokensPerRun: 30000,
                blockedTools: ["merge-pull-request", "cursor-launch-agent"],
                requireHumanApproval: false
            }
        },
        {
            slug: orgSlug("sdlc-reviewer"),
            name: "SDLC Reviewer",
            description: "Reviews PRs, calculates trust scores, and makes merge recommendations.",
            instructions: REVIEWER_INSTRUCTIONS,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-6",
            temperature: 0.3,
            maxSteps: 3,
            skills: [orgSlug("pr-review"), orgSlug("audit-review")],
            tools: ["memory-recall", "calculate-trust-score"],
            scorecard: {
                criteria: [
                    {
                        name: "Review Quality",
                        weight: 30,
                        description: "Thorough, accurate code review"
                    },
                    {
                        name: "Trust Score Calibration",
                        weight: 25,
                        description: "Accurate trust score calculation"
                    },
                    {
                        name: "Security Awareness",
                        weight: 25,
                        description: "Identifies security concerns"
                    },
                    {
                        name: "Recommendation Accuracy",
                        weight: 20,
                        description: "Correct APPROVE/BLOCK decision"
                    }
                ]
            },
            testCases: [
                {
                    name: "PR with security issue",
                    inputText:
                        "Review this PR that adds user input directly to a SQL query without parameterization.",
                    expectedOutput: "Should BLOCK and flag SQL injection vulnerability as critical"
                }
            ],
            guardrail: {
                maxTokensPerRun: 30000,
                blockedTools: [],
                requireHumanApproval: true
            }
        }
    ];

    const memoryConfigs: Record<string, object> = {
        classifier: {
            lastMessages: 3,
            semanticRecall: { topK: 2, messageRange: 1 },
            workingMemory: { enabled: true }
        },
        planner: {
            lastMessages: 5,
            semanticRecall: { topK: 3, messageRange: 1 },
            workingMemory: { enabled: true }
        },
        auditor: {
            lastMessages: 3,
            semanticRecall: false,
            workingMemory: { enabled: true }
        },
        reviewer: {
            lastMessages: 3,
            semanticRecall: { topK: 2, messageRange: 1 },
            workingMemory: { enabled: true }
        }
    };

    const contextConfigs: Record<string, object> = {
        classifier: { maxContextTokens: 8000, windowSize: 3 },
        planner: { maxContextTokens: 30000, windowSize: 5 },
        auditor: { maxContextTokens: 20000, windowSize: 3 },
        reviewer: { maxContextTokens: 25000, windowSize: 3 }
    };

    const agents: Record<string, { id: string; slug: string }> = {};
    for (const agentDef of agentDefs) {
        let existing = await prisma.agent.findFirst({
            where: { slug: agentDef.slug }
        });
        if (!existing) {
            const agentRole = agentDef.slug.includes("classifier")
                ? "classifier"
                : agentDef.slug.includes("planner")
                  ? "planner"
                  : agentDef.slug.includes("auditor")
                    ? "auditor"
                    : "reviewer";
            existing = await prisma.agent.create({
                data: {
                    slug: agentDef.slug,
                    name: agentDef.name,
                    description: agentDef.description,
                    instructions: agentDef.instructions,
                    modelProvider: agentDef.modelProvider,
                    modelName: agentDef.modelName,
                    temperature: agentDef.temperature,
                    maxSteps: agentDef.maxSteps,
                    memoryEnabled: true,
                    memoryConfig: memoryConfigs[agentRole],
                    contextConfig: contextConfigs[agentRole],
                    visibility: "ORGANIZATION",
                    workspaceId: workspace.id
                }
            });
            console.log("Created agent:", existing.slug);

            // Attach tools
            for (const toolId of agentDef.tools) {
                await prisma.agentTool.create({
                    data: { agentId: existing.id, toolId }
                });
            }

            // Attach skills
            for (const skillSlug of agentDef.skills) {
                const skill = skills[skillSlug];
                if (skill) {
                    await prisma.agentSkill.create({
                        data: {
                            agentId: existing.id,
                            skillId: skill.id,
                            pinned: true
                        }
                    });
                }
            }

            // Create scorecard
            if (agentDef.scorecard) {
                await prisma.agentScorecard.create({
                    data: {
                        agentId: existing.id,
                        criteria: agentDef.scorecard.criteria
                    }
                });
            }

            // Create test cases
            for (const tc of agentDef.testCases) {
                await prisma.agentTestCase.create({
                    data: {
                        agentId: existing.id,
                        name: tc.name,
                        inputText: tc.inputText,
                        expectedOutput: tc.expectedOutput,
                        tags: ["sdlc"]
                    }
                });
            }

            // Create guardrail
            if (agentDef.guardrail) {
                await prisma.guardrailPolicy.create({
                    data: {
                        agentId: existing.id,
                        configJson: agentDef.guardrail
                    }
                });
            }
        } else {
            console.log("Agent exists:", existing.slug);
        }
        agents[agentDef.slug] = { id: existing.id, slug: existing.slug };
    }

    // ─── 5. Create Workflows ────────────────────────────────────────

    const standardWorkflowDef = {
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
                        pipelineRunId: "{{input.pipelineRunId}}",
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
                    promptTemplate:
                        "Classify this ticket:\n\nTitle: {{input.title}}\nDescription: {{input.description}}\n\nGitHub Issue: {{steps.intake.issueUrl}}\n\nProvide classification, priority, complexity, and suggested route.",
                    outputFormat: "json"
                }
            },
            {
                id: "route",
                type: "branch",
                name: "Route by Classification",
                config: {
                    branches: [
                        {
                            id: "user-error",
                            condition: "steps.classify?.classification === 'user_error'",
                            steps: [
                                {
                                    id: "kb-article",
                                    type: "agent",
                                    name: "Create KB Article",
                                    config: {
                                        agentSlug: orgSlug("sdlc-planner"),
                                        promptTemplate:
                                            "The ticket '{{input.title}}' was classified as a user error. Create a knowledge base article explaining the correct usage and common mistakes.\n\nDescription: {{input.description}}"
                                    }
                                }
                            ]
                        }
                    ],
                    defaultBranch: [
                        {
                            id: "analyze-launch",
                            type: "tool",
                            name: "Launch Code Analysis",
                            config: {
                                toolId: "cursor-launch-agent",
                                parameters: {
                                    prompt: "You are performing a codebase analysis for a development ticket. Do NOT implement any changes — analysis only.\n\n## Ticket\n\nTitle: {{input.title}}\n\n{{input.description}}\n\nClassification: {{steps.classify.classification}} | Priority: {{steps.classify.priority}} | Complexity: {{steps.classify.complexity}}\nGitHub Issue: {{steps.intake.issueUrl}}\nRepository: {{input.repository}}\n\n## Your Task\n\n1. **Search the codebase** to find all code related to this ticket.\n2. **Architecture Analysis**: Identify the relevant architecture patterns, key files, and areas that need changes.\n3. **Impact Assessment**: What other parts of the system are affected?\n4. **Development Options**: Suggest 2-3 approaches with pros/cons and risk levels.\n\nOutput your complete analysis as a structured markdown document.",
                                    repository: "https://github.com/{{input.repository}}",
                                    model: "claude-4.6-opus-high-thinking"
                                }
                            }
                        },
                        {
                            id: "analyze-wait",
                            type: "tool",
                            name: "Wait for Analysis",
                            config: {
                                toolId: "cursor-poll-until-done",
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
                                toolId: "cursor-get-conversation",
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
                                    body: "## Codebase Analysis\n\n_Performed by Cursor Cloud Agent with full codebase access._\n\n{{steps['analyze-wait'].summary}}\n\n---\n_Analysis completed in {{steps['analyze-wait'].durationMs}}ms | Agent: {{steps['analyze-launch'].agentId}}_",
                                    repository: "{{input.repository}}",
                                    issueNumber: "{{steps.intake.issueNumber}}"
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
                                    "steps['plan-review']?.approved !== true && steps['plan-review']?.rejected !== true",
                                steps: [
                                    {
                                        id: "plan",
                                        type: "agent",
                                        name: "Create Plan",
                                        config: {
                                            agentSlug: orgSlug("sdlc-planner"),
                                            promptTemplate:
                                                "Create a detailed implementation plan based on the codebase analysis.\n\nCodebase analysis (from Cursor Cloud Agent with full codebase access):\n{{steps['analyze-wait'].summary}}\n\nTicket: {{input.title}}\nClassification: {{steps.classify.classification}}\n\n{{#if steps['plan-audit']}}Previous audit feedback: {{steps['plan-audit'].summary}}\nIssues to address: {{helpers.json(steps['plan-audit'].issues)}}{{/if}}\n\n{{#if steps['plan-review']}}Human feedback: {{steps['plan-review'].feedback}}{{/if}}\n\nProvide a structured, numbered plan with file paths, estimated complexity, and risk assessment for each step."
                                        }
                                    },
                                    {
                                        id: "plan-audit",
                                        type: "agent",
                                        name: "Audit Plan",
                                        config: {
                                            agentSlug: orgSlug("sdlc-auditor"),
                                            promptTemplate:
                                                "Audit this implementation plan:\n\n{{steps.plan.text}}\n\nOriginal analysis:\n{{steps['analyze-wait'].summary}}\n\nVerify: completeness, correct sequencing, edge case handling, testing coverage.",
                                            outputFormat: "json"
                                        }
                                    },
                                    {
                                        id: "plan-verdict-route",
                                        type: "branch",
                                        name: "Route by Audit Verdict",
                                        config: {
                                            branches: [
                                                {
                                                    id: "passed",
                                                    condition:
                                                        "steps['plan-audit']?.verdict === 'PASS'",
                                                    steps: [
                                                        {
                                                            id: "plan-review",
                                                            type: "human",
                                                            name: "Review Plan",
                                                            config: {
                                                                prompt: "The auditor has APPROVED the implementation plan. Review and approve to proceed to coding, provide feedback for changes, or reject."
                                                            }
                                                        }
                                                    ]
                                                }
                                            ],
                                            defaultBranch: [
                                                {
                                                    id: "plan-audit-notes",
                                                    type: "tool",
                                                    name: "Post Audit Feedback",
                                                    config: {
                                                        toolId: "github-add-issue-comment",
                                                        parameters: {
                                                            body: "## SDLC Audit: Plan Revision Required\n\n**Verdict:** {{steps['plan-audit'].verdict}}\n**Severity:** {{steps['plan-audit'].severity}}\n\n**Summary:** {{steps['plan-audit'].summary}}\n\n**Issues:**\n{{helpers.json(steps['plan-audit'].issues)}}\n\nA revised plan will be generated automatically.",
                                                            repository: "{{input.repository}}",
                                                            issueNumber:
                                                                "{{steps.intake.issueNumber}}"
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
                            name: "Launch Coding Agent",
                            config: {
                                toolId: "cursor-launch-agent",
                                parameters: {
                                    prompt: "Implement the following approved plan. Create a branch, make the changes, and push.\n\n## Ticket\nTitle: {{input.title}}\nGitHub Issue: {{steps.intake.issueUrl}}\n\n## Approved Implementation Plan\n{{steps.plan.text}}\n\n## Instructions\n1. Create a feature branch from main\n2. Implement the changes according to the approved plan\n3. Add or update tests as needed\n4. Run linting and type-checking to verify\n5. Commit with a conventional commit message\n6. Push the branch — do NOT create a PR or merge",
                                    repository: "https://github.com/{{input.repository}}",
                                    model: "claude-4.6-opus-high-thinking"
                                }
                            }
                        },
                        {
                            id: "implement-wait",
                            type: "tool",
                            name: "Wait for Implementation",
                            config: {
                                toolId: "cursor-poll-until-done",
                                parameters: {
                                    agentId: "{{steps['implement-launch'].agentId}}",
                                    maxWaitMinutes: 30
                                }
                            }
                        },
                        {
                            id: "create-pr",
                            type: "tool",
                            name: "Create Pull Request",
                            config: {
                                toolId: "github-create-pull-request",
                                parameters: {
                                    base: "main",
                                    head: "{{steps['implement-wait'].branchName}}",
                                    title: "{{input.title}}",
                                    body: "## Summary\n\nResolves #{{steps.intake.issueNumber}}\n\nClassification: {{steps.classify.classification}} | Priority: {{steps.classify.priority}}\n\n## Analysis\n\n{{steps['analyze-wait'].summary}}\n\n## Implementation Plan\n\n{{steps.plan.text}}\n\n## Implementation\n\n{{steps['implement-wait'].summary}}\n\n---\n_Automated via AgentC2 SDLC Standard Pipeline_",
                                    repository: "{{input.repository}}"
                                }
                            }
                        },
                        {
                            id: "merge-review",
                            type: "human",
                            name: "Review PR on GitHub",
                            config: {
                                prompt: "A pull request has been created:\n\n{{steps['create-pr'].htmlUrl}}\n\nReview the code changes on GitHub. Approve to merge, or reject."
                            }
                        },
                        {
                            id: "merge",
                            type: "tool",
                            name: "Merge PR",
                            config: {
                                toolId: "merge-pull-request",
                                parameters: {
                                    prNumber: "{{steps['create-pr'].prNumber}}",
                                    repository: "{{input.repository}}",
                                    mergeMethod: "squash"
                                }
                            }
                        }
                    ]
                }
            }
        ]
    };

    const bugfixWorkflowDef = {
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
                    toolId: "cursor-launch-agent",
                    parameters: {
                        prompt: "You are performing a root cause analysis for a bug report. Do NOT implement any fix — analysis and planning only.\n\n## Bug Report\n\nTitle: {{input.title}}\n\n{{input.description}}\n\nGitHub Issue: {{steps.intake.issueUrl}}\nRepository: {{input.repository}}\n\n## Your Task\n\n1. **Search the codebase** to find all code related to this bug. Use grep, semantic search, and file reading to thoroughly understand the relevant code.\n\n2. **Root Cause Analysis**: Identify the exact root cause with specific file paths, function names, and line numbers.\n\n3. **Impact Assessment**: What other parts of the system are affected?\n\n4. **Fix Plan**: Create a detailed, step-by-step fix plan:\n   - Specific files to modify and what changes to make\n   - Any new files or tests needed\n   - Risk assessment (low/medium/high)\n   - Estimated complexity\n\nOutput your complete analysis as a structured markdown document. Be thorough — your analysis will be reviewed by an auditor and a human before any code is written.",
                        repository: "https://github.com/{{input.repository}}",
                        model: "claude-4.6-opus-high-thinking"
                    }
                }
            },
            {
                id: "analyze-wait",
                type: "tool",
                name: "Wait for Analysis",
                config: {
                    toolId: "cursor-poll-until-done",
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
                    toolId: "cursor-get-conversation",
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
                        body: "## Root Cause Analysis\n\n_Performed by Cursor Cloud Agent with full codebase access._\n\n{{steps['analyze-wait'].summary}}\n\n---\n_Analysis completed in {{steps['analyze-wait'].durationMs}}ms | Agent: {{steps['analyze-launch'].agentId}}_",
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
                                    "Audit this bugfix analysis and plan. It was produced by a Cursor Cloud Agent with full codebase access.\n\n## Analysis Summary\n{{steps['analyze-wait'].summary}}\n\n## Full Conversation\n{{json(steps['analyze-result'].messages)}}\n\n{{#if steps['fix-audit']}}## Previous Audit Issues\nYour previous audit found these issues: {{helpers.json(steps['fix-audit'].issues)}}\nVerify whether they have been addressed in the revised analysis.{{/if}}\n\n{{#if steps['fix-review']}}## Human Feedback\n{{steps['fix-review'].feedback}}{{/if}}\n\nEvaluate:\n- Is the root cause correctly identified with specific file paths and code references?\n- Is the fix plan complete and correctly sequenced?\n- Are edge cases and risks addressed?\n- Is test coverage planned?"
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
                    toolId: "cursor-launch-agent",
                    parameters: {
                        prompt: "Implement the following approved bugfix.\n\n## Bug\nTitle: {{input.title}}\nGitHub Issue: {{steps.intake.issueUrl}}\n\n## Approved Fix Plan\n{{steps['analyze-wait'].summary}}\n\n## Instructions\n1. Implement the fix according to the approved plan on the current branch (do NOT create a new branch)\n2. Add or update tests as needed\n3. Run linting and type-checking to verify\n4. Commit with a conventional commit message: fix: <description>\n5. Push the branch. Do NOT merge or create a PR — the system handles PR creation automatically.",
                        repository: "https://github.com/{{input.repository}}",
                        autoCreatePr: true,
                        model: "claude-4.6-opus-high-thinking"
                    }
                }
            },
            {
                id: "implement-wait",
                type: "tool",
                name: "Wait for Implementation",
                config: {
                    toolId: "cursor-poll-until-done",
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

    const featureWorkflowDef = {
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
                    toolId: "cursor-launch-agent",
                    parameters: {
                        prompt: "You are creating a technical design for a feature request. Do NOT implement anything — design and analysis only.\n\n## Feature Request\n\nTitle: {{input.title}}\n\n{{input.description}}\n\nScope: {{steps.classify.complexity}} | Priority: {{steps.classify.priority}}\nGitHub Issue: {{steps.intake.issueUrl}}\nRepository: {{input.repository}}\n\n## Your Task\n\n1. **Search the codebase** to understand the relevant architecture, patterns, and existing implementations.\n2. **Technical Design**: Create a comprehensive design document including architecture changes, new components, data model changes, API changes, and integration points.\n3. **Impact Assessment**: What existing functionality is affected? What are the risks?\n4. **Phased Approach**: Break the feature into deliverable phases with clear milestones.\n\nOutput your complete design as a structured markdown document.",
                        repository: "https://github.com/{{input.repository}}",
                        model: "claude-4.6-opus-high-thinking"
                    }
                }
            },
            {
                id: "design-wait",
                type: "tool",
                name: "Wait for Design",
                config: {
                    toolId: "cursor-poll-until-done",
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
                    toolId: "cursor-get-conversation",
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
                        body: "## Technical Design\n\n_Performed by Cursor Cloud Agent with full codebase access._\n\n{{steps['design-wait'].summary}}\n\n---\n_Design completed in {{steps['design-wait'].durationMs}}ms | Agent: {{steps['design-launch'].agentId}}_",
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
                                    "Create a phased implementation plan for this feature.\n\nTechnical design (from Cursor Cloud Agent with full codebase access):\n{{steps['design-wait'].summary}}\n\nFeature: {{input.title}}\nScope: {{steps.classify.complexity}}\n\nBreak into deliverable phases with clear milestones, file paths, and estimated complexity.\n\n{{#if steps['feature-plan-audit']}}Previous audit feedback: {{steps['feature-plan-audit'].summary}}\nIssues to address: {{helpers.json(steps['feature-plan-audit'].issues)}}{{/if}}\n\n{{#if steps['feature-plan-review']}}Human feedback: {{steps['feature-plan-review'].feedback}}{{/if}}"
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
                    toolId: "cursor-launch-agent",
                    parameters: {
                        prompt: "Implement the following approved feature plan.\n\n## Feature\nTitle: {{input.title}}\nGitHub Issue: {{steps.intake.issueUrl}}\n\n## Approved Implementation Plan\n{{steps['feature-plan'].text}}\n\n## Instructions\n1. Implement the feature according to the approved phased plan on the current branch (do NOT create a new branch)\n2. Add comprehensive tests\n3. Run linting and type-checking to verify\n4. Commit with conventional commit messages: feat: <description>\n5. Push the branch. Do NOT merge or create a PR — the system handles PR creation automatically.",
                        repository: "https://github.com/{{input.repository}}",
                        autoCreatePr: true,
                        model: "claude-4.6-opus-high-thinking"
                    }
                }
            },
            {
                id: "implement-wait",
                type: "tool",
                name: "Wait for Implementation",
                config: {
                    toolId: "cursor-poll-until-done",
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

    const triageWorkflowDef = {
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
                        body: "## SDLC Triage\n\n**Classification:** {{steps.classify.classification}}\n**Priority:** {{steps.classify.priority}}\n**Complexity:** {{steps.classify.complexity}}\n**Route:** {{steps.classify.suggestedRoute}}\n\n**Rationale:** {{steps.classify.rationale}}\n\n**Affected Areas:** {{helpers.json(steps.classify.affectedAreas)}}\n\n---\n_Classified by sdlc-classifier-agentc2_",
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
                                        workflowId: orgSlug("sdlc-bugfix"),
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
                                        workflowId: orgSlug("sdlc-feature"),
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
                                    body: "## Knowledge Base Response\n\n{{steps['kb-generate'].text}}\n\n---\n_Generated by sdlc-planner-agentc2 | Classification: {{steps.classify.classification}}_",
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

    const workflowDefs = [
        {
            slug: orgSlug("sdlc-triage"),
            name: "SDLC Triage",
            description:
                "Single entry point for all SDLC tickets. Classifies incoming tickets and routes to the correct sub-workflow: bugfix (bugs), feature (features), or inline KB article (user/training issues).",
            definitionJson: triageWorkflowDef,
            isActive: true,
            isPublished: true
        },
        {
            slug: orgSlug("sdlc-bugfix"),
            name: "SDLC Bugfix",
            description:
                "GitHub-centric SDLC bugfix workflow. AgentC2 orchestrates root cause analysis, audit cycles, implementation, PR creation, review, and merge.",
            definitionJson: bugfixWorkflowDef,
            isActive: true,
            isPublished: true
        },
        {
            slug: orgSlug("sdlc-feature"),
            name: "SDLC Feature",
            description:
                "GitHub-centric SDLC feature workflow. AgentC2 orchestrates design, phased planning (with audit revision cycles), implementation, PR review, and merge.",
            definitionJson: featureWorkflowDef,
            isActive: true,
            isPublished: true
        },
        {
            slug: orgSlug("sdlc-standard"),
            name: "SDLC Standard [DEPRECATED]",
            description:
                "[DEPRECATED] Replaced by sdlc-triage which routes to sdlc-bugfix or sdlc-feature. Previously: GitHub-centric full SDLC workflow.",
            definitionJson: standardWorkflowDef,
            isActive: false,
            isPublished: false
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

    // ─── 5b. Create Default Webhook Trigger for SDLC Workflows ────

    const sdlcTriggerName = "SDLC GitHub Webhook";
    const existingTrigger = await prisma.agentTrigger.findFirst({
        where: {
            entityType: "workflow",
            name: sdlcTriggerName
        }
    });

    if (!existingTrigger) {
        const { encryptString } = await import("../apps/agent/src/lib/credential-crypto");
        const webhookPath = `trigger_${randomBytes(16).toString("hex")}`;
        const webhookSecretPlain = randomBytes(32).toString("hex");
        const webhookSecret = encryptString(webhookSecretPlain);

        await prisma.agentTrigger.create({
            data: {
                entityType: "workflow",
                workflowId: workflows[orgSlug("sdlc-triage")]!.id,
                workspaceId: workspace.id,
                name: sdlcTriggerName,
                description:
                    "Triggers SDLC triage workflow when a GitHub Issue is labeled. " +
                    "Triage classifies and routes to sdlc-bugfix, sdlc-feature, or handles inline.",
                triggerType: "webhook",
                webhookPath,
                webhookSecret,
                filterJson: {
                    triggerLabel: "agentc2-sdlc",
                    githubEvents: ["issues"],
                    githubActions: ["labeled"]
                },
                inputMapping: {
                    config: {
                        fieldMapping: {
                            title: "issue.title",
                            description: "issue.body",
                            repository: "repository.full_name"
                        }
                    }
                },
                isActive: true
            }
        });
        console.log("Created SDLC webhook trigger:", webhookPath);
        console.log("  Webhook URL: /api/webhooks/" + webhookPath);
        console.log("  Webhook secret:", webhookSecretPlain);
        console.log("  ⚠️  Save this secret - it won't be shown again!");
    } else {
        console.log("SDLC webhook trigger already exists:", existingTrigger.webhookPath);
    }

    // ─── 6. Package as Playbook ─────────────────────────────────────

    console.log("\nPackaging SDLC Flywheel playbook...");

    let playbook = await prisma.playbook.findUnique({
        where: { slug: "sdlc-flywheel" }
    });

    const { packagePlaybook } = await import("../packages/agentc2/src/playbooks/packager");

    if (!playbook) {
        const result = await packagePlaybook({
            name: "SDLC Flywheel",
            slug: "sdlc-flywheel",
            description:
                "Autonomous software development lifecycle powered by AI agents. " +
                "Includes ticket classification, code analysis, implementation planning " +
                "with revision cycles, automated coding, PR review with trust scores, " +
                "and deployment — all with human-in-the-loop controls.",
            category: "development",
            tags: ["sdlc", "development", "coding-pipeline", "autonomous", "flywheel"],
            entryWorkflowId: workflows[orgSlug("sdlc-triage")].id,
            includeWorkflows: [
                workflows[orgSlug("sdlc-bugfix")].id,
                workflows[orgSlug("sdlc-feature")].id
            ],
            organizationId: org.id,
            userId: systemUser.id,
            pricingModel: "FREE"
        });
        playbook = result.playbook;
        console.log("Created SDLC Flywheel playbook:", playbook.id);
        console.log("Warnings:", result.warnings.length > 0 ? result.warnings : "none");
    } else {
        console.log("SDLC Flywheel playbook exists:", playbook.id);
    }

    // 7. Update playbook metadata
    const SDLC_TAGLINE =
        "Autonomous software development with AI agents. From ticket to deploy with human-in-the-loop controls.";

    const SDLC_LONG_DESCRIPTION = `## What's Inside

The SDLC Flywheel gives your organization an end-to-end autonomous software development pipeline. AI agents handle classification, planning, coding, and review — while humans maintain control at every critical decision point.

### Agents

- **SDLC Classifier** (GPT-4o) — Analyzes incoming tickets, classifies by type/priority/complexity, routes to the right workflow
- **SDLC Planner** (Claude Sonnet) — Analyzes codebases, generates development options, creates detailed implementation plans
- **SDLC Auditor** (Claude Sonnet) — Reviews plans and code for quality, completeness, gaps, and potential issues
- **SDLC Reviewer** (Claude Sonnet) — Reviews PRs, calculates trust scores (0-100), makes merge recommendations

### Workflows

- **SDLC Triage** (entry point) — Classify → route to bugfix, feature, or generate KB article for user/training issues
- **SDLC Bugfix** — Root cause analysis (Cursor Cloud) → audit cycle → human approval → implement → PR → merge
- **SDLC Feature** — Technical design (Cursor Cloud) → human design review → phased plan (with audit) → implement → PR → merge

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
- **Cursor Cloud** — Automated coding agent

### After Installation

1. Replace document templates with your organization's standards
2. Configure \`RepositoryConfig\` for your repos
3. Set up \`PipelinePolicy\` with your Dark Factory thresholds
4. Connect GitHub and Cursor in the integrations page
5. Dispatch your first ticket!`;

    await prisma.playbook.update({
        where: { id: playbook.id },
        data: {
            tagline: SDLC_TAGLINE,
            longDescription: SDLC_LONG_DESCRIPTION,
            requiredIntegrations: ["github", "cursor"]
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
            headline: "Set up your Dark Software Factory",
            description:
                "Connect your integrations, select a repository, and create a webhook to start autonomous development.",
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
        console.log("Published SDLC Flywheel playbook");
    } else {
        console.log("Playbook already published");
    }

    // ── 9. SDLC Triage Network (fallback for workflow engine) ──────────

    console.log("\nEnsuring SDLC Triage network...");

    const triageNetworkSlug = orgSlug("sdlc-triage-network");

    let triageNetwork = await prisma.network.findFirst({
        where: { slug: triageNetworkSlug, workspaceId: workspace.id }
    });

    if (!triageNetwork) {
        triageNetwork = await prisma.network.create({
            data: {
                slug: triageNetworkSlug,
                name: "SDLC Triage Network",
                description:
                    "Multi-agent network that mirrors the SDLC triage workflow topology. " +
                    "Provides a fallback execution path via the network engine when workflow-execute is unavailable.",
                instructions:
                    "You are the SDLC Triage router. Given an incoming ticket, first delegate to the Classifier agent " +
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
                createdBy: "seed-sdlc-playbook"
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
                        networkId: triageNetwork.id,
                        primitiveType: "agent",
                        agentId: agentRecord.id,
                        description: pa.desc
                    }
                });
            }
        }

        console.log("Created SDLC Triage network:", triageNetwork.slug);
    } else {
        console.log("SDLC Triage network exists:", triageNetwork.slug);
    }

    console.log("\n✔ SDLC Flywheel seed complete!");
    console.log("  Organization:", org.slug, "(", org.id, ")");
    console.log("  Workspace:", workspace.slug, "(", workspace.id, ")");
    console.log("  Documents:", Object.keys(documents).join(", "));
    console.log("  Skills:", Object.keys(skills).join(", "));
    console.log("  Agents:", Object.keys(agents).join(", "));
    console.log("  Workflows:", Object.keys(workflows).join(", "));
    console.log("  Network:", triageNetwork.slug, "(", triageNetwork.id, ")");
    console.log("  Playbook:", playbook.slug, "(", playbook.id, ")");
}

main().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
});
