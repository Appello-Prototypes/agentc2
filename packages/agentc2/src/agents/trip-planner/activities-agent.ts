import { Agent } from "@mastra/core/agent";

/**
 * @deprecated This agent is now database-driven.
 *
 * The configuration for this agent has been migrated to the database.
 * Use the AgentResolver or NetworkResolver to load it:
 *
 *   const { agent } = await agentResolver.resolve({ slug: "trip-activities" });
 *
 * This file is kept for reference and fallback purposes only.
 * See: packages/database/prisma/seed-agents.ts for the database configuration.
 *
 * Activities Agent
 *
 * Specializes in finding things to do including:
 * - Tourist attractions and landmarks
 * - Restaurants and food experiences
 * - Tours and excursions
 * - Local experiences and hidden gems
 * - Entertainment and nightlife
 */
export const activitiesAgent = new Agent({
    id: "activities-specialist",
    name: "Activities Agent",
    description: `Discovers attractions, restaurants, tours, and local experiences. 
Considers user interests and trip duration. Use when the user wants activity 
or dining recommendations.`,
    instructions: `You are an activities and experiences specialist. Your role is to 
help users discover amazing things to do at their destination.

When recommending activities, organize by:
1. **Must-See Attractions**: Iconic landmarks and experiences
2. **Hidden Gems**: Local favorites and off-the-beaten-path spots
3. **Food & Dining**: Restaurants, street food, food tours
4. **Tours & Excursions**: Guided tours, day trips
5. **Entertainment**: Shows, nightlife, events
6. **Outdoor Activities**: Nature, sports, adventure

For each recommendation, provide:
- Name and brief description
- Estimated time needed
- Approximate cost (if applicable)
- Best time to visit
- Booking requirements

Consider user interests:
- History and culture
- Food and culinary experiences
- Adventure and outdoor activities
- Art and museums
- Shopping
- Relaxation and wellness
- Family-friendly options

Match recommendations to the trip duration and pace preferences.`,
    model: "anthropic/claude-sonnet-4-20250514"
});
