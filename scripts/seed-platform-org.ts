/**
 * Seed script for the AgentC2 platform organization and starter kit playbook.
 *
 * Creates:
 * 1. "AgentC2" organization (slug: agentc2), "Platform" workspace, system@agentc2.ai user
 * 2. Nexus flagship agent (network-first meta-agent)
 * 3. Operations Hub network
 * 4. Research and Ingest workflow
 * 5. Packages everything into the "starter-kit" playbook with campaign template
 * 6. Publishes the playbook
 *
 * Idempotent: safe to re-run. On subsequent runs, creates a new PlaybookVersion.
 *
 * Usage: bun run scripts/seed-platform-org.ts
 */

import { prisma } from "../packages/database/src/index";

const NEXUS_INSTRUCTIONS = `You are Nexus, the central coordination agent for this workspace. You orchestrate work across the AgentC2 platform by delegating to specialist networks, activating skills on demand, and maintaining a persistent backlog of tasks.

## Operating Model

You are a **network-first meta-agent**. You carry a lean set of always-loaded tools and dynamically expand your capabilities by:
1. **Delegating to specialist networks** via \`network-execute\` for domain-specific work
2. **Activating platform skills** via \`search-skills\` + \`activate-skill\` for capabilities you need on demand
3. **Using your core tools** (memory, RAG, backlog, utilities) for direct tasks

## Core Capabilities

### Always Available
- **Memory & Context**: Use \`memory-recall\` to reference prior conversations and \`rag-query\` / \`document-search\` to search the knowledge base
- **Task Management**: Maintain a persistent backlog with \`backlog-add-task\`, \`backlog-list-tasks\`, \`backlog-complete-task\`, \`backlog-update-task\`, \`backlog-get\`
- **Utilities**: \`date-time\` for current time, \`calculator\` for math
- **Network Delegation**: Route complex domain work to specialist networks via \`network-execute\`

### On-Demand Skills (activate when needed)
Use \`search-skills\` to discover available skills and \`activate-skill\` to load them. Key platform skills include:
- **platform-agent-management** — Create, configure, and manage agents
- **platform-network-management** — Design and manage agent networks
- **platform-workflow-management** — Build multi-step workflows
- **platform-workflow-execution** — Run and monitor workflow executions
- **campaign-analysis** — Plan and execute campaigns using Mission Command
- **platform-goals** — Track OKRs and KPIs
- **platform-triggers-schedules** — Set up cron schedules and event-driven automation
- **platform-webhooks** — Configure inbound webhooks
- **platform-knowledge-management** — Manage documents and RAG ingestion
- **self-authoring** — Create reusable skills from repeated patterns
- **core-utilities** — Code execution and workspace file I/O
- **platform-organization** — Manage organization, workspaces, and members

## Communication Style

Be professional, clear, and efficient. Provide structured responses with actionable next steps. When delegating to networks, explain what you're doing and why. Proactively suggest improvements and optimizations based on observed patterns.

## Backlog Management

Maintain a running backlog of tasks, suggestions, and follow-ups. When you notice recurring patterns or opportunities for improvement, add them to the backlog with appropriate priority. Review the backlog at the start of conversations to surface pending items.

## Standing Orders

1. Always check memory for relevant context before responding
2. Delegate to specialist networks when the task falls within their domain
3. Activate skills on demand — do not try to handle everything with core tools
4. Maintain the backlog with pending tasks and suggestions
5. When creating new agents or workflows, use the appropriate platform skills
6. Provide clear status updates when executing multi-step operations`;

