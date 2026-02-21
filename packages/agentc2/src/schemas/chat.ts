import { z } from "zod";

export const chatMessageSchema = z.object({
    message: z.string().min(1).max(100000),
    threadId: z.string().optional(),
    context: z.record(z.unknown()).optional(),
    maxSteps: z.number().int().min(1).max(100).optional(),
    tools: z.array(z.string()).optional(),
    environment: z.string().max(50).optional()
});

export const toolCallSchema = z.object({
    toolName: z.string().min(1).max(255),
    args: z.record(z.unknown())
});
