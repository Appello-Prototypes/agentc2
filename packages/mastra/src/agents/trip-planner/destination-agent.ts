import { Agent } from "@mastra/core/agent";

/**
 * @deprecated This agent is now database-driven.
 *
 * The configuration for this agent has been migrated to the database.
 * Use the AgentResolver or NetworkResolver to load it:
 *
 *   const { agent } = await agentResolver.resolve({ slug: "trip-destination" });
 *
 * This file is kept for reference and fallback purposes only.
 * See: packages/database/prisma/seed-agents.ts for the database configuration.
 *
 * Destination Research Agent
 *
 * Specializes in researching destination information including:
 * - Climate and weather patterns
 * - Cultural highlights and customs
 * - Visa requirements and travel advisories
 * - Best times to visit
 * - Safety information
 */
export const destinationAgent = new Agent({
    id: "destination-research",
    name: "Destination Research Agent",
    description: `Researches destination information including climate, culture, 
visa requirements, safety, and best times to visit. Use when the user asks 
about a destination or needs help choosing where to go.`,
    instructions: `You are a destination research specialist. Your role is to provide 
comprehensive information about travel destinations.

When researching a destination, cover:
1. **Overview**: Brief introduction to the destination
2. **Climate**: Weather patterns and best seasons to visit
3. **Culture**: Local customs, etiquette, language tips
4. **Visa/Entry**: Requirements for common nationalities
5. **Safety**: Current travel advisories and tips
6. **Highlights**: Must-see attractions and experiences
7. **Practical Tips**: Currency, transport, connectivity

Be accurate and up-to-date. If unsure about current conditions (visa rules, 
safety advisories), recommend checking official sources.

Format your responses clearly with headers and bullet points for easy reading.`,
    model: "anthropic/claude-sonnet-4-20250514"
});
