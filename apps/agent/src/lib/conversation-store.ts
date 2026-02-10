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
 * Generate a concise task title from the first user message (client-side only).
 * Strips conversational filler and derives a short action-oriented label.
 * Used as an immediate placeholder while the async LLM title is being generated.
 */
export function generateTitle(firstMessage: string): string {
    let text = firstMessage.trim().replace(/\n/g, " ");

    // Strip leading filler phrases (case-insensitive)
    const fillerPrefixes = [
        /^(hey|hi|hello|yo|sup|hiya)[,!.\s]*/i,
        /^(can you|could you|would you|will you|please|pls|plz)\s+/i,
        /^(i want to|i'd like to|i need to|i want you to|i need you to|i'd like you to)\s+/i,
        /^(help me|help us|assist me|assist us)\s+(to\s+)?/i,
        /^(i need help with|i need help on|i need some help with)\s+/i,
        /^(i have a question about|i have a question on|question about)\s+/i,
        /^(let's|lets|let us)\s+/i,
        /^(i'm trying to|i am trying to)\s+/i,
        /^(give me|show me|tell me|get me)\s+(a\s+)?/i
    ];

    for (const re of fillerPrefixes) {
        text = text.replace(re, "");
    }

    // Capitalize first letter
    text = text.charAt(0).toUpperCase() + text.slice(1);

    // Remove trailing punctuation for cleanliness
    text = text.replace(/[.!?]+$/, "");

    // Truncate to a reasonable title length
    if (text.length <= 40) return text;
    // Try to break at a word boundary
    const truncated = text.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 20) return truncated.slice(0, lastSpace) + "…";
    return truncated + "…";
}

/**
 * Generate a conversation title using a server-side LLM call (async).
 * Falls back to the client-side `generateTitle` if the API call fails.
 * This runs in the background and updates the conversation title once ready.
 */
export async function generateTitleAsync(
    conversationId: string,
    firstMessage: string
): Promise<string> {
    try {
        const res = await fetch("/api/conversations/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: firstMessage })
        });

        if (!res.ok) {
            throw new Error(`Title API returned ${res.status}`);
        }

        const { title } = await res.json();

        if (title && typeof title === "string") {
            // Update the stored conversation with the LLM-generated title
            updateConversationTitle(conversationId, title);
            return title;
        }

        // Fallback if API returns empty
        return generateTitle(firstMessage);
    } catch {
        // Silently fall back to the client-side title
        return generateTitle(firstMessage);
    }
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
