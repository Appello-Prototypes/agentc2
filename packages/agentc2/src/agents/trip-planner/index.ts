/**
 * Trip Planner Agents
 *
 * A network of specialized travel planning agents that work together
 * to create comprehensive trip plans.
 *
 * @deprecated These agents are now database-driven.
 *
 * The Trip Planner network has been migrated to use database-driven agents.
 * Use the NetworkResolver to get the Trip Planner network:
 *
 *   import { networkResolver } from "@repo/agentc2";
 *   const agent = await networkResolver.getTripPlannerNetwork();
 *
 * The 6 specialized agents are stored in the database with slugs:
 * - trip-destination
 * - trip-transport
 * - trip-accommodation
 * - trip-activities
 * - trip-budget
 * - trip-itinerary
 *
 * These exports are kept for backwards compatibility and fallback.
 * See: packages/agentc2/src/agents/network-resolver.ts for the new implementation.
 */

// Specialized agents (deprecated - now loaded from database)
export { destinationAgent } from "./destination-agent";
export { transportAgent } from "./transport-agent";
export { accommodationAgent } from "./accommodation-agent";
export { activitiesAgent } from "./activities-agent";
export { budgetAgent } from "./budget-agent";
export { itineraryAgent } from "./itinerary-agent";

// Main routing agent (deprecated - now constructed by NetworkResolver)
export { tripPlannerRoutingAgent } from "./routing-agent";
