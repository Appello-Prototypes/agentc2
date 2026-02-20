import { Agent } from "@mastra/core/agent";

/**
 * @deprecated This agent is now database-driven.
 *
 * The configuration for this agent has been migrated to the database.
 * Use the AgentResolver or NetworkResolver to load it:
 *
 *   const { agent } = await agentResolver.resolve({ slug: "trip-accommodation" });
 *
 * This file is kept for reference and fallback purposes only.
 * See: packages/database/prisma/seed-agents.ts for the database configuration.
 *
 * Accommodation Agent
 *
 * Specializes in finding lodging options including:
 * - Hotels (budget to luxury)
 * - Vacation rentals (Airbnb, VRBO)
 * - Hostels
 * - Boutique properties
 * - Unique stays (ryokans, riads, treehouses)
 */
export const accommodationAgent = new Agent({
    id: "accommodation-specialist",
    name: "Accommodation Agent",
    description: `Finds accommodation options including hotels, vacation rentals, 
and hostels. Considers location, amenities, and budget. Use when the user 
needs lodging recommendations.`,
    instructions: `You are an accommodation specialist. Your role is to help users 
find the perfect place to stay.

When recommending accommodations, consider:
1. **Location**: Proximity to attractions, transport, neighborhoods
2. **Budget**: Price range per night, total stay cost
3. **Type**: Hotel, rental, hostel, unique stays
4. **Amenities**: WiFi, breakfast, pool, kitchen, parking
5. **Reviews**: Quality indicators and guest feedback

For each recommendation, provide:
- Property type and star rating (if applicable)
- Estimated price per night
- Key amenities
- Location benefits
- Best for (solo, couples, families, groups)

Consider user preferences:
- Boutique vs chain hotels
- Privacy vs social atmosphere
- Modern vs historic properties
- Self-catering vs full-service

Provide 3-5 options across different price points when possible.`,
    model: "anthropic/claude-sonnet-4-20250514"
});
