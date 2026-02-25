/**
 * Seed script for platform-level SYSTEM skills.
 *
 * Creates 12 global skills with type=SYSTEM, workspaceId=null.
 * These are discoverable by all organizations via search-skills / activate-skill.
 *
 * Idempotent: updates version and creates SkillVersion on re-run.
 *
 * Usage: bun run scripts/seed-platform-skills.ts
 */

import { prisma } from "../packages/database/src/index";

interface SkillDefinition {
    slug: string;
    name: string;
    description: string;
    instructions: string;
    category: string;
    tags: string[];
    tools: string[];
}

const PLATFORM_SKILLS: SkillDefinition[] = [
    {
        slug: "platform-agent-management",
        name: "Agent Management",
        description:
            "Create, read, update, and delete agents. Manage agent configurations, tools, and deployment settings.",
        instructions: `Use these tools to manage agents on the platform:

- **agent-create**: Create a new agent with model, instructions, and tool configuration
- **agent-read**: Get full details of an agent by slug
- **agent-update**: Update an agent's configuration (instructions, model, tools, etc.)
- **agent-delete**: Remove an agent
- **agent-list**: List all agents in the workspace
- **agent-overview**: Get a high-level summary of all agents

When creating agents, always set appropriate scorers and configure memory for conversational agents. Use descriptive slugs and clear instructions.`,
        category: "Platform Building",
        tags: ["agents", "management", "crud", "platform"],
        tools: [
            "agent-create",
            "agent-read",
            "agent-update",
            "agent-delete",
            "agent-list",
            "agent-overview"
        ]
    },
    {
        slug: "platform-network-management",
        name: "Network Management",
        description:
            "Design and manage agent networks. Create routing topologies, add primitives, and configure multi-agent orchestration.",
        instructions: `Use these tools to manage networks:

- **network-create**: Create a new network with routing instructions and topology
- **network-read**: Get full details of a network
- **network-update**: Update network configuration
- **network-delete**: Remove a network
- **network-generate**: Generate a network from a natural language description
- **network-validate**: Validate a network configuration before deployment
- **network-designer-chat**: Interactive network design assistant

Networks route requests to agents, workflows, and tools based on the routing instructions. Design clear routing logic and include descriptive primitive labels.`,
        category: "Platform Building",
        tags: ["networks", "management", "routing", "multi-agent"],
        tools: [
            "network-create",
            "network-read",
            "network-update",
            "network-delete",
            "network-generate",
            "network-validate",
            "network-designer-chat"
        ]
    },
    {
        slug: "platform-workflow-management",
        name: "Workflow Management",
        description:
            "Build and manage multi-step workflows. Design step sequences, configure branching logic, and set up input/output schemas.",
        instructions: `Use these tools to manage workflows:

- **workflow-create**: Create a new workflow with step definitions
- **workflow-read**: Get full details of a workflow
- **workflow-update**: Update workflow configuration
- **workflow-delete**: Remove a workflow
- **workflow-generate**: Generate a workflow from natural language description
- **workflow-validate**: Validate a workflow definition
- **workflow-designer-chat**: Interactive workflow design assistant

Workflows define multi-step processes with tools and agents. Use clear step labels and configure proper input/output mappings between steps.`,
        category: "Platform Building",
        tags: ["workflows", "management", "automation", "multi-step"],
        tools: [
            "workflow-create",
            "workflow-read",
            "workflow-update",
            "workflow-delete",
            "workflow-generate",
            "workflow-validate",
            "workflow-designer-chat"
        ]
    },
    {
        slug: "platform-workflow-execution",
        name: "Workflow Execution",
        description:
            "Run, monitor, and manage workflow executions. Resume paused workflows and inspect run history.",
        instructions: `Use these tools to execute and monitor workflows:

- **workflow-execute**: Start a workflow run with input parameters
- **workflow-list-runs**: List execution history for a workflow
- **workflow-get-run**: Get details of a specific run
- **workflow-resume**: Resume a paused workflow (e.g., after human approval)
- **workflow-metrics**: Get performance metrics
- **workflow-stats**: Get aggregate statistics

Monitor runs for failures and provide clear status updates during multi-step executions.`,
        category: "Platform Building",
        tags: ["workflows", "execution", "monitoring", "runs"],
        tools: [
            "workflow-execute",
            "workflow-list-runs",
            "workflow-get-run",
            "workflow-resume",
            "workflow-metrics",
            "workflow-stats"
        ]
    },
    {
        slug: "campaign-analysis",
        name: "Campaign Analysis",
        description:
            "Plan and execute campaigns using Mission Command principles. Create campaigns, define missions, write execution plans, and conduct after-action reviews.",
        instructions: `Use these tools to manage campaigns:

- **campaign-create**: Create a new campaign with intent, end state, and constraints
- **campaign-list**: List campaigns, optionally filtered by status
- **campaign-get**: Get full details of a campaign
- **campaign-update**: Update campaign configuration or status
- **campaign-delete**: Remove a campaign
- **campaign-write-missions**: Define missions and tasks for a campaign
- **campaign-write-plan**: Generate an execution plan with phases and agent assignments
- **campaign-write-aar**: Conduct after-action review and capture lessons learned

Campaigns follow Mission Command principles: define clear intent, end state, constraints, and restraints. Break work into missions with specific tasks assigned to agents.`,
        category: "Operations & Governance",
        tags: ["campaigns", "mission-command", "planning", "governance"],
        tools: [
            "campaign-create",
            "campaign-list",
            "campaign-get",
            "campaign-update",
            "campaign-delete",
            "campaign-write-missions",
            "campaign-write-plan",
            "campaign-write-aar"
        ]
    },
    {
        slug: "platform-goals",
        name: "Goals & OKRs",
        description:
            "Define and track organizational goals, OKRs, and KPIs. Monitor progress and alignment across teams.",
        instructions: `Use these tools to manage goals:

- **goal-create**: Create a new goal with description, metrics, and target values
- **goal-list**: List all goals, optionally filtered
- **goal-get**: Get full details of a goal
- **goal-update**: Update goal progress, status, or configuration
- **goal-delete**: Remove a goal

Goals provide strategic direction. Define measurable objectives with clear success criteria and track progress over time.`,
        category: "Operations & Governance",
        tags: ["goals", "okrs", "kpis", "tracking"],
        tools: ["goal-create", "goal-list", "goal-get", "goal-update", "goal-delete"]
    },
    {
        slug: "platform-triggers-schedules",
        name: "Triggers & Schedules",
        description:
            "Set up cron schedules, event-driven triggers, and automated agent/workflow execution.",
        instructions: `Use these tools to manage triggers and schedules:

- **trigger-unified-list**: List all triggers (cron, event, webhook)
- **trigger-unified-get**: Get details of a specific trigger
- **trigger-unified-create**: Create a new trigger
- **trigger-unified-update**: Update trigger configuration
- **trigger-unified-delete**: Remove a trigger
- **trigger-unified-enable**: Enable a disabled trigger
- **trigger-unified-disable**: Disable a trigger without deleting
- **trigger-test**: Test a trigger configuration
- **schedule-create**: Create a cron schedule
- **schedule-list**: List schedules
- **schedule-update**: Update a schedule
- **schedule-delete**: Remove a schedule

Triggers automate agent and workflow execution based on time (cron) or events. Always test triggers before enabling them in production.`,
        category: "Operations & Governance",
        tags: ["triggers", "schedules", "cron", "automation", "events"],
        tools: [
            "trigger-unified-list",
            "trigger-unified-get",
            "trigger-unified-create",
            "trigger-unified-update",
            "trigger-unified-delete",
            "trigger-unified-enable",
            "trigger-unified-disable",
            "trigger-test",
            "schedule-create",
            "schedule-list",
            "schedule-update",
            "schedule-delete"
        ]
    },
    {
        slug: "platform-webhooks",
        name: "Webhooks",
        description:
            "Configure inbound webhooks to connect external systems to agents and workflows.",
        instructions: `Use these tools to manage webhooks:

- **webhook-list-agents**: List agents available for webhook routing
- **webhook-create**: Create a new inbound webhook endpoint
- **trigger-unified-create**: Create a webhook trigger (triggerType: "webhook")

Webhooks allow external systems to trigger agent actions. Configure proper authentication and input mapping for security.`,
        category: "Operations & Governance",
        tags: ["webhooks", "integrations", "inbound", "events"],
        tools: ["webhook-list-agents", "webhook-create", "trigger-unified-create"]
    },
    {
        slug: "platform-knowledge-management",
        name: "Knowledge Management",
        description:
            "Manage documents, RAG ingestion, and the workspace knowledge base. Create, search, and organize knowledge resources.",
        instructions: `Use these tools to manage knowledge:

- **document-create**: Create a new document
- **document-read**: Get full document content
- **document-update**: Update document content or metadata
- **document-delete**: Remove a document
- **document-list**: List documents with filtering
- **document-search**: Search documents by keywords and metadata
- **rag-ingest**: Ingest content into the RAG vector index
- **rag-query**: Query the RAG knowledge base
- **rag-documents-list**: List RAG-indexed documents
- **rag-document-delete**: Remove a document from the RAG index

Documents are the platform's knowledge primitive. Use RAG ingestion for content that agents should be able to semantically search. Use document-search for metadata-based lookups.`,
        category: "Knowledge & Self-Improvement",
        tags: ["documents", "rag", "knowledge", "ingestion", "search"],
        tools: [
            "document-create",
            "document-read",
            "document-update",
            "document-delete",
            "document-list",
            "document-search",
            "rag-ingest",
            "rag-query",
            "rag-documents-list",
            "rag-document-delete"
        ]
    },
    {
        slug: "self-authoring",
        name: "Self-Authoring",
        description:
            "Create reusable skills from observed patterns and experiences. Package tool combinations and instructions for future use.",
        instructions: `Use these tools to create and manage skills:

- **skill-create**: Create a new skill with instructions and tool bindings
- **skill-read**: Get skill details
- **skill-update**: Update skill instructions or configuration
- **skill-attach-tool**: Bind a tool to a skill
- **skill-detach-tool**: Remove a tool binding
- **skill-attach-document**: Associate a document with a skill
- **skill-detach-document**: Remove a document association
- **skill-get-versions**: View skill version history
- **agent-attach-skill**: Attach a skill to an agent
- **agent-detach-skill**: Remove a skill from an agent

When you notice a repeated pattern (specific tool combination + instructions), create a skill for it. Skills make capabilities reusable and shareable across agents.`,
        category: "Knowledge & Self-Improvement",
        tags: ["skills", "self-improvement", "authoring", "reusable"],
        tools: [
            "skill-create",
            "skill-read",
            "skill-update",
            "skill-attach-tool",
            "skill-detach-tool",
            "skill-attach-document",
            "skill-detach-document",
            "skill-get-versions",
            "agent-attach-skill",
            "agent-detach-skill"
        ]
    },
    {
        slug: "core-utilities",
        name: "Core Utilities",
        description: "Execute code, manage workspace files, and perform data processing tasks.",
        instructions: `Use these tools for code execution and file management:

- **execute-code**: Run JavaScript/TypeScript code in a sandboxed environment
- **write-workspace-file**: Write content to a file in the workspace
- **read-workspace-file**: Read file contents
- **list-workspace-files**: List files in the workspace directory
- **json-parser**: Parse and transform JSON data

These tools enable data processing, file generation, and scripting tasks. Use execute-code for complex transformations and json-parser for structured data handling.`,
        category: "Knowledge & Self-Improvement",
        tags: ["utilities", "code", "files", "data-processing"],
        tools: [
            "execute-code",
            "write-workspace-file",
            "read-workspace-file",
            "list-workspace-files",
            "json-parser"
        ]
    },
    {
        slug: "platform-organization",
        name: "Organization Management",
        description:
            "Manage organizations, workspaces, and team members. View org structure and configure access.",
        instructions: `Use these tools to manage the organization:

- **org-list**: List organizations the user belongs to
- **org-get**: Get organization details
- **org-members-list**: List members of an organization
- **org-member-add**: Add a new member to the organization
- **org-workspaces-list**: List workspaces in an organization
- **org-workspace-create**: Create a new workspace

Organizations contain workspaces which contain agents, workflows, and networks. Members have roles (owner, admin, member) that control access.`,
        category: "Administration",
        tags: ["organization", "workspaces", "members", "administration"],
        tools: [
            "org-list",
            "org-get",
            "org-members-list",
            "org-member-add",
            "org-workspaces-list",
            "org-workspace-create"
        ]
    }
];

