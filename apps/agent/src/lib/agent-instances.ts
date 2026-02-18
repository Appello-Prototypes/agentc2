/**
 * Agent Instance Resolution & Management
 *
 * Provides lookup, caching, and CRUD utilities for AgentInstance and
 * InstanceChannelBinding. These primitives enable a single agent template
 * to operate as isolated, context-aware instances across communication
 * channels (Slack, email, WhatsApp, web, voice).
 */

import { prisma, type Prisma } from "@repo/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentInstanceWithBindings = Prisma.AgentInstanceGetPayload<{
    include: {
        channelBindings: true;
        agent: { select: { id: true; slug: true; name: true } };
    };
}>;

export type ChannelBinding = Prisma.InstanceChannelBindingGetPayload<{
    include: {
        instance: {
            include: {
                agent: { select: { id: true; slug: true; name: true } };
            };
        };
    };
}>;

export interface InstanceContext {
    instanceId: string;
    instanceName: string;
    instanceSlug: string;
    agentId: string;
    agentSlug: string;
    organizationId: string;
    contextType: string | null;
    contextId: string | null;
    contextData: Record<string, unknown> | null;
    instructionOverrides: string | null;
    memoryNamespace: string;
    ragCollectionId: string | null;
    temperatureOverride: number | null;
    maxStepsOverride: number | null;
    // Channel-specific overrides from the binding
    replyMode: string | null;
    responseLength: string | null;
    richFormatting: boolean | null;
    triggerOnAllMessages: boolean;
    triggerKeywords: string[];
    triggerOnFileUpload: boolean;
    allowedUserIds: string[];
    blockedUserIds: string[];
}

// ---------------------------------------------------------------------------
// In-memory cache for binding lookups (avoids DB hit on every Slack message)
// ---------------------------------------------------------------------------

interface CachedBinding {
    context: InstanceContext | null;
    cachedAt: number;
}

const bindingCache = new Map<string, CachedBinding>();
const CACHE_TTL_MS = 60_000; // 1 minute

function cacheKey(channelType: string, channelIdentifier: string): string {
    return `${channelType}:${channelIdentifier}`;
}

export function invalidateBindingCache(channelType?: string, channelIdentifier?: string): void {
    if (channelType && channelIdentifier) {
        bindingCache.delete(cacheKey(channelType, channelIdentifier));
    } else {
        bindingCache.clear();
    }
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * Look up an InstanceChannelBinding by channel type + identifier.
 * Returns the full InstanceContext needed for agent resolution, or null if
 * no binding exists for this channel.
 *
 * Results are cached in-memory for CACHE_TTL_MS to avoid per-message DB hits.
 */
export async function lookupChannelBinding(
    channelType: string,
    channelIdentifier: string
): Promise<InstanceContext | null> {
    const key = cacheKey(channelType, channelIdentifier);

    const cached = bindingCache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.context;
    }

    const binding = await prisma.instanceChannelBinding.findUnique({
        where: {
            channelType_channelIdentifier: {
                channelType,
                channelIdentifier
            }
        },
        include: {
            instance: {
                include: {
                    agent: { select: { id: true, slug: true, name: true } }
                }
            }
        }
    });

    if (!binding || !binding.isActive || !binding.instance.isActive) {
        bindingCache.set(key, { context: null, cachedAt: Date.now() });
        return null;
    }

    const inst = binding.instance;
    const contextData =
        inst.contextData && typeof inst.contextData === "object"
            ? (inst.contextData as Record<string, unknown>)
            : null;

    const context: InstanceContext = {
        instanceId: inst.id,
        instanceName: inst.name,
        instanceSlug: inst.slug,
        agentId: inst.agent.id,
        agentSlug: inst.agent.slug,
        organizationId: inst.organizationId,
        contextType: inst.contextType,
        contextId: inst.contextId,
        contextData,
        instructionOverrides: inst.instructionOverrides,
        memoryNamespace: inst.memoryNamespace,
        ragCollectionId: inst.ragCollectionId,
        temperatureOverride: inst.temperatureOverride,
        maxStepsOverride: inst.maxStepsOverride,
        replyMode: binding.replyMode,
        responseLength: binding.responseLength,
        richFormatting: binding.richFormatting,
        triggerOnAllMessages: binding.triggerOnAllMessages,
        triggerKeywords: binding.triggerKeywords,
        triggerOnFileUpload: binding.triggerOnFileUpload,
        allowedUserIds: binding.allowedUserIds,
        blockedUserIds: binding.blockedUserIds
    };

    bindingCache.set(key, { context, cachedAt: Date.now() });
    return context;
}

