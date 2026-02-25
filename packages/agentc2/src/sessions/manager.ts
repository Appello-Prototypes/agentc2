import { prisma } from "@repo/database";
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { storage } from "../storage";
import { vector } from "../vector";

// ── Types ──

export interface CreateSessionOptions {
    workspaceId?: string;
    organizationId?: string;
    initiatorType: "agent" | "network" | "user";
    initiatorId: string;
    agentSlugs: string[];
    orchestratorSlug?: string;
    name?: string;
    description?: string;
    scratchpadTemplate?: string;
    maxPeerCalls?: number;
    maxDepth?: number;
}

export interface SessionInfo {
    id: string;
    name: string | null;
    status: string;
    memoryResourceId: string;
    memoryThreadId: string;
    maxPeerCalls: number;
    maxDepth: number;
    peerCallCount: number;
    participants: Array<{
        agentSlug: string;
        role: string;
        invocationCount: number;
    }>;
}

// ── Helpers ──

function buildSessionResourceId(organizationId: string | undefined, sessionId: string): string {
    const base = `session-${sessionId}`;
    return organizationId ? `${organizationId}:${base}` : base;
}

function buildSessionThreadId(organizationId: string | undefined, sessionId: string): string {
    const base = `session-${sessionId}-main`;
    return organizationId ? `${organizationId}:${base}` : base;
}

function getSessionMemory(): Memory {
    return new Memory({
        storage,
        vector,
        embedder: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
        options: {
            lastMessages: 20,
            workingMemory: { enabled: true },
            semanticRecall: { topK: 5, messageRange: 2, scope: "resource" as const }
        }
    });
}

const SCRATCHPAD_MEMORY_CONFIG = {
    lastMessages: 20,
    workingMemory: { enabled: true }
};

// ── Session lifecycle ──

export async function createSession(options: CreateSessionOptions): Promise<SessionInfo> {
    const sessionId = generateId();
    const memoryResourceId = buildSessionResourceId(options.organizationId, sessionId);
    const memoryThreadId = buildSessionThreadId(options.organizationId, sessionId);

    const scratchpadTemplate =
        options.scratchpadTemplate ||
        `# Session Scratchpad
- **Task**: (pending)
- **Status**: active
- **Findings**:
- **Decisions**:
- **Open Questions**:`;

    const session = await prisma.agentSession.create({
        data: {
            id: sessionId,
            workspaceId: options.workspaceId || null,
            name: options.name || null,
            description: options.description || null,
            initiatorType: options.initiatorType,
            initiatorId: options.initiatorId,
            memoryResourceId,
            memoryThreadId,
            scratchpadTemplate,
            maxPeerCalls: options.maxPeerCalls ?? 20,
            maxDepth: options.maxDepth ?? 5,
            participants: {
                create: options.agentSlugs.map((slug) => ({
                    agentSlug: slug,
                    role: slug === options.orchestratorSlug ? "orchestrator" : "participant"
                }))
            }
        },
        include: { participants: true }
    });

    return {
        id: session.id,
        name: session.name,
        status: session.status,
        memoryResourceId: session.memoryResourceId,
        memoryThreadId: session.memoryThreadId,
        maxPeerCalls: session.maxPeerCalls,
        maxDepth: session.maxDepth,
        peerCallCount: session.peerCallCount,
        participants: session.participants.map((p) => ({
            agentSlug: p.agentSlug,
            role: p.role,
            invocationCount: p.invocationCount
        }))
    };
}

export async function getSession(sessionId: string): Promise<SessionInfo | null> {
    const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        include: { participants: true }
    });
    if (!session) return null;

    return {
        id: session.id,
        name: session.name,
        status: session.status,
        memoryResourceId: session.memoryResourceId,
        memoryThreadId: session.memoryThreadId,
        maxPeerCalls: session.maxPeerCalls,
        maxDepth: session.maxDepth,
        peerCallCount: session.peerCallCount,
        participants: session.participants.map((p) => ({
            agentSlug: p.agentSlug,
            role: p.role,
            invocationCount: p.invocationCount
        }))
    };
}

export async function readScratchpad(sessionId: string): Promise<string | null> {
    const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        select: { memoryResourceId: true, memoryThreadId: true, scratchpadTemplate: true }
    });
    if (!session) return null;

    try {
        const mem = getSessionMemory();
        const workingMemory = await mem.getWorkingMemory({
            threadId: session.memoryThreadId,
            resourceId: session.memoryResourceId,
            memoryConfig: SCRATCHPAD_MEMORY_CONFIG
        });

        return workingMemory || session.scratchpadTemplate || null;
    } catch {
        return session.scratchpadTemplate || null;
    }
}

export async function writeScratchpad(
    sessionId: string,
    content: string,
    mode: "append" | "replace" = "replace"
): Promise<void> {
    const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        select: { memoryResourceId: true, memoryThreadId: true }
    });
    if (!session) throw new Error(`Session "${sessionId}" not found`);

    const mem = getSessionMemory();

    let newContent = content;
    if (mode === "append") {
        const existing = await readScratchpad(sessionId);
        const timestamp = new Date().toISOString();
        newContent = existing ? `${existing}\n\n---\n[${timestamp}]\n${content}` : content;
    }

    await mem.updateWorkingMemory({
        threadId: session.memoryThreadId,
        resourceId: session.memoryResourceId,
        workingMemory: newContent,
        memoryConfig: SCRATCHPAD_MEMORY_CONFIG
    });
}

/**
 * Atomically increment the peer call counter and check if the limit is exceeded.
 */
export async function recordPeerCall(
    sessionId: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
    const session = await prisma.agentSession.update({
        where: { id: sessionId },
        data: { peerCallCount: { increment: 1 } },
        select: { peerCallCount: true, maxPeerCalls: true }
    });

    return {
        allowed: session.peerCallCount <= session.maxPeerCalls,
        count: session.peerCallCount,
        limit: session.maxPeerCalls
    };
}

/**
 * Record that a specific participant was invoked (for stats tracking).
 */
export async function recordParticipantInvocation(
    sessionId: string,
    agentSlug: string,
    tokensUsed?: number
): Promise<void> {
    await prisma.sessionParticipant.updateMany({
        where: { sessionId, agentSlug },
        data: {
            invocationCount: { increment: 1 },
            ...(tokensUsed ? { tokensUsed: { increment: tokensUsed } } : {})
        }
    });
}

export async function completeSession(
    sessionId: string,
    status: "completed" | "failed" | "cancelled" = "completed"
): Promise<void> {
    const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        select: { createdAt: true }
    });

    const durationMs = session ? Date.now() - session.createdAt.getTime() : undefined;

    await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
            status,
            completedAt: new Date(),
            durationMs: durationMs ?? null
        }
    });
}

function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
