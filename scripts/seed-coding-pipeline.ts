#!/usr/bin/env bun
/**
 * Seed Coding Pipeline
 *
 * Creates the agentc2-developer agent, coding pipeline workflows (standard + internal),
 * and configures everything needed for the autonomous coding pipeline.
 *
 * Run with: bun run scripts/seed-coding-pipeline.ts
 */

import { config } from "dotenv";
import { prisma, AgentType } from "../packages/database/src";
import {
    CODING_PIPELINE_WORKFLOW_SEED,
    CODING_PIPELINE_INTERNAL_WORKFLOW_SEED
} from "../packages/agentc2/src/workflows/coding-pipeline";

config({ path: ".env" });

const AGENTC2_DEVELOPER_AGENT = {
    slug: "agentc2-developer",
    name: "AgentC2 Developer",
    description:
        "Specialized agent for AgentC2 self-development. Deep knowledge of the " +
        "agentc2 monorepo, coding standards from CLAUDE.md, and the " +
        "full technology stack. Plans and reviews code changes for the platform.",
    instructions: `You are the AgentC2 platform developer agent. You have deep, expert knowledge of the AgentC2 codebase (agentc2 monorepo).

## Architecture Knowledge

- **Monorepo**: Turborepo with Bun 1.3.4+
  - apps/agent/ - AI Agent Next.js app (port 3001, basePath: /agent)
  - apps/frontend/ - Main Next.js app (port 3000)
  - apps/admin/ - Admin dashboard
  - packages/agentc2/ - Core agent framework (@repo/agentc2)
  - packages/database/ - Prisma schema and client (@repo/database)
  - packages/auth/ - Better Auth configuration (@repo/auth)
  - packages/ui/ - Shared UI components (@repo/ui)

- **Tech Stack**: Next.js 16, React 19, TypeScript 5, Prisma 6, Tailwind CSS 4, shadcn/ui
- **AI**: Mastra Core, @mastra/mcp, @mastra/memory, @mastra/rag, AI SDK
- **Database**: PostgreSQL via Supabase
- **Auth**: Better Auth with cross-app sessions via Caddy
- **Background Jobs**: Inngest
- **Deployment**: Digital Ocean (138.197.150.253), PM2, Caddy

## Coding Standards

- 4-space indent, no semicolons, double quotes
- Import order: React/Next → External packages → Internal packages (@repo/*) → Relative imports
- Use createTool from @mastra/core/tools for new tools
- Register tools in packages/agentc2/src/tools/registry.ts
- Add MCP schemas in packages/agentc2/src/tools/mcp-schemas/
- Follow existing patterns in the codebase

## Pre-Push Checklist

ALWAYS verify these pass before approving any PR:
1. bun run type-check
2. bun run lint
3. bun run build

## Critical Paths (Never Auto-Approve)

- packages/auth/ - Authentication
- packages/agentc2/src/crypto/ - Encryption
- packages/database/prisma/schema.prisma - Database schema
- middleware.ts - Route middleware
- ecosystem.config.js - PM2 deployment config
- Caddyfile - Reverse proxy config

## Capabilities

You can:
- Analyze codebase structure and architecture using GitHub MCP tools
- Plan implementation of features, bug fixes, and improvements
- Dispatch coding tasks to Cursor Cloud Agents
- Review and verify generated code changes
- Monitor build/test results
- Query knowledge base (RAG) for documentation and architecture details

## Approach

1. Always read existing code before suggesting changes
2. Follow existing patterns and conventions
3. Consider multi-tenant implications (organizationId scoping)
4. Verify type safety and error handling
5. Never skip build verification`,
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    temperature: 0.2,
    maxSteps: 15,
    maxTokens: 8192,
    memoryEnabled: true,
    memoryConfig: {
        lastMessages: 20,
        semanticRecall: { topK: 5, messageRange: { before: 3, after: 3 } }
    },
    tools: [
        "cursor-launch-agent",
        "cursor-get-status",
        "cursor-add-followup",
        "cursor-get-conversation",
        "cursor-poll-until-done",
        "verify-branch",
        "wait-for-checks",
        "ingest-ticket",
        "dispatch-coding-pipeline",
        "update-pipeline-status",
        "rag-query",
        "web-fetch"
    ],
    metadata: {
        category: "developer",
        slack: {
            displayName: "AgentC2 Developer",
            iconEmoji: ":hammer_and_wrench:"
        }
    }
};

async function seedAgent() {
    console.log(`Seeding agent: ${AGENTC2_DEVELOPER_AGENT.slug}...`);

    const existing = await prisma.agent.findFirst({
        where: { slug: AGENTC2_DEVELOPER_AGENT.slug }
    });

    const agentData = {
        name: AGENTC2_DEVELOPER_AGENT.name,
        description: AGENTC2_DEVELOPER_AGENT.description,
        instructions: AGENTC2_DEVELOPER_AGENT.instructions,
        modelProvider: AGENTC2_DEVELOPER_AGENT.modelProvider,
        modelName: AGENTC2_DEVELOPER_AGENT.modelName,
        temperature: AGENTC2_DEVELOPER_AGENT.temperature,
        maxSteps: AGENTC2_DEVELOPER_AGENT.maxSteps,
        maxTokens: AGENTC2_DEVELOPER_AGENT.maxTokens,
        memoryEnabled: AGENTC2_DEVELOPER_AGENT.memoryEnabled,
        memoryConfig: AGENTC2_DEVELOPER_AGENT.memoryConfig as object,
        metadata: AGENTC2_DEVELOPER_AGENT.metadata as object
    };

    let agent;
    if (existing) {
        agent = await prisma.agent.update({
            where: { id: existing.id },
            data: agentData
        });
    } else {
        agent = await prisma.agent.create({
            data: {
                slug: AGENTC2_DEVELOPER_AGENT.slug,
                type: AgentType.CHAT,
                ...agentData
            }
        });
    }

    // Upsert tool attachments
    const toolNames = AGENTC2_DEVELOPER_AGENT.tools;
    for (const toolId of toolNames) {
        await prisma.agentTool.upsert({
            where: {
                agentId_toolId: { agentId: agent.id, toolId }
            },
            update: {},
            create: {
                agentId: agent.id,
                toolId
            }
        });
    }

    console.log(
        `  ${existing ? "Updated" : "Created"} agent: ${agent.slug} (${agent.id}) with ${toolNames.length} tools`
    );
    return agent;
}

