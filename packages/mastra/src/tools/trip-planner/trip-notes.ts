import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Trip Notes Tool
 *
 * Saves user preferences, bookings, and notes for the trip.
 * This helps the agent remember important details across the conversation.
 */

// In-memory store for demo (in production, use persistent storage)
const tripNotesStore: Map<
    string,
    Array<{
        id: string;
        category: string;
        content: string;
        importance: string;
        timestamp: string;
    }>
> = new Map();

export const tripNotesTool = createTool({
    id: "trip-notes",
    description: `Save trip-related notes, preferences, or booking confirmations. 
Use to remember user preferences (e.g., "prefers window seats") or save 
important details for later reference.`,
    inputSchema: z.object({
        action: z.enum(["save", "list", "search"]).describe("Action to perform"),
        category: z
            .enum(["preference", "booking", "note", "requirement"])
            .optional()
            .describe("Category of the note"),
        content: z.string().optional().describe("Content of the note (required for save)"),
        importance: z
            .enum(["high", "medium", "low"])
            .optional()
            .default("medium")
            .describe("Importance level"),
        tripId: z.string().optional().default("default").describe("Trip identifier"),
        searchQuery: z.string().optional().describe("Search query (for search action)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        action: z.string(),
        note: z
            .object({
                id: z.string(),
                category: z.string(),
                content: z.string(),
                importance: z.string(),
                timestamp: z.string()
            })
            .optional(),
        notes: z
            .array(
                z.object({
                    id: z.string(),
                    category: z.string(),
                    content: z.string(),
                    importance: z.string(),
                    timestamp: z.string()
                })
            )
            .optional(),
        message: z.string()
    }),
    execute: async ({
        action,
        category,
        content,
        importance = "medium",
        tripId = "default",
        searchQuery
    }) => {
        // Initialize trip notes if needed
        if (!tripNotesStore.has(tripId)) {
            tripNotesStore.set(tripId, []);
        }

        const tripNotes = tripNotesStore.get(tripId)!;

        switch (action) {
            case "save": {
                if (!content || !category) {
                    return {
                        success: false,
                        action: "save",
                        message: "Content and category are required for saving notes"
                    };
                }

                const note = {
                    id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    category,
                    content,
                    importance,
                    timestamp: new Date().toISOString()
                };

                tripNotes.push(note);
                console.log(`[Trip Notes] Saved ${category}: ${content.substring(0, 50)}...`);

                return {
                    success: true,
                    action: "save",
                    note,
                    message: `Saved ${category} note successfully`
                };
            }

            case "list": {
                let filteredNotes = tripNotes;

                if (category) {
                    filteredNotes = tripNotes.filter((n) => n.category === category);
                }

                // Sort by importance and timestamp
                const importanceOrder = { high: 0, medium: 1, low: 2 };
                filteredNotes.sort((a, b) => {
                    const impDiff =
                        importanceOrder[a.importance as keyof typeof importanceOrder] -
                        importanceOrder[b.importance as keyof typeof importanceOrder];
                    if (impDiff !== 0) return impDiff;
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });

                return {
                    success: true,
                    action: "list",
                    notes: filteredNotes,
                    message: `Found ${filteredNotes.length} notes${category ? ` in category: ${category}` : ""}`
                };
            }

            case "search": {
                if (!searchQuery) {
                    return {
                        success: false,
                        action: "search",
                        message: "Search query is required"
                    };
                }

                const query = searchQuery.toLowerCase();
                const matchingNotes = tripNotes.filter(
                    (n) =>
                        n.content.toLowerCase().includes(query) ||
                        n.category.toLowerCase().includes(query)
                );

                return {
                    success: true,
                    action: "search",
                    notes: matchingNotes,
                    message: `Found ${matchingNotes.length} notes matching "${searchQuery}"`
                };
            }

            default:
                return {
                    success: false,
                    action: action,
                    message: "Unknown action"
                };
        }
    }
});

// Export helper to clear notes (useful for testing)
export const clearTripNotes = (tripId: string = "default") => {
    tripNotesStore.delete(tripId);
};
