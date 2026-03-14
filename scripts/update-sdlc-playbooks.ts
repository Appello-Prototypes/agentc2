/**
 * Update script for both SDLC Flywheel playbooks.
 *
 * Phase 1: Fix Cursor Cloud playbook requiredIntegrations
 * Phase 2: Enhance Claude Code playbook with boot document, boot tasks,
 *          setup config, auto-boot, updated metadata, and repackage to v2
 *
 * Idempotent: safe to re-run.
 *
 * Usage: bun run scripts/update-sdlc-playbooks.ts
 */

import { prisma } from "../packages/database/src/index";

/* ─── Phase 1: Fix Cursor Cloud Playbook ────────────────────────────── */

async function fixCursorPlaybook() {
    console.log("=== Phase 1: Fix Cursor Cloud Playbook ===\n");

    const playbook = await prisma.playbook.findUnique({
        where: { slug: "sdlc-flywheel" }
    });
    if (!playbook) {
        console.log("WARNING: sdlc-flywheel playbook not found, skipping Phase 1");
        return;
    }

    const current = playbook.requiredIntegrations;
    if (current.length === 2 && current.includes("github") && current.includes("cursor")) {
        console.log("requiredIntegrations already correct:", current);
        return;
    }

    await prisma.playbook.update({
        where: { id: playbook.id },
        data: { requiredIntegrations: ["github", "cursor"] }
    });
    console.log(
        "Fixed requiredIntegrations:",
        JSON.stringify(current),
        "→",
        '["github", "cursor"]'
    );
}

/* ─── Phase 2: Enhance Claude Code Playbook ─────────────────────────── */

const CLAUDE_NAME = "SDLC Flywheel Claude Code";

const CLAUDE_TAGLINE =
    "Autonomous SDLC powered by Claude Code Agent SDK — from ticket to merged PR with human-in-the-loop controls.";

const CLAUDE_DESCRIPTION =
    "End-to-end software development lifecycle automation powered by the Claude Code Agent SDK. " +
    "Incoming tickets are classified, analyzed, and planned by specialized AI agents. " +
    "Approved plans are implemented autonomously by the Claude Code CLI, which clones the repo, " +
    "writes code, commits, pushes a branch, and creates a PR via the GitHub API. " +
    "A reviewer agent scores the PR with a trust rating before a human approves the merge. " +
    "Every critical decision includes human-in-the-loop controls.";

const CLAUDE_LONG_DESCRIPTION = `## SDLC Flywheel Claude Code

A complete autonomous software development pipeline built on AgentC2, powered by **Claude Code Agent SDK** as the code implementation engine.

### How It Works

1. **Triage** — Submit a ticket (bug report, feature request, or question). The SDLC Classifier agent analyzes it, assigns priority/complexity, and routes it to the correct workflow.
2. **Analysis & Planning** — Specialized agents analyze the codebase, generate fix/implementation plans, and an Auditor agent reviews for quality and completeness.
3. **Human Approval** — Plans are presented for human review. Approve, request revision (with feedback), or reject. Revision cycles repeat until approved.
4. **Implementation (Claude Code Agent)** — The approved plan is sent to a Claude Code Agent via \`claude-launch-agent\`. The tool spawns the Claude CLI as a subprocess, which clones the target repository, implements the changes, commits, pushes a branch, and creates a PR using the GitHub API directly.
5. **Code Review** — The SDLC Reviewer agent fetches the PR diff, reviews for quality and adherence to the plan, and calculates a **trust score** (0-100) with a merge recommendation.
6. **Human Merge Decision** — The trust score and review are presented. Approve to merge, request revision, or reject.
7. **Merge & Close** — On approval, the PR is merged and the linked GitHub issue is closed.

### What's Included

**4 Agents:**
- **SDLC Classifier** (GPT-4o) — Ticket classification, priority, complexity, routing
- **SDLC Planner** (Claude Sonnet) — Codebase analysis, implementation planning, option generation
- **SDLC Auditor** (Claude Sonnet) — Plan and code quality review, gap analysis
- **SDLC Reviewer** (Claude Sonnet) — PR review, trust scoring, merge recommendations

**3 Workflows:**
- **SDLC Triage (Claude Code)** (entry point) — Classify and route tickets to bugfix or feature workflows
- **SDLC Bugfix (Claude Code)** — Root cause analysis, fix planning (with audit + revision), Claude Code implementation, PR review, merge
- **SDLC Feature (Claude Code)** — Design, phased planning (with audit + revision), Claude Code implementation, PR review, merge

**5 Skills** with attached tools and document templates

**4 Knowledge Documents** — Coding standards, architecture guide, testing strategy, deployment procedures (customize with your own)

### Claude Code Agent Integration

This playbook uses two key tools to interact with Claude Code:

- **\`claude-launch-agent\`** — Spawns the Claude CLI (\`@anthropic-ai/claude-code\`) as a subprocess with the target repository and implementation prompt. The CLI clones the repo using a GitHub PAT, implements changes, commits, and pushes a branch. The workflow's \`create-pr\` step then creates the PR with proper issue-closing references.
- **\`claude-poll-until-done\`** — Polls every 30 seconds (up to 30 minutes) until the agent completes. Returns the agent's summary, branch name, and **PR URL**.

Unlike the Cursor Cloud variant, Claude Code does **not** use a GitHub App for PR creation. Instead, it uses the organization's **GitHub Personal Access Token** directly for all git operations (clone, push) and PR creation via the GitHub API.

### Human-in-the-Loop Controls

Every critical step includes a revision cycle:
1. Agent generates work product (plan, code, review)
2. Auditor/Reviewer evaluates quality
3. Human approves, requests revision (with feedback), or rejects
4. If revised, the cycle repeats with feedback incorporated

### Required Integrations

- **GitHub** — Personal Access Token with \`repo\` and \`read:org\` scopes for issue/PR management and git operations
- **Claude Code / Anthropic** — Anthropic API key for powering the Claude Code CLI subprocess

### After Installation

1. Connect GitHub integration (PAT with \`repo\`, \`read:org\` scopes)
2. Connect Anthropic / Claude Code integration (API key)
3. Ensure the Claude CLI (\`@anthropic-ai/claude-code\`) is installed on the server running AgentC2
4. Select your target repository
5. Optionally create a GitHub webhook for auto-triage on \`agentc2-sdlc\` labeled issues
6. Dispatch your first ticket!`;

