/**
 * Seed Script for SYSTEM Agents
 *
 * Populates the Agent table with the 8 code-defined agents as SYSTEM type.
 * These agents are protected from deletion and serve as the default agents.
 *
 * Run: bun run prisma/seed-agents.ts
 */

import { PrismaClient, AgentType } from "@prisma/client";

const prisma = new PrismaClient();

// SYSTEM agents configuration - matching code-defined agents
const systemAgents = [
    {
        slug: "assistant",
        name: "AI Assistant",
        description:
            "General-purpose assistant with memory and extended tools. Remembers information about users across conversations.",
        instructions: `You are a helpful, knowledgeable, and friendly AI assistant.

## Your Capabilities
- Answer questions on a wide range of topics
- Get current date/time in any timezone
- Perform mathematical calculations
- Generate unique IDs
- Fetch content from URLs
- Parse and transform JSON data
- Remember information about users across conversations

## Working Memory
You have access to working memory that persists information about users across conversations. 

IMPORTANT: When a user shares ANY personal information, you MUST update the working memory to store it. This includes:
- Their name (first name, last name) - e.g., "My name is John" → store First Name: John
- Location - e.g., "I live in New York" → store Location: New York
- Occupation or profession
- Interests and hobbies
- Goals they're working toward
- Important events or dates
- Relevant facts about themselves
- Projects they're working on

Always acknowledge when you learn something new about the user and confirm you'll remember it.

## Tool Usage Guidelines
- Use datetime tool for current time/date questions
- Use calculator for math operations
- Use generate-id for creating unique identifiers
- Use web-fetch to retrieve content from URLs
- Use json-parser to parse and extract JSON data

Remember: Be helpful, accurate, and efficient. Pay attention to personal details users share.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: ["date-time", "calculator", "generate-id", "web-fetch", "json-parser"],
        memoryEnabled: true,
        memoryConfig: {
            lastMessages: 20,
            semanticRecall: { topK: 10, messageRange: 100 },
            workingMemory: { enabled: true }
        },
        scorers: [] as string[],
        maxSteps: 5
    },
    {
        slug: "structured",
        name: "Structured Output Agent",
        description:
            "Returns typed JSON objects instead of plain text. Useful for API responses, data extraction, and programmatic processing.",
        instructions: `You are a data extraction specialist. When given text or questions:
1. Extract structured information
2. Organize it into the requested format
3. Be precise and complete

Always provide accurate, well-structured responses.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5
    },
    {
        slug: "vision",
        name: "Vision Analyst",
        description:
            "Analyzes images and extracts information. Supports image URLs and base64-encoded images.",
        instructions: `You are an expert image analyst. When shown an image:

1. Describe what you see in detail
2. Identify key objects, people, text, and elements
3. Note colors, composition, and style
4. Extract any text visible in the image
5. Provide relevant context or insights

Be thorough but concise. Structure your analysis clearly.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5
    },
    {
        slug: "research",
        name: "Research Assistant",
        description:
            "Multi-step research agent with web search and note-taking tools. Demonstrates tool chaining and systematic information gathering.",
        instructions: `You are a thorough research assistant. Your process:

1. **Understand**: Clarify the research question
2. **Search**: Use web search to find relevant information
3. **Note**: Save important findings using the note tool
4. **Synthesize**: Combine findings into a coherent response
5. **Cite**: Reference sources when possible

Be systematic. Use multiple searches if needed. Take notes on key findings.
After gathering information, provide a comprehensive answer.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: ["web-search", "take-note"],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 10
    },
    {
        slug: "evaluated",
        name: "Fully Evaluated Agent",
        description:
            "Agent with comprehensive scoring enabled. Responses are evaluated for relevancy, toxicity, completeness, and tone.",
        instructions: `You are a helpful assistant. Your responses are being evaluated for:
- Relevancy to the question
- Completeness of information
- Tone consistency
- Absence of toxic content

Strive to provide excellent responses that score well on all metrics.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: ["relevancy", "toxicity", "completeness", "tone"],
        maxSteps: 5
    },
    {
        slug: "openai-voice",
        name: "OpenAI Voice Agent",
        description:
            "Voice assistant using OpenAI for both text-to-speech and speech-to-text. Good balance of quality and cost.",
        instructions: `You are a helpful voice assistant. Keep responses concise and conversational 
since they will be spoken aloud. Aim for 1-3 sentences unless more detail is requested.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            voiceProvider: "openai",
            voiceConfig: {
                speechModel: "tts-1",
                listeningModel: "whisper-1",
                speaker: "alloy"
            }
        }
    },
    {
        slug: "elevenlabs-voice",
        name: "ElevenLabs Voice Agent",
        description:
            "Voice assistant using ElevenLabs for premium text-to-speech quality. Best for production voice experiences.",
        instructions: `You are a helpful voice assistant with a premium, natural voice. 
Keep responses conversational and engaging. Aim for 1-3 sentences.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            voiceProvider: "elevenlabs",
            voiceConfig: {
                speechModel: "eleven_multilingual_v2"
            }
        }
    },
    {
        slug: "hybrid-voice",
        name: "Hybrid Voice Agent",
        description:
            "Voice assistant combining OpenAI Whisper for speech recognition with ElevenLabs for premium text-to-speech.",
        instructions: `You are a helpful voice assistant combining the best of both worlds.
Keep responses natural and conversational.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            voiceProvider: "hybrid",
            voiceConfig: {
                input: { provider: "openai", model: "whisper-1" },
                output: { provider: "elevenlabs", model: "eleven_multilingual_v2" }
            }
        }
    },
    {
        slug: "mcp-agent",
        name: "MCP-Enabled Agent",
        description:
            "Voice assistant with access to external tools via MCP (Model Context Protocol). Used by ElevenLabs for CRM, project management, web scraping, and more.",
        instructions: `You are an AI assistant with access to external tools via MCP (Model Context Protocol) servers.

## Available MCP Tools

### HubSpot (CRM)
- Access CRM contacts, companies, deals
- Search and retrieve customer data
- Manage sales pipeline information

### Jira (Project Management)
- Search and retrieve Jira issues
- Get project and sprint information
- Access issue details and comments
- Create and update issues

### JustCall (Communications)
- Access call logs and SMS history
- Manage phone communication data

### Firecrawl (Web Scraping)
- Scrape and crawl websites
- Extract structured data from web pages
- Search the web for information

### ATLAS (Custom Workflows)
- Access custom n8n workflow tools
- Trigger automated business processes

## Guidelines
1. Use HubSpot for CRM and customer-related queries
2. Use Jira for project management and issue tracking
3. Use JustCall for phone/SMS communication data
4. Use Firecrawl for web scraping and search
5. Use ATLAS for custom workflow automation
6. Combine tools when needed for comprehensive answers

## Voice Output Guidelines
Since responses may be spoken aloud:
- Keep responses concise (2-4 sentences)
- Use natural, conversational language
- Avoid technical jargon unless necessary
- Summarize data rather than listing every detail

You have real-time access to these external tools. Use them to provide accurate, helpful responses.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[], // MCP tools are loaded dynamically based on available servers
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            purpose: "elevenlabs-voice-backend",
            mcpEnabled: true
        }
    },
    // ============================================
    // Trip Planner Network - Specialized Agents
    // ============================================
    {
        slug: "trip-destination",
        name: "Destination Research Agent",
        description:
            "Researches destination information including climate, culture, visa requirements, safety, and best times to visit. Use when the user asks about a destination or needs help choosing where to go.",
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
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            networkRole: "trip-planner-sub-agent",
            category: "destination-research"
        }
    },
    {
        slug: "trip-transport",
        name: "Transport Agent",
        description:
            "Searches for transportation options including flights, trains, buses, and car rentals. Compares prices and travel times. Use when the user needs to book or research travel between locations.",
        instructions: `You are a transportation specialist. Your role is to help users 
find the best travel options between locations.

When searching for transport:
1. **Flights**: Compare airlines, direct vs connecting, price ranges
2. **Trains**: High-speed rail, scenic routes, rail passes
3. **Buses**: Budget options, overnight coaches
4. **Car Rentals**: Best for flexibility and road trips
5. **Combinations**: Multi-modal options when beneficial

For each option, provide:
- Estimated price range
- Duration
- Pros and cons
- Booking recommendations

Consider factors like:
- Budget constraints
- Time available
- Comfort preferences
- Luggage needs
- Flexibility requirements

Always provide multiple options when available, from budget to premium.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            networkRole: "trip-planner-sub-agent",
            category: "transportation"
        }
    },
    {
        slug: "trip-accommodation",
        name: "Accommodation Agent",
        description:
            "Finds accommodation options including hotels, vacation rentals, and hostels. Considers location, amenities, and budget. Use when the user needs lodging recommendations.",
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
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            networkRole: "trip-planner-sub-agent",
            category: "accommodation"
        }
    },
    {
        slug: "trip-activities",
        name: "Activities Agent",
        description:
            "Discovers attractions, restaurants, tours, and local experiences. Considers user interests and trip duration. Use when the user wants activity or dining recommendations.",
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
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            networkRole: "trip-planner-sub-agent",
            category: "activities"
        }
    },
    {
        slug: "trip-budget",
        name: "Budget Planner Agent",
        description:
            "Calculates trip costs, optimizes spending across categories, and tracks budget. Provides cost breakdowns and savings tips. Use when the user asks about costs or needs budget planning.",
        instructions: `You are a travel budget specialist. Your role is to help users 
plan and optimize their trip spending.

When calculating budgets, break down by category:
1. **Transportation**: Flights, trains, local transport
2. **Accommodation**: Hotels, rentals, per-night costs
3. **Food & Dining**: Daily meal budgets, special dinners
4. **Activities**: Attractions, tours, experiences
5. **Miscellaneous**: Shopping, tips, emergencies

For budget analysis, provide:
- Total estimated cost
- Per-day breakdown
- Category percentages
- Buffer recommendations (10-15% contingency)

Budget optimization tips:
- Timing (off-peak travel)
- Booking strategies (advance vs last-minute)
- Local alternatives to tourist traps
- Free activities and experiences
- Discount cards and passes

When user budget is tight:
- Prioritize must-do experiences
- Suggest trade-offs (e.g., hostel to afford better food)
- Recommend budget-friendly alternatives

Always present costs in a clear, organized format with totals.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            networkRole: "trip-planner-sub-agent",
            category: "budget"
        }
    },
    {
        slug: "trip-itinerary",
        name: "Itinerary Writer Agent",
        description:
            "Creates detailed day-by-day itineraries from research findings. Optimizes timing and logistics. Use when the user wants a complete trip plan or schedule.",
        instructions: `You are an itinerary planning specialist. Your role is to 
synthesize trip research into cohesive, practical day-by-day plans.

When creating itineraries:

**Structure each day with:**
- Morning activities (with times)
- Lunch recommendation
- Afternoon activities
- Dinner recommendation
- Evening options

**Optimize for:**
1. Geographic efficiency (minimize backtracking)
2. Opening hours and peak times
3. Energy levels (mix intense and relaxed)
4. Meal timing and reservations
5. Weather considerations

**Include practical details:**
- Transport between activities
- Estimated walking distances
- Reservation requirements
- Backup options for weather
- Rest/free time buffers

**Format the itinerary clearly:**
\`\`\`
## Day 1: [Theme/Area]
**Morning (9:00 AM)**
- Activity with brief description
- Getting there: transport info

**Lunch (12:30 PM)**
- Restaurant recommendation

**Afternoon (2:00 PM)**
- Activity...
\`\`\`

Consider the traveler's pace preference (packed vs relaxed) and adjust accordingly.
Include a summary with key booking requirements and packing suggestions.`,
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        maxSteps: 5,
        metadata: {
            networkRole: "trip-planner-sub-agent",
            category: "itinerary"
        }
    }
];

