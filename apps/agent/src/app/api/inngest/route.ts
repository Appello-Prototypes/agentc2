import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { inngestFunctions } from "@/lib/inngest-functions";

/**
 * Inngest API route handler
 *
 * This endpoint is called by Inngest to:
 * - GET: Introspect available functions
 * - POST: Execute function invocations
 * - PUT: Handle function step completions
 *
 * @see https://www.inngest.com/docs/reference/serve
 */
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: inngestFunctions
});
