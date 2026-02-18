import { NextResponse } from "next/server";
import { z } from "zod";

export function parseJsonBodySchema<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    body: unknown
): { data: z.infer<TSchema>; response?: undefined } | { data?: undefined; response: NextResponse } {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return {
            response: NextResponse.json(
                {
                    success: false,
                    error: "Invalid request payload",
                    issues: parsed.error.issues.map((issue) => ({
                        path: issue.path.join("."),
                        message: issue.message
                    }))
                },
                { status: 400 }
            )
        };
    }
    return { data: parsed.data };
}

export const nonEmptyString = z.string().trim().min(1);