// ---------------------------------------------------------------------------
// CRUD — Instances
// ---------------------------------------------------------------------------

export async function createInstance(data: {
    agentId: string;
    organizationId: string;
    name: string;
    slug: string;
    contextType?: string;
    contextId?: string;
    contextData?: Record<string, unknown>;
    instructionOverrides?: string;
    ragCollectionId?: string;
    temperatureOverride?: number;
    maxStepsOverride?: number;
    metadata?: Record<string, unknown>;
    createdBy?: string;
}): Promise<AgentInstanceWithBindings> {
    const memoryNamespace = `instance-${data.slug}-${Date.now().toString(36)}`;

    return prisma.agentInstance.create({
        data: {
            agentId: data.agentId,
            organizationId: data.organizationId,
            name: data.name,
            slug: data.slug,
            contextType: data.contextType,
            contextId: data.contextId,
            contextData: (data.contextData as Prisma.InputJsonValue) ?? undefined,
            instructionOverrides: data.instructionOverrides,
            memoryNamespace,
            ragCollectionId: data.ragCollectionId,
            temperatureOverride: data.temperatureOverride,
            maxStepsOverride: data.maxStepsOverride,
            metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
            createdBy: data.createdBy
        },
        include: {
            channelBindings: true,
            agent: { select: { id: true, slug: true, name: true } }
        }
    });
}

export async function updateInstance(
    id: string,
    data: {
        name?: string;
        contextType?: string | null;
        contextId?: string | null;
        contextData?: Record<string, unknown> | null;
        contextRefreshAt?: Date | null;
        instructionOverrides?: string | null;
        ragCollectionId?: string | null;
        temperatureOverride?: number | null;
        maxStepsOverride?: number | null;
        metadata?: Record<string, unknown> | null;
        isActive?: boolean;
    }
): Promise<AgentInstanceWithBindings> {
    invalidateBindingCache();

    const updateData: Prisma.AgentInstanceUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.contextType !== undefined) updateData.contextType = data.contextType;
    if (data.contextId !== undefined) updateData.contextId = data.contextId;
    if (data.contextData !== undefined)
        updateData.contextData = (data.contextData as Prisma.InputJsonValue) ?? undefined;
    if (data.contextRefreshAt !== undefined) updateData.contextRefreshAt = data.contextRefreshAt;
    if (data.instructionOverrides !== undefined)
        updateData.instructionOverrides = data.instructionOverrides;
    if (data.ragCollectionId !== undefined) updateData.ragCollectionId = data.ragCollectionId;
    if (data.temperatureOverride !== undefined)
        updateData.temperatureOverride = data.temperatureOverride;
    if (data.maxStepsOverride !== undefined) updateData.maxStepsOverride = data.maxStepsOverride;
    if (data.metadata !== undefined)
        updateData.metadata = (data.metadata as Prisma.InputJsonValue) ?? undefined;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.agentInstance.update({
        where: { id },
        data: updateData,
        include: {
            channelBindings: true,
            agent: { select: { id: true, slug: true, name: true } }
        }
    });
}

export async function deleteInstance(id: string): Promise<void> {
    invalidateBindingCache();
    await prisma.agentInstance.delete({ where: { id } });
}

export async function listInstances(
    organizationId: string,
    options?: { agentId?: string; contextType?: string; isActive?: boolean }
): Promise<AgentInstanceWithBindings[]> {
    return prisma.agentInstance.findMany({
        where: {
            organizationId,
            ...(options?.agentId ? { agentId: options.agentId } : {}),
            ...(options?.contextType ? { contextType: options.contextType } : {}),
            ...(options?.isActive !== undefined ? { isActive: options.isActive } : {})
        },
        include: {
            channelBindings: true,
            agent: { select: { id: true, slug: true, name: true } }
        },
        orderBy: { updatedAt: "desc" }
    });
}

export async function getInstance(id: string): Promise<AgentInstanceWithBindings | null> {
    return prisma.agentInstance.findUnique({
        where: { id },
        include: {
            channelBindings: true,
            agent: { select: { id: true, slug: true, name: true } }
        }
    });
}

// ---------------------------------------------------------------------------
// CRUD — Channel Bindings
// ---------------------------------------------------------------------------

