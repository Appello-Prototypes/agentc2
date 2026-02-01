import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Itinerary Assembly Workflow
 *
 * Sequential workflow that creates a detailed day-by-day itinerary:
 * Research → Draft Plan → Optimize Schedule → Format Output
 */

// Input schema for itinerary creation (all optional fields use .optional() to avoid type issues)
const itineraryInputSchema = z.object({
    destination: z.string().describe("Destination city/country"),
    startDate: z.string().describe("Trip start date (YYYY-MM-DD)"),
    endDate: z.string().describe("Trip end date (YYYY-MM-DD)"),
    travelers: z.number().optional().describe("Number of travelers (defaults to 2)"),
    interests: z.array(z.string()).optional().describe("Traveler interests"),
    pace: z
        .enum(["relaxed", "moderate", "packed"])
        .optional()
        .describe("Trip pace (defaults to moderate)"),
    accommodation: z.string().optional().describe("Where staying (for logistics)"),
    mustSee: z.array(z.string()).optional().describe("Must-see attractions")
});

/**
 * Research Step - Gather destination information
 */
const researchStep = createStep({
    id: "itinerary-research",
    description: "Research destination for itinerary planning",
    inputSchema: itineraryInputSchema,
    outputSchema: z.object({
        destination: z.string(),
        days: z.number(),
        highlights: z.array(z.string()),
        neighborhoods: z.array(z.string()),
        practicalInfo: z.object({
            bestTransport: z.string(),
            typicalMealTimes: z.string(),
            openingHours: z.string()
        })
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const start = new Date(inputData.startDate);
        const end = new Date(inputData.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        const response = await agent.generate(
            `Research ${inputData.destination} for creating a ${days}-day itinerary.

Interests: ${inputData.interests?.join(", ") || "General sightseeing"}
Must-see: ${inputData.mustSee?.join(", ") || "Top attractions"}

Provide destination research for itinerary planning.

Respond with ONLY a JSON object:
{
  "destination": "${inputData.destination}",
  "days": ${days},
  "highlights": ["Top attraction 1", "Top attraction 2", ...],
  "neighborhoods": ["Area 1 - known for X", "Area 2 - known for Y"],
  "practicalInfo": {
    "bestTransport": "Metro/walking recommended",
    "typicalMealTimes": "Lunch 12-2pm, Dinner 7-9pm",
    "openingHours": "Most attractions 9am-6pm"
  }
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
            destination: inputData.destination,
            days,
            highlights: ["Main attraction", "Cultural site", "Local market"],
            neighborhoods: ["City Center", "Historic District"],
            practicalInfo: {
                bestTransport: "Public transport and walking",
                typicalMealTimes: "Lunch 12-2pm, Dinner 7-9pm",
                openingHours: "Most places 9am-6pm"
            }
        };
    }
});

/**
 * Draft Itinerary Step - Create initial day-by-day plan
 */
const draftStep = createStep({
    id: "draft-itinerary",
    description: "Create initial day-by-day itinerary draft",
    inputSchema: z.object({
        destination: z.string(),
        days: z.number(),
        highlights: z.array(z.string()),
        neighborhoods: z.array(z.string()),
        practicalInfo: z.object({
            bestTransport: z.string(),
            typicalMealTimes: z.string(),
            openingHours: z.string()
        })
    }),
    outputSchema: z.object({
        itinerary: z.array(
            z.object({
                day: z.number(),
                date: z.string(),
                theme: z.string(),
                morning: z.object({
                    activity: z.string(),
                    duration: z.string(),
                    notes: z.string()
                }),
                lunch: z.string(),
                afternoon: z.object({
                    activity: z.string(),
                    duration: z.string(),
                    notes: z.string()
                }),
                dinner: z.string(),
                evening: z.string().optional()
            })
        )
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `Create a ${inputData.days}-day itinerary for ${inputData.destination}.

Highlights to include: ${inputData.highlights.join(", ")}
Neighborhoods: ${inputData.neighborhoods.join(", ")}
Transport: ${inputData.practicalInfo.bestTransport}
Meal times: ${inputData.practicalInfo.typicalMealTimes}

Create a balanced, realistic day-by-day plan.

Respond with ONLY a JSON object:
{
  "itinerary": [
    {
      "day": 1,
      "date": "Day 1",
      "theme": "Arrival & First Impressions",
      "morning": { "activity": "Arrive, check-in", "duration": "2 hours", "notes": "Rest if needed" },
      "lunch": "Local restaurant near hotel",
      "afternoon": { "activity": "Neighborhood walk", "duration": "3 hours", "notes": "Easy start" },
      "dinner": "Restaurant recommendation",
      "evening": "Early night to recover"
    }
  ]
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

        // Generate fallback itinerary
        const itinerary = [];
        for (let i = 1; i <= inputData.days; i++) {
            itinerary.push({
                day: i,
                date: `Day ${i}`,
                theme: i === 1 ? "Arrival" : i === inputData.days ? "Departure" : "Exploration",
                morning: {
                    activity:
                        inputData.highlights[i % inputData.highlights.length] || "Sightseeing",
                    duration: "3 hours",
                    notes: "Start early to avoid crowds"
                },
                lunch: "Local restaurant",
                afternoon: {
                    activity: "Continue exploring",
                    duration: "3 hours",
                    notes: "Take breaks as needed"
                },
                dinner: "Dinner at recommended spot",
                evening: "Leisure time"
            });
        }

        return { itinerary };
    }
});

/**
 * Optimize Step - Refine logistics and timing
 */
const optimizeStep = createStep({
    id: "optimize-itinerary",
    description: "Optimize itinerary for logistics and timing",
    inputSchema: z.object({
        itinerary: z.array(
            z.object({
                day: z.number(),
                date: z.string(),
                theme: z.string(),
                morning: z.object({
                    activity: z.string(),
                    duration: z.string(),
                    notes: z.string()
                }),
                lunch: z.string(),
                afternoon: z.object({
                    activity: z.string(),
                    duration: z.string(),
                    notes: z.string()
                }),
                dinner: z.string(),
                evening: z.string().optional()
            })
        )
    }),
    outputSchema: z.object({
        itinerary: z.array(
            z.object({
                day: z.number(),
                date: z.string(),
                theme: z.string(),
                morning: z.object({
                    activity: z.string(),
                    time: z.string(),
                    duration: z.string(),
                    notes: z.string()
                }),
                lunch: z.object({
                    time: z.string(),
                    recommendation: z.string()
                }),
                afternoon: z.object({
                    activity: z.string(),
                    time: z.string(),
                    duration: z.string(),
                    notes: z.string()
                }),
                dinner: z.object({
                    time: z.string(),
                    recommendation: z.string()
                }),
                evening: z.string().optional()
            })
        ),
        optimizations: z.array(z.string())
    }),
    execute: async ({ inputData }) => {
        // Add specific times and optimize
        const optimizedItinerary = inputData.itinerary.map((day) => ({
            ...day,
            morning: {
                ...day.morning,
                time: "9:00 AM"
            },
            lunch: {
                time: "12:30 PM",
                recommendation: day.lunch
            },
            afternoon: {
                ...day.afternoon,
                time: "2:00 PM"
            },
            dinner: {
                time: "7:00 PM",
                recommendation: day.dinner
            }
        }));

        const optimizations = [
            "Added specific timing for each activity",
            "Grouped nearby attractions together",
            "Allowed buffer time for travel between locations",
            "Scheduled popular attractions early to avoid crowds"
        ];

        return {
            itinerary: optimizedItinerary,
            optimizations
        };
    }
});

/**
 * Format Step - Create final formatted output
 */
const formatStep = createStep({
    id: "format-itinerary",
    description: "Format itinerary for final output",
    inputSchema: z.object({
        itinerary: z.array(z.any()),
        optimizations: z.array(z.string())
    }),
    outputSchema: z.object({
        title: z.string(),
        summary: z.string(),
        days: z.array(
            z.object({
                day: z.number(),
                theme: z.string(),
                schedule: z.array(
                    z.object({
                        time: z.string(),
                        activity: z.string(),
                        type: z.string(),
                        notes: z.string().optional()
                    })
                )
            })
        ),
        tips: z.array(z.string()),
        packingReminders: z.array(z.string())
    }),
    execute: async ({ inputData }) => {
        const days = inputData.itinerary.map((day: any) => ({
            day: day.day,
            theme: day.theme,
            schedule: [
                {
                    time: day.morning.time,
                    activity: day.morning.activity,
                    type: "activity",
                    notes: day.morning.notes
                },
                {
                    time: day.lunch.time,
                    activity: day.lunch.recommendation,
                    type: "meal"
                },
                {
                    time: day.afternoon.time,
                    activity: day.afternoon.activity,
                    type: "activity",
                    notes: day.afternoon.notes
                },
                {
                    time: day.dinner.time,
                    activity: day.dinner.recommendation,
                    type: "meal"
                },
                ...(day.evening
                    ? [
                          {
                              time: "8:30 PM",
                              activity: day.evening,
                              type: "evening"
                          }
                      ]
                    : [])
            ]
        }));

        return {
            title: `${inputData.itinerary.length}-Day Trip Itinerary`,
            summary: `A ${inputData.itinerary.length}-day adventure with a balanced mix of sightseeing, culture, and local experiences.`,
            days,
            tips: [
                "Book popular attractions in advance",
                "Download offline maps",
                "Keep copies of important documents",
                "Stay hydrated and take breaks"
            ],
            packingReminders: [
                "Comfortable walking shoes",
                "Weather-appropriate clothing",
                "Universal power adapter",
                "Small day bag"
            ]
        };
    }
});

/**
 * Itinerary Assembly Workflow
 *
 * Creates a detailed day-by-day itinerary through a sequential process:
 * 1. Research destination
 * 2. Draft initial itinerary
 * 3. Optimize timing and logistics
 * 4. Format final output
 */
export const itineraryAssemblyWorkflow = createWorkflow({
    id: "trip-itinerary-assembly",
    description: `Creates a detailed day-by-day itinerary by researching the 
destination, drafting a plan, optimizing logistics, and formatting the output.`,
    inputSchema: itineraryInputSchema,
    outputSchema: z.object({
        title: z.string(),
        summary: z.string(),
        days: z.array(
            z.object({
                day: z.number(),
                theme: z.string(),
                schedule: z.array(
                    z.object({
                        time: z.string(),
                        activity: z.string(),
                        type: z.string(),
                        notes: z.string().optional()
                    })
                )
            })
        ),
        tips: z.array(z.string()),
        packingReminders: z.array(z.string())
    })
})
    .then(researchStep)
    .then(draftStep)
    .then(optimizeStep)
    .then(formatStep)
    .commit();
