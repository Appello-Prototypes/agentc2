import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Parallel Research Workflow
 *
 * Runs transport, accommodation, and activities research in parallel
 * to save time when planning a complete trip.
 *
 * Flow: Input → [Transport | Hotels | Activities] → Combine → Output
 */

// Input schema for trip research (all optional fields use .optional() to avoid type issues)
const tripResearchInputSchema = z.object({
    destination: z.string().describe("Destination city/country"),
    origin: z.string().optional().describe("Origin city for flight search"),
    startDate: z.string().describe("Trip start date (YYYY-MM-DD)"),
    endDate: z.string().describe("Trip end date (YYYY-MM-DD)"),
    travelers: z.number().optional().describe("Number of travelers (defaults to 2)"),
    budget: z.number().optional().describe("Total budget in USD"),
    interests: z.array(z.string()).optional().describe("Traveler interests")
});

/**
 * Transport Research Step
 */
const transportStep = createStep({
    id: "transport-research",
    description: "Search for flight and transport options",
    inputSchema: tripResearchInputSchema,
    outputSchema: z.object({
        flights: z.array(
            z.object({
                airline: z.string(),
                price: z.number(),
                duration: z.string(),
                stops: z.number()
            })
        ),
        estimatedCost: z.number(),
        recommendation: z.string()
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const travelers = inputData.travelers ?? 2;

        const response = await agent.generate(
            `You are a transport search assistant. Find flight options for this trip:

Origin: ${inputData.origin || "Major city near traveler"}
Destination: ${inputData.destination}
Dates: ${inputData.startDate} to ${inputData.endDate}
Travelers: ${travelers}

Generate 3 realistic flight options with different price points.

Respond with ONLY a JSON object:
{
  "flights": [
    { "airline": "Airline Name", "price": 500, "duration": "12h 30m", "stops": 1 }
  ],
  "estimatedCost": 1000,
  "recommendation": "Best value option description"
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {
            // Fallback
        }

        return {
            flights: [
                {
                    airline: "Sample Airline",
                    price: 500 * (inputData.travelers || 2),
                    duration: "14h",
                    stops: 1
                }
            ],
            estimatedCost: 500 * (inputData.travelers || 2),
            recommendation: "Economy class with good reviews"
        };
    }
});

/**
 * Accommodation Research Step
 */
const accommodationStep = createStep({
    id: "accommodation-research",
    description: "Search for hotel and lodging options",
    inputSchema: tripResearchInputSchema,
    outputSchema: z.object({
        hotels: z.array(
            z.object({
                name: z.string(),
                type: z.string(),
                pricePerNight: z.number(),
                rating: z.number()
            })
        ),
        estimatedCost: z.number(),
        recommendation: z.string()
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        // Calculate nights
        const start = new Date(inputData.startDate);
        const end = new Date(inputData.endDate);
        const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        const response = await agent.generate(
            `You are an accommodation search assistant. Find hotel options for this trip:

Destination: ${inputData.destination}
Check-in: ${inputData.startDate}
Check-out: ${inputData.endDate}
Nights: ${nights}
Travelers: ${inputData.travelers ?? 2}

Generate 3 realistic hotel options with different price points (budget, mid-range, luxury).

Respond with ONLY a JSON object:
{
  "hotels": [
    { "name": "Hotel Name", "type": "Mid-range Hotel", "pricePerNight": 150, "rating": 4.2 }
  ],
  "estimatedCost": 750,
  "recommendation": "Best location for sightseeing"
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {
            // Fallback
        }

        return {
            hotels: [
                { name: "City Center Hotel", type: "Mid-range", pricePerNight: 120, rating: 4.0 }
            ],
            estimatedCost: 120 * nights,
            recommendation: "Central location with good amenities"
        };
    }
});

/**
 * Activities Research Step
 */
const activitiesStep = createStep({
    id: "activities-research",
    description: "Discover attractions and activities",
    inputSchema: tripResearchInputSchema,
    outputSchema: z.object({
        attractions: z.array(
            z.object({
                name: z.string(),
                type: z.string(),
                estimatedCost: z.number(),
                duration: z.string()
            })
        ),
        restaurants: z.array(
            z.object({
                name: z.string(),
                cuisine: z.string(),
                priceRange: z.string()
            })
        ),
        estimatedCost: z.number(),
        recommendation: z.string()
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `You are an activities research assistant. Find things to do for this trip:

Destination: ${inputData.destination}
Duration: ${inputData.startDate} to ${inputData.endDate}
Travelers: ${inputData.travelers ?? 2}
Interests: ${inputData.interests?.join(", ") || "General sightseeing"}

Generate 5 attraction recommendations and 3 restaurant recommendations.

Respond with ONLY a JSON object:
{
  "attractions": [
    { "name": "Famous Landmark", "type": "Landmark", "estimatedCost": 25, "duration": "2-3 hours" }
  ],
  "restaurants": [
    { "name": "Local Restaurant", "cuisine": "Local Cuisine", "priceRange": "$$" }
  ],
  "estimatedCost": 200,
  "recommendation": "Must-see highlight description"
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {
            // Fallback
        }

        return {
            attractions: [
                {
                    name: "Main Attraction",
                    type: "Landmark",
                    estimatedCost: 20,
                    duration: "2 hours"
                }
            ],
            restaurants: [{ name: "Local Favorite", cuisine: "Local", priceRange: "$$" }],
            estimatedCost: 150,
            recommendation: "Top-rated experiences in the area"
        };
    }
});

/**
 * Combine Results Step
 * Note: Input keys must match the step IDs from the parallel execution
 */
const combineStep = createStep({
    id: "combine-research",
    description: "Combine all parallel research results",
    inputSchema: z.object({
        "transport-research": z.object({
            flights: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        "accommodation-research": z.object({
            hotels: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        "activities-research": z.object({
            attractions: z.array(z.any()),
            restaurants: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        })
    }),
    outputSchema: z.object({
        transport: z.object({
            flights: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        accommodation: z.object({
            hotels: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        activities: z.object({
            attractions: z.array(z.any()),
            restaurants: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        summary: z.object({
            totalEstimatedCost: z.number(),
            breakdown: z.object({
                transport: z.number(),
                accommodation: z.number(),
                activities: z.number()
            }),
            topRecommendations: z.array(z.string())
        })
    }),
    execute: async ({ inputData }) => {
        // Extract results using step IDs
        const transport = inputData["transport-research"];
        const accommodation = inputData["accommodation-research"];
        const activities = inputData["activities-research"];

        const totalEstimatedCost =
            transport.estimatedCost + accommodation.estimatedCost + activities.estimatedCost;

        return {
            transport,
            accommodation,
            activities,
            summary: {
                totalEstimatedCost,
                breakdown: {
                    transport: transport.estimatedCost,
                    accommodation: accommodation.estimatedCost,
                    activities: activities.estimatedCost
                },
                topRecommendations: [
                    transport.recommendation,
                    accommodation.recommendation,
                    activities.recommendation
                ]
            }
        };
    }
});

/**
 * Parallel Research Workflow
 *
 * Executes transport, accommodation, and activities research in parallel,
 * then combines the results into a comprehensive trip research summary.
 */
export const parallelResearchWorkflow = createWorkflow({
    id: "trip-parallel-research",
    description: `Research flights, hotels, and activities in parallel for efficient 
trip planning. Combines results into a comprehensive summary with cost breakdown.`,
    inputSchema: tripResearchInputSchema,
    outputSchema: z.object({
        transport: z.object({
            flights: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        accommodation: z.object({
            hotels: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        activities: z.object({
            attractions: z.array(z.any()),
            restaurants: z.array(z.any()),
            estimatedCost: z.number(),
            recommendation: z.string()
        }),
        summary: z.object({
            totalEstimatedCost: z.number(),
            breakdown: z.object({
                transport: z.number(),
                accommodation: z.number(),
                activities: z.number()
            }),
            topRecommendations: z.array(z.string())
        })
    })
})
    .parallel([transportStep, accommodationStep, activitiesStep])
    .then(combineStep)
    .commit();