export async function addChannelBinding(data: {
    instanceId: string;
    channelType: string;
    channelIdentifier: string;
    channelName?: string;
    channelMetadata?: Record<string, unknown>;
    replyMode?: string;
    responseLength?: string;
    richFormatting?: boolean;
    triggerOnAllMessages?: boolean;
    triggerKeywords?: string[];
    triggerOnFileUpload?: boolean;
    allowedUserIds?: string[];
    blockedUserIds?: string[];
}) {
    invalidateBindingCache(data.channelType, data.channelIdentifier);

    return prisma.instanceChannelBinding.create({
        data: {
            instanceId: data.instanceId,
            channelType: data.channelType,
            channelIdentifier: data.channelIdentifier,
            channelName: data.channelName,
            channelMetadata: (data.channelMetadata as Prisma.InputJsonValue) ?? undefined,
            replyMode: data.replyMode,
            responseLength: data.responseLength,
            richFormatting: data.richFormatting,
            triggerOnAllMessages: data.triggerOnAllMessages,
            triggerKeywords: data.triggerKeywords,
            triggerOnFileUpload: data.triggerOnFileUpload,
            allowedUserIds: data.allowedUserIds,
            blockedUserIds: data.blockedUserIds
        },
        include: {
            instance: {
                include: {
                    agent: { select: { id: true, slug: true, name: true } }
                }
            }
        }
    });
}

export async function updateChannelBinding(
    id: string,
    data: {
        channelName?: string;
        channelMetadata?: Record<string, unknown> | null;
        replyMode?: string | null;
        responseLength?: string | null;
        richFormatting?: boolean | null;
        triggerOnAllMessages?: boolean;
        triggerKeywords?: string[];
        triggerOnFileUpload?: boolean;
        allowedUserIds?: string[];
        blockedUserIds?: string[];
        isActive?: boolean;
    }
) {
    invalidateBindingCache();

    const bindingUpdate: Prisma.InstanceChannelBindingUpdateInput = {
        ...(data.channelName !== undefined ? { channelName: data.channelName } : {}),
        ...(data.channelMetadata !== undefined
            ? {
                  channelMetadata:
                      (data.channelMetadata as Prisma.InputJsonValue) ?? undefined
              }
            : {}),
        ...(data.replyMode !== undefined ? { replyMode: data.replyMode } : {}),
        ...(data.responseLength !== undefined ? { responseLength: data.responseLength } : {}),
        ...(data.richFormatting !== undefined ? { richFormatting: data.richFormatting } : {}),
        ...(data.triggerOnAllMessages !== undefined
            ? { triggerOnAllMessages: data.triggerOnAllMessages }
            : {}),
        ...(data.triggerKeywords !== undefined ? { triggerKeywords: data.triggerKeywords } : {}),
        ...(data.triggerOnFileUpload !== undefined
            ? { triggerOnFileUpload: data.triggerOnFileUpload }
            : {}),
        ...(data.allowedUserIds !== undefined ? { allowedUserIds: data.allowedUserIds } : {}),
        ...(data.blockedUserIds !== undefined ? { blockedUserIds: data.blockedUserIds } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
    };

    return prisma.instanceChannelBinding.update({
        where: { id },
        data: bindingUpdate
    });
}

export async function removeChannelBinding(id: string): Promise<void> {
    invalidateBindingCache();
    await prisma.instanceChannelBinding.delete({ where: { id } });
}

/**
 * Check if a message should trigger the agent based on binding trigger rules.
 */
export function shouldTrigger(
    binding: InstanceContext,
    messageText: string,
    isMention: boolean,
    isFileUpload: boolean
): boolean {
    if (isMention) return true;
    if (binding.triggerOnAllMessages) return true;
    if (isFileUpload && binding.triggerOnFileUpload) return true;

    if (binding.triggerKeywords.length > 0) {
        const lower = messageText.toLowerCase();
        return binding.triggerKeywords.some((kw) => lower.includes(kw.toLowerCase()));
    }

    return false;
}

/**
 * Check if a user is allowed to interact with this instance via the binding.
 */
export function isUserAllowed(binding: InstanceContext, userId: string): boolean {
    if (binding.blockedUserIds.length > 0 && binding.blockedUserIds.includes(userId)) {
        return false;
    }
    if (binding.allowedUserIds.length > 0 && !binding.allowedUserIds.includes(userId)) {
        return false;
    }
    return true;
}
