import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserMembership } from "@/lib/organization";

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

        const body = await request.json().catch(() => ({}));
        const connectedIntegrations: string[] = Array.isArray(body?.connectedIntegrations)
            ? body.connectedIntegrations.filter((v: unknown) => typeof v === "string")
            : [];

        const hasGmail = connectedIntegrations.includes("gmail");
        const hasCalendar = connectedIntegrations.includes("calendar");
        const hasDrive = connectedIntegrations.includes("drive");
        const hasSlack = connectedIntegrations.includes("slack");

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

        // Build tool list based on connections
        const tools: string[] = [];
        if (hasGmail) {
            tools.push(
                "gmail-search-emails",
                "gmail-read-email",
                "gmail-send-email",
                "gmail-draft-email",
                "gmail-archive-email"
            );
        }
        if (hasCalendar) {
            tools.push(
                "google-calendar-search-events",
                "google-calendar-list-events",
                "google-calendar-get-event",
                "google-calendar-create-event",
                "google-calendar-update-event",
                "google-calendar-delete-event"
            );
        }
        if (hasDrive) {
            tools.push(
                "google-drive-search-files",
                "google-drive-read-file",
                "google-drive-create-doc"
            );
        }
        if (hasSlack) {
            // Slack tools are MCP-based — use the correct MCP tool IDs
            tools.push(
                "slack_slack_post_message",
                "slack_slack_list_channels",
                "slack_slack_get_channel_history",
                "slack_slack_reply_to_thread",
                "slack_slack_get_users"
            );
        }

        // Collect skill slugs to attach (pinned)
        const skillSlugsToAttach: string[] = [];
        if (hasGmail || hasCalendar) {
            skillSlugsToAttach.push("email-management");
        }
        if (hasDrive) {
            skillSlugsToAttach.push("google-drive-files");
        }
        if (hasSlack) {
            skillSlugsToAttach.push("mcp-communication-slack");
        }

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
            hasGmail,
            hasCalendar,
            hasDrive,
            hasSlack
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
  <connected_tools>${[hasGmail ? "Gmail" : null, hasCalendar ? "Calendar" : null, hasDrive ? "Drive" : null, hasSlack ? "Slack" : null].filter(Boolean).join(", ") || "None yet"}</connected_tools>
  <recent_topics></recent_topics>
</user_profile>`
                    }
                },
                scorers: ["relevancy", "completeness"],
                isOnboardingAgent: true,
                isActive: true,
                type: "USER",
                ownerId: session.user.id,
                workspaceId: workspace?.id || undefined,
                metadata: {
                    createdBy: "onboarding",
                    connectedIntegrations,
                    slack: {
                        displayName: `${session.user.name?.split(" ")[0] || "My"}'s Assistant`,
                        iconEmoji: ":robot_face:"
                    }
                }
            }
        });

        // Create tool associations
        if (tools.length > 0) {
            await prisma.agentTool.createMany({
                data: tools.map((toolId) => ({
                    agentId: agent.id,
                    toolId
                })),
                skipDuplicates: true
            });
        }

        // Attach skills (pinned) — injects skill instructions into system prompt
        if (skillSlugsToAttach.length > 0) {
            const skills = await prisma.skill.findMany({
                where: { slug: { in: skillSlugsToAttach } },
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
    hasGmail: boolean,
    hasCalendar: boolean,
    hasDrive: boolean,
    hasSlack: boolean
): string {
    const toolInstructions: string[] = [];

    if (hasGmail) {
        toolInstructions.push(
            `- You have access to Gmail tools. When the user first interacts with you, proactively offer to summarize their recent unread emails. Use the gmail-search-emails tool visibly so they can see you working. You can also send emails — ALWAYS show a preview and get confirmation before sending (use confirmSend=true only after explicit approval).`
        );
    }

    if (hasCalendar) {
        toolInstructions.push(
            `- You have access to Google Calendar. You can search events, list upcoming events, get event details, create new events, update existing events, and delete events. Use this to cross-reference meetings with email contacts for richer context. When creating, updating, or deleting events, ALWAYS show a preview first and get user confirmation.`
        );
    }

    if (hasDrive) {
        toolInstructions.push(
            `- You have access to Google Drive. You can search files, read documents (Docs, Sheets, Slides), and **create new Google Docs**. When producing reports, summaries, or analyses, offer to save them as a Google Doc the user can open immediately.`
        );
    }

    if (hasSlack) {
        toolInstructions.push(
            `- You have access to Slack tools. You can check channels, send messages, reply to threads, and look up users. Mention this capability when relevant.`
        );
    }

    // Build first-interaction bullets
    const firstInteraction: string[] = [];
    if (hasGmail) firstInteraction.push("- Offer to summarize their latest emails");
    if (hasCalendar)
        firstInteraction.push("- Mention you can check their upcoming calendar events");
    if (hasDrive) firstInteraction.push("- Note you can search their Drive and create Google Docs");
    if (hasSlack) firstInteraction.push("- Mention you can also check their Slack channels");
    if (firstInteraction.length === 0) firstInteraction.push("- Ask what they'd like help with");

    return `You are ${userName}'s personal AI assistant on the AgentC2 platform.

## Your Core Behaviors

1. **Be helpful and action-oriented** — Don't just answer questions, take action. Use your tools proactively.
2. **Show your work** — When using tools, briefly explain what you're doing so the user can see the platform's capabilities.
3. **Remember context** — Use working memory to remember the user's name, preferences, and recent topics. Update your memory as you learn about them.
4. **Be conversational** — You're a personal assistant, not a chatbot. Be warm, concise, and proactive.

## Tool Usage
${toolInstructions.length > 0 ? toolInstructions.join("\n") : "- No integrations connected yet. Suggest that connecting Gmail or Slack would unlock powerful capabilities."}

## Platform Awareness
You are running on the AgentC2 platform, which offers powerful features:
- **Memory**: You remember context across conversations (you're using this right now)
- **Workflows**: Multi-step automations can be created to handle complex processes
- **Canvas Dashboards**: Interactive dashboards can be generated from data
- **Triggers**: Automations can run on schedule, on events, or via webhooks
- **Evaluations**: Your responses are automatically scored for quality

When relevant, naturally mention these capabilities. For example:
- If the user asks about recurring tasks, suggest they could set up a scheduled trigger
- If they're looking at data, mention that a Canvas dashboard could visualize it
- Don't force it — only mention features when genuinely helpful

## First Interaction
On your very first message, warmly greet ${userName} and:
${firstInteraction.join("\n")}
- Briefly note that you'll remember what you discuss for next time

Keep it concise — 2-3 sentences max for the greeting.`;
}
