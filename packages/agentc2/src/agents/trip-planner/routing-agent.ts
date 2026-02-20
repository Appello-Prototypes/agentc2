/**
 * @deprecated This routing agent is now constructed dynamically by NetworkResolver.
 *
 * The Trip Planner network is now database-driven. Sub-agents are loaded from
 * the database at runtime, allowing for customization via the UI.
 *
 * To use the Trip Planner network:
 *
 *   import { networkResolver } from "@repo/agentc2";
 *   const agent = await networkResolver.getTripPlannerNetwork();
 *
 * This file is kept for reference and fallback purposes only.
 * See: packages/agentc2/src/agents/network-resolver.ts for the new implementation.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

// Import specialized agents (deprecated - now loaded from database)
import { destinationAgent } from "./destination-agent";
import { transportAgent } from "./transport-agent";
import { accommodationAgent } from "./accommodation-agent";
import { activitiesAgent } from "./activities-agent";
import { budgetAgent } from "./budget-agent";
import { itineraryAgent } from "./itinerary-agent";

// Import workflows
import {
    parallelResearchWorkflow,
    itineraryAssemblyWorkflow,
    budgetApprovalWorkflow
} from "../../workflows/trip-planner";

// Import tools
import {
    flightSearchTool,
    hotelSearchTool,
    weatherLookupTool,
    tripNotesTool
} from "../../tools/trip-planner";

// Import storage and vector for memory
import { storage } from "../../storage";
import { vector } from "../../vector";

/**
 * Trip Planner Memory
 *
 * Configured with:
 * - Message history for conversation context
 * - Working memory for trip preferences and details
 * - Semantic recall for finding relevant past discussions
 */
const tripPlannerMemory = new Memory({
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

/**
 * Trip Planner Routing Agent
 *
 * The main agent network controller that coordinates specialized agents,
 * workflows, and tools for comprehensive trip planning.
 *
 * This agent uses Mastra's Agent Network feature to:
 * 1. Interpret user requests about trip planning
 * 2. Delegate to appropriate specialist agents
 * 3. Trigger workflows for complex operations
 * 4. Use tools for quick lookups
 * 5. Remember user preferences across conversations
 */
export const tripPlannerRoutingAgent = new Agent({
    id: "trip-planner-router",
    name: "Trip Planner",
    description: `A comprehensive trip planning assistant that coordinates a network 
of specialized travel agents, workflows, and tools. Use this for any travel or 
vacation planning needs including destination research, flights, hotels, 
activities, budgeting, and itinerary creation.`,
    instructions: `You are a comprehensive trip planning assistant that coordinates 
a network of specialized travel agents, workflows, and tools.

## Your Role
You help users plan amazing trips by intelligently delegating to the right 
specialists and combining their expertise into actionable travel plans.

## Available Specialists

**Agents (for detailed research and recommendations):**
- destinationAgent: Research destinations, visa requirements, best times to visit
- transportAgent: Find flights, trains, and transport options with prices
- accommodationAgent: Search hotels, rentals, and lodging options
- activitiesAgent: Discover attractions, restaurants, tours, and experiences
- budgetAgent: Calculate costs, optimize spending, provide savings tips
- itineraryAgent: Create detailed day-by-day trip schedules

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
   - "Tell me about visiting Japan" → destinationAgent
   - "What hotels are good in Rome?" → accommodationAgent
   - "What should I do in Barcelona?" → activitiesAgent

3. **Complete Trip Planning** → Use workflows
   - "Plan a 5-day trip to Tokyo" → parallelResearchWorkflow, then itineraryAgent
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
- Interests and must-sees`,
    model: "anthropic/claude-sonnet-4-20250514",

    // Sub-agents for delegation
    agents: {
        destinationAgent,
        transportAgent,
        accommodationAgent,
        activitiesAgent,
        budgetAgent,
        itineraryAgent
    },

    // Workflows for complex operations
    workflows: {
        parallelResearchWorkflow,
        itineraryAssemblyWorkflow,
        budgetApprovalWorkflow
    },

    // Direct tools for quick lookups
    tools: {
        flightSearch: flightSearchTool,
        hotelSearch: hotelSearchTool,
        weatherLookup: weatherLookupTool,
        tripNotes: tripNotesTool
    },

    // Memory for conversation context and preferences
    memory: tripPlannerMemory
});
