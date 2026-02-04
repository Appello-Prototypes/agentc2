/**
 * Network Resolver
 *
 * Dynamically resolves agent networks by loading sub-agents from the database.
 * This enables database-driven agent networks where specialized agents can be
 * configured and modified via the UI.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

import { agentResolver } from "./resolver";
import { storage } from "../storage";
import { vector } from "../vector";

// Import workflows (still code-defined, could be database-driven in future)
import {
    parallelResearchWorkflow,
    itineraryAssemblyWorkflow,
    budgetApprovalWorkflow
} from "../workflows/trip-planner";

// Import tools (from tool registry)
import {
    flightSearchTool,
    hotelSearchTool,
    weatherLookupTool,
    tripNotesTool
} from "../tools/trip-planner";

/**
 * Trip Planner Network Configuration
 *
 * Defines which agents participate in the trip planner network.
 * Agents are referenced by slug and resolved from database at runtime.
 */
const TRIP_PLANNER_SUB_AGENTS = [
    "trip-destination",
    "trip-transport",
    "trip-accommodation",
    "trip-activities",
    "trip-budget",
    "trip-itinerary"
] as const;

const TRIP_PLANNER_ROUTER_SLUG = "trip-planner";

/**
 * Trip Planner Memory Configuration
 *
 * Configured with:
 * - Message history for conversation context
 * - Working memory for trip preferences and details
 * - Semantic recall for finding relevant past discussions
 */
function createTripPlannerMemory(): Memory {
    return new Memory({
        storage,
        vector,
        embedder: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
        options: {
            generateTitle: true,
            lastMessages: 15,
            workingMemory: {
                enabled: true,
                template: `# Trip Planning Context
- **Travelers**: (number and names if mentioned)
- **Budget**: (total budget and currency)
- **Dates**: (travel dates)
- **Destinations Interested**: (places mentioned)
- **Interests/Activities**: (user's preferences)
- **Accommodation Preference**: (hotel type, amenities)
- **Dietary Restrictions**: (allergies, preferences)
- **Special Requirements**: (accessibility, kids, etc.)
- **Confirmed Details**: (any finalized bookings or decisions)`
            },
            semanticRecall: {
                topK: 5,
                messageRange: 2,
                scope: "resource"
            }
        }
    });
}

/**
 * Trip Planner Routing Agent Instructions
 */
const TRIP_PLANNER_INSTRUCTIONS = `You are a comprehensive trip planning assistant that coordinates 
a network of specialized travel agents, workflows, and tools.

## Your Role
You help users plan amazing trips by intelligently delegating to the right 
specialists and combining their expertise into actionable travel plans.

## Available Specialists

**Agents (for detailed research and recommendations):**
- trip-destination: Research destinations, visa requirements, best times to visit
- trip-transport: Find flights, trains, and transport options with prices
- trip-accommodation: Search hotels, rentals, and lodging options
- trip-activities: Discover attractions, restaurants, tours, and experiences
- trip-budget: Calculate costs, optimize spending, provide savings tips
- trip-itinerary: Create detailed day-by-day trip schedules

**Workflows (for complex multi-step operations):**
- parallelResearchWorkflow: Research flights, hotels, and activities simultaneously
- itineraryAssemblyWorkflow: Create a complete itinerary (research → plan → optimize)
- budgetApprovalWorkflow: Get user approval on budget before "booking"

**Tools (for quick lookups):**
- flightSearch: Quick flight search
- hotelSearch: Quick hotel search
- weatherLookup: Get weather forecast for destinations
- tripNotes: Save user preferences and important details

## Decision Guidelines

1. **Simple Questions** → Answer directly or use a tool
   - "What's the weather in Paris?" → weatherLookup tool
   - "How much are flights to Tokyo?" → flightSearch tool

2. **Research Requests** → Delegate to specialist agent
   - "Tell me about visiting Japan" → trip-destination agent
   - "What hotels are good in Rome?" → trip-accommodation agent
   - "What should I do in Barcelona?" → trip-activities agent

3. **Complete Trip Planning** → Use workflows
   - "Plan a 5-day trip to Tokyo" → parallelResearchWorkflow, then trip-itinerary
   - "Help me plan my vacation" → Gather details, then parallelResearchWorkflow

4. **Budget Decisions** → Use budget approval workflow
   - After presenting costs → budgetApprovalWorkflow for confirmation

## Response Guidelines

- Always be helpful and enthusiastic about travel
- Remember user preferences mentioned in conversation
- Provide clear, organized information
- Include price estimates when relevant
- Offer next steps and follow-up questions
- Format responses with headers and lists for readability

When you don't have enough information to help, ask clarifying questions about:
- Destination preferences
- Travel dates
- Number of travelers
- Budget range
- Interests and must-sees`;

