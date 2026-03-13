import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserMembership } from "@/lib/organization";
import { getBlueprint } from "@repo/agentc2/integrations";
import { listMcpToolDefinitions } from "@repo/agentc2/mcp";

/**
 * POST /api/onboarding/bootstrap-agent
 *
 * Creates a starter agent for a new user during onboarding.
 * The agent is configured with:
 * - Memory enabled (working memory + last messages)
 * - Gmail/Slack tools based on connected integrations
 * - Evaluation scorers (relevancy, completeness)
 * - Instructions designed to showcase platform capabilities
 *
 * Body: { connectedIntegrations: string[] }
 * Returns: { success: true, agent: { id, slug, name } }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const membership = await getUserMembership(session.user.id);
        if (!membership) {
            return NextResponse.json(
                { success: false, error: "No organization membership found" },
                { status: 400 }
            );
        }

        // Check if user already has an onboarding agent
        const existingAgent = await prisma.agent.findFirst({
            where: {
                ownerId: session.user.id,
                isOnboardingAgent: true
            }
        });

        if (existingAgent) {
            return NextResponse.json({
                success: true,
                agent: {
                    id: existingAgent.id,
                    slug: existingAgent.slug,
                    name: existingAgent.name
                },
                existing: true
            });
        }

        // Get the default workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                organizationId: membership.organizationId,
                isDefault: true
            }
        });

        // Query database for ALL active integrations
        const activeConnections = await prisma.integrationConnection.findMany({
            where: {
                organizationId: membership.organizationId,
                isActive: true
            },
            include: { provider: true }
        });

        console.log(
            `[Bootstrap Agent] Found ${activeConnections.length} active integrations for org ${membership.organizationId}`
        );

        // Build tool list from ALL active connections
        const tools: string[] = [];
        const skillSlugsToAttach: string[] = [];
        const integrationNames: string[] = [];

        for (const connection of activeConnections) {
            const blueprint = getBlueprint(connection.provider.key);
            if (!blueprint) {
                console.log(
                    `[Bootstrap Agent] No blueprint for ${connection.provider.key}, skipping`
                );
                continue;
            }

            integrationNames.push(connection.provider.name);

            if (blueprint.skill.toolDiscovery === "static" && blueprint.skill.staticTools) {
                tools.push(...blueprint.skill.staticTools);
                console.log(
                    `[Bootstrap Agent] Added ${blueprint.skill.staticTools.length} static tools from ${connection.provider.key}`
                );
            } else if (blueprint.skill.toolDiscovery === "dynamic") {
                try {
                    const { definitions } = await listMcpToolDefinitions(membership.organizationId);
                    const prefix = `${connection.provider.key}_`;
                    const mcpTools = definitions
                        .filter((t) => t.name.startsWith(prefix))
                        .map((t) => t.name);

                    if (mcpTools.length > 0) {
                        tools.push(...mcpTools);
                        console.log(
                            `[Bootstrap Agent] Discovered ${mcpTools.length} MCP tools from ${connection.provider.key}`
                        );
                    }
                } catch (error) {
                    console.error(
                        `[Bootstrap Agent] Failed to discover tools for ${connection.provider.key}:`,
                        error
                    );
                }
            }

            skillSlugsToAttach.push(blueprint.skill.slug);
        }

        // Deduplicate tools
        const uniqueTools = [...new Set(tools)];
        console.log(
            `[Bootstrap Agent] Total tools after deduplication: ${uniqueTools.length} (from ${activeConnections.length} integrations)`
        );

        // Generate a unique slug (scoped to workspace)
        const userName = session.user.name?.split(" ")[0]?.toLowerCase() || "my";
        const baseSlug = `${userName}-assistant`;
        let slug = baseSlug;
        let counter = 1;
        while (
            await prisma.agent.findFirst({
                where: { slug, ...(workspace?.id ? { workspaceId: workspace.id } : {}) }
            })
        ) {
            counter++;
            slug = `${baseSlug}-${counter}`;
        }

        // Build instructions that showcase platform capabilities
        const instructions = buildStarterInstructions(
            session.user.name || "there",
            integrationNames,
            uniqueTools
        );

        // Create the agent
        const agent = await prisma.agent.create({
            data: {
                slug,
                name: `${session.user.name?.split(" ")[0] || "My"}'s Assistant`,
                description:
                    "Your personal AI assistant, auto-created during onboarding with your connected integrations.",
                instructions,
                modelProvider: "openai",
                modelName: "gpt-4o",
                temperature: 0.7,
                maxSteps: 10,
                memoryEnabled: true,
                memoryConfig: {
                    lastMessages: 20,
                    semanticRecall: false,
                    workingMemory: {
                        enabled: true,
                        template: `<user_profile>
  <name></name>
  <role></role>
  <preferences></preferences>
  <connected_tools>${integrationNames.join(", ") || "None yet"}</connected_tools>
  <recent_topics></recent_topics>
</user_profile>`
                    }
                },
                isOnboardingAgent: true,
                isActive: true,
                type: "USER",
                ownerId: session.user.id,
                workspaceId: workspace?.id || "",
                metadata: {
                    createdBy: "onboarding",
                    discoveredIntegrations: integrationNames,
                    toolCount: uniqueTools.length,
                    slack: {
                        displayName: `${session.user.name?.split(" ")[0] || "My"}'s Assistant`,
                        iconEmoji: ":robot_face:"
                    }
                }
            }
        });

        // Create tool associations
        if (uniqueTools.length > 0) {
            await prisma.agentTool.createMany({
                data: uniqueTools.map((toolId) => ({
                    agentId: agent.id,
                    toolId
                })),
                skipDuplicates: true
            });
            console.log(`[Bootstrap Agent] Created ${uniqueTools.length} tool associations`);
        }

        // Attach skills (pinned) — injects skill instructions into system prompt
        if (skillSlugsToAttach.length > 0 && workspace) {
            const skills = await prisma.skill.findMany({
                where: {
                    slug: { in: skillSlugsToAttach },
                    workspaceId: workspace.id
                },
                select: { id: true, slug: true }
            });
            if (skills.length > 0) {
                await prisma.agentSkill.createMany({
                    data: skills.map((skill) => ({
                        agentId: agent.id,
                        skillId: skill.id,
                        pinned: true
                    })),
                    skipDuplicates: true
                });
                console.log(`[Bootstrap Agent] Attached ${skills.length} skills`);
            }
        }

        return NextResponse.json({
            success: true,
            agent: {
                id: agent.id,
                slug: agent.slug,
                name: agent.name
            }
        });
    } catch (error) {
        console.error("[Bootstrap Agent] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create starter agent"
            },
            { status: 500 }
        );
    }
}

/**
 * Build starter agent instructions that demonstrate platform capabilities.
 * The agent is designed to "show, don't tell" — it uses memory, tools visibly,
 * and suggests advanced features organically.
 */
