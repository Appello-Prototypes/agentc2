import { Inngest, EventSchemas } from "inngest";

/**
 * Inngest client for background goal execution.
 *
 * Events:
 * - goal/submitted: Triggered when a user submits a new goal
 * - goal/retry: Triggered for manual retry of a failed goal
 */
export const inngest = new Inngest({
    id: "mastra-agent",
    schemas: new EventSchemas().fromRecord<{
        "goal/submitted": {
            data: {
                goalId: string;
                userId: string;
            };
        };
        "goal/retry": {
            data: {
                goalId: string;
                userId: string;
                attempt: number;
            };
        };
    }>()
});