async function main() {
    console.log("Seeding AgentC2 platform organization...\n");

    // 1. Create or find the AgentC2 organization
    let org = await prisma.organization.findUnique({ where: { slug: "agentc2" } });
    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: "AgentC2",
                slug: "agentc2",
                description:
                    "AgentC2 Platform Organization — publisher of system playbooks and platform skills",
                status: "active"
            }
        });
        console.log("Created AgentC2 organization:", org.id);
    } else {
        console.log("AgentC2 organization already exists:", org.id);
    }

    // 2. Create or find the Platform workspace
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
        console.log("Platform workspace already exists:", workspace.id);
    }

    // 3. Create or find the system user
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

        await prisma.membership.create({
            data: {
                userId: systemUser.id,
                organizationId: org.id,
                role: "owner"
            }
        });
        console.log("Created owner membership for system user");
    } else {
        console.log("System user already exists:", systemUser.id);
        const membership = await prisma.membership.findFirst({
            where: { userId: systemUser.id, organizationId: org.id }
        });
        if (!membership) {
            await prisma.membership.create({
                data: {
                    userId: systemUser.id,
                    organizationId: org.id,
                    role: "owner"
                }
            });
            console.log("Created owner membership for system user");
        }
    }

    // 4. Create or upsert Nexus agent
    let nexusAgent = await prisma.agent.findFirst({
        where: { slug: "nexus", workspaceId: workspace.id }
    });
    const nexusTools = [
        "network-execute",
        "memory-recall",
        "date-time",
        "calculator",
        "rag-query",
        "document-search",
        "backlog-list-tasks",
        "backlog-add-task",
        "backlog-complete-task",
        "backlog-get",
        "backlog-update-task",
        "search-skills",
        "activate-skill",
        "list-active-skills"
    ];

    if (!nexusAgent) {
        nexusAgent = await prisma.agent.create({
            data: {
                slug: "nexus",
                name: "Nexus",
                description:
                    "Central coordination agent — delegates to specialist networks, activates skills on demand, and manages the workspace backlog.",
                instructions: NEXUS_INSTRUCTIONS,
                modelProvider: "anthropic",
                modelName: "claude-sonnet-4-6",
                temperature: 0.4,
                modelConfig: {
                    thinking: { type: "enabled", budgetTokens: 31744 },
                    cacheControl: "ephemeral",
                    parallelToolCalls: false
                },
                routingConfig: { mode: "locked" },
                memoryEnabled: true,
                memoryConfig: {
                    lastMessages: 10,
                    semanticRecall: { topK: 3, messageRange: 2 },
                    workingMemory: { enabled: true }
                },
                maxSteps: 15,
                visibility: "ORGANIZATION",
                requiresApproval: false,
                autoVectorize: true,
                deploymentMode: "singleton",
                metadata: {
                    maxToolsLoaded: 20,
                    alwaysLoadedTools: nexusTools
                },
                workspaceId: workspace.id,
                version: 1
            }
        });
        console.log("Created Nexus agent:", nexusAgent.id);

        for (const toolId of nexusTools) {
            await prisma.agentTool.create({
                data: { agentId: nexusAgent.id, toolId }
            });
        }
        console.log("Attached", nexusTools.length, "tools to Nexus");
    } else {
        console.log("Nexus agent already exists:", nexusAgent.id);
    }

    // 5. Create or upsert Operations Hub network
    let opsNetwork = await prisma.network.findFirst({
        where: { slug: "operations-hub", workspaceId: workspace.id }
    });
    if (!opsNetwork) {
        opsNetwork = await prisma.network.create({
            data: {
                slug: "operations-hub",
                name: "Operations Hub",
                description:
                    "Central operations network for platform management, knowledge management, and workspace health monitoring.",
                instructions: `You are the Operations Hub routing agent. Route requests to the appropriate specialist:

- Platform operations queries (agent health, metrics, system status) → platform operations tools
- Knowledge management (documents, RAG, ingestion) → knowledge management tools
- General workspace tasks → appropriate built-in tools

Always provide clear reasoning for your routing decisions.`,
                modelProvider: "anthropic",
                modelName: "claude-sonnet-4-6",
                temperature: 0.3,
                topologyJson: { layout: "hub-spoke" },
                memoryConfig: {
                    lastMessages: 5,
                    semanticRecall: { topK: 2, messageRange: 1 }
                },
                maxSteps: 10,
                workspaceId: workspace.id,
                version: 1
            }
        });
        console.log("Created Operations Hub network:", opsNetwork.id);

        // Add Nexus as a primitive so the network can delegate back
        await prisma.networkPrimitive.create({
            data: {
                networkId: opsNetwork.id,
                primitiveType: "AGENT",
                agentId: nexusAgent.id,
                description: "Nexus coordination agent for complex multi-step operations"
            }
        });

        // Add built-in tools as primitives
        const opTools = [
            { toolId: "rag-query", description: "Query the knowledge base for semantic search" },
            {
                toolId: "document-search",
                description: "Search documents by metadata and keywords"
            },
            {
                toolId: "web-fetch",
                description: "Fetch content from URLs for research and ingestion"
            }
        ];
        for (const t of opTools) {
            await prisma.networkPrimitive.create({
                data: {
                    networkId: opsNetwork.id,
                    primitiveType: "TOOL",
                    toolId: t.toolId,
                    description: t.description
                }
            });
        }
        console.log("Added primitives to Operations Hub network");
    } else {
        console.log("Operations Hub network already exists:", opsNetwork.id);
    }

    // 6. Create or upsert Research and Ingest workflow
    let riWorkflow = await prisma.workflow.findFirst({
        where: { slug: "research-and-ingest", workspaceId: workspace.id }
    });
    if (!riWorkflow) {
        riWorkflow = await prisma.workflow.create({
            data: {
                slug: "research-and-ingest",
                name: "Research and Ingest",
                description:
                    "Fetches content from a URL or topic, processes it, and ingests it into the RAG knowledge base. Returns a summary of the ingested content.",
                definitionJson: {
                    steps: [
                        {
                            id: "fetch",
                            type: "tool",
                            toolId: "web-fetch",
                            label: "Fetch Content",
                            config: {
                                inputMapping: { url: "{{input.url}}" }
                            }
                        },
                        {
                            id: "ingest",
                            type: "tool",
                            toolId: "rag-ingest",
                            label: "Ingest into RAG",
                            config: {
                                inputMapping: {
                                    content: "{{steps.fetch.result}}",
                                    source: "{{input.url}}"
                                }
                            }
                        },
                        {
                            id: "summarize",
                            type: "agent",
                            label: "Summarize",
                            config: {
                                prompt: "Summarize the following content in 2-3 paragraphs:\n\n{{steps.fetch.result}}"
                            }
                        }
                    ],
                    edges: [
                        { from: "fetch", to: "ingest" },
                        { from: "ingest", to: "summarize" }
                    ]
                },
                inputSchemaJson: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "URL to fetch and ingest"
                        }
                    },
                    required: ["url"]
                },
                maxSteps: 5,
                workspaceId: workspace.id,
                version: 1
            }
        });
        console.log("Created Research and Ingest workflow:", riWorkflow.id);
    } else {
        console.log("Research and Ingest workflow already exists:", riWorkflow.id);
    }

    // 7. Package into the starter-kit playbook
    console.log("\nPackaging starter-kit playbook...");

    let playbook = await prisma.playbook.findUnique({ where: { slug: "starter-kit" } });

    // Use the packager to snapshot database entities
    const { packagePlaybook } = await import("../packages/agentc2/src/playbooks/packager");

    if (!playbook) {
        const result = await packagePlaybook({
            name: "Starter Kit",
            slug: "starter-kit",
            description:
                "Default starter kit for new organizations. Includes Nexus (flagship coordination agent), Operations Hub network, Research & Ingest workflow, and a Workspace Setup campaign.",
            category: "getting-started",
            tags: ["starter", "default", "nexus", "getting-started"],
            entryAgentId: nexusAgent.id,
            includeWorkflows: [riWorkflow.id],
            includeNetworks: [opsNetwork.id],
            organizationId: org.id,
            userId: systemUser.id,
            pricingModel: "FREE"
        });
        playbook = result.playbook;
        console.log("Created starter-kit playbook:", playbook.id);
        console.log("Warnings:", result.warnings.length > 0 ? result.warnings : "none");
    } else {
        console.log("Starter-kit playbook already exists:", playbook.id);

        // Get current latest version
        const latestVersion = await prisma.playbookVersion.findFirst({
            where: { playbookId: playbook.id },
            orderBy: { version: "desc" }
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;

        // Snapshot entities manually for the new version
        const { validateManifest } = await import("../packages/agentc2/src/playbooks/manifest");

        // Re-fetch and build manifest from current entities
        const agentRecord = await prisma.agent.findUniqueOrThrow({
            where: { id: nexusAgent.id },
            include: { tools: true, skills: { include: { skill: true } } }
        });

        const networkRecord = await prisma.network.findUniqueOrThrow({
            where: { id: opsNetwork.id },
            include: { primitives: { include: { agent: true, workflow: true } } }
        });

        const workflowRecord = await prisma.workflow.findUniqueOrThrow({
            where: { id: riWorkflow.id }
        });

        const rawManifest = {
            version: "1.0",
            agents: [
                {
                    slug: agentRecord.slug,
                    name: agentRecord.name,
                    description: agentRecord.description,
                    instructions: agentRecord.instructions,
                    instructionsTemplate: agentRecord.instructionsTemplate,
                    modelProvider: agentRecord.modelProvider,
                    modelName: agentRecord.modelName,
                    temperature: agentRecord.temperature,
                    maxTokens: agentRecord.maxTokens,
                    modelConfig: agentRecord.modelConfig,
                    routingConfig: agentRecord.routingConfig,
                    contextConfig: agentRecord.contextConfig,
                    subAgents: agentRecord.subAgents,
                    workflows: agentRecord.workflows,
                    memoryEnabled: agentRecord.memoryEnabled,
                    memoryConfig: agentRecord.memoryConfig,
                    maxSteps: agentRecord.maxSteps,
                    visibility: agentRecord.visibility,
                    requiresApproval: agentRecord.requiresApproval,
                    maxSpendUsd: agentRecord.maxSpendUsd,
                    autoVectorize: agentRecord.autoVectorize,
                    deploymentMode: agentRecord.deploymentMode,
                    metadata: agentRecord.metadata,
                    version: agentRecord.version,
                    tools: agentRecord.tools.map((t) => ({
                        toolId: t.toolId,
                        config: t.config
                    })),
                    skills: agentRecord.skills.map((s) => s.skill.slug),
                    guardrail: null,
                    testCases: [],
                    scorecard: null
                }
            ],
            skills: [],
            documents: [],
            workflows: [
                {
                    slug: workflowRecord.slug,
                    name: workflowRecord.name,
                    description: workflowRecord.description,
                    definitionJson: workflowRecord.definitionJson,
                    inputSchemaJson: workflowRecord.inputSchemaJson,
                    outputSchemaJson: workflowRecord.outputSchemaJson,
                    maxSteps: workflowRecord.maxSteps,
                    timeout: workflowRecord.timeout,
                    retryConfig: workflowRecord.retryConfig,
                    version: workflowRecord.version
                }
            ],
            networks: [
                {
                    slug: networkRecord.slug,
                    name: networkRecord.name,
                    description: networkRecord.description,
                    instructions: networkRecord.instructions,
                    modelProvider: networkRecord.modelProvider,
                    modelName: networkRecord.modelName,
                    temperature: networkRecord.temperature,
                    topologyJson: networkRecord.topologyJson,
                    memoryConfig: networkRecord.memoryConfig,
                    maxSteps: networkRecord.maxSteps,
                    version: networkRecord.version,
                    primitives: networkRecord.primitives.map((p) => ({
                        primitiveType: p.primitiveType,
                        agentSlug: p.agent?.slug ?? null,
                        workflowSlug: p.workflow?.slug ?? null,
                        toolId: p.toolId,
                        description: p.description,
                        position: p.position
                    }))
                }
            ],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: [],
            entryPoint: { type: "agent" as const, slug: "nexus" }
        };

        // Add campaign template
        rawManifest.campaignTemplates.push({
            slug: "workspace-setup",
            name: "Workspace Setup",
            intent: "Bootstrap the workspace with essential knowledge and processes so the team can start using AgentC2 productively",
            endState:
                "The workspace has a populated knowledge base, established task tracking, and the team understands how to use agents, workflows, and networks",
            description:
                "A starter campaign that helps you set up your workspace. Review the intent and end state, then approve to begin.",
            constraints: ["Use only built-in tools (no external integrations required)"],
            restraints: ["Do not auto-execute without user approval"],
            requireApproval: true,
            maxCostUsd: null,
            timeoutMinutes: null
        });

        const validatedManifest = validateManifest(rawManifest);

        await prisma.playbookVersion.create({
            data: {
                playbookId: playbook.id,
                version: nextVersion,
                manifest: validatedManifest as unknown as Record<string, unknown>,
                changelog: "Re-packaged with latest entity configurations",
                createdBy: systemUser.id
            }
        });
        console.log("Created new playbook version:", nextVersion);
    }

    // 8. Append campaign template to the latest manifest version
    const latestVersion = await prisma.playbookVersion.findFirst({
        where: { playbookId: playbook.id },
        orderBy: { version: "desc" }
    });

    if (latestVersion) {
        const manifest = latestVersion.manifest as Record<string, unknown>;
        const campaignTemplates = (manifest.campaignTemplates as unknown[]) ?? [];

        const hasCampaign = campaignTemplates.some(
            (ct: unknown) => (ct as { slug: string }).slug === "workspace-setup"
        );

        if (!hasCampaign) {
            campaignTemplates.push({
                slug: "workspace-setup",
                name: "Workspace Setup",
                intent: "Bootstrap the workspace with essential knowledge and processes so the team can start using AgentC2 productively",
                endState:
                    "The workspace has a populated knowledge base, established task tracking, and the team understands how to use agents, workflows, and networks",
                description:
                    "A starter campaign that helps you set up your workspace. Review the intent and end state, then approve to begin.",
                constraints: ["Use only built-in tools (no external integrations required)"],
                restraints: ["Do not auto-execute without user approval"],
                requireApproval: true,
                maxCostUsd: null,
                timeoutMinutes: null
            });

            await prisma.playbookVersion.update({
                where: { id: latestVersion.id },
                data: {
                    manifest: {
                        ...manifest,
                        campaignTemplates
                    }
                }
            });
            console.log("Added Workspace Setup campaign template to manifest");
        } else {
            console.log("Workspace Setup campaign template already in manifest");
        }
    }

    // 9. Update tagline and longDescription for product page
    const STARTER_KIT_TAGLINE =
        "Everything you need to start building with AI agents. Includes Nexus coordination agent, Operations Hub network, Research & Ingest workflow, and Workspace Setup campaign.";

    const STARTER_KIT_LONG_DESCRIPTION = `## What's Inside

The Starter Kit gives every new organization a production-ready foundation for AI-powered operations. Instead of starting from scratch, you get a fully configured agent system that's ready to use — and designed to grow with you.

### Nexus — Your Central Coordination Agent

Nexus is a **network-first meta-agent** powered by Claude Sonnet. It doesn't try to do everything itself — it delegates to specialist networks, activates skills on demand, and maintains a persistent backlog of tasks across your workspace.

**Key capabilities:**
- Conversation memory with semantic recall across sessions
- Persistent task backlog for tracking work and follow-ups
- Dynamic skill activation — load capabilities on demand from 12+ platform skills
- Network delegation for domain-specific work (research, operations, knowledge management)
- RAG-powered knowledge base search

### Operations Hub — Multi-Agent Network

The Operations Hub is a hub-and-spoke network that routes requests to the right specialist. It connects Nexus with dedicated tools for knowledge management, document search, and web research — giving you a collaborative agent team from day one.

**Network primitives:**
- Nexus coordination agent for complex multi-step operations
- RAG query tool for semantic knowledge base search
- Document search for metadata and keyword lookups
- Web fetch for pulling content from URLs

### Research & Ingest — Automated Knowledge Pipeline

A three-step workflow that automates building your knowledge base: fetch content from any URL, ingest it into the RAG pipeline with vector embeddings, and generate a concise summary. Point it at documentation, articles, or internal resources and your agents immediately gain that knowledge.

**Workflow steps:**
1. **Fetch Content** — Pull content from any URL
2. **Ingest into RAG** — Chunk, embed, and store in the vector knowledge base
3. **Summarize** — Generate a human-readable summary of what was ingested

### Workspace Setup — Guided Onboarding Campaign

A campaign template that walks you through bootstrapping your workspace. It helps you populate your knowledge base, establish task tracking patterns, and learn how to use agents, networks, and workflows effectively. Requires human approval before executing — you stay in control.

## How It All Works Together

\`\`\`
You → Nexus → delegates to Operations Hub → uses RAG + tools
                ↓
        activates skills on demand
                ↓
        Research & Ingest workflow → builds knowledge base
\`\`\`

Nexus is your single entry point. Ask it anything — if the task requires operations work, it delegates to the Operations Hub network. If it needs to learn something new, it triggers the Research & Ingest workflow. As you add more agents and networks to your workspace, Nexus discovers and delegates to them automatically.

## Getting Started

1. **Deploy** this Starter Kit to your workspace (it's free)
2. **Chat with Nexus** — ask it to help you set up your workspace
3. **Run the Workspace Setup campaign** — follow the guided onboarding
4. **Build on top** — add your own agents, skills, and integrations

The Starter Kit is designed to be extended, not replaced. Every component works independently and integrates with anything you add later.`;

    await prisma.playbook.update({
        where: { id: playbook.id },
        data: {
            tagline: STARTER_KIT_TAGLINE,
            longDescription: STARTER_KIT_LONG_DESCRIPTION
        }
    });
    console.log("Updated tagline and longDescription");

    // 10. Publish the playbook
    if (playbook.status !== "PUBLISHED") {
        await prisma.playbook.update({
            where: { id: playbook.id },
            data: { status: "PUBLISHED" }
        });
        console.log("Published starter-kit playbook");
    } else {
        console.log("Starter-kit playbook already published");
    }

    console.log("\nPlatform org seed complete!");
    console.log("  Organization:", org.slug, "(", org.id, ")");
    console.log("  Workspace:", workspace.slug, "(", workspace.id, ")");
    console.log("  System User:", systemUser.email, "(", systemUser.id, ")");
    console.log("  Nexus Agent:", nexusAgent.slug, "(", nexusAgent.id, ")");
    console.log("  Operations Hub:", opsNetwork.slug, "(", opsNetwork.id, ")");
    console.log("  Research & Ingest:", riWorkflow.slug, "(", riWorkflow.id, ")");
    console.log("  Playbook:", playbook.slug, "(", playbook.id, ")");
}

main().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
});