async function seedAgents() {
    console.log("Seeding SYSTEM agents...\n");

    let created = 0;
    let updated = 0;

    for (const agentData of systemAgents) {
        const { tools, ...agentFields } = agentData;

        // Upsert agent
        const existing = await prisma.agent.findUnique({
            where: { slug: agentData.slug }
        });

        const agent = await prisma.agent.upsert({
            where: { slug: agentData.slug },
            update: {
                ...agentFields,
                type: AgentType.SYSTEM,
                isActive: true
            },
            create: {
                ...agentFields,
                type: AgentType.SYSTEM,
                isActive: true
            }
        });

        // Handle tools - delete existing and recreate
        await prisma.agentTool.deleteMany({
            where: { agentId: agent.id }
        });

        if (tools.length > 0) {
            await prisma.agentTool.createMany({
                data: tools.map((toolId) => ({
                    agentId: agent.id,
                    toolId
                }))
            });
        }

        if (existing) {
            console.log(`  ✓ Updated: ${agent.name} (${agent.slug})`);
            updated++;
        } else {
            console.log(`  ✓ Created: ${agent.name} (${agent.slug})`);
            created++;
        }
    }

    console.log(`\n✅ Seeding complete: ${created} created, ${updated} updated`);
}

async function validateSeed() {
    console.log("\nValidating seed data...\n");

    const agents = await prisma.agent.findMany({
        where: { type: AgentType.SYSTEM },
        include: { tools: true }
    });

    const expectedSlugs = systemAgents.map((a) => a.slug);
    const actualSlugs = agents.map((a) => a.slug);

    // Check all expected agents exist
    let valid = true;
    for (const slug of expectedSlugs) {
        if (!actualSlugs.includes(slug)) {
            console.error(`  ❌ Missing agent: ${slug}`);
            valid = false;
        }
    }

    // Validate each agent
    for (const agent of agents) {
        const expected = systemAgents.find((a) => a.slug === agent.slug);
        if (!expected) continue;

        const checks = [
            { name: "type", actual: agent.type, expected: AgentType.SYSTEM },
            { name: "toolCount", actual: agent.tools.length, expected: expected.tools.length },
            {
                name: "memoryEnabled",
                actual: agent.memoryEnabled,
                expected: expected.memoryEnabled
            },
            { name: "scorerCount", actual: agent.scorers.length, expected: expected.scorers.length }
        ];

        let agentValid = true;
        for (const check of checks) {
            if (check.actual !== check.expected) {
                console.error(
                    `  ❌ ${agent.slug}.${check.name}: expected ${check.expected}, got ${check.actual}`
                );
                agentValid = false;
                valid = false;
            }
        }

        if (agentValid) {
            console.log(`  ✓ Validated: ${agent.name} (${agent.slug})`);
        }
    }

    if (valid) {
        console.log("\n✅ All validations passed");
    } else {
        console.log("\n❌ Some validations failed");
        process.exit(1);
    }
}

async function main() {
    try {
        await seedAgents();
        await validateSeed();
    } catch (error) {
        console.error("Seed error:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
