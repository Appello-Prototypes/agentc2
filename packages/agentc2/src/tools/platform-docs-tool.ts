/**
 * Platform Documentation Tool
 *
 * Self-documenting MCP tool that any IDE can call to learn what the AgentC2
 * platform can do. Tool listings are dynamically generated from the live
 * registry (zero maintenance); conceptual metadata and recipes are static
 * but stable (~quarterly changes).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listAvailableTools, toolCategoryMap, toolCategoryOrder } from "./registry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Recipe {
    name: string;
    description: string;
    steps: string[];
    toolIds: string[];
}

interface DomainMeta {
    description: string;
    keyConcepts: string[];
    recipes: Recipe[];
    relatedDomains: string[];
}

/* ------------------------------------------------------------------ */
/*  Topic alias map — normalizes user input to toolCategoryMap keys    */
/* ------------------------------------------------------------------ */

const topicAliases: Record<string, string> = {
    agents: "Agent Management",
    "agent-management": "Agent Management",
    quality: "Agent Quality & Runs",
    "agent-quality": "Agent Quality & Runs",
    runs: "Agent Quality & Runs",
    learning: "Learning & Simulations",
    simulations: "Learning & Simulations",
    workflows: "Workflows",
    networks: "Networks",
    triggers: "Triggers",
    schedules: "Triggers",
    rag: "RAG & Knowledge",
    knowledge: "RAG & Knowledge",
    documents: "Documents",
    skills: "Skills",
    monitoring: "Monitoring & Metrics",
    metrics: "Monitoring & Metrics",
    integrations: "Integrations",
    organization: "Organization",
    org: "Organization",
    campaigns: "Campaigns",
    goals: "Campaigns",
    coding: "Coding Pipeline",
    "coding-pipeline": "Coding Pipeline",
    sandbox: "Code Execution",
    "code-execution": "Code Execution",
    "remote-compute": "Remote Compute",
    compute: "Remote Compute",
    email: "Email & Calendar",
    calendar: "Email & Calendar",
    communication: "Communication",
    teams: "Communication",
    "file-storage": "File Storage",
    files: "File Storage",
    utilities: "Utilities",
    youtube: "YouTube",
    bim: "BIM",
    backlog: "Backlog",
    infrastructure: "Infrastructure",
    support: "Support"
};

/* ------------------------------------------------------------------ */
/*  Static domain metadata + recipes                                   */
/* ------------------------------------------------------------------ */

