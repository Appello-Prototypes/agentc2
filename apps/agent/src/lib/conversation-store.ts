/**
 * Conversation Store
 *
 * localStorage-based conversation persistence for the CoWork chat interface.
 * Stores conversation metadata and messages locally (not synced to server).
 * Cap at 50 conversations with LRU eviction.
 */

const STORAGE_KEY = "cowork-conversations";
const META_KEY = "cowork-conversation-meta";
const MAX_CONVERSATIONS = 50;

export interface ConversationMeta {
    id: string; // Same as threadId
    title: string; // Auto-generated from first user message
    agentSlug: string;
    agentName: string;
    modelName?: string;
    messageCount: number;
    createdAt: string; // ISO
    updatedAt: string; // ISO
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SerializedMessage = any;

/**
 * Get all conversation metadata, sorted by updatedAt descending
 */
export function listConversations(): ConversationMeta[] {
    try {
        const raw = localStorage.getItem(META_KEY);
        if (!raw) return [];
        const metas: ConversationMeta[] = JSON.parse(raw);
        return metas.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    } catch {
        return [];
    }
}

/**
 * Save or update a conversation
 */
export function saveConversation(meta: ConversationMeta, messages: SerializedMessage[]): void {
    try {
        // Save messages
        localStorage.setItem(`${STORAGE_KEY}:${meta.id}`, JSON.stringify(messages));

        // Update metadata
        const metas = listConversations();
        const existingIndex = metas.findIndex((m) => m.id === meta.id);

        if (existingIndex >= 0) {
            metas[existingIndex] = meta;
        } else {
            metas.unshift(meta);
        }

        // LRU eviction
        while (metas.length > MAX_CONVERSATIONS) {
            const removed = metas.pop();
            if (removed) {
                localStorage.removeItem(`${STORAGE_KEY}:${removed.id}`);
            }
        }

        localStorage.setItem(META_KEY, JSON.stringify(metas));
    } catch {
        // localStorage full or unavailable
    }
}

/**
 * Load a conversation's messages
 */
export function loadConversation(id: string): {
    meta: ConversationMeta | null;
    messages: SerializedMessage[];
} {
    try {
        const metas = listConversations();
        const meta = metas.find((m) => m.id === id) || null;
        const raw = localStorage.getItem(`${STORAGE_KEY}:${id}`);
        const messages = raw ? JSON.parse(raw) : [];
        return { meta, messages };
    } catch {
        return { meta: null, messages: [] };
    }
}

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): void {
    try {
        localStorage.removeItem(`${STORAGE_KEY}:${id}`);
        const metas = listConversations().filter((m) => m.id !== id);
        localStorage.setItem(META_KEY, JSON.stringify(metas));
    } catch {
        // ignore
    }
}

/**
 * Update a conversation's title
 */
export function updateConversationTitle(id: string, title: string): void {
    try {
        const metas = listConversations();
        const meta = metas.find((m) => m.id === id);
        if (meta) {
            meta.title = title;
            localStorage.setItem(META_KEY, JSON.stringify(metas));
        }
    } catch {
        // ignore
    }
}

/**
 * Search conversations by title (case-insensitive)
 */
export function searchConversations(query: string): ConversationMeta[] {
    const lower = query.toLowerCase();
    return listConversations().filter((m) => m.title.toLowerCase().includes(lower));
}

/**
 * Generate a title from the first user message
 */
export function generateTitle(firstMessage: string): string {
    const clean = firstMessage.trim().replace(/\n/g, " ");
    if (clean.length <= 50) return clean;
    return clean.slice(0, 47) + "...";
}

/**
 * Group conversations by time period
 */
export function groupConversationsByTime(
    metas: ConversationMeta[]
): { label: string; conversations: ConversationMeta[] }[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const thisWeek = new Date(today.getTime() - 7 * 86400000);

    const groups: { label: string; conversations: ConversationMeta[] }[] = [
        { label: "Today", conversations: [] },
        { label: "Yesterday", conversations: [] },
        { label: "This week", conversations: [] },
        { label: "Older", conversations: [] }
    ];

    for (const meta of metas) {
        const date = new Date(meta.updatedAt);
        if (date >= today) {
            groups[0].conversations.push(meta);
        } else if (date >= yesterday) {
            groups[1].conversations.push(meta);
        } else if (date >= thisWeek) {
            groups[2].conversations.push(meta);
        } else {
            groups[3].conversations.push(meta);
        }
    }

    return groups.filter((g) => g.conversations.length > 0);
}
