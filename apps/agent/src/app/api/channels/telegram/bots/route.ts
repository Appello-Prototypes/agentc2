/**
 * Telegram Bot Management API
 *
 * GET  /api/channels/telegram/bots  - List all Telegram bot connections for the org
 * POST /api/channels/telegram/bots  - Create a new bot connection with agent/instance binding
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, type Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { encryptCredentials } from "@/lib/credential-crypto";
import { decryptCredentials } from "@/lib/credential-crypto";
import { createInstance, addChannelBinding } from "@/lib/agent-instances";

// -----------------------------------------------------------------------
// GET - List bots
// -----------------------------------------------------------------------

export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const connections = await prisma.integrationConnection.findMany({
            where: {
                organizationId: authContext.organizationId,
                provider: { key: "telegram-bot" },
                isActive: true
            },
            include: { provider: true },
            orderBy: { createdAt: "desc" }
        });

        const bots = await Promise.all(
            connections.map(async (conn) => {
                const metadata = (conn.metadata ?? {}) as Record<string, unknown>;
                const botUsername = (metadata.botUsername as string) || null;
                const botId = (metadata.botId as number) || null;
                const agentSlug = (metadata.agentSlug as string) || null;
                const instanceId = (metadata.instanceId as string) || null;

                let instance = null;
                if (instanceId) {
                    instance = await prisma.agentInstance.findUnique({
                        where: { id: instanceId },
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            isActive: true,
                            agent: {
                                select: {
                                    id: true,
                                    slug: true,
                                    name: true
                                }
                            }
                        }
                    });
                }

                let agent = null;
                if (agentSlug && !instanceId) {
                    agent = await prisma.agent.findFirst({
                        where: {
                            slug: agentSlug,
                            isActive: true
                        },
                        select: {
                            id: true,
                            slug: true,
                            name: true
                        }
                    });
                }

                return {
                    id: conn.id,
                    name: conn.name,
                    botUsername,
                    botId,
                    agentSlug,
                    instanceId,
                    instance,
                    agent: instance?.agent ?? agent,
                    webhookPath: conn.webhookPath,
                    isDefault: conn.isDefault,
                    createdAt: conn.createdAt,
                    updatedAt: conn.updatedAt
                };
            })
        );

        return NextResponse.json({ success: true, bots });
    } catch (error) {
        console.error("[TelegramBots] List error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list bots"
            },
            { status: 500 }
        );
    }
}

// -----------------------------------------------------------------------
// POST - Create bot
// -----------------------------------------------------------------------

interface CreateBotBody {
    botToken: string;
    webhookSecret?: string;
    bindingType: "agent" | "instance";
    agentSlug?: string;
    instanceId?: string;
    createInstance?: {
        agentId: string;
        name: string;
        slug: string;
        instructionOverrides?: string;
        contextType?: string;
        contextId?: string;
        metadata?: Record<string, unknown>;
    };
}

export async function POST(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = (await request.json()) as CreateBotBody;

        if (!body.botToken) {
            return NextResponse.json(
                {
                    success: false,
                    error: "botToken is required"
                },
                { status: 400 }
            );
        }

        // 1. Validate the bot token with Telegram
        const getMeRes = await fetch(`https://api.telegram.org/bot${body.botToken}/getMe`);
        const getMeData = await getMeRes.json();
        if (!getMeRes.ok || !getMeData.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid bot token. Telegram rejected it.",
                    details: getMeData
                },
                { status: 400 }
            );
        }

        const botInfo = getMeData.result;
        const botUsername = botInfo.username;
        const botId = botInfo.id;

        // 2. Resolve agent/instance binding
        let resolvedAgentSlug: string | undefined = body.agentSlug;
        let resolvedInstanceId: string | undefined = body.instanceId;

        // Create instance inline if requested
        if (body.createInstance) {
            const ci = body.createInstance;
            const agent = await prisma.agent.findFirst({
                where: {
                    id: ci.agentId,
                    workspace: {
                        organizationId: authContext.organizationId
                    }
                },
                select: { id: true, slug: true }
            });
            if (!agent) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Agent not found in your organization"
                    },
                    { status: 404 }
                );
            }

            const instance = await createInstance({
                agentId: ci.agentId,
                organizationId: authContext.organizationId,
                name: ci.name,
                slug: ci.slug,
                instructionOverrides: ci.instructionOverrides,
                contextType: ci.contextType,
                contextId: ci.contextId,
                metadata: ci.metadata,
                createdBy: authContext.userId
            });

            resolvedInstanceId = instance.id;
            resolvedAgentSlug = agent.slug;
        }

        if (!resolvedAgentSlug && !resolvedInstanceId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Either agentSlug, instanceId, or createInstance is required"
                },
                { status: 400 }
            );
        }

        // 3. Ensure the telegram-bot provider exists
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "telegram-bot" }
        });
        if (!provider) {
            return NextResponse.json(
                {
                    success: false,
                    error: "telegram-bot provider not found. Run db:seed or sync providers."
                },
                { status: 500 }
            );
        }

        // 4. Create IntegrationConnection
        const credentials: Record<string, string> = {
            TELEGRAM_BOT_TOKEN: body.botToken
        };
        if (body.webhookSecret) {
            credentials.TELEGRAM_WEBHOOK_SECRET = body.webhookSecret;
        }
        if (resolvedAgentSlug) {
            credentials.TELEGRAM_DEFAULT_AGENT_SLUG = resolvedAgentSlug;
        }

        const connectionMetadata: Record<string, unknown> = {
            botUsername,
            botId,
            ...(resolvedAgentSlug ? { agentSlug: resolvedAgentSlug } : {}),
            ...(resolvedInstanceId ? { instanceId: resolvedInstanceId } : {})
        };

        const encryptedCreds = encryptCredentials(credentials as Record<string, unknown>);

        const connection = await prisma.integrationConnection.create({
            data: {
                providerId: provider.id,
                organizationId: authContext.organizationId,
                scope: "org",
                name: `@${botUsername}`,
                isDefault: false,
                isActive: true,
                credentials: encryptedCreds
                    ? JSON.parse(JSON.stringify(encryptedCreds))
                    : undefined,
                metadata: connectionMetadata as Prisma.InputJsonValue
            }
        });

        // 5. Create InstanceChannelBinding if we have an instance
        let binding = null;
        if (resolvedInstanceId) {
            try {
                binding = await addChannelBinding({
                    instanceId: resolvedInstanceId,
                    channelType: "telegram",
                    channelIdentifier: `bot:${botUsername}`,
                    channelName: `@${botUsername}`,
                    channelMetadata: {
                        connectionId: connection.id,
                        botId
                    },
                    triggerOnAllMessages: true
                });
            } catch (e) {
                console.warn(
                    "[TelegramBots] Failed to create channel binding (may already exist):",
                    e
                );
            }
        }

        // 6. Build webhook URL and register with Telegram
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.DEPLOY_DOMAIN;
        const webhookUrl = baseUrl
            ? `${baseUrl.replace(/\/$/, "")}/api/channels/telegram/webhook/${connection.id}`
            : null;

        let webhookRegistered = false;
        if (webhookUrl) {
            const setWebhookParams: Record<string, string> = {
                url: webhookUrl
            };
            if (body.webhookSecret) {
                setWebhookParams.secret_token = body.webhookSecret;
            }

            const webhookRes = await fetch(
                `https://api.telegram.org/bot${body.botToken}/setWebhook`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(setWebhookParams)
                }
            );
            const webhookData = await webhookRes.json();
            webhookRegistered = webhookData.ok === true;

            if (webhookRegistered) {
                await prisma.integrationConnection.update({
                    where: { id: connection.id },
                    data: {
                        webhookPath: `/api/channels/telegram/webhook/${connection.id}`
                    }
                });
            }

            console.log(
                `[TelegramBots] Webhook registration for @${botUsername}: ${webhookRegistered ? "success" : "failed"}`,
                webhookRegistered ? webhookUrl : webhookData
            );
        }

        return NextResponse.json(
            {
                success: true,
                bot: {
                    connectionId: connection.id,
                    botUsername,
                    botId,
                    botFirstName: botInfo.first_name,
                    agentSlug: resolvedAgentSlug,
                    instanceId: resolvedInstanceId,
                    webhookUrl,
                    webhookRegistered,
                    binding: binding ? { id: binding.id } : null
                }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[TelegramBots] Create error:", error);
        if (error instanceof Error && error.message.includes("Unique constraint failed")) {
            return NextResponse.json(
                {
                    success: false,
                    error: "A connection for this bot may already exist, or the instance slug is taken."
                },
                { status: 409 }
            );
        }
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create bot"
            },
            { status: 500 }
        );
    }
}
