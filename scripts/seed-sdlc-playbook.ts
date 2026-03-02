/**
 * Seed script for the SDLC Flywheel playbook.
 *
 * Creates within the AgentC2 org:
 * 1. SDLC Skills: code-analysis, implementation-planning, audit-review, ticket-triage, pr-review
 * 2. SDLC Documents: coding-standards, architecture-overview, testing-procedures, deployment-runbook
 * 3. SDLC Agents: sdlc-planner, sdlc-auditor, sdlc-classifier, sdlc-reviewer
 *    (each with tools, scorecards, test cases, guardrails, memory config)
 * 4. SDLC Workflows: sdlc-standard, sdlc-bugfix, sdlc-feature
 * 5. Packages everything into the "SDLC Flywheel" playbook
 * 6. Publishes the playbook
 *
 * Idempotent: safe to re-run.
 *
 * Usage: bun run scripts/seed-sdlc-playbook.ts
 */

import { prisma } from "../packages/database/src/index";
import { randomBytes } from "crypto";
import { z } from "zod";

/* ─── Instructions ─────────────────────────────────────────────────── */

const PLANNER_INSTRUCTIONS = `You are the SDLC Planner agent. You analyze codebases, develop implementation plans, and present development options for review.

## Responsibilities
1. **Code Analysis**: Examine codebases to understand architecture, patterns, and relevant files
2. **Development Options**: Generate multiple approaches for implementing changes, with pros/cons and risk assessments
3. **Detailed Plans**: Create step-by-step implementation plans with file-level specificity
4. **Revision Handling**: When feedback is provided from auditors or human reviewers, revise your output accordingly

## Output Standards
- Always provide structured, numbered plans
- Include file paths and estimated complexity for each step
- Flag risks, dependencies, and potential breaking changes
- When presenting options, include effort estimates and risk levels

## Memory Usage
You maintain memory across runs. Reference prior codebase knowledge, project conventions, and architectural patterns from previous interactions. Build on what you know rather than re-analyzing from scratch.`;

const AUDITOR_INSTRUCTIONS = `You are the SDLC Auditor agent. You review plans, options, and code changes for quality, completeness, and potential issues.

## Responsibilities
1. **Option Audit**: Review proposed development options for feasibility, missed alternatives, and risk underestimation
2. **Plan Audit**: Verify implementation plans are complete, correctly sequenced, and handle edge cases
3. **Code Review**: Assess code changes against coding standards, architectural patterns, and best practices
4. **Gap Detection**: Identify missing steps, untested scenarios, and potential regressions

## Output Format

**CRITICAL: You MUST output valid JSON. Do not wrap in markdown code blocks. Do not add explanatory text before or after the JSON.**

Always output structured JSON matching this exact format:
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

**Example valid output:**
{"verdict":"PASS","severity":"none","issues":[],"positives":["Clear requirements"],"summary":"All checks passed.","checklist":{"requirementsAddressed":true,"edgeCasesConsidered":true,"errorHandlingPresent":true,"noBreakingChanges":true,"securityReviewed":true,"performanceAssessed":true,"testingCovered":true}}

**WRONG - Do not do this:**
\`\`\`json
{"verdict": "PASS"}
\`\`\`

## Verdict Criteria
- **PASS**: All checklist items satisfied, no critical or major issues. Minor issues acceptable if noted.
- **NEEDS_REVISION**: Major issues found that need addressing, or critical checklist items not met. Provide specific fixes.
- **FAIL**: Fundamental design flaws, security vulnerabilities, or completely missing requirements. Requires restart.

## Rules
- Always populate the issues array, even on PASS (use minor observations)
- Always populate positives to acknowledge good work
- The summary must reference the verdict and key reasoning
- For NEEDS_REVISION, suggestedFix on each issue must be actionable and specific`;

const AUDITOR_OUTPUT_SCHEMA = {
    verdict: z.enum(["PASS", "NEEDS_REVISION", "FAIL"]).describe("Audit verdict"),
    severity: z.enum(["none", "minor", "major", "critical"]).describe("Severity level"),
    issues: z
        .array(
            z.object({
                severity: z.enum(["critical", "major", "minor"]),
                area: z.string(),
                description: z.string(),
                suggestedFix: z.string()
            })
        )
        .describe("List of issues found"),
    positives: z.array(z.string()).describe("Positive aspects"),
    summary: z.string().describe("Overall assessment summary"),
    checklist: z
        .object({
            requirementsAddressed: z.boolean(),
            edgeCasesConsidered: z.boolean(),
            errorHandlingPresent: z.boolean(),
            noBreakingChanges: z.boolean(),
            securityReviewed: z.boolean(),
            performanceAssessed: z.boolean(),
            testingCovered: z.boolean()
        })
        .describe("Quality checklist")
};