const domainMeta: Record<string, DomainMeta> = {
    "Agent Management": {
        description:
            "Create, configure, test, and manage AI agents. Agents are database-driven and resolved at runtime with full version control. Each agent has a model provider, instructions, tools, memory settings, and optional sub-agents.",
        keyConcepts: [
            "Agents are stored in PostgreSQL and resolved by slug at runtime via AgentResolver",
            "Model providers: OpenAI (gpt-4o, o3-mini) and Anthropic (claude-sonnet-4-20250514)",
            "Each update creates a version snapshot; rollback to any previous version",
            "Agents can invoke other agents via agent-invoke-dynamic",
            "agent-discover finds agents by capability keyword for collaboration",
            "Tools are attached by ID from the central tool registry"
        ],
        recipes: [
            {
                name: "Build an Agent from Scratch",
                description:
                    "Discover available tools, create a new agent, test it, and iterate on its configuration.",
                steps: [
                    "1. Call tool-registry-list (optionally with category filter) to discover available tools",
                    "2. Call agent-create with: name, instructions, modelProvider, modelName, toolIds array",
                    "3. Call agent-invoke-dynamic with agentSlug and a test message to verify behavior",
                    "4. Review the response — check output quality, token usage, and duration",
                    "5. Call agent-update to refine instructions, add/remove tools, or change model",
                    "6. Repeat steps 3-5 until the agent performs well"
                ],
                toolIds: [
                    "tool-registry-list",
                    "agent-create",
                    "agent-invoke-dynamic",
                    "agent-update"
                ]
            },
            {
                name: "Agent Self-Construction",
                description:
                    "An agent with the right tools can design and build other agents autonomously — discovering capabilities, creating agents, testing them, and improving them through learning.",
                steps: [
                    "1. Give the builder agent these tools: tool-registry-list, agent-create, agent-invoke-dynamic, agent-update, agent-learning-start, agent-learning-proposal-approve",
                    "2. The builder agent calls tool-registry-list to understand available capabilities",
                    "3. It calls agent-create to build a new agent with appropriate tools and instructions",
                    "4. It calls agent-invoke-dynamic to test the new agent with representative prompts",
                    "5. It calls agent-learning-start to analyze performance and generate improvement proposals",
                    "6. It reviews proposals and calls agent-learning-proposal-approve to apply improvements",
                    "7. It iterates until the agent meets quality thresholds"
                ],
                toolIds: [
                    "tool-registry-list",
                    "agent-create",
                    "agent-invoke-dynamic",
                    "agent-update",
                    "agent-learning-start",
                    "agent-learning-proposal-approve"
                ]
            }
        ],
        relatedDomains: ["Agent Quality & Runs", "Learning & Simulations", "Skills", "Triggers"]
    },

    "Agent Quality & Runs": {
        description:
            "Monitor agent runs, trace execution step-by-step, collect feedback, manage guardrails, create test cases, and run evaluations. Every run produces a full trace with tool calls, token usage, and model routing decisions.",
        keyConcepts: [
            "Every run creates an AgentTrace with sequential steps (LLM calls, tool calls, memory ops)",
            "Traces include token usage, cost, duration, and evaluation scores per step",
            "Guardrails: input (PII blocking, injection detection), output (PII leakage, toxicity), execution (cost/duration/tool-call limits)",
            "Org-level guardrails set a floor that agent-level cannot weaken",
            "Scorers evaluate quality: relevancy, toxicity, completeness, tone, helpfulness",
            "Test cases enable regression testing across agent versions"
        ],
        recipes: [
            {
                name: "Trace and Debug a Failed Run",
                description:
                    "Find a problematic run, get its full execution trace, analyze the root cause, and re-run to verify fixes.",
                steps: [
                    "1. Call agent-runs-list with status filter or date range to find the problematic run",
                    "2. Call agent-run-trace with the runId to get the full step-by-step execution timeline",
                    "3. Examine each step: check tool call inputs/outputs, error messages, token usage, and duration",
                    "4. Identify the failure point — common causes: tool errors, guardrail blocks, model hallucination, timeout",
                    "5. Fix the root cause (update instructions, add tools, adjust guardrails)",
                    "6. Call agent-run-rerun to re-execute with the same input and verify the fix"
                ],
                toolIds: ["agent-runs-list", "agent-run-trace", "agent-run-rerun", "agent-update"]
            },
            {
                name: "Set Up Guardrails for Production Safety",
                description:
                    "Configure three-layer guardrails to protect against bad inputs, bad outputs, and runaway execution.",
                steps: [
                    "1. Call agent-guardrails-get to see current guardrail configuration",
                    "2. Call agent-guardrails-update to configure input guardrails: blockPII, blockPromptInjection, maxLength, blockedPatterns",
                    "3. Configure output guardrails: blockPII (prevent leakage), maxLength, blockedPatterns",
                    "4. Configure execution guardrails: maxDurationMs, maxToolCalls, maxCostUsd",
                    "5. Monitor violations with agent-guardrails-events — each event shows what was blocked and why",
                    "6. Collect user feedback with agent-feedback-submit to track quality over time"
                ],
                toolIds: [
                    "agent-guardrails-get",
                    "agent-guardrails-update",
                    "agent-guardrails-events",
                    "agent-feedback-submit"
                ]
            }
        ],
        relatedDomains: ["Agent Management", "Learning & Simulations", "Monitoring & Metrics"]
    },

    "Learning & Simulations": {
        description:
            "Autonomous agent improvement through signal extraction, proposal generation, A/B experimentation, and human approval. Also includes simulation testing for batch validation of agent behavior.",
        keyConcepts: [
            "Learning sessions analyze recent runs to extract signals: LOW_SCORE, TOOL_FAILURE, NEGATIVE_FEEDBACK, SKILL_CORRELATION",
            "Proposals suggest improvements: instruction changes, tool additions, memory config, model changes",
            "Experiments run A/B tests with traffic splits (default 10% to candidate)",
            "Learning policy controls: autoLearn, minRunsBeforeLearn, requireApproval, trafficSplitPct",
            "Simulations batch-test agent behavior with themed scenarios"
        ],
        recipes: [
            {
                name: "Run a Learning Cycle to Improve an Agent",
                description:
                    "Trigger a learning session, review AI-generated improvement proposals, and promote the best version to production.",
                steps: [
                    "1. Call agent-learning-start with the agentId to begin a learning session",
                    "2. The system automatically extracts signals from recent runs (via Inngest background jobs)",
                    "3. The system generates improvement proposals based on signals",
                    "4. Call agent-learning-session-get to review the session: signals found, proposals generated",
                    "5. Evaluate proposals — they may suggest instruction changes, new tools, or model switches",
                    "6. Call agent-learning-proposal-approve to promote improvements, or agent-learning-proposal-reject to discard",
                    "7. Call agent-learning-metrics to track improvement trends over time"
                ],
                toolIds: [
                    "agent-learning-start",
                    "agent-learning-session-get",
                    "agent-learning-proposal-approve",
                    "agent-learning-proposal-reject",
                    "agent-learning-metrics"
                ]
            },
            {
                name: "Batch-Test Agent with Simulations",
                description:
                    "Run simulations to validate agent behavior across multiple scenarios before deploying changes.",
                steps: [
                    "1. Call agent-simulations-start with agentId and a theme or prompt set",
                    "2. The system runs multiple conversations against the agent",
                    "3. Call agent-simulations-get to review results: responses, scores, failures",
                    "4. Compare simulation results across agent versions to verify improvements"
                ],
                toolIds: [
                    "agent-simulations-start",
                    "agent-simulations-get",
                    "agent-simulations-list"
                ]
            }
        ],
        relatedDomains: ["Agent Management", "Agent Quality & Runs", "Monitoring & Metrics"]
    },

    Workflows: {
        description:
            "Multi-step orchestration with 9 step types: agent, tool, branch, parallel, foreach, human approval, delay, transform, and nested workflow. Workflows support version control, human-in-the-loop gates, and AI-assisted design.",
        keyConcepts: [
            "Step types: agent (invoke agent), tool (call tool), branch (conditional), parallel (concurrent), foreach (iterate), human (approval gate), delay (sleep), transform (data), workflow (nested, max 5 deep)",
            "Templates: {{input.field}}, {{steps.stepId.output}}, {{env.VAR}}, {{helpers.today()}}",
            "Human steps suspend the workflow until workflow-resume is called with approval data",
            "AI-assisted design: workflow-designer-chat generates RFC 6902 JSON Patch from natural language",
            "Each update creates a version snapshot; rollback to any previous version"
        ],
        recipes: [
            {
                name: "Design a Workflow with AI Assistance",
                description:
                    "Use natural language to design or modify workflows. The AI generates JSON Patch proposals that you review and apply.",
                steps: [
                    "1. Call workflow-create with a basic name and description (or use an existing workflow)",
                    "2. Call workflow-designer-chat with a prompt describing what you want (e.g., 'Add a step that searches the web, then branches based on whether results were found')",
                    "3. Review the returned JSON Patch proposal with before/after diff",
                    "4. Call workflow-update to apply the changes",
                    "5. Call workflow-validate to verify the definition is valid",
                    "6. Call workflow-execute to test it with sample input",
                    "7. If the workflow has human steps, call workflow-resume to provide approval"
                ],
                toolIds: [
                    "workflow-create",
                    "workflow-designer-chat",
                    "workflow-update",
                    "workflow-validate",
                    "workflow-execute",
                    "workflow-resume"
                ]
            },
            {
                name: "Build a Human-in-the-Loop Approval Workflow",
                description:
                    "Create a workflow that pauses for human approval before proceeding — useful for content review, expense approval, or deployment gates.",
                steps: [
                    "1. Call workflow-create with a definition that includes a 'human' step type",
                    "2. Configure the human step with: prompt (what to review), formSchema (approval fields), timeout",
                    "3. Call workflow-execute to start the workflow",
                    "4. The workflow runs until it hits the human step, then suspends",
                    "5. Call workflow-get-run to check status — it will show 'suspended' with the approval prompt",
                    "6. Call workflow-resume with the resumeData (e.g., { approved: true, feedback: '...' })",
                    "7. The workflow continues from where it left off"
                ],
                toolIds: [
                    "workflow-create",
                    "workflow-execute",
                    "workflow-get-run",
                    "workflow-resume"
                ]
            }
        ],
        relatedDomains: ["Networks", "Agent Management", "Triggers"]
    },

    Networks: {
        description:
            "Multi-agent networks where a routing agent coordinates multiple primitives (agents, workflows, tools). The LLM dynamically decides which primitive to call based on the message, enabling sophisticated task decomposition.",
        keyConcepts: [
            "A network is a routing agent with sub-agents, workflows, and tools attached",
            "The LLM analyzes available primitives and routes messages to the best match",
            "Networks require memory to track conversation context across primitive calls",
            "AI-assisted design: network-designer-chat generates topology changes from natural language",
            "Topology graph (topologyJson) defines nodes and edges visually"
        ],
        recipes: [
            {
                name: "Build a Multi-Agent Network",
                description:
                    "Create a network that coordinates multiple specialized agents, routing messages to the right agent based on the task.",
                steps: [
                    "1. Ensure you have specialized agents created (e.g., research-agent, crm-agent, calendar-agent)",
                    "2. Call network-create with: name, instructions (routing behavior), and primitives array listing agent slugs",
                    "3. Call network-execute with a message — the routing agent decides which primitive handles it",
                    "4. Use network-designer-chat to refine topology with natural language",
                    "5. Monitor with network-metrics and network-list-runs"
                ],
                toolIds: [
                    "network-create",
                    "network-execute",
                    "network-designer-chat",
                    "network-metrics",
                    "network-list-runs"
                ]
            }
        ],
        relatedDomains: ["Agent Management", "Workflows", "Campaigns"]
    },

    Triggers: {
        description:
            "Event-driven automation with 7 trigger types: scheduled (cron), webhook, event, MCP, API, manual, and test. Also includes schedule management for recurring agent execution.",
        keyConcepts: [
            "Unified trigger system consolidates schedules and triggers into a single API",
            "Scheduled: cron expression + timezone for recurring execution",
            "Webhook: auto-generated unique URL with secret authentication",
            "Event: listens for internal/external events with filter conditions",
            "MCP: exposes agent as an MCP tool callable from any IDE",
            "Input mapping: template, field, or jsonPath extraction from payloads"
        ],
        recipes: [
            {
                name: "Set Up Scheduled Agent Execution",
                description:
                    "Configure an agent to run automatically on a schedule (e.g., daily briefing, hourly monitoring).",
                steps: [
                    "1. Call schedule-create with: agentId, cron expression (e.g., '0 9 * * 1-5' for weekdays at 9am), timezone",
                    "2. Set defaultInput with the prompt the agent should run",
                    "3. Call schedule-list to verify the schedule was created",
                    "4. The system calculates nextRunAt automatically",
                    "5. Monitor execution with agent-runs-list filtered by trigger source"
                ],
                toolIds: ["schedule-create", "schedule-list", "agent-runs-list"]
            },
            {
                name: "Create a Webhook Trigger",
                description:
                    "Set up an agent to execute when an external system sends a webhook (e.g., GitHub push, Stripe payment, form submission).",
                steps: [
                    "1. Call trigger-unified-create with type 'webhook', agentId, and optional filterJson",
                    "2. Note the auto-generated webhook URL from the response",
                    "3. Configure inputMapping to extract the right data from the webhook payload",
                    "4. Call trigger-test with a sample payload to verify the mapping",
                    "5. Call trigger-unified-enable to activate the trigger",
                    "6. Configure the external system to POST to the webhook URL"
                ],
                toolIds: ["trigger-unified-create", "trigger-test", "trigger-unified-enable"]
            }
        ],
        relatedDomains: ["Agent Management", "Workflows", "Monitoring & Metrics"]
    },

    "Coding Pipeline": {
        description:
            "Automated software development lifecycle: from ticket ingestion to deployed code. Uses Cursor Cloud Agents for code generation, remote compute for verification, risk-gated approvals, behavioral scenario testing, and trust scoring.",
        keyConcepts: [
            "26-step pipeline: ingest → analyze → plan → risk-classify → code → verify → test → score → review → merge → deploy",
            "Cursor Cloud Agents write code on GitHub branches",
            "Risk levels: trivial, low, medium, high, critical — with auto-approval thresholds",
            "Trust score: weighted composite of scenario pass rate (35%), holdout tests (25%), CI (20%), build (20%)",
            "Remote compute: ephemeral DigitalOcean droplets for isolated build/test",
            "Pipeline policy per org: autoApprovePlanBelow, autoApprovePrBelow, allowedRepos"
        ],
        recipes: [
            {
                name: "Full Coding Pipeline: Ticket to Deployed Code",
                description:
                    "The complete automated pipeline from a ticket/task to deployed, verified code. This is the platform's most sophisticated orchestration.",
                steps: [
                    "1. Call ingest-ticket with sourceType and sourceId to normalize the ticket",
                    "2. Call lookup-pipeline-config to load org policy and repo configuration",
                    "3. Analyze the codebase and plan implementation (agent steps)",
                    "4. Classify risk level (trivial/low/medium/high/critical)",
                    "5. Risk-gated plan approval: auto-approve if below policy threshold, else human review",
                    "6. Call cursor-launch-agent with repository URL and implementation plan",
                    "7. Call cursor-poll-until-done to wait for the Cursor agent to finish coding",
                    "8. Call provision-compute to spin up an ephemeral build environment",
                    "9. Call remote-execute to clone the branch, install dependencies, and run build/lint/type-check",
                    "10. Call run-scenarios to execute behavioral tests against the branch",
                    "11. Call teardown-compute to destroy the build environment",
                    "12. Call wait-for-checks to wait for GitHub CI to pass",
                    "13. Call calculate-trust-score with scenario results, CI results, and build results",
                    "14. Risk-gated PR review: auto-approve if below policy threshold, else human review",
                    "15. Call merge-pull-request to merge the PR",
                    "16. Call await-deploy to wait for the deployment workflow to complete"
                ],
                toolIds: [
                    "ingest-ticket",
                    "lookup-pipeline-config",
                    "cursor-launch-agent",
                    "cursor-poll-until-done",
                    "provision-compute",
                    "remote-execute",
                    "run-scenarios",
                    "teardown-compute",
                    "wait-for-checks",
                    "calculate-trust-score",
                    "merge-pull-request",
                    "await-deploy",
                    "update-pipeline-status"
                ]
            }
        ],
        relatedDomains: ["Remote Compute", "Infrastructure", "Agent Management"]
    },

    "Remote Compute": {
        description:
            "Provision ephemeral cloud compute (DigitalOcean droplets) for isolated code execution. Droplets auto-bootstrap with Node, Bun, Git, and Docker. Encrypted SSH keys, TTL-based auto-expiry, and full resource lifecycle tracking.",
        keyConcepts: [
            "Ephemeral droplets: auto-generated SSH keys, bootstrap script, TTL-based expiry",
            "Sizes: small (1vCPU/2GB), medium (2vCPU/4GB), large (4vCPU/8GB)",
            "remote-execute runs commands via SSH with configurable timeout and working directory",
            "remote-file-transfer pushes/pulls files between local and remote",
            "teardown-compute destroys the droplet, deletes SSH keys, wipes credentials",
            "All resources tracked in ProvisionedResource table for cost and lifecycle management"
        ],
        recipes: [
            {
                name: "Provision, Execute, and Teardown",
                description:
                    "Spin up isolated compute, run commands, and clean up — used for build verification, testing, or any heavy computation.",
                steps: [
                    "1. Call provision-compute with size, region, and ttlMinutes",
                    "2. Wait for the droplet to be active (the tool polls automatically)",
                    "3. Call remote-execute with commands (e.g., clone repo, install deps, run tests)",
                    "4. Call remote-file-transfer to pull results if needed",
                    "5. Call teardown-compute to destroy the droplet and clean up credentials"
                ],
                toolIds: [
                    "provision-compute",
                    "remote-execute",
                    "remote-file-transfer",
                    "teardown-compute"
                ]
            }
        ],
        relatedDomains: ["Coding Pipeline", "Infrastructure", "Code Execution"]
    },

    "Code Execution": {
        description:
            "Execute code in Docker-isolated sandboxes with optional network access and credential injection. Persistent per-agent workspaces for reading and writing files.",
        keyConcepts: [
            "Languages: bash, python, typescript",
            "Docker isolation with memory/CPU limits",
            "Optional network access and credential injection from org connections",
            "Persistent workspace: per-agent, per-org directories with path traversal protection"
        ],
        recipes: [],
        relatedDomains: ["Remote Compute", "Coding Pipeline"]
    },

    Campaigns: {
        description:
            "Intent-driven multi-agent orchestration using Mission Command principles. Define WHAT you want (intent + end state), and the platform decomposes it into missions and tasks, assigns agents, detects capability gaps, executes with budget protection, and generates After-Action Reviews.",
        keyConcepts: [
            "Campaign lifecycle: PLANNING → ANALYZING → READY → EXECUTING → REVIEWING → COMPLETE",
            "Missions decompose into tasks: ASSIGNED (explicit), IMPLIED (derived), ESSENTIAL (required)",
            "Three system agents: campaign-analyst (decompose), campaign-planner (assign), campaign-architect (build capabilities)",
            "Capability gap detection: if no agent can handle a task, campaign-architect creates one",
            "Budget enforcement: maxCostUsd checked before each task",
            "After-Action Reviews: sustain (what worked), improve (what to fix), rework detection"
        ],
        recipes: [
            {
                name: "Campaign Command: Intent to Execution",
                description:
                    "Define a high-level intent and let the platform decompose, plan, execute, and review autonomously.",
                steps: [
                    "1. Call campaign-create with: name, intent (what you want), endState (how you know it's done), maxCostUsd",
                    "2. Call campaign-update with action 'approve' to kick off analysis",
                    "3. The campaign-analyst agent decomposes intent into missions and tasks (via campaign-write-missions)",
                    "4. The campaign-planner agent assigns agents to tasks, estimates cost/duration (via campaign-write-plan)",
                    "5. If capability gaps are detected, campaign-architect creates new agents or skills",
                    "6. Missions execute in sequence groups (parallel within groups), each task assigned to an agent",
                    "7. The campaign-reviewer generates an After-Action Review (via campaign-write-aar)",
                    "8. Call campaign-get to review the full results: missions, tasks, outputs, costs, AAR"
                ],
                toolIds: [
                    "campaign-create",
                    "campaign-update",
                    "campaign-get",
                    "campaign-write-missions",
                    "campaign-write-plan",
                    "campaign-write-aar"
                ]
            }
        ],
        relatedDomains: ["Agent Management", "Networks", "Organization"]
    },

    "RAG & Knowledge": {
        description:
            "Retrieval Augmented Generation pipeline for document ingestion, chunking, vector embedding, and semantic search. Ingest documents from any source and query them with natural language.",
        keyConcepts: [
            "Ingest: content → chunk → embed → store in vector database",
            "Query: natural language → vector search → ranked results with similarity scores",
            "Supports markdown, text, HTML, and JSON content types",
            "Configurable chunking options and conflict handling (error, skip, update)"
        ],
        recipes: [
            {
                name: "Build a Knowledge Base",
                description: "Ingest documents and make them searchable via semantic queries.",
                steps: [
                    "1. Call rag-ingest with content, sourceId, sourceName, and optional category/tags",
                    "2. Repeat for each document you want to include",
                    "3. Call rag-query with a natural language query to search the knowledge base",
                    "4. Use rag-documents-list to see all ingested documents",
                    "5. Attach rag-query as a tool to agents that need knowledge access"
                ],
                toolIds: ["rag-ingest", "rag-query", "rag-documents-list", "rag-document-delete"]
            }
        ],
        relatedDomains: ["Documents", "Skills", "Agent Management"]
    },

    Documents: {
        description:
            "Document CRUD with semantic search. Documents are standalone knowledge objects that can be attached to skills for agent capability augmentation.",
        keyConcepts: [
            "Documents have: title, content, description, category, tags",
            "document-search performs semantic search across all documents",
            "Documents can be attached to skills via skill-attach-document"
        ],
        recipes: [],
        relatedDomains: ["RAG & Knowledge", "Skills"]
    },

    Skills: {
        description:
            "Reusable knowledge bundles with attached tools and documents. Skills provide procedural knowledge (instructions), declarative knowledge (documents), and capabilities (tools) as a composable unit.",
        keyConcepts: [
            "A skill bundles: instructions (how-to), documents (reference), and tools (capabilities)",
            "Pinned skills: tools always loaded when agent starts",
            "Discoverable skills: tools loaded on-demand mid-conversation via activate-skill",
            "Progressive disclosure: agents start lean, acquire capabilities as needed",
            "Skills are versioned and can be forked"
        ],
        recipes: [
            {
                name: "Dynamic Skill Augmentation at Runtime",
                description:
                    "Let agents discover and activate skills mid-conversation, loading new tools on demand instead of starting with everything.",
                steps: [
                    "1. Create skills with skill-create: include instructions, then attach tools and documents",
                    "2. Attach skills to an agent as discoverable (not pinned) via agent-attach-skill with pinned=false",
                    "3. Give the agent the search-skills and activate-skill tools",
                    "4. During conversation, the agent calls search-skills when it needs a capability it doesn't have",
                    "5. The agent calls activate-skill to load the skill's tools into the current thread",
                    "6. The loaded tools are available on the next message in the conversation"
                ],
                toolIds: [
                    "skill-create",
                    "skill-attach-tool",
                    "skill-attach-document",
                    "agent-attach-skill",
                    "search-skills",
                    "activate-skill"
                ]
            }
        ],
        relatedDomains: ["Agent Management", "Documents", "RAG & Knowledge"]
    },

    "Monitoring & Metrics": {
        description:
            "Live production monitoring, per-agent analytics, cost tracking, and audit logging. Provides real-time visibility into agent performance, latency, token usage, model routing, and spending.",
        keyConcepts: [
            "metrics-live-summary: platform-wide metrics including latency percentiles, top slow/expensive runs, per-agent stats",
            "metrics-agent-analytics: per-agent deep dive with success rates, latency trends, tool usage, quality scores, model comparison",
            "Cost tracking: per-run token/cost events, daily rollups, budget alerts",
            "Model routing analysis: see which models are being used, cost-per-quality tradeoffs",
            "Audit logs: full activity trail for compliance"
        ],
        recipes: [
            {
                name: "Optimize Cost vs Quality",
                description:
                    "Analyze agent spending, identify cost-per-quality tradeoffs, and configure intelligent model routing to reduce costs without sacrificing quality.",
                steps: [
                    "1. Call metrics-live-summary to get platform-wide cost overview",
                    "2. Call metrics-agent-analytics for the target agent to see cost breakdown by model",
                    "3. Compare cost-per-quality: check modelUsage array for each model's runs, tokens, cost, and quality scores",
                    "4. Call agent-budget-get to see current budget settings",
                    "5. Call agent-budget-update to set monthlyLimitUsd, alertAtPct, hardLimit",
                    "6. Configure auto-routing in agent-update: set routingConfig with fastModel for simple queries and escalationModel for complex ones",
                    "7. Monitor the impact with metrics-agent-analytics over the next period"
                ],
                toolIds: [
                    "metrics-live-summary",
                    "metrics-agent-analytics",
                    "agent-budget-get",
                    "agent-budget-update",
                    "agent-update"
                ]
            }
        ],
        relatedDomains: ["Agent Quality & Runs", "Agent Management", "Campaigns"]
    },

    Integrations: {
        description:
            "Connect external services via MCP servers and OAuth integrations. Manage providers, connections, credentials, and MCP configuration. Supports HubSpot, Jira, GitHub, Slack, Google Drive, Dropbox, Gmail, Outlook, and more.",
        keyConcepts: [
            "MCP servers expose external tools: each server adds tools prefixed with serverName_toolName",
            "OAuth integrations: Gmail, Microsoft, Dropbox, Slack with automatic token refresh",
            "Integration connections store credentials per-org, encrypted at rest",
            "integration-mcp-config supports read/plan/apply modes for safe config changes",
            "Import MCP JSON from other tools with integration-import-mcp-json"
        ],
        recipes: [
            {
                name: "Connect a New MCP Server",
                description:
                    "Add an external MCP server integration and make its tools available to agents.",
                steps: [
                    "1. Call integration-providers-list to see available providers and their connection status",
                    "2. Call integration-connection-create with providerKey and required credentials",
                    "3. Call integration-connection-test to verify the connection works",
                    "4. Call integration-mcp-config with action 'read' to see current MCP config",
                    "5. Call integration-mcp-config with action 'plan' to preview adding the new server",
                    "6. Call integration-mcp-config with action 'apply' to activate the new server",
                    "7. The server's tools are now available in the tool registry (prefixed with serverName_)"
                ],
                toolIds: [
                    "integration-providers-list",
                    "integration-connection-create",
                    "integration-connection-test",
                    "integration-mcp-config"
                ]
            }
        ],
        relatedDomains: ["Agent Management", "Organization"]
    },

    Organization: {
        description:
            "Multi-tenant organization management with workspaces, members, and API keys. Organizations scope agents, integrations, and resources.",
        keyConcepts: [
            "Organizations contain workspaces, members, and integrations",
            "Workspaces isolate agent groups within an organization",
            "Members have roles: owner, admin, member",
            "Goals enable background autonomous agent execution"
        ],
        recipes: [],
        relatedDomains: ["Integrations", "Campaigns", "Agent Management"]
    },

    "Email & Calendar": {
        description:
            "Native email and calendar integrations via OAuth. Send, read, search, and archive emails through Gmail and Outlook. Create, update, and manage calendar events through Google Calendar and Outlook Calendar.",
        keyConcepts: [
            "Gmail: search, read, draft, send, archive emails via Google OAuth",
            "Outlook: list, read, send, archive emails via Microsoft Graph API",
            "Google Calendar: search, list, create, update, delete events",
            "Outlook Calendar: list, get, create, update events",
            "All integrations use OAuth with automatic token refresh"
        ],
        recipes: [],
        relatedDomains: ["Communication", "Integrations"]
    },

    Communication: {
        description:
            "Microsoft Teams integration for sending messages to channels and chats. Part of the broader communication stack alongside Email & Calendar and Slack (via MCP).",
        keyConcepts: [
            "List teams and channels, send messages to channels",
            "List chats and send direct messages",
            "Slack integration available via MCP server (separate from Teams)"
        ],
        recipes: [],
        relatedDomains: ["Email & Calendar", "Integrations"]
    },

    "File Storage": {
        description:
            "Cloud file storage integrations: Google Drive and Dropbox. Search, read, create, and share files across cloud storage providers.",
        keyConcepts: [
            "Google Drive: search files, read content (Docs/Sheets/Slides), create documents",
            "Dropbox: list, read, upload, search files, manage sharing links",
            "Both use OAuth with automatic token refresh"
        ],
        recipes: [],
        relatedDomains: ["Integrations", "Documents"]
    },

    Utilities: {
        description:
            "General-purpose utility tools: date/time, calculator, ID generation, web fetch/search/scrape, memory recall, JSON parsing, and interactive questions.",
        keyConcepts: [
            "web-search: search the web for information",
            "web-fetch: fetch and parse a URL",
            "web-scrape: extract structured content from web pages",
            "memory-recall: retrieve relevant memories from conversation history",
            "ask-questions: present structured questions to the user for input"
        ],
        recipes: [],
        relatedDomains: ["Agent Management"]
    },

    YouTube: {
        description:
            "YouTube video research tools: search for videos, get transcripts, analyze video content, and ingest transcripts into the knowledge base for RAG queries.",
        keyConcepts: [
            "youtube-search-videos: find videos by keyword",
            "youtube-get-transcript: extract full transcript from a video",
            "youtube-analyze-video: AI analysis of video content",
            "youtube-ingest-to-knowledge: ingest transcript into RAG for semantic search"
        ],
        recipes: [],
        relatedDomains: ["RAG & Knowledge", "Utilities"]
    },

    Infrastructure: {
        description:
            "Track provisioned cloud resources (droplets, VMs) for lifecycle and cost management. Records creation, usage, and destruction of ephemeral infrastructure.",
        keyConcepts: [
            "track-resource: record a provisioned resource",
            "list-resources: view all tracked resources with status and cost",
            "destroy-resource: destroy and deregister a resource"
        ],
        recipes: [],
        relatedDomains: ["Remote Compute", "Coding Pipeline"]
    },

    Backlog: {
        description:
            "Per-agent task backlog for tracking work items. Agents can manage their own task queues with priorities, statuses, and completion tracking.",
        keyConcepts: [
            "Each agent has its own backlog of tasks",
            "Tasks have: title, description, priority, status, dueDate",
            "Status flow: pending → in_progress → completed"
        ],
        recipes: [],
        relatedDomains: ["Agent Management", "Campaigns"]
    },

    BIM: {
        description:
            "Building Information Modeling tools for construction and architecture: query IFC models, compute takeoffs, detect clashes, diff model versions, and generate handover registers.",
        keyConcepts: [
            "bim-query: query elements from IFC/Speckle/CSV models",
            "bim-takeoff: compute quantity takeoffs (area, volume, count)",
            "bim-diff: compare two model versions to find changes",
            "bim-clash: detect spatial clashes between elements",
            "bim-handover: generate structured handover register"
        ],
        recipes: [],
        relatedDomains: ["RAG & Knowledge"]
    },

    Support: {
        description:
            "Support ticket management: submit tickets, track status, view details, and add comments. Provides a help desk for platform users.",
        keyConcepts: [
            "submit-support-ticket: create a new support request",
            "list-my-tickets: view all your tickets",
            "view-ticket-details: get full ticket with comments",
            "comment-on-ticket: add updates to an existing ticket"
        ],
        recipes: [],
        relatedDomains: []
    },

    "Platform Documentation": {
        description:
            "This tool — self-documenting endpoint that describes what the platform can do. Call with a topic to get detailed documentation for any capability domain.",
        keyConcepts: [
            "Call with topic='overview' for the full capabilities index",
            "Call with a domain name for detailed tools, concepts, and recipes",
            "Tool listings are always current (read from live registry)"
        ],
        recipes: [],
        relatedDomains: []
    }
};

