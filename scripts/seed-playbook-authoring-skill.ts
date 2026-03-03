/**
 * Seed script for the Playbook Authoring platform skill.
 *
 * Creates a SYSTEM skill that teaches agents how to manage playbook lifecycle:
 * boot documents, boot tasks, metadata, packaging, and publishing.
 *
 * Idempotent: updates on re-run.
 *
 * Usage: bun run scripts/seed-playbook-authoring-skill.ts
 */

import { prisma } from "../packages/database/src/index";

const SKILL_SLUG = "playbook-authoring";

const SKILL = {
    slug: SKILL_SLUG,
    name: "Playbook Authoring",
    description:
        "Manage the full playbook publishing lifecycle: create boot documents, structural boot tasks, update metadata, package versions, and submit for marketplace review.",
    instructions: `You are a playbook authoring specialist. Use these tools to manage playbooks on the AgentC2 marketplace.

## Playbook Lifecycle

1. **Create** the playbook via the platform UI or API (name, slug, description, category, pricing)
2. **Configure Boot Document** — write a markdown runbook that deployed agents will read to self-configure
3. **Add Boot Tasks** — create structural task templates that become BacklogTasks on deploy
4. **Package** — snapshot the agent system into a versioned manifest
5. **Submit for Review** — send to admin for marketplace approval

## Boot Document Best Practices

Structure boot documents with clear phases:

\`\`\`markdown
# Boot Runbook

## Phase 1: Orientation
- Read and understand your role and capabilities
- Review your assigned tools and skills

## Phase 2: Integration Assessment
- Check which integrations are connected (CRM, email, calendar, etc.)
- Note any missing integrations that limit capabilities

## Phase 3: Initial Configuration
- Set up default workflows based on available integrations
- Configure notification preferences
- Create initial data structures or templates

## Phase 4: Validation
- Run a self-diagnostic to verify all tools are operational
- Create a test task and verify completion
- Report boot status
\`\`\`

Adapt the phases to the specific playbook's domain. Be specific about what the agent should check and configure.

## Boot Task Guidelines

Structural boot tasks should be:
- **Deterministic** — tasks that must always happen regardless of context (e.g., "Verify integration connections")
- **High priority** — critical setup tasks get priority 8-10
- **Tagged** — use tags like "boot", "setup", "validation" for filtering
- **Ordered** — set sortOrder to control execution sequence

Leave contextual, adaptive tasks to the boot document — the agent will generate those dynamically.

## Repackage Modes

- **full** — re-snapshot everything (components + boot config). Use when both the agent system and boot config changed.
- **components-only** — re-snapshot agents/skills/docs/workflows but keep existing boot doc and boot tasks. Use when the underlying agent changed but boot process stays the same.
- **boot-only** — keep components from previous version, only update boot config. Use when refining the boot process without changing the agent system.

## Available Tools

### Publisher Tools
- \`playbook-list-mine\` — list your published playbooks
- \`playbook-get-full\` — full detail view (metadata, boot doc, boot tasks, components, versions)
- \`playbook-update-metadata\` — update name, tagline, description, category, tags, pricing
- \`playbook-get-boot-document\` — read the current boot document
- \`playbook-set-boot-document\` — write or update the boot document (markdown)
- \`playbook-add-boot-task\` — add a structural boot task template
- \`playbook-list-boot-tasks\` — list all boot tasks
- \`playbook-update-boot-task\` — modify a boot task
- \`playbook-remove-boot-task\` — delete a boot task
- \`playbook-package\` — package a new version (with mode and changelog)
- \`playbook-submit-review\` — submit for marketplace review
- \`playbook-set-auto-boot\` — enable/disable auto-boot on deploy

### Useful Context Tools
- \`agent-read\` — read agent configuration to understand what to write in the boot doc
- \`backlog-list-tasks\` — see existing backlog patterns for boot task inspiration
- \`playbook-detail\` — see published playbook details

## Changelog Writing

Write concise changelogs that explain what changed and why:
- "Added CRM integration check to boot process"
- "Refined boot document with Salesforce-specific configuration steps"
- "Updated agent instructions for improved context handling"`,
    category: "Platform Building",
    tags: ["playbook", "publishing", "marketplace", "boot", "authoring"],
    tools: [
        "playbook-list-mine",
        "playbook-get-full",
        "playbook-update-metadata",
        "playbook-get-boot-document",
        "playbook-set-boot-document",
        "playbook-add-boot-task",
        "playbook-list-boot-tasks",
        "playbook-update-boot-task",
        "playbook-remove-boot-task",
        "playbook-package",
        "playbook-submit-review",
        "playbook-set-auto-boot",
        "playbook-search",
        "playbook-detail",
        "agent-read",
        "backlog-list-tasks"
    ]
};

async function main() {
    console.log("Seeding Playbook Authoring skill...");

    const existing = await prisma.skill.findUnique({
        where: { slug: SKILL_SLUG }
    });

    if (existing) {
        await prisma.skill.update({
            where: { slug: SKILL_SLUG },
            data: {
                name: SKILL.name,
                description: SKILL.description,
                instructions: SKILL.instructions,
                category: SKILL.category,
                tags: SKILL.tags,
                type: "SYSTEM",
                version: { increment: 1 }
            }
        });

        // Sync tools
        await prisma.skillTool.deleteMany({ where: { skillId: existing.id } });
        for (const toolId of SKILL.tools) {
            await prisma.skillTool.create({
                data: { skillId: existing.id, toolId }
            });
        }

        console.log(`  Updated existing skill: ${SKILL_SLUG} (v${existing.version + 1})`);
    } else {
        const skill = await prisma.skill.create({
            data: {
                slug: SKILL.slug,
                name: SKILL.name,
                description: SKILL.description,
                instructions: SKILL.instructions,
                category: SKILL.category,
                tags: SKILL.tags,
                type: "SYSTEM",
                version: 1
            }
        });

        for (const toolId of SKILL.tools) {
            await prisma.skillTool.create({
                data: { skillId: skill.id, toolId }
            });
        }

        console.log(`  Created skill: ${SKILL_SLUG}`);
    }

    console.log("Done.");
    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