const CLASSIFIER_INSTRUCTIONS = `You are the SDLC Classifier agent. You analyze incoming tickets to determine type, priority, complexity, and routing.

## Responsibilities
1. **Classification**: Categorize tickets as bug, feature, user_error, documentation, or infrastructure
2. **Priority Assessment**: Determine urgency based on impact, affected users, and business context
3. **Complexity Estimation**: Rate implementation complexity (trivial, low, medium, high, critical)
4. **Cross-System Analysis**: Query connected systems (Jira, GitHub, HubSpot) for context

## Output Format
Always output structured JSON:
{
    "classification": "bug" | "feature" | "user_error" | "documentation" | "infrastructure",
    "priority": "trivial" | "low" | "medium" | "high" | "critical",
    "complexity": "trivial" | "low" | "medium" | "high" | "critical",
    "affectedAreas": ["area1", "area2"],
    "suggestedRoute": "sdlc-standard" | "sdlc-bugfix" | "sdlc-feature",
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
        where: { organizationId: org.id, slug: "platform" }
    });
    if (!workspace) {
        workspace = await prisma.workspace.create({
            data: {
                organizationId: org.id,
                name: "Platform",
                slug: "platform",
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
        let existing = await prisma.document.findUnique({
            where: { slug: doc.slug }
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
            slug: "code-analysis",
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
            slug: "implementation-planning",
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
            slug: "audit-review",
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
            slug: "ticket-triage",
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
            slug: "pr-review",
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
            where: { slug: skill.slug, workspaceId: workspace.id }
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
            slug: "sdlc-classifier",
            name: "SDLC Classifier",
            description: "Classifies incoming tickets by type, priority, and complexity.",
            instructions: CLASSIFIER_INSTRUCTIONS,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            maxSteps: 5,
            skills: ["ticket-triage"],
            tools: ["memory-recall", "ticket-to-github-issue"],
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
            slug: "sdlc-planner",
            name: "SDLC Planner",
            description: "Analyzes codebases and creates detailed implementation plans.",
            instructions: PLANNER_INSTRUCTIONS,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-6",
            temperature: 0.5,
            maxSteps: 10,
            skills: ["code-analysis", "implementation-planning"],
            tools: ["memory-recall", "web-fetch"],
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
            slug: "sdlc-auditor",
            name: "SDLC Auditor",
            description: "Reviews plans and code for quality, completeness, and potential issues.",
            instructions: AUDITOR_INSTRUCTIONS,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-6",
            temperature: 0.3,
            maxSteps: 8,
            skills: ["audit-review", "code-analysis"],
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
            slug: "sdlc-reviewer",
            name: "SDLC Reviewer",
            description: "Reviews PRs, calculates trust scores, and makes merge recommendations.",
            instructions: REVIEWER_INSTRUCTIONS,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-6",
            temperature: 0.3,
            maxSteps: 8,
            skills: ["pr-review", "audit-review"],
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

    const memoryConfig = {
        lastMessages: 20,
        semanticRecall: { topK: 5, messageRange: 2 },
        workingMemory: { enabled: true }
    };

    const agents: Record<string, { id: string; slug: string }> = {};
    for (const agentDef of agentDefs) {
        let existing = await prisma.agent.findFirst({
            where: { slug: agentDef.slug, workspaceId: workspace.id }
        });
        if (!existing) {
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
                    memoryConfig,
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
                        tenantId: org.id,
                        criteria: agentDef.scorecard.criteria
                    }
                });
            }

            // Create test cases
            for (const tc of agentDef.testCases) {
                await prisma.agentTestCase.create({
                    data: {
                        agentId: existing.id,
                        tenantId: org.id,
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
                        tenantId: org.id,
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

    // sdlc-standard: the full flywheel workflow with dowhile revision cycles
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
                        pipelineRunId: "{{input.pipelineRunId}}"
                    }
                }
            },
            {
                id: "classify",
                type: "agent",
                name: "Classify Ticket",
                config: {
                    agentSlug: "sdlc-classifier",
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
                                        agentSlug: "sdlc-planner",
                                        promptTemplate:
                                            "The ticket '{{input.title}}' was classified as a user error. Create a knowledge base article explaining the correct usage and common mistakes.\n\nDescription: {{input.description}}"
                                    }
                                }
                            ]
                        }
                    ],
                    defaultBranch: [
                        {
                            id: "analyze",
                            type: "agent",
                            name: "Analyze Codebase",
                            config: {
                                agentSlug: "sdlc-planner",
                                promptTemplate:
                                    "Analyze the codebase for this ticket:\n\nTitle: {{input.title}}\nDescription: {{input.description}}\nClassification: {{steps.classify.classification}}\nRepository: {{input.repository}}\n\nIdentify the relevant files, architecture patterns, and areas that need changes."
                            }
                        },
                        {
                            id: "options-cycle",
                            type: "dowhile",
                            name: "Development Options Cycle",
                            config: {
                                maxIterations: 3,
                                conditionExpression:
                                    "steps['options-review']?.approved !== true && steps['options-review']?.rejected !== true",
                                steps: [
                                    {
                                        id: "options",
                                        type: "agent",
                                        name: "Generate Options",
                                        config: {
                                            agentSlug: "sdlc-planner",
                                            promptTemplate:
                                                "Based on the analysis:\n{{steps.analyze.text}}\n\nGenerate 2-3 development options with pros/cons and risk assessment.\n\n{{#if steps['options-audit']}}Previous audit feedback: {{steps['options-audit'].summary}}\nIssues to address: {{helpers.json(steps['options-audit'].issues)}}{{/if}}\n\n{{#if steps['options-review']}}Human feedback: {{steps['options-review'].feedback}}{{/if}}"
                                        }
                                    },
                                    {
                                        id: "options-audit",
                                        type: "agent",
                                        name: "Audit Options",
                                        config: {
                                            agentSlug: "sdlc-auditor",
                                            promptTemplate:
                                                "Audit these development options:\n\n{{steps.options.text}}\n\nCheck for: feasibility, missed alternatives, risk underestimation, completeness.",
                                            outputFormat: "json",
                                            outputSchema: AUDITOR_OUTPUT_SCHEMA
                                        }
                                    },
                                    {
                                        id: "options-verdict-route",
                                        type: "branch",
                                        name: "Route by Audit Verdict",
                                        config: {
                                            branches: [
                                                {
                                                    id: "passed",
                                                    condition:
                                                        "steps['options-audit']?.verdict === 'PASS'",
                                                    steps: [
                                                        {
                                                            id: "options-review",
                                                            type: "human",
                                                            name: "Review Options",
                                                            config: {
                                                                prompt: "The auditor has APPROVED the development options. Review and approve the preferred option, provide feedback for changes, or reject."
                                                            }
                                                        }
                                                    ]
                                                }
                                            ],
                                            defaultBranch: [
                                                {
                                                    id: "options-audit-notes",
                                                    type: "tool",
                                                    name: "Post Audit Feedback",
                                                    config: {
                                                        toolId: "github-add-issue-comment",
                                                        parameters: {
                                                            issueNumber:
                                                                "{{ steps.intake.issueNumber || input.existingIssueNumber }}",
                                                            repository: "{{ input.repository }}",
                                                            body: "## SDLC Audit: Options Revision Required\n\n**Verdict:** {{ steps['options-audit'].verdict }}\n**Severity:** {{ steps['options-audit'].severity }}\n\n**Summary:** {{ steps['options-audit'].summary }}\n\n**Issues:**\n{{ helpers.json(steps['options-audit'].issues) }}\n\nRevised options will be generated automatically."
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
                                            agentSlug: "sdlc-planner",
                                            promptTemplate:
                                                "Create a detailed implementation plan based on the approved option.\n\nApproved option context: {{steps['options-cycle'].text}}\nCodebase analysis: {{steps.analyze.text}}\n\n{{#if steps['plan-audit']}}Previous audit feedback: {{steps['plan-audit'].summary}}\nIssues to address: {{helpers.json(steps['plan-audit'].issues)}}{{/if}}\n\n{{#if steps['plan-review']}}Human feedback: {{steps['plan-review'].feedback}}{{/if}}"
                                        }
                                    },
                                    {
                                        id: "plan-audit",
                                        type: "agent",
                                        name: "Audit Plan",
                                        config: {
                                            agentSlug: "sdlc-auditor",
                                            promptTemplate:
                                                "Audit this implementation plan:\n\n{{steps.plan.text}}\n\nVerify: completeness, correct sequencing, edge case handling, testing coverage.",
                                            outputFormat: "json",
                                            outputSchema: AUDITOR_OUTPUT_SCHEMA
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
                                                            issueNumber:
                                                                "{{ steps.intake.issueNumber || input.existingIssueNumber }}",
                                                            repository: "{{ input.repository }}",
                                                            body: "## SDLC Audit: Plan Revision Required\n\n**Verdict:** {{ steps['plan-audit'].verdict }}\n**Severity:** {{ steps['plan-audit'].severity }}\n\n**Summary:** {{ steps['plan-audit'].summary }}\n\n**Issues:**\n{{ helpers.json(steps['plan-audit'].issues) }}\n\nA revised plan will be generated automatically."
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
                            id: "code",
                            type: "tool",
                            name: "Launch Coding Agent",
                            config: {
                                toolId: "cursor-launch-agent",
                                parameters: {
                                    task: "{{steps.plan.text}}",
                                    repository: "{{input.repository}}"
                                }
                            }
                        },
                        {
                            id: "build-verify",
                            type: "tool",
                            name: "Build Verification",
                            config: {
                                toolId: "verify-branch",
                                parameters: {
                                    repository: "{{input.repository}}"
                                }
                            }
                        },
                        {
                            id: "pr-cycle",
                            type: "dowhile",
                            name: "PR Review Cycle",
                            config: {
                                maxIterations: 3,
                                conditionExpression:
                                    "steps['pr-approval']?.approved === false && !steps['pr-approval']?.rejected",
                                steps: [
                                    {
                                        id: "pr-review",
                                        type: "agent",
                                        name: "PR Review",
                                        config: {
                                            agentSlug: "sdlc-reviewer",
                                            promptTemplate:
                                                "Review the pull request for this change:\n\nPlan: {{steps.plan.text}}\nBuild result: {{steps['build-verify']}}\n\n{{#if steps['pr-approval']}}Revision feedback: {{steps['pr-approval'].feedback}}{{/if}}\n\nProvide trust score and merge recommendation.",
                                            outputFormat: "json"
                                        }
                                    },
                                    {
                                        id: "pr-approval",
                                        type: "human",
                                        name: "PR Approval",
                                        config: {
                                            prompt: "Review the PR assessment and trust score. Approve to merge, request changes, or reject."
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            id: "merge",
                            type: "tool",
                            name: "Merge PR",
                            config: {
                                toolId: "merge-pull-request",
                                parameters: {
                                    repository: "{{input.repository}}"
                                }
                            }
                        },
                        {
                            id: "deploy",
                            type: "tool",
                            name: "Await Deploy",
                            config: {
                                toolId: "await-deploy",
                                parameters: {
                                    repository: "{{input.repository}}"
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
                        labels: ["bug"]
                    }
                }
            },
            {
                id: "analyze",
                type: "agent",
                name: "Root Cause Analysis",
                config: {
                    agentSlug: "sdlc-planner",
                    promptTemplate:
                        "Perform root cause analysis for this bug:\n\nTitle: {{input.title}}\nDescription: {{input.description}}\nRepository: {{input.repository}}\n\nIdentify the root cause, affected files, and fix approach."
                }
            },
            {
                id: "fix-cycle",
                type: "dowhile",
                name: "Fix & Review Cycle",
                config: {
                    maxIterations: 3,
                    conditionExpression:
                        "steps['fix-review']?.approved !== true && steps['fix-review']?.rejected !== true",
                    steps: [
                        {
                            id: "fix-plan",
                            type: "agent",
                            name: "Fix Plan",
                            config: {
                                agentSlug: "sdlc-planner",
                                promptTemplate:
                                    "Create a focused fix plan:\n\nRoot cause: {{steps.analyze.text}}\n\n{{#if steps['fix-audit']}}Previous audit feedback: {{steps['fix-audit'].summary}}\nIssues to address: {{helpers.json(steps['fix-audit'].issues)}}{{/if}}\n\n{{#if steps['fix-review']}}Human feedback: {{steps['fix-review'].feedback}}{{/if}}"
                            }
                        },
                        {
                            id: "fix-audit",
                            type: "agent",
                            name: "Audit Fix",
                            config: {
                                agentSlug: "sdlc-auditor",
                                promptTemplate:
                                    "Audit this bugfix plan:\n\n{{steps['fix-plan'].text}}\n\nRoot cause: {{steps.analyze.text}}",
                                outputFormat: "json",
                                outputSchema: AUDITOR_OUTPUT_SCHEMA
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
                                                    prompt: "The auditor has APPROVED the fix plan. Review and approve to proceed with implementation, provide feedback for changes, or reject."
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
                                                issueNumber:
                                                    "{{ steps.intake.issueNumber || input.existingIssueNumber }}",
                                                repository: "{{ input.repository }}",
                                                body: "## SDLC Audit: Revision Required\n\n**Verdict:** {{ steps['fix-audit'].verdict }}\n**Severity:** {{ steps['fix-audit'].severity }}\n\n**Summary:** {{ steps['fix-audit'].summary }}\n\n**Issues:**\n{{ helpers.json(steps['fix-audit'].issues) }}\n\nA revised plan will be generated automatically."
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
                id: "code",
                type: "tool",
                name: "Implement Fix",
                config: {
                    toolId: "cursor-launch-agent",
                    parameters: {
                        task: "{{steps['fix-plan'].text}}",
                        repository: "{{input.repository}}"
                    }
                }
            },
            {
                id: "verify",
                type: "tool",
                name: "Verify Fix",
                config: {
                    toolId: "verify-branch",
                    parameters: { repository: "{{input.repository}}" }
                }
            },
            {
                id: "merge-approval",
                type: "human",
                name: "Merge Approval",
                config: {
                    prompt: "The bugfix has been implemented and verified. Approve to merge."
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
                        labels: ["feature"]
                    }
                }
            },
            {
                id: "classify",
                type: "agent",
                name: "Feature Analysis",
                config: {
                    agentSlug: "sdlc-classifier",
                    promptTemplate:
                        "Analyze this feature request:\n\nTitle: {{input.title}}\nDescription: {{input.description}}\n\nAssess scope, complexity, and dependencies.",
                    outputFormat: "json"
                }
            },
            {
                id: "design",
                type: "agent",
                name: "Technical Design",
                config: {
                    agentSlug: "sdlc-planner",
                    promptTemplate:
                        "Create a technical design for this feature:\n\nTitle: {{input.title}}\nDescription: {{input.description}}\nAnalysis: {{steps.classify}}\nRepository: {{input.repository}}\n\nInclude: architecture changes, new components, data model changes, API changes."
                }
            },
            {
                id: "design-review",
                type: "human",
                name: "Design Review",
                config: {
                    prompt: "Review the technical design. Approve to proceed with implementation planning."
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
                                agentSlug: "sdlc-planner",
                                promptTemplate:
                                    "Create a phased implementation plan for this feature:\n\nDesign: {{steps.design.text}}\n\nBreak into deliverable phases with clear milestones.\n\n{{#if steps['feature-plan-audit']}}Previous audit feedback: {{steps['feature-plan-audit'].summary}}\nIssues to address: {{helpers.json(steps['feature-plan-audit'].issues)}}{{/if}}\n\n{{#if steps['feature-plan-review']}}Human feedback: {{steps['feature-plan-review'].feedback}}{{/if}}"
                            }
                        },
                        {
                            id: "feature-plan-audit",
                            type: "agent",
                            name: "Audit Plan",
                            config: {
                                agentSlug: "sdlc-auditor",
                                promptTemplate:
                                    "Audit this phased implementation plan:\n\n{{steps['feature-plan'].text}}",
                                outputFormat: "json",
                                outputSchema: AUDITOR_OUTPUT_SCHEMA
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
                                                issueNumber:
                                                    "{{ steps.intake.issueNumber || input.existingIssueNumber }}",
                                                repository: "{{ input.repository }}",
                                                body: "## SDLC Audit: Plan Revision Required\n\n**Verdict:** {{ steps['feature-plan-audit'].verdict }}\n**Severity:** {{ steps['feature-plan-audit'].severity }}\n\n**Summary:** {{ steps['feature-plan-audit'].summary }}\n\n**Issues:**\n{{ helpers.json(steps['feature-plan-audit'].issues) }}\n\nA revised plan will be generated automatically."
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
                id: "code",
                type: "tool",
                name: "Implement Feature",
                config: {
                    toolId: "cursor-launch-agent",
                    parameters: {
                        task: "{{steps['feature-plan'].text}}",
                        repository: "{{input.repository}}"
                    }
                }
            },
            {
                id: "verify",
                type: "tool",
                name: "Build & Test",
                config: {
                    toolId: "verify-branch",
                    parameters: { repository: "{{input.repository}}" }
                }
            },
            {
                id: "pr-cycle",
                type: "dowhile",
                name: "PR Review Cycle",
                config: {
                    maxIterations: 3,
                    conditionExpression:
                        "steps['feature-pr-approval']?.approved === false && !steps['feature-pr-approval']?.rejected",
                    steps: [
                        {
                            id: "feature-pr-review",
                            type: "agent",
                            name: "PR Review",
                            config: {
                                agentSlug: "sdlc-reviewer",
                                promptTemplate:
                                    "Review the feature PR:\n\nPlan: {{steps['feature-plan'].text}}\nBuild: {{steps.verify}}\n\n{{#if steps['feature-pr-approval']}}Feedback: {{steps['feature-pr-approval'].feedback}}{{/if}}",
                                outputFormat: "json"
                            }
                        },
                        {
                            id: "feature-pr-approval",
                            type: "human",
                            name: "PR Approval",
                            config: {
                                prompt: "Review the PR assessment. Approve to merge."
                            }
                        }
                    ]
                }
            },
            {
                id: "merge",
                type: "tool",
                name: "Merge PR",
                config: {
                    toolId: "merge-pull-request",
                    parameters: { repository: "{{input.repository}}" }
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
            }
        },
        required: ["title", "description", "repository"]
    };

    const workflowDefs = [
        {
            slug: "sdlc-standard",
            name: "SDLC Standard",
            description:
                "Full SDLC workflow with classification, planning, revision cycles, coding, review, and deployment.",
            definitionJson: standardWorkflowDef
        },
        {
            slug: "sdlc-bugfix",
            name: "SDLC Bugfix",
            description:
                "Streamlined SDLC workflow for bug fixes: root cause analysis, fix planning, and deployment.",
            definitionJson: bugfixWorkflowDef
        },
        {
            slug: "sdlc-feature",
            name: "SDLC Feature",
            description:
                "Extended SDLC workflow for features: design, phased planning, implementation, and deployment.",
            definitionJson: featureWorkflowDef
        }
    ];

    const workflows: Record<string, { id: string; slug: string }> = {};
    for (const wfDef of workflowDefs) {
        let existing = await prisma.workflow.findFirst({
            where: { slug: wfDef.slug, workspaceId: workspace.id }
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
                    workspaceId: workspace.id
                }
            });
            console.log("Created workflow:", existing.slug);
        } else {
            console.log("Workflow exists:", existing.slug);
        }
        workflows[wfDef.slug] = { id: existing.id, slug: existing.slug };
    }

    // ─── 5b. Create Default Webhook Trigger for SDLC Workflows ────

    const sdlcTriggerName = "SDLC GitHub Webhook";
    const existingTrigger = await prisma.agentTrigger.findFirst({
        where: {
            workflowId: workflows["sdlc-standard"]!.id,
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
                workflowId: workflows["sdlc-standard"]!.id,
                workspaceId: workspace.id,
                name: sdlcTriggerName,
                description:
                    "Triggers SDLC workflows when a GitHub Issue is labeled. " +
                    "Routes to sdlc-bugfix, sdlc-feature, or sdlc-standard based on issue labels.",
                triggerType: "webhook",
                webhookPath,
                webhookSecret,
                filterJson: {
                    triggerLabel: "agentc2-sdlc",
                    githubEvents: ["issues"],
                    githubActions: ["labeled"]
                },
                inputMapping: {
                    _config: {
                        workflowRouting: {
                            bug: "sdlc-bugfix",
                            feature: "sdlc-feature",
                            default: "sdlc-standard"
                        },
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
            entryWorkflowId: workflows["sdlc-standard"].id,
            includeWorkflows: [workflows["sdlc-bugfix"].id, workflows["sdlc-feature"].id],
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

- **SDLC Standard** — Full lifecycle: classify → analyze → options (with revision) → plan (with revision) → code → review (with revision) → merge → deploy
- **SDLC Bugfix** — Streamlined: root cause analysis → fix plan (with revision) → implement → verify → merge
- **SDLC Feature** — Extended: design → phased plan (with revision) → implement → PR review (with revision) → merge

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

    console.log("\n✔ SDLC Flywheel seed complete!");
    console.log("  Organization:", org.slug, "(", org.id, ")");
    console.log("  Workspace:", workspace.slug, "(", workspace.id, ")");
    console.log("  Documents:", Object.keys(documents).join(", "));
    console.log("  Skills:", Object.keys(skills).join(", "));
    console.log("  Agents:", Object.keys(agents).join(", "));
    console.log("  Workflows:", Object.keys(workflows).join(", "));
    console.log("  Playbook:", playbook.slug, "(", playbook.id, ")");
}

main().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
});