const CLAUDE_TAGS = [
    "sdlc",
    "github",
    "claude-code",
    "anthropic",
    "code-review",
    "automation",
    "ci-cd",
    "devops"
];

const CLAUDE_BOOT_DOCUMENT = `# SDLC Flywheel Claude Code — Complete Guide

## Overview

The SDLC Flywheel Claude Code is an end-to-end autonomous software development pipeline built on AgentC2. It takes incoming tickets (bugs, features, questions), classifies them, generates implementation plans through specialized AI agents, and then hands off approved plans to **Claude Code Agent SDK** for autonomous code implementation. The result is a merged PR — with human-in-the-loop controls at every critical decision point.

The pipeline flow: **Ticket → Classify → Analyze → Plan → Audit → Human Approval → Claude Code Implementation → PR Review → Human Merge Decision → Merge & Close**

---

## How Claude Code Agents Work in This Playbook

Claude Code Agent is the autonomous coding engine at the heart of this playbook. Here is exactly how it integrates:

### 1. Launch (\`claude-launch-agent\` tool)

When a bugfix or feature plan is approved by a human, the workflow calls \`claude-launch-agent\` with:

- **repository** — The target GitHub repo URL (e.g., \`https://github.com/org/repo\`)
- **prompt** — A detailed implementation prompt containing the approved plan, bug/feature context, and coding instructions
- The workflow's **create-pr** step handles PR creation with `Fixes #N` references to auto-close GitHub issues on merge