/**
 * NetworkResolver
 *
 * Resolves agent networks by loading sub-agents from the database
 * and constructing the routing agent dynamically.
 */
export class NetworkResolver {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private cachedNetwork: Agent<any, any, any, any> | null = null;
    private cacheExpiry: number = 0;
    private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get the Trip Planner network with database-driven sub-agents.
     *
     * Sub-agents are loaded from the database via AgentResolver,
     * while workflows and tools remain code-defined.
     *
     * @param forceRefresh - If true, bypasses cache and reloads agents
     * @returns The Trip Planner routing agent with resolved sub-agents
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getTripPlannerNetwork(forceRefresh = false): Promise<Agent<any, any, any, any>> {
        // Check cache (in development, we might want shorter TTL or no cache)
        const now = Date.now();
        if (!forceRefresh && this.cachedNetwork && now < this.cacheExpiry) {
            return this.cachedNetwork;
        }

        console.log("[NetworkResolver] Resolving Trip Planner sub-agents from database...");

        try {
            const { agent, record } = await agentResolver.resolve({
                slug: TRIP_PLANNER_ROUTER_SLUG,
                fallbackToSystem: false
            });

            if (record) {
                this.cachedNetwork = agent;
                this.cacheExpiry = now + this.cacheTTL;
                console.log(
                    "[NetworkResolver] Trip Planner routing agent loaded from database configuration"
                );
                return agent as Agent<any, any, any, any>;
            }
        } catch {
            // Fall back to hardcoded trip planner network if no DB routing agent exists
        }

        // Resolve all sub-agents from database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agents: Record<string, Agent<any, any, any, any>> = {};
        const errors: string[] = [];

        for (const slug of TRIP_PLANNER_SUB_AGENTS) {
            try {
                const { agent, source } = await agentResolver.resolve({ slug });
                agents[slug] = agent;
                console.log(`  ✓ Resolved: ${slug} (from ${source})`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(`${slug}: ${message}`);
                console.error(`  ✗ Failed to resolve: ${slug} - ${message}`);
            }
        }

        // If any agents failed to resolve, throw an error
        if (errors.length > 0) {
            throw new Error(
                `Failed to resolve ${errors.length} sub-agent(s) for Trip Planner network:\n` +
                    errors.map((e) => `  - ${e}`).join("\n")
            );
        }

        // Create the routing agent with resolved sub-agents
        // Note: Using 'any' to bypass strict typing for Agent constructor
        // which expects specific types for agents/workflows/tools
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const routingAgent = new Agent({
            id: "trip-planner-router",
            name: "Trip Planner",
            description: `A comprehensive trip planning assistant that coordinates a network 
of specialized travel agents, workflows, and tools. Use this for any travel or 
vacation planning needs including destination research, flights, hotels, 
activities, budgeting, and itinerary creation.`,
            instructions: TRIP_PLANNER_INSTRUCTIONS,
            model: "anthropic/claude-sonnet-4-20250514",

            // Sub-agents resolved from database
            agents,

            // Workflows (code-defined)
            workflows: {
                parallelResearchWorkflow,
                itineraryAssemblyWorkflow,
                budgetApprovalWorkflow
            },

            // Tools (code-defined)
            tools: {
                flightSearch: flightSearchTool,
                hotelSearch: hotelSearchTool,
                weatherLookup: weatherLookupTool,
                tripNotes: tripNotesTool
            },

            // Memory for conversation context
            memory: createTripPlannerMemory()
        } as ConstructorParameters<typeof Agent>[0]);

        // Cache the resolved network
        this.cachedNetwork = routingAgent;
        this.cacheExpiry = now + this.cacheTTL;

        console.log("[NetworkResolver] Trip Planner network ready with 6 sub-agents");
        return routingAgent;
    }

    /**
     * Clear the cached network.
     * Call this when agent configurations change in the database.
     */
    clearCache(): void {
        this.cachedNetwork = null;
        this.cacheExpiry = 0;
        console.log("[NetworkResolver] Cache cleared");
    }

    /**
     * Get the list of sub-agent slugs used by the Trip Planner network.
     */
    getTripPlannerSubAgentSlugs(): readonly string[] {
        return TRIP_PLANNER_SUB_AGENTS;
    }
}

/**
 * Singleton instance of NetworkResolver
 */
export const networkResolver = new NetworkResolver();
