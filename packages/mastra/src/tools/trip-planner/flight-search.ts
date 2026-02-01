import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Flight Search Tool
 *
 * Simulated flight search for demo purposes.
 * In production, this would connect to a real flight API
 * (e.g., Amadeus, Skyscanner, Google Flights).
 */
export const flightSearchTool = createTool({
    id: "flight-search",
    description: `Search for flights between two locations. Returns flight options 
with prices, airlines, and duration. Use when researching air travel options.`,
    inputSchema: z.object({
        origin: z.string().describe("Origin city or airport code (e.g., 'New York' or 'JFK')"),
        destination: z
            .string()
            .describe("Destination city or airport code (e.g., 'Tokyo' or 'NRT')"),
        departDate: z.string().describe("Departure date in YYYY-MM-DD format"),
        returnDate: z
            .string()
            .optional()
            .describe("Return date in YYYY-MM-DD format (optional for one-way)"),
        passengers: z.number().default(1).describe("Number of passengers")
    }),
    outputSchema: z.object({
        flights: z.array(
            z.object({
                airline: z.string(),
                flightNumber: z.string(),
                departure: z.object({
                    airport: z.string(),
                    time: z.string()
                }),
                arrival: z.object({
                    airport: z.string(),
                    time: z.string()
                }),
                duration: z.string(),
                stops: z.number(),
                price: z.number(),
                class: z.string()
            })
        ),
        searchParams: z.object({
            origin: z.string(),
            destination: z.string(),
            departDate: z.string(),
            returnDate: z.string().optional(),
            passengers: z.number()
        })
    }),
    execute: async ({ origin, destination, departDate, returnDate, passengers = 1 }) => {
        // Simulated flight data for demo
        const airlines = [
            "United Airlines",
            "Delta",
            "American Airlines",
            "Japan Airlines",
            "ANA",
            "Emirates",
            "British Airways"
        ];

        const generateFlights = () => {
            const numFlights = 3 + Math.floor(Math.random() * 3);
            const flights = [];

            for (let i = 0; i < numFlights; i++) {
                const airline = airlines[Math.floor(Math.random() * airlines.length)];
                const stops = Math.floor(Math.random() * 3);
                const basePrice = 400 + Math.floor(Math.random() * 800);
                const duration = stops === 0 ? "14h 30m" : stops === 1 ? "18h 45m" : "24h 15m";

                flights.push({
                    airline,
                    flightNumber: `${airline.substring(0, 2).toUpperCase()}${100 + Math.floor(Math.random() * 900)}`,
                    departure: {
                        airport: origin.length === 3 ? origin : `${origin} Intl`,
                        time: `${6 + Math.floor(Math.random() * 12)}:${Math.random() > 0.5 ? "00" : "30"}`
                    },
                    arrival: {
                        airport: destination.length === 3 ? destination : `${destination} Intl`,
                        time: `${6 + Math.floor(Math.random() * 12)}:${Math.random() > 0.5 ? "00" : "30"} +1d`
                    },
                    duration,
                    stops,
                    price: basePrice * passengers,
                    class: "Economy"
                });
            }

            return flights.sort((a, b) => a.price - b.price);
        };

        const flights = generateFlights();

        console.log(
            `[Flight Search] ${origin} → ${destination} on ${departDate}: Found ${flights.length} flights`
        );

        return {
            flights,
            searchParams: {
                origin,
                destination,
                departDate,
                returnDate,
                passengers
            }
        };
    }
});