The tool then:
1. Resolves the organization's **Anthropic API key** from IntegrationConnection
2. Resolves the organization's **GitHub PAT** from IntegrationConnection
3. Clones the target repository using the GitHub PAT
4. Spawns the Claude CLI (\`@anthropic-ai/claude-code\`) as a subprocess with \`permissionMode: "acceptEdits"\`
5. The CLI reads the prompt, analyzes the codebase, implements changes, and commits

### 2. Poll (\`claude-poll-until-done\` tool)

The workflow polls for completion:

- Polls every 30 seconds for up to 30 minutes
- Returns the final status, a summary of what the agent did, the branch name, and the **PR URL**
- If the agent times out, the step reports a timeout status so the workflow can handle it

### 3. PR Creation via GitHub API

Unlike the Cursor Cloud variant (which uses the Cursor GitHub App), Claude Code creates PRs directly:

- After implementing changes, the tool pushes the branch using the GitHub PAT
- It then creates a PR via the GitHub REST API using the same PAT
- The PR is authored by the PAT owner (your GitHub account), not a bot
- No GitHub App installation is required — the PAT handles everything

### 4. Branch Management

The \`claude-launch-agent\` tool creates a feature branch from \`main\` (or the specified ref). The workflow prompt instructs the agent to:
- Implement changes on the **current branch**
- Commit with conventional commit messages
- Push the branch
- NOT create a PR manually — the workflow's \`create-pr\` step handles that with proper issue references

### 5. Permission Mode

Claude Code runs with \`permissionMode: "acceptEdits"\`, which means:
- File read/write/edit operations are auto-approved
- Shell commands (bash) are auto-approved
- No interactive permission prompts that could block headless execution
- The agent can freely modify files, run tests, and commit changes

### 6. Credential Resolution

Both credentials are resolved from the organization's IntegrationConnection records:
- **Anthropic API Key**: Looked up as \`ANTHROPIC_API_KEY\` in the organization's integrations
- **GitHub PAT**: Looked up as \`GITHUB_PERSONAL_ACCESS_TOKEN\` in the organization's integrations

This means each organization can have its own API keys — the playbook is fully multi-tenant.

### 7. Failure Handling

- **Timeout**: If the agent doesn't finish within 30 minutes, \`claude-poll-until-done\` returns a timeout status. The workflow reports this and the human can retry or investigate.
- **No PR URL**: If \`prUrl\` is null after completion, it usually means the GitHub PAT doesn't have \`repo\` scope or the push failed.
- **Clone failure**: If the repo clone fails with "Invalid username or token", the GitHub PAT is invalid or expired. Check Settings > Integrations > GitHub.
- **CLI not found**: If the Claude CLI is not installed on the server, the tool will fail with a process error. Install via \`npm install -g @anthropic-ai/claude-code\`.
- **Build failures**: The prompt instructs the agent to run linting and type-checking. If these fail, the agent attempts to fix them before completing.

---

## Architecture

The system uses three workflows orchestrated by a triage entry point:

### SDLC Triage (Entry Point)
Classifies incoming tickets and routes them:
- **Bug** → SDLC Bugfix (Claude Code) workflow
- **Feature** → SDLC Feature (Claude Code) workflow
- **Question/Other** → Generates a knowledge base article inline

### SDLC Bugfix Workflow (10 Steps)
1. **intake** — Creates or reuses a GitHub issue
2. **analyze-launch** — Launches Claude Code Agent to perform root cause analysis
3. **analyze-wait** — Polls until analysis is complete
4. **analyze-result** — Retrieves the full conversation for audit context
5. **audit-cycle** — Auditor reviews the analysis; loops with revision if needed
6. **implement-launch** — Launches Claude Code Agent with the approved fix plan
7. **implement-wait** — Polls until implementation is complete, retrieves branch name
8. **merge-review** — Human approval: merge the PR, request changes, or reject
9. **merge** — Merges the PR and closes the issue
10. **output-summary** — Final summary with all links and metrics

### SDLC Feature Workflow (12 Steps)
1. **intake** — Creates or reuses a GitHub issue
2. **classify** — Classifier assesses scope and complexity
3. **design-launch** — Launches Claude Code Agent for codebase analysis and design
4. **design-wait** — Polls until design is complete
5. **design-result** — Retrieves the full conversation
6. **design-review** — Human approval: approve, revise, or reject the design
7. **plan-cycle** — Planner generates phased plan, Auditor reviews, loops if needed
8. **implement-launch** — Launches Claude Code Agent with the approved plan
9. **implement-wait** — Polls until implementation is complete, retrieves branch name
10. **merge-review** — Human approval: merge, request changes, or reject
11. **merge** — Merges the PR
12. **output-summary** — Final summary with all links and metrics

---

## Components Inventory

### Agents

| Agent | Model | Role | Claude Code? |
|-------|-------|------|--------------|
| SDLC Classifier | GPT-4o | Ticket classification, priority, complexity, routing | No |
| SDLC Planner | Claude Sonnet | Codebase analysis, implementation planning, options | No |
| SDLC Auditor | Claude Sonnet | Plan/code quality review, gap analysis | No |
| SDLC Reviewer | Claude Sonnet | PR review, trust scoring, merge recommendations | No |

Note: Claude Code Agent is NOT a managed agent in the platform — it is an external service invoked via tools (\`claude-launch-agent\`, \`claude-poll-until-done\`).

### Workflows

| Workflow | Slug | Entry Point? | Steps | Claude Code Steps |
|----------|------|-------------|-------|--------------------|
| SDLC Triage (Claude Code) | sdlc-triage-claude-agentc2 | Yes | 4 | None |
| SDLC Bugfix (Claude Code) | sdlc-bugfix-claude-agentc2 | No | 10 | analyze-launch/wait, implement-launch/wait |
| SDLC Feature (Claude Code) | sdlc-feature-claude-agentc2 | No | 12 | design-launch/wait, implement-launch/wait |

### Skills

5 reusable skills with attached tools and document templates providing coding standards, architecture guidelines, testing strategy, deployment procedures, and GitHub operations.

### Knowledge Documents

4 document templates that agents reference for context:
- Coding Standards
- Architecture Guide
- Testing Strategy
- Deployment Procedures

Customize these with your organization's actual standards after installation.

---

## Integration Requirements

This playbook requires two integrations:

### 1. GitHub Personal Access Token (PAT)

**What it does:** Enables the platform to create issues, add comments, fetch PR diffs, merge PRs, close issues, AND enables Claude Code to clone repos, push branches, and create PRs.

**Required scopes:**
- \`repo\` — Full repository access (issues, PRs, code, git operations)
- \`read:org\` — Read organization membership

**How to create:**
1. Go to github.com > Settings > Developer Settings > Personal Access Tokens > Fine-grained tokens
2. Create a token with the scopes above
3. Add it in AgentC2: Settings > Integrations > GitHub

### 2. Anthropic API Key (Claude Code)

**What it does:** Powers the Claude Code CLI subprocess that analyzes codebases and implements changes. This is the same API key used for Claude model access.

**How to get:**
1. Go to console.anthropic.com
2. Navigate to API Keys
3. Create a new API key
4. Add it in AgentC2: Settings > Integrations > Anthropic (or Claude Code)

### Server Prerequisite: Claude CLI

The Claude CLI must be installed on the server running AgentC2:

\`\`\`bash
npm install -g @anthropic-ai/claude-code
\`\`\`

Additionally, the CLI's terms of service must be accepted for headless operation:

\`\`\`bash
mkdir -p ~/.claude
echo '{"hasCompletedOnboarding":true,"hasAcceptedTermsOfService":true}' > ~/.claude/settings.json
\`\`\`

---

## Post-Install Setup

After deploying this playbook from the marketplace:

### Step 1: Connect GitHub Integration
Create a GitHub PAT with \`repo\` and \`read:org\` scopes. Add it via Settings > Integrations > GitHub.

### Step 2: Connect Anthropic / Claude Code Integration
Get your API key from console.anthropic.com. Add it via Settings > Integrations > Anthropic.

### Step 3: Verify Claude CLI Installation
Ensure the Claude CLI (\`@anthropic-ai/claude-code\`) is installed on the server. Run \`claude --version\` to verify. If not installed: \`npm install -g @anthropic-ai/claude-code\`. Also ensure the TOS acceptance file exists at \`~/.claude/settings.json\`.

### Step 4: Select Target Repository
Choose the GitHub repository (owner/repo format, e.g., \`my-org/my-app\`) where issues and PRs will be created.

### Step 5: Create Webhook Trigger (Optional)
For fully automated ticket intake, create a GitHub webhook on your repo that triggers when issues are labeled \`agentc2-sdlc\`. This auto-dispatches tickets to the triage workflow.

### Step 6: Run Verification Test
Dispatch a test bugfix through the Bugfix workflow to verify the full end-to-end flow:
1. Run the SDLC Triage (Claude Code) workflow with a test bug title and description
2. Verify the classifier routes it as a bug
3. Check that Claude Code Agent launches and completes analysis
4. Approve the fix plan at the human approval step
5. Verify Claude Code Agent implements the fix and creates a PR
6. Review the trust score from the reviewer agent
7. Approve the merge

---

## Usage Guide

### Dispatching a Bugfix

Run the **SDLC Triage (Claude Code)** workflow with:
- **title**: Bug title (e.g., "Login button returns 500 error")
- **description**: Full bug description with reproduction steps
- **repository**: Target repo in \`owner/repo\` format (e.g., \`my-org/my-app\`)

The workflow will:
1. Create a GitHub issue
2. Classify the ticket as a bug
3. Launch Claude Code to analyze root cause
4. Generate a fix plan and audit it
5. Suspend for your approval
6. On approval, launch Claude Code to implement the fix
7. Create a PR via the GitHub API
8. Review the PR with a trust score
9. Suspend for your merge decision
10. On approval, merge the PR and close the issue

### Dispatching a Feature

Same as above, but with a feature-oriented title and description. The classifier will route it to the Feature workflow, which includes an additional design and planning phase.

### Human Approval Steps

When the workflow suspends for human approval, you can:
- **Approve** — Proceed to the next phase
- **Revise** — Provide feedback; the agent incorporates it and the audit/review cycle repeats
- **Reject** — Cancel the workflow

Use the workflow resume tool or the AgentC2 UI to submit your decision.

### Webhook-Driven Auto-Triage

To enable fully automated ticket intake:
1. Create a GitHub webhook on your repo
2. Set it to trigger on issue events
3. Point it to your AgentC2 webhook endpoint
4. Label issues with \`agentc2-sdlc\` to auto-dispatch to triage

---

## Customization

### Swap AI Models
Each agent can use a different model. Edit the agent configuration to change:
- Classifier: GPT-4o (fast, good at classification)
- Planner/Auditor/Reviewer: Claude Sonnet (strong at analysis and code review)

### Adjust Audit Strictness
Modify the Auditor agent's instructions to be more or less strict about plan quality, code coverage requirements, or documentation standards.

### Add Tools
Attach additional MCP tools to any agent. For example, add Slack notifications, Jira sync, or custom API integrations.

### Modify Prompts
Each workflow step has a configurable prompt template. Edit the workflow definition to change how agents are instructed at each step.

### Change Claude Code Behavior
- Adjust the implementation prompt in \`implement-launch\` steps to add project-specific instructions
- Change the polling timeout in \`implement-wait\` steps
- Modify \`ref\` to implement on a different base branch

### Replace Knowledge Documents
After installation, replace the 4 template knowledge documents with your organization's actual:
- Coding standards and conventions
- Architecture documentation
- Testing strategy and requirements
- Deployment procedures

---

## Cursor Cloud vs. Claude Code: Key Differences

| Aspect | Cursor Cloud | Claude Code |
|--------|-------------|-------------|
| **Coding Engine** | Cursor Cloud API | Claude CLI subprocess |
| **PR Creation** | Cursor GitHub App (bot author) | GitHub API via PAT (your account) |
| **GitHub App Required?** | Yes (github.com/apps/cursor) | No |
| **API Key** | Cursor Cloud API key | Anthropic API key |
| **Server CLI Needed?** | No (cloud-hosted) | Yes (\`@anthropic-ai/claude-code\`) |
| **Permission Mode** | N/A (cloud) | \`acceptEdits\` (auto-approve file ops) |
| **Git Operations** | Cursor platform handles | GitHub PAT directly |
| **Multi-tenant?** | Yes (per-org Cursor key) | Yes (per-org Anthropic key + GitHub PAT) |

---

## Troubleshooting

### Claude Code Agent Times Out
**Symptom:** \`implement-wait\` returns timeout status after 30 minutes.
**Fix:** The implementation may be too complex for a single agent run. Break the plan into smaller steps, or increase the timeout in the workflow definition.

### No PR Created (prUrl is null)
**Symptom:** Claude Code Agent completes successfully but no PR URL is returned.
**Fix:** Ensure the GitHub PAT has \`repo\` scope. Check that the push succeeded by reviewing the agent's conversation output. Verify the PAT is correctly configured in Settings > Integrations > GitHub.

### Clone Fails ("Invalid username or token")
**Symptom:** The agent fails immediately with a git clone authentication error.
**Fix:** The GitHub PAT is invalid, expired, or missing the \`repo\` scope. Go to Settings > Integrations > GitHub and update the token.

### Claude CLI Not Found
**Symptom:** Agent fails with "Command not found: claude" or process exit code 1.
**Fix:** Install the Claude CLI on the server: \`npm install -g @anthropic-ai/claude-code\`. Also create the TOS acceptance file: \`echo '{"hasCompletedOnboarding":true,"hasAcceptedTermsOfService":true}' > ~/.claude/settings.json\`.

### Claude CLI Hangs (TOS Prompt)
**Symptom:** Agent appears to start but never completes; no output is generated.
**Fix:** The Claude CLI is waiting for interactive terms of service acceptance. Create the file \`~/.claude/settings.json\` with \`{"hasCompletedOnboarding":true,"hasAcceptedTermsOfService":true}\`.

### Permission Denied (Running as Root)
**Symptom:** Agent fails with permission-related errors when running under PM2 as root.
**Fix:** Ensure the tool uses \`permissionMode: "acceptEdits"\` (not \`"bypassPermissions"\`). The \`--dangerously-skip-permissions\` flag is blocked when running as root.

### GitHub Issue Not Created
**Symptom:** The triage workflow fails at the intake step.
**Fix:** Verify your GitHub PAT has \`repo\` scope and the repository exists. Check Settings > Integrations > GitHub.

### Agent Classification Wrong
**Symptom:** Bugs are classified as features or vice versa.
**Fix:** Improve the ticket description. The classifier relies on title and description to determine type. Clear reproduction steps signal a bug; desired behavior descriptions signal a feature.

### Workflow Won't Resume
**Symptom:** Attempting to resume a suspended workflow fails.
**Fix:** Ensure you're using the correct \`runId\` and providing the expected resume payload (typically \`{ "approved": true }\` or \`{ "approved": false, "feedback": "..." }\`).`;

const CLAUDE_BOOT_TASKS = [
    {
        title: "Connect GitHub Integration",
        description:
            "Create a GitHub Personal Access Token (PAT) with `repo` and `read:org` scopes. " +
            "This token enables the SDLC agents to create issues, add comments, fetch PR diffs, merge PRs, and close issues. " +
            "It is ALSO used by Claude Code to clone repos, push branches, and create PRs via the GitHub API. " +
            "Add the token via Settings > Integrations > GitHub.",
        priority: 10,
        tags: ["integration", "github", "required"],
        sortOrder: 0
    },
    {
        title: "Connect Anthropic / Claude Code Integration",
        description:
            "Get your Anthropic API key from console.anthropic.com > API Keys. " +
            "This key powers the Claude Code CLI subprocess that analyzes codebases and implements code changes. " +
            "Add the key via Settings > Integrations > Anthropic (or Claude Code).",
        priority: 9,
        tags: ["integration", "anthropic", "claude-code", "required"],
        sortOrder: 1
    },
    {
        title: "Verify Claude CLI Installation",
        description:
            "Ensure the Claude CLI (`@anthropic-ai/claude-code`) is installed on the server running AgentC2. " +
            "Run `claude --version` to verify. If not installed: `npm install -g @anthropic-ai/claude-code`. " +
            "Also ensure the TOS acceptance file exists at `~/.claude/settings.json` with " +
            '`{"hasCompletedOnboarding":true,"hasAcceptedTermsOfService":true}`. ' +
            "Without this, the CLI will hang waiting for interactive input.",
        priority: 8,
        tags: ["server", "claude-code", "required"],
        sortOrder: 2
    },
    {
        title: "Select Target Repository",
        description:
            "Choose the GitHub repository where SDLC issues and PRs will be created. " +
            "Use the owner/repo format (e.g., `my-org/my-app`). " +
            "This repository should be accessible by the GitHub PAT configured in the previous step.",
        priority: 7,
        tags: ["configuration", "github"],
        sortOrder: 3
    },
    {
        title: "Create Webhook Trigger (Optional)",
        description:
            "For fully automated ticket intake, create a GitHub webhook on your repository that triggers on issue events. " +
            "Configure it to auto-dispatch issues labeled `agentc2-sdlc` to the SDLC Triage (Claude Code) workflow. " +
            "This enables a zero-touch intake pipeline where labeling an issue kicks off the entire SDLC.",
        priority: 6,
        tags: ["configuration", "webhook", "optional"],
        sortOrder: 4
    },
    {
        title: "Run Verification Test",
        description:
            "Dispatch a test bugfix through the SDLC Triage (Claude Code) workflow to verify the full end-to-end flow. " +
            "Submit a test bug (e.g., title: 'Test bug — button returns 500 error', description with reproduction steps). " +
            "Verify: (1) classifier routes it as a bug, (2) Claude Code analyzes root cause, " +
            "(3) fix plan is generated and audited, (4) approve the plan, " +
            "(5) Claude Code implements the fix and creates a PR via GitHub API, " +
            "(6) reviewer scores the PR, (7) approve and merge.",
        priority: 5,
        tags: ["verification", "testing"],
        sortOrder: 5
    }
];

const CLAUDE_SETUP_CONFIG = {
    headline: "Set Up Your SDLC Flywheel (Claude Code)",
    description:
        "Connect your GitHub and Anthropic integrations, verify Claude CLI installation, " +
        "select your target repository, and optionally create a webhook for automated ticket intake.",
    steps: [
        {
            id: "github-integration",
            type: "integration-prompt",
            label: "Connect GitHub",
            provider: "github",
            description:
                "Connect your GitHub account with a Personal Access Token. " +
                "Required scopes: `repo` (full repository access) and `read:org` (read organization membership). " +
                "This token is used by both the platform agents AND Claude Code for git operations."
        },
        {
            id: "claude-integration",
            type: "integration-prompt",
            label: "Connect Anthropic / Claude Code",
            provider: "anthropic",
            description:
                "Connect your Anthropic account with an API key from console.anthropic.com. " +
                "This enables powering the Claude Code CLI subprocess for code analysis and implementation."
        },
        {
            id: "repo-select",
            type: "repo-select",
            label: "Select Target Repository",
            description:
                "Choose the GitHub repository where the SDLC will create issues, branches, and PRs. " +
                "The GitHub PAT must have access to this repository."
        },
        {
            id: "webhook-create",
            type: "webhook-create",
            label: "Create Webhook Trigger",
            description:
                "Create a GitHub webhook to auto-dispatch issues labeled `agentc2-sdlc` " +
                "to the SDLC Triage (Claude Code) workflow. " +
                "This enables fully automated ticket intake — label an issue and the entire SDLC pipeline kicks off."
        }
    ]
};

async function enhanceClaudePlaybook() {
    console.log("\n=== Phase 2: Enhance Claude Code Playbook ===\n");

    const playbook = await prisma.playbook.findUnique({
        where: { slug: "sdlc-flywheel-claude" }
    });
    if (!playbook) {
        console.log("ERROR: sdlc-flywheel-claude playbook not found!");
        return;
    }
    console.log("Found playbook:", playbook.id);

    // 2a. Update metadata
    console.log("\n--- 2a. Updating metadata ---");
    await prisma.playbook.update({
        where: { id: playbook.id },
        data: {
            name: CLAUDE_NAME,
            tagline: CLAUDE_TAGLINE,
            description: CLAUDE_DESCRIPTION,
            longDescription: CLAUDE_LONG_DESCRIPTION,
            tags: CLAUDE_TAGS,
            requiredIntegrations: ["github", "claude-code"]
        }
    });
    console.log("Updated: name, tagline, description, longDescription, tags, requiredIntegrations");

    // 2b. Set boot document
    console.log("\n--- 2b. Setting boot document ---");
    await prisma.playbook.update({
        where: { id: playbook.id },
        data: { bootDocument: CLAUDE_BOOT_DOCUMENT }
    });
    console.log("Set boot document:", CLAUDE_BOOT_DOCUMENT.length, "chars");

    // 2c. Add boot tasks (idempotent: delete existing first)
    console.log("\n--- 2c. Adding boot tasks ---");
    const existingTasks = await prisma.playbookBootTask.findMany({
        where: { playbookId: playbook.id }
    });
    if (existingTasks.length > 0) {
        await prisma.playbookBootTask.deleteMany({
            where: { playbookId: playbook.id }
        });
        console.log("Deleted", existingTasks.length, "existing boot tasks");
    }
    for (const task of CLAUDE_BOOT_TASKS) {
        await prisma.playbookBootTask.create({
            data: {
                playbookId: playbook.id,
                ...task
            }
        });
        console.log("Created boot task:", task.title);
    }

    // 2d. Set setup config
    console.log("\n--- 2d. Setting setup config ---");
    await prisma.playbook.update({
        where: { id: playbook.id },
        data: { setupConfig: CLAUDE_SETUP_CONFIG as any }
    });
    console.log("Set setup config with", CLAUDE_SETUP_CONFIG.steps.length, "steps");

    // 2e. Enable auto-boot
    console.log("\n--- 2e. Enabling auto-boot ---");
    await prisma.playbook.update({
        where: { id: playbook.id },
        data: { autoBootEnabled: true }
    });
    console.log("Auto-boot enabled");

    // 2f. Repackage to v2
    console.log("\n--- 2f. Repackaging to v2 ---");
    const { repackagePlaybook } = await import("../packages/agentc2/src/playbooks/packager");

    const org = await prisma.organization.findUnique({
        where: { slug: "agentc2" }
    });
    if (!org) {
        console.log("ERROR: AgentC2 org not found!");
        return;
    }

    const systemUser = await prisma.user.findFirst({
        where: { email: "system@agentc2.ai" }
    });
    if (!systemUser) {
        console.log("ERROR: System user not found!");
        return;
    }

    const claudeNetwork = await prisma.network.findFirst({
        where: { slug: "sdlc-triage-network-claude-agentc2" }
    });

    const claudeWorkflows = await prisma.workflow.findMany({
        where: {
            slug: {
                in: [
                    "sdlc-triage-claude-agentc2",
                    "sdlc-bugfix-claude-agentc2",
                    "sdlc-feature-claude-agentc2"
                ]
            }
        }
    });

    const result = await repackagePlaybook({
        playbookId: playbook.id,
        entryNetworkId: claudeNetwork?.id,
        includeWorkflows: claudeWorkflows.map((w) => w.id),
        includeSkills: true,
        includeDocuments: true,
        organizationId: org.id,
        userId: systemUser.id,
        mode: "full",
        changelog:
            "v2: Comprehensive documentation overhaul. Added detailed boot document " +
            "(Claude Code integration guide covering CLI spawning, acceptEdits permission mode, " +
            "GitHub PAT for git operations, credential resolution, failure handling, and " +
            "Cursor vs Claude comparison). Added 6 setup boot tasks. Added 4-step setup wizard. " +
            "Rewrote longDescription with Claude Code specifics. Enabled auto-boot. " +
            "Updated tags and requiredIntegrations."
    });
    console.log("Repackaged playbook:", result.playbook.id);
    console.log("Warnings:", result.warnings.length > 0 ? result.warnings : "none");

    // Inject setupConfig and requiredIntegrations into the new version manifest
    const latestVersion = await prisma.playbookVersion.findFirst({
        where: { playbookId: playbook.id },
        orderBy: { version: "desc" }
    });
    if (latestVersion) {
        const manifest = latestVersion.manifest as Record<string, unknown>;
        manifest.setupConfig = CLAUDE_SETUP_CONFIG;
        manifest.requiredIntegrations = ["github", "claude-code"];
        await prisma.playbookVersion.update({
            where: { id: latestVersion.id },
            data: { manifest: manifest as any }
        });
        console.log("Injected setupConfig and requiredIntegrations into manifest");
    }

    // Re-set requiredIntegrations on playbook (repackage may have cleared it)
    await prisma.playbook.update({
        where: { id: playbook.id },
        data: { requiredIntegrations: ["github", "claude-code"] }
    });
    console.log("Re-set requiredIntegrations after repackage");
}

/* ─── Verification ──────────────────────────────────────────────────── */

async function verify() {
    console.log("\n=== Phase 3: Verification ===\n");

    for (const slug of ["sdlc-flywheel", "sdlc-flywheel-claude"]) {
        const pb = await prisma.playbook.findUnique({
            where: { slug },
            include: {
                bootTasks: true,
                versions: { orderBy: { version: "desc" }, take: 1 }
            }
        });
        if (!pb) {
            console.log(`ERROR: ${slug} not found!`);
            continue;
        }

        const checks = {
            name: pb.name,
            status: pb.status,
            requiredIntegrations: pb.requiredIntegrations,
            hasBootDocument: !!pb.bootDocument,
            bootDocLength: pb.bootDocument?.length ?? 0,
            bootTaskCount: pb.bootTasks.length,
            autoBootEnabled: pb.autoBootEnabled,
            hasSetupConfig: !!pb.setupConfig,
            hasLongDescription: !!pb.longDescription,
            latestVersion: pb.versions[0]?.version ?? "none"
        };

        console.log(`\n${slug}:`);
        for (const [key, value] of Object.entries(checks)) {
            const status =
                key === "status"
                    ? value === "PUBLISHED"
                        ? "PASS"
                        : "FAIL"
                    : key === "hasBootDocument" ||
                        key === "autoBootEnabled" ||
                        key === "hasSetupConfig" ||
                        key === "hasLongDescription"
                      ? value
                          ? "PASS"
                          : "FAIL"
                      : key === "bootTaskCount"
                        ? (value as number) >= 5
                            ? "PASS"
                            : "FAIL"
                        : key === "requiredIntegrations"
                          ? (value as string[]).length >= 2
                              ? "PASS"
                              : "FAIL"
                          : "INFO";
            console.log(
                `  ${status === "FAIL" ? "FAIL" : status === "PASS" ? "PASS" : "    "} ${key}: ${JSON.stringify(value)}`
            );
        }
    }
}

/* ─── Main ──────────────────────────────────────────────────────────── */

async function main() {
    console.log("Updating SDLC Flywheel Playbooks\n");
    console.log("=".repeat(60));

    await fixCursorPlaybook();
    await enhanceClaudePlaybook();
    await verify();

    console.log("\n" + "=".repeat(60));
    console.log("Done! Both playbooks are ready for fresh org deployment.");
}

main().catch((e) => {
    console.error("Update failed:", e);
    process.exit(1);
});