/* ------------------------------------------------------------------ */
/*  Key cross-domain recipes shown in the overview                     */
/* ------------------------------------------------------------------ */

const keyRecipes = [
    {
        name: "Agent Self-Construction",
        description: "Agents that design, build, test, and improve other agents autonomously",
        domains: ["Agent Management", "Learning & Simulations", "Skills"]
    },
    {
        name: "Full Coding Pipeline",
        description: "From ticket to deployed, verified code in 26 automated steps",
        domains: ["Coding Pipeline", "Remote Compute", "Infrastructure"]
    },
    {
        name: "Run Tracing & Root Cause Analysis",
        description: "Step-by-step execution tracing to debug any agent run",
        domains: ["Agent Quality & Runs", "Monitoring & Metrics"]
    },
    {
        name: "Cost vs Quality Optimization",
        description: "Budget guardrails, intelligent model routing, and cost-per-quality analytics",
        domains: ["Monitoring & Metrics", "Agent Management"]
    },
    {
        name: "Multi-Agent Networks",
        description: "Routing agent coordinates specialized agents, workflows, and tools",
        domains: ["Networks", "Agent Management", "Workflows"]
    },
    {
        name: "AI-Assisted Workflow Design",
        description: "Natural language to multi-step workflow with human-in-the-loop gates",
        domains: ["Workflows"]
    },
    {
        name: "Campaign Command",
        description:
            "Intent-driven orchestration: define what you want, platform plans and executes with multiple agents",
        domains: ["Campaigns", "Agent Management", "Networks"]
    },
    {
        name: "Dynamic Skill Augmentation",
        description:
            "Agents discover and activate skills mid-conversation, loading tools on demand",
        domains: ["Skills", "Agent Management", "Documents"]
    },
    {
        name: "Governance & Safety",
        description:
            "Three-layer guardrails with org-level floor policies, PII blocking, and cost limits",
        domains: ["Agent Quality & Runs", "Organization"]
    }
];