function buildStarterInstructions(
    userName: string,
    integrationNames: string[],
    tools: string[]
): string {
    const hasIntegrations = integrationNames.length > 0;
    const toolsByCategory = categorizeTools(tools);

    const toolInstructions: string[] = [];

    if (toolsByCategory.gmail.length > 0) {
        toolInstructions.push(
            `- You have access to Gmail tools. When the user first interacts with you, proactively offer to summarize their recent unread emails. Use the gmail-search-emails tool visibly so they can see you working. You can also send emails — ALWAYS show a preview and get confirmation before sending (use confirmSend=true only after explicit approval).`
        );
    }

    if (toolsByCategory.calendar.length > 0) {
        toolInstructions.push(
            `- You have access to Google Calendar. You can search events, list upcoming events, get event details, create new events, update existing events, and delete events. Use this to cross-reference meetings with email contacts for richer context. When creating, updating, or deleting events, ALWAYS show a preview first and get user confirmation.`
        );
    }

    if (toolsByCategory.drive.length > 0) {
        toolInstructions.push(
            `- You have access to Google Drive. You can search files, read documents (Docs, Sheets, Slides), and **create new Google Docs**. When producing reports, summaries, or analyses, offer to save them as a Google Doc the user can open immediately.`
        );
    }

    if (toolsByCategory.slack.length > 0) {
        toolInstructions.push(
            `- You have access to Slack tools. You can check channels, send messages, reply to threads, and look up users. Mention this capability when relevant.`
        );
    }

    if (toolsByCategory.crm.length > 0) {
        toolInstructions.push(
            `- You have access to CRM tools (${toolsByCategory.crm.join(", ")}). You can look up contacts, deals, companies, and manage your sales pipeline.`
        );
    }

    if (toolsByCategory.productivity.length > 0) {
        toolInstructions.push(
            `- You have access to productivity tools (${toolsByCategory.productivity.join(", ")}). You can help with project management, task tracking, and documentation.`
        );
    }

    if (toolsByCategory.other.length > 0) {
        toolInstructions.push(
            `- You also have access to: ${toolsByCategory.other.join(", ")}. Use these tools when relevant to help the user accomplish their goals.`
        );
    }

    const firstInteraction: string[] = [];
    if (hasIntegrations) {
        firstInteraction.push(
            `- Mention that you have access to ${integrationNames.slice(0, 3).join(", ")}${integrationNames.length > 3 ? `, and ${integrationNames.length - 3} other integrations` : ""}`
        );
        if (toolsByCategory.gmail.length > 0) {
            firstInteraction.push("- Offer to summarize their latest emails");
        }
        if (toolsByCategory.calendar.length > 0) {
            firstInteraction.push("- Mention you can check their upcoming calendar events");
        }
    } else {
        firstInteraction.push(
            "- Ask what they'd like help with and suggest connecting integrations like Gmail or Slack"
        );
    }

    return `You are ${userName}'s personal AI assistant on the AgentC2 platform.

## Your Core Behaviors

1. **Be helpful and action-oriented** — Don't just answer questions, take action. Use your tools proactively.
2. **Show your work** — When using tools, briefly explain what you're doing so the user can see the platform's capabilities.
3. **Remember context** — Use working memory to remember the user's name, preferences, and recent topics. Update your memory as you learn about them.
4. **Be conversational** — You're a personal assistant, not a chatbot. Be warm, concise, and proactive.

## Tool Usage
${toolInstructions.length > 0 ? toolInstructions.join("\n") : "- No integrations connected yet. Suggest that connecting Gmail, Slack, or other integrations would unlock powerful capabilities."}

## Platform Awareness
You are running on the AgentC2 platform, which offers powerful features:
- **Memory**: You remember context across conversations (you're using this right now)
- **Workflows**: Multi-step automations can be created to handle complex processes
- **Triggers**: Automations can run on schedule, on events, or via webhooks
- **Evaluations**: Your responses are automatically scored for quality

When relevant, naturally mention these capabilities. For example:
- If the user asks about recurring tasks, suggest they could set up a scheduled trigger
- Don't force it — only mention features when genuinely helpful

## First Interaction
On your very first message, warmly greet ${userName} and:
${firstInteraction.join("\n")}
- Briefly note that you'll remember what you discuss for next time

Keep it concise — 2-3 sentences max for the greeting.`;
}

/**
 * Categorize tools by integration type for better instructions.
 */
function categorizeTools(tools: string[]): {
    gmail: string[];
    calendar: string[];
    drive: string[];
    slack: string[];
    crm: string[];
    productivity: string[];
    other: string[];
} {
    const categories = {
        gmail: [] as string[],
        calendar: [] as string[],
        drive: [] as string[],
        slack: [] as string[],
        crm: [] as string[],
        productivity: [] as string[],
        other: [] as string[]
    };

    for (const tool of tools) {
        if (tool.startsWith("gmail-")) {
            categories.gmail.push(tool);
        } else if (tool.startsWith("google-calendar-")) {
            categories.calendar.push(tool);
        } else if (tool.startsWith("google-drive-")) {
            categories.drive.push(tool);
        } else if (tool.includes("slack")) {
            categories.slack.push(tool);
        } else if (tool.includes("hubspot") || tool.includes("salesforce")) {
            categories.crm.push(tool);
        } else if (
            tool.includes("jira") ||
            tool.includes("github") ||
            tool.includes("notion") ||
            tool.includes("asana")
        ) {
            categories.productivity.push(tool);
        } else {
            categories.other.push(tool);
        }
    }

    return categories;
}
