import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Weather Lookup Tool
 *
 * Provides weather forecasts for travel planning.
 * In production, this could connect to a weather API
 * (e.g., OpenWeatherMap, Weather.com, AccuWeather).
 */
export const weatherLookupTool = createTool({
    id: "weather-lookup",
    description: `Get weather forecast for a location and date range. Returns 
temperature, conditions, and packing recommendations. Use for trip planning 
and knowing what to pack.`,
    inputSchema: z.object({
        location: z.string().describe("City or destination (e.g., 'Tokyo, Japan')"),
        startDate: z.string().describe("Start date in YYYY-MM-DD format"),
        endDate: z.string().optional().describe("End date in YYYY-MM-DD format (optional)")
    }),
    outputSchema: z.object({
        location: z.string(),
        forecast: z.array(
            z.object({
                date: z.string(),
                condition: z.string(),
                tempHigh: z.number(),
                tempLow: z.number(),
                precipitation: z.number(),
                humidity: z.number()
            })
        ),
        summary: z.object({
            averageHigh: z.number(),
            averageLow: z.number(),
            conditions: z.array(z.string()),
            packingTips: z.array(z.string())
        })
    }),
    execute: async ({ location, startDate, endDate }) => {
        // Parse dates
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date(startDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Simulated weather conditions based on destination patterns
        const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Showers", "Clear"];

        // Generate seasonal base temperatures (simplified)
        const month = start.getMonth();
        const isNorthernHemisphere = !location.toLowerCase().includes("australia");
        const isSummer = isNorthernHemisphere
            ? month >= 5 && month <= 8
            : month >= 11 || month <= 2;
        const isWinter = isNorthernHemisphere
            ? month >= 11 || month <= 2
            : month >= 5 && month <= 8;

        let baseTemp = 20; // Default spring/fall
        if (isSummer) baseTemp = 28;
        if (isWinter) baseTemp = 8;

        // Adjust for tropical locations
        if (
            location.toLowerCase().includes("thailand") ||
            location.toLowerCase().includes("bali") ||
            location.toLowerCase().includes("hawaii")
        ) {
            baseTemp = 30;
        }

        // Generate forecast
        const forecast = [];
        let totalHigh = 0;
        let totalLow = 0;
        const seenConditions = new Set<string>();

        for (let i = 0; i < Math.min(days, 14); i++) {
            const date = new Date(start);
            date.setDate(date.getDate() + i);

            const variance = Math.floor(Math.random() * 6) - 3;
            const tempHigh = baseTemp + variance + Math.floor(Math.random() * 5);
            const tempLow = tempHigh - 8 - Math.floor(Math.random() * 4);
            const condition = conditions[Math.floor(Math.random() * conditions.length)];

            totalHigh += tempHigh;
            totalLow += tempLow;
            seenConditions.add(condition);

            forecast.push({
                date: date.toISOString().split("T")[0],
                condition,
                tempHigh,
                tempLow,
                precipitation:
                    condition.includes("Rain") || condition.includes("Shower")
                        ? 40 + Math.floor(Math.random() * 40)
                        : Math.floor(Math.random() * 20),
                humidity: 40 + Math.floor(Math.random() * 40)
            });
        }

        // Generate packing tips based on conditions
        const packingTips: string[] = [];
        const avgHigh = Math.round(totalHigh / forecast.length);
        const avgLow = Math.round(totalLow / forecast.length);

        if (avgHigh > 25) packingTips.push("Light, breathable clothing");
        if (avgHigh > 30) packingTips.push("Sunscreen and hat essential");
        if (avgLow < 15) packingTips.push("Bring layers for cool evenings");
        if (avgLow < 10) packingTips.push("Warm jacket recommended");
        if (seenConditions.has("Light Rain") || seenConditions.has("Showers")) {
            packingTips.push("Pack a light rain jacket or umbrella");
        }
        packingTips.push("Comfortable walking shoes");

        console.log(`[Weather Lookup] ${location}: ${forecast.length} day forecast generated`);

        return {
            location,
            forecast,
            summary: {
                averageHigh: avgHigh,
                averageLow: avgLow,
                conditions: Array.from(seenConditions),
                packingTips
            }
        };
    }
});
