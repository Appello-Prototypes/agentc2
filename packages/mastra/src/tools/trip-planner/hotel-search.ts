import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Hotel Search Tool
 *
 * Simulated hotel search for demo purposes.
 * In production, this would connect to a real hotel API
 * (e.g., Booking.com, Expedia, Hotels.com).
 */
export const hotelSearchTool = createTool({
    id: "hotel-search",
    description: `Search for hotels and accommodations at a location. Returns 
options with prices, ratings, and amenities. Use when researching where to stay.`,
    inputSchema: z.object({
        location: z.string().describe("City or area to search (e.g., 'Tokyo, Japan')"),
        checkIn: z.string().describe("Check-in date in YYYY-MM-DD format"),
        checkOut: z.string().describe("Check-out date in YYYY-MM-DD format"),
        guests: z.number().default(2).describe("Number of guests"),
        rooms: z.number().default(1).describe("Number of rooms"),
        budget: z.enum(["budget", "mid-range", "luxury"]).optional().describe("Budget preference")
    }),
    outputSchema: z.object({
        hotels: z.array(
            z.object({
                name: z.string(),
                type: z.string(),
                stars: z.number(),
                rating: z.number(),
                reviewCount: z.number(),
                pricePerNight: z.number(),
                totalPrice: z.number(),
                amenities: z.array(z.string()),
                neighborhood: z.string(),
                distanceToCenter: z.string()
            })
        ),
        searchParams: z.object({
            location: z.string(),
            checkIn: z.string(),
            checkOut: z.string(),
            guests: z.number(),
            rooms: z.number(),
            nights: z.number()
        })
    }),
    execute: async ({ location, checkIn, checkOut, guests = 2, rooms = 1, budget }) => {
        // Calculate nights
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        // Simulated hotel data for demo
        const hotelTemplates = [
            {
                type: "Luxury Hotel",
                stars: 5,
                basePrice: 350,
                amenities: ["Spa", "Pool", "Fine Dining", "Concierge", "Gym", "Room Service"]
            },
            {
                type: "Boutique Hotel",
                stars: 4,
                basePrice: 200,
                amenities: ["Restaurant", "Bar", "Gym", "Room Service", "WiFi"]
            },
            {
                type: "Business Hotel",
                stars: 4,
                basePrice: 150,
                amenities: ["Business Center", "Gym", "Restaurant", "WiFi", "Parking"]
            },
            {
                type: "Mid-Range Hotel",
                stars: 3,
                basePrice: 100,
                amenities: ["Breakfast", "WiFi", "Parking", "Laundry"]
            },
            {
                type: "Budget Hotel",
                stars: 2,
                basePrice: 60,
                amenities: ["WiFi", "Breakfast", "Parking"]
            },
            {
                type: "Vacation Rental",
                stars: 0,
                basePrice: 120,
                amenities: ["Kitchen", "Washer", "WiFi", "Living Room", "Local Host"]
            },
            {
                type: "Hostel",
                stars: 0,
                basePrice: 35,
                amenities: ["Shared Kitchen", "Common Area", "WiFi", "Lockers"]
            }
        ];

        const neighborhoods = [
            "City Center",
            "Historic District",
            "Arts Quarter",
            "Business District",
            "Waterfront",
            "University Area"
        ];

        const hotelNames = [
            "Grand",
            "Royal",
            "Park",
            "Plaza",
            "Central",
            "Harbor",
            "Garden",
            "Imperial",
            "Metropolitan"
        ];

        const generateHotels = () => {
            let templates = hotelTemplates;

            // Filter by budget preference
            if (budget === "budget") {
                templates = templates.filter((t) => t.basePrice <= 80);
            } else if (budget === "mid-range") {
                templates = templates.filter((t) => t.basePrice > 80 && t.basePrice <= 200);
            } else if (budget === "luxury") {
                templates = templates.filter((t) => t.basePrice > 200);
            }

            const hotels = templates.map((template) => {
                const priceVariance = 0.8 + Math.random() * 0.4;
                const pricePerNight = Math.round(template.basePrice * priceVariance * rooms);
                const name = `${hotelNames[Math.floor(Math.random() * hotelNames.length)]} ${template.type.split(" ")[0]}`;

                return {
                    name: `${name} ${location.split(",")[0]}`,
                    type: template.type,
                    stars: template.stars,
                    rating: 3.5 + Math.random() * 1.5,
                    reviewCount: 100 + Math.floor(Math.random() * 2000),
                    pricePerNight,
                    totalPrice: pricePerNight * nights,
                    amenities: template.amenities,
                    neighborhood: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
                    distanceToCenter: `${(0.2 + Math.random() * 3).toFixed(1)} km`
                };
            });

            return hotels.sort((a, b) => a.pricePerNight - b.pricePerNight);
        };

        const hotels = generateHotels();

        console.log(
            `[Hotel Search] ${location} (${nights} nights): Found ${hotels.length} properties`
        );

        return {
            hotels,
            searchParams: {
                location,
                checkIn,
                checkOut,
                guests,
                rooms,
                nights
            }
        };
    }
});
