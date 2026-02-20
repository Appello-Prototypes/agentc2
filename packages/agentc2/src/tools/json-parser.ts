import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * JSON Parser Tool
 *
 * Parses JSON strings and extracts specific fields.
 */
export const jsonParserTool = createTool({
    id: "json-parser",
    description:
        "Parse a JSON string and optionally extract specific fields using dot notation paths.",
    inputSchema: z.object({
        jsonString: z.string().describe("The JSON string to parse"),
        extractPaths: z
            .array(z.string())
            .optional()
            .describe("Optional dot-notation paths to extract (e.g., 'user.name', 'items[0].id')")
    }),
    outputSchema: z.object({
        parsed: z.any(),
        extracted: z.record(z.any()).optional(),
        type: z.string(),
        keys: z.array(z.string()).optional()
    }),
    execute: async ({ jsonString, extractPaths }) => {
        try {
            const parsed = JSON.parse(jsonString);
            const type = Array.isArray(parsed) ? "array" : typeof parsed;

            let extracted: Record<string, any> | undefined;

            if (extractPaths && extractPaths.length > 0) {
                extracted = {};
                for (const path of extractPaths) {
                    const value = getNestedValue(parsed, path);
                    extracted[path] = value;
                }
            }

            const keys = type === "object" ? Object.keys(parsed) : undefined;

            return {
                parsed,
                extracted,
                type,
                keys
            };
        } catch (error) {
            throw new Error(
                `Invalid JSON: ${error instanceof Error ? error.message : "Parse error"}`
            );
        }
    }
});

function getNestedValue(obj: any, path: string): any {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current = obj;

    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }

    return current;
}