async function upsertSkill(def: SkillDefinition) {
    const existing = await prisma.skill.findFirst({
        where: { slug: def.slug, workspaceId: null, type: "SYSTEM" }
    });

    if (existing) {
        const hasChanged =
            existing.instructions !== def.instructions ||
            existing.description !== def.description ||
            existing.name !== def.name;

        if (hasChanged) {
            const newVersion = existing.version + 1;
            await prisma.skill.update({
                where: { id: existing.id },
                data: {
                    name: def.name,
                    description: def.description,
                    instructions: def.instructions,
                    category: def.category,
                    tags: def.tags,
                    version: newVersion,
                    updatedAt: new Date()
                }
            });

            await prisma.skillVersion.create({
                data: {
                    skillId: existing.id,
                    version: newVersion,
                    instructions: def.instructions,
                    changeSummary: `Updated skill to v${newVersion}`
                }
            });

            // Sync tools: remove old, add new
            await prisma.skillTool.deleteMany({ where: { skillId: existing.id } });
            for (const toolId of def.tools) {
                await prisma.skillTool.create({
                    data: { skillId: existing.id, toolId }
                });
            }

            console.log(`  Updated ${def.slug} to v${newVersion}`);
        } else {
            console.log(`  ${def.slug} unchanged (v${existing.version})`);
        }
        return existing.id;
    }

    // Create new skill
    const skill = await prisma.skill.create({
        data: {
            slug: def.slug,
            name: def.name,
            description: def.description,
            instructions: def.instructions,
            category: def.category,
            tags: def.tags,
            workspaceId: null,
            type: "SYSTEM",
            version: 1
        }
    });

    // Create initial version record
    await prisma.skillVersion.create({
        data: {
            skillId: skill.id,
            version: 1,
            instructions: def.instructions,
            changeSummary: "Initial version"
        }
    });

    // Attach tools
    for (const toolId of def.tools) {
        await prisma.skillTool.create({
            data: { skillId: skill.id, toolId }
        });
    }

    console.log(`  Created ${def.slug} (v1, ${def.tools.length} tools)`);
    return skill.id;
}

async function main() {
    console.log("Seeding platform SYSTEM skills...\n");

    const results: Array<{ slug: string; id: string }> = [];

    for (const def of PLATFORM_SKILLS) {
        const id = await upsertSkill(def);
        results.push({ slug: def.slug, id });
    }

    console.log("\nPlatform skills seed complete!");
    console.log(`  Total: ${results.length} skills`);
    console.log("  Skills:", results.map((r) => r.slug).join(", "));
}

main().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
});
