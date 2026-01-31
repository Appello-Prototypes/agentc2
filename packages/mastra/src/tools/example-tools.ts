import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Date/Time Tool - Get current date and time in any timezone
 */
export const dateTimeTool = createTool({
    id: "get-datetime",
    description:
        "Get the current date and time. Optionally specify a timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo').",
    inputSchema: z.object({
        timezone: z
            .string()
            .optional()
            .describe("IANA timezone name (e.g., 'America/New_York'). Defaults to UTC.")
    }),
    outputSchema: z.object({
        datetime: z.string().describe("Formatted date and time string"),
        date: z.string().describe("Date in YYYY-MM-DD format"),
        time: z.string().describe("Time in HH:MM:SS format"),
        timezone: z.string().describe("Timezone used"),
        timestamp: z.number().describe("Unix timestamp in milliseconds")
    }),
    execute: async ({ timezone = "UTC" }) => {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        };

        const formatter = new Intl.DateTimeFormat("en-CA", options);
        const parts = formatter.formatToParts(now);

        const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

        const date = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
        const time = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;

        return {
            datetime: now.toLocaleString("en-US", { timeZone: timezone }),
            date,
            time,
            timezone,
            timestamp: now.getTime()
        };
    }
});

/**
 * Calculator Tool - Perform basic and advanced math operations
 */
export const calculatorTool = createTool({
    id: "calculator",
    description:
        "Perform mathematical calculations. Supports basic operations (+, -, *, /), exponents (^), and common functions (sqrt, sin, cos, tan, log, abs, round, floor, ceil).",
    inputSchema: z.object({
        expression: z
            .string()
            .describe("Mathematical expression to evaluate (e.g., '2 + 2', 'sqrt(16)', '10 ^ 2')")
    }),
    outputSchema: z.object({
        expression: z.string().describe("The original expression"),
        result: z.number().describe("The calculated result"),
        formatted: z.string().describe("Formatted result string")
    }),
    execute: async ({ expression }) => {
        // Safe math expression evaluator
        const safeEval = (expr: string): number => {
            // Replace common math functions and operators
            let sanitized = expr
                .replace(/\^/g, "**") // Exponent
                .replace(/sqrt\(/g, "Math.sqrt(")
                .replace(/sin\(/g, "Math.sin(")
                .replace(/cos\(/g, "Math.cos(")
                .replace(/tan\(/g, "Math.tan(")
                .replace(/log\(/g, "Math.log10(")
                .replace(/ln\(/g, "Math.log(")
                .replace(/abs\(/g, "Math.abs(")
                .replace(/round\(/g, "Math.round(")
                .replace(/floor\(/g, "Math.floor(")
                .replace(/ceil\(/g, "Math.ceil(")
                .replace(/pi/gi, "Math.PI")
                .replace(/e(?![a-z])/gi, "Math.E");

            // Validate: only allow numbers, operators, parentheses, Math functions, and whitespace
            if (!/^[\d\s+\-*/.()Math,a-z]+$/i.test(sanitized)) {
                throw new Error("Invalid characters in expression");
            }

            // Use Function constructor for safe evaluation
            const fn = new Function(`return ${sanitized}`);
            const result = fn();

            if (typeof result !== "number" || !isFinite(result)) {
                throw new Error("Expression did not evaluate to a valid number");
            }

            return result;
        };

        try {
            const result = safeEval(expression);
            return {
                expression,
                result,
                formatted: Number.isInteger(result)
                    ? result.toString()
                    : result.toFixed(6).replace(/\.?0+$/, "")
            };
        } catch (error) {
            throw new Error(
                `Failed to evaluate expression: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
});

/**
 * Generate ID Tool - Create unique identifiers
 */
export const generateIdTool = createTool({
    id: "generate-id",
    description:
        "Generate a unique identifier. Useful for creating IDs for new records, sessions, or tracking purposes.",
    inputSchema: z.object({
        prefix: z
            .string()
            .optional()
            .describe("Optional prefix for the ID (e.g., 'user', 'order')"),
        length: z.number().optional().describe("Length of the random portion (default: 12)")
    }),
    outputSchema: z.object({
        id: z.string().describe("The generated unique identifier"),
        timestamp: z.number().describe("Timestamp when ID was generated")
    }),
    execute: async ({ prefix, length = 12 }) => {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let randomPart = "";

        for (let i = 0; i < length; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const id = prefix ? `${prefix}_${randomPart}` : randomPart;

        return {
            id,
            timestamp: Date.now()
        };
    }
});

/**
 * All tools bundled together for agent registration
 */
export const tools = {
    dateTimeTool,
    calculatorTool,
    generateIdTool
};