async function seedWorkflow(seed: {
    slug: string;
    name: string;
    description: string;
    maxSteps: number;
    definitionJson: unknown;
}) {
    console.log(`Seeding workflow: ${seed.slug}...`);

    const existing = await prisma.workflow.findFirst({
        where: { slug: seed.slug }
    });

    const workflow = await prisma.workflow.upsert({
        where: { id: existing?.id || "nonexistent" },
        update: {
            name: seed.name,
            description: seed.description,
            maxSteps: seed.maxSteps,
            definitionJson: seed.definitionJson as object
        },
        create: {
            slug: seed.slug,
            name: seed.name,
            description: seed.description,
            maxSteps: seed.maxSteps,
            definitionJson: seed.definitionJson as object,
            isActive: true
        }
    });

    console.log(
        `  ${existing ? "Updated" : "Created"} workflow: ${workflow.slug} (${workflow.id})`
    );
    return workflow;
}

async function seedPipelinePolicy() {
    console.log("Seeding pipeline policy for Appello...");

    const org = await prisma.organization.findFirst({
        where: { slug: "appello" }
    });

    if (!org) {
        console.log("  Skipped: No 'appello' organization found. Create it first.");
        return;
    }

    const policy = await prisma.pipelinePolicy.upsert({
        where: { organizationId: org.id },
        update: {
            enabled: true,
            autoApprovePlanBelow: "medium",
            autoApprovePrBelow: "low",
            allowedRepos: ["https://github.com/acme/agentc2"]
        },
        create: {
            organizationId: org.id,
            enabled: true,
            autoApprovePlanBelow: "medium",
            autoApprovePrBelow: "low",
            allowedRepos: ["https://github.com/acme/agentc2"]
        }
    });

    console.log(`  Upserted PipelinePolicy for ${org.slug} (${policy.id})`);
    console.log(`    enabled: ${policy.enabled}`);
    console.log(`    autoApprovePlanBelow: ${policy.autoApprovePlanBelow}`);
    console.log(`    autoApprovePrBelow: ${policy.autoApprovePrBelow}`);
}

async function seedRepositoryConfig() {
    console.log("Seeding repository config for agentc2...");

    const org = await prisma.organization.findFirst({
        where: { slug: "appello" }
    });

    if (!org) {
        console.log("  Skipped: No 'appello' organization found. Create it first.");
        return;
    }

    const repoUrl = "https://github.com/acme/agentc2";

    const repo = await prisma.repositoryConfig.upsert({
        where: {
            organizationId_repositoryUrl: {
                organizationId: org.id,
                repositoryUrl: repoUrl
            }
        },
        update: {
            name: "agentc2",
            baseBranch: "main",
            installCommand: "bun install",
            buildCommand: "bun run type-check && bun run lint && bun run build",
            testCommand: null,
            codingAgentSlug: "agentc2-developer",
            codingStandards:
                "Turborepo monorepo. TypeScript 5, Next.js 16, React 19, Prisma 6. " +
                "4-space indent, no semicolons, double quotes. " +
                "Import order: React/Next -> External packages -> Internal packages (@repo/*) -> Relative imports. " +
                "Pre-push: bun run type-check && bun run lint && bun run build. " +
                "See CLAUDE.md for full details."
        },
        create: {
            organizationId: org.id,
            repositoryUrl: repoUrl,
            name: "agentc2",
            baseBranch: "main",
            installCommand: "bun install",
            buildCommand: "bun run type-check && bun run lint && bun run build",
            testCommand: null,
            codingAgentSlug: "agentc2-developer",
            codingStandards:
                "Turborepo monorepo. TypeScript 5, Next.js 16, React 19, Prisma 6. " +
                "4-space indent, no semicolons, double quotes. " +
                "Import order: React/Next -> External packages -> Internal packages (@repo/*) -> Relative imports. " +
                "Pre-push: bun run type-check && bun run lint && bun run build. " +
                "See CLAUDE.md for full details."
        }
    });

    console.log(`  Upserted RepositoryConfig for ${repoUrl} (${repo.id})`);
    console.log(`    installCommand: ${repo.installCommand}`);
    console.log(`    buildCommand: ${repo.buildCommand}`);
    console.log(`    codingAgentSlug: ${repo.codingAgentSlug}`);
}

async function main() {
    console.log("=== Seeding Coding Pipeline (Dark Factory) ===\n");

    await seedAgent();
    await seedWorkflow(CODING_PIPELINE_WORKFLOW_SEED);
    await seedWorkflow(CODING_PIPELINE_INTERNAL_WORKFLOW_SEED);
    await seedPipelinePolicy();
    await seedRepositoryConfig();

    console.log("\n=== Done ===");
    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("Seed failed:", err);
    prisma.$disconnect();
    process.exit(1);
});