/* ------------------------------------------------------------------ */
/*  Helper: group tools by category                                    */
/* ------------------------------------------------------------------ */

function groupToolsByCategory() {
    const tools = listAvailableTools();
    const grouped: Record<string, Array<{ id: string; description: string }>> = {};

    for (const tool of tools) {
        const cat = tool.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ id: tool.id, description: tool.description });
    }

    return grouped;
}

/* ------------------------------------------------------------------ */
/*  Helper: resolve topic string to category name                      */
/* ------------------------------------------------------------------ */

function resolveTopic(topic: string): string | null {
    const lower = topic.toLowerCase().trim();

    if (lower === "overview" || lower === "") return "overview";

    if (topicAliases[lower]) return topicAliases[lower];

    const allCategories = [...new Set(Object.values(toolCategoryMap))];
    const exact = allCategories.find((c) => c.toLowerCase() === lower);
    if (exact) return exact;

    const partial = allCategories.find((c) => c.toLowerCase().includes(lower));
    if (partial) return partial;

    return null;
}

/* ------------------------------------------------------------------ */
/*  The tool                                                           */
/* ------------------------------------------------------------------ */

export const platformDocsTool = createTool({
    id: "platform-docs",
    description:
        "RECOMMENDED FIRST CALL: Get structured documentation about what the AgentC2 platform can do. Returns capability domains, available tools, key concepts, and step-by-step recipes for success. Call with topic='overview' for the full index, or a specific domain (e.g. 'agents', 'workflows', 'coding-pipeline', 'campaigns') for detailed documentation.",
    inputSchema: z.object({
        topic: z
            .string()
            .optional()
            .describe(
                "Topic to get documentation for. Use 'overview' for the full capabilities index, or a domain name like 'agents', 'workflows', 'networks', 'campaigns', 'coding-pipeline', 'skills', 'rag', 'triggers', 'learning', 'quality', 'monitoring', 'integrations'. Defaults to 'overview'."
            )
    }),
    execute: async ({ topic }) => {
        const resolvedTopic = resolveTopic(topic || "overview");
        const toolsByCategory = groupToolsByCategory();
        const allCategories = toolCategoryOrder.filter((c) => toolsByCategory[c]);
        const extraCategories = Object.keys(toolsByCategory)
            .filter((c) => !toolCategoryOrder.includes(c))
            .sort();
        const orderedCategories = [...allCategories, ...extraCategories];

        if (resolvedTopic === "overview") {
            return {
                platform: "AgentC2",
                description:
                    "Production-grade AI agent platform for building, deploying, and orchestrating AI agents with multi-model support, MCP integrations, RAG, voice, and background job processing.",
                totalTools: Object.keys(toolCategoryMap).length,
                domains: orderedCategories.map((cat) => ({
                    name: cat,
                    description: domainMeta[cat]?.description || `Tools in the ${cat} category.`,
                    toolCount: toolsByCategory[cat]?.length || 0,
                    recipeCount: domainMeta[cat]?.recipes?.length || 0,
                    hasDocumentation: !!domainMeta[cat]
                })),
                keyRecipes,
                availableTopics: [
                    "overview",
                    ...orderedCategories.map((c) => {
                        const alias = Object.entries(topicAliases).find(([, v]) => v === c);
                        return alias ? alias[0] : c.toLowerCase();
                    })
                ],
                hint: "Call platform-docs with a specific topic (e.g. 'agents', 'coding-pipeline', 'campaigns') to get detailed documentation with tools and recipes."
            };
        }

        if (!resolvedTopic) {
            const availableTopics = orderedCategories.map((c) => {
                const alias = Object.entries(topicAliases).find(([, v]) => v === c);
                return alias ? alias[0] : c.toLowerCase();
            });
            return {
                error: `Unknown topic: '${topic}'. Available topics: overview, ${availableTopics.join(", ")}`,
                availableTopics: ["overview", ...availableTopics]
            };
        }

        const meta = domainMeta[resolvedTopic];
        const tools = toolsByCategory[resolvedTopic] || [];

        return {
            domain: resolvedTopic,
            description: meta?.description || `Tools in the ${resolvedTopic} category.`,
            keyConcepts: meta?.keyConcepts || [],
            tools: tools.map((t) => ({ id: t.id, description: t.description })),
            toolCount: tools.length,
            recipes: meta?.recipes || [],
            relatedDomains: meta?.relatedDomains || [],
            hint:
                meta?.recipes && meta.recipes.length > 0
                    ? `This domain has ${meta.recipes.length} recipe(s) with step-by-step instructions. Review the recipes to understand how to combine these tools effectively.`
                    : "Call platform-docs with topic='overview' to see all domains and key recipes."
        };
    }
});
