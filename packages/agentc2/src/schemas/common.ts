import { z } from "zod";

export const idSchema = z.string().min(1).max(255);

export const slugSchema = z
    .string()
    .min(1)
    .max(128)
    .regex(
        /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
        "Must be lowercase alphanumeric with hyphens"
    );

export const dateRangeSchema = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional()
});

export const paginationSchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(["asc", "desc"]).default("desc"),
    sortBy: z.string().optional()
});

export const searchQuerySchema = z.object({
    q: z.string().max(500).optional(),
    ...paginationSchema.shape
});
