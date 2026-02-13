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
                "gmail-draft-email"
            );
        }
        if (hasSlack) {
            tools.push("slack-post-message", "slack-list-channels", "slack-get-channel-history");
        }

        // Generate a unique slug
        const userName = session.user.name?.split(" ")[0]?.toLowerCase() || "my";
        const baseSlug = `${userName}-assistant`;
        let slug = baseSlug;
        let counter = 1;
        while (await prisma.agent.findUnique({ where: { slug } })) {
            counter++;
            slug = `${baseSlug}-${counter}`;
        }

        // Build instructions that showcase platform capabilities
        const instructions = buildStarterInstructions(
            session.user.name || "there",
            hasGmail,
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
  <connected_tools>${[hasGmail ? "Gmail" : null, hasSlack ? "Slack" : null].filter(Boolean).join(", ") || "None yet"}</connected_tools>
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
function buildStarterInstructions(userName: string, hasGmail: boolean, hasSlack: boolean): string {
    const toolInstructions: string[] = [];

    if (hasGmail) {
        toolInstructions.push(
            `- You have access to Gmail tools. When the user first interacts with you, proactively offer to summarize their recent unread emails. Use the gmail-search-emails tool visibly so they can see you working.`
        );
    }

    if (hasSlack) {
        toolInstructions.push(
            `- You have access to Slack tools. You can check channels and send messages. Mention this capability when relevant.`
        );
    }

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
${hasGmail ? "- Offer to summarize their latest emails" : "- Ask what they'd like help with"}
${hasSlack ? "- Mention you can also check their Slack channels" : ""}
- Briefly note that you'll remember what you discuss for next time

Keep it concise — 2-3 sentences max for the greeting.`;
}
