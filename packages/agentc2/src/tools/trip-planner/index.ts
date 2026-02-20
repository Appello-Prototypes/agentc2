/**
 * Trip Planner Tools
 *
 * A collection of tools for trip planning including
 * flight search, hotel search, weather lookup, and note-taking.
 */

export { flightSearchTool } from "./flight-search";
export { hotelSearchTool } from "./hotel-search";
export { weatherLookupTool } from "./weather-lookup";
export { tripNotesTool, clearTripNotes } from "./trip-notes";

import { flightSearchTool } from "./flight-search";
import { hotelSearchTool } from "./hotel-search";
import { weatherLookupTool } from "./weather-lookup";
import { tripNotesTool } from "./trip-notes";

// Bundle of all trip planner tools
export const tripPlannerTools = {
    flightSearch: flightSearchTool,
    hotelSearch: hotelSearchTool,
    weatherLookup: weatherLookupTool,
    tripNotes: tripNotesTool
};
