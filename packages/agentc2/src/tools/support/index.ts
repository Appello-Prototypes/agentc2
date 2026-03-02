/**
 * Support Ticket Tools -- User-facing bug & feature request management.
 *
 * 4 tools for users to interact with the support ticket system via chat:
 * - submit-support-ticket: Create a new bug report, feature request, improvement, or question
 * - list-my-tickets: List the user's submitted tickets with optional filters
 * - view-ticket-details: View full ticket details with comment thread
 * - comment-on-ticket: Add a comment to an existing ticket
 *
 * All tools use direct Prisma calls (no HTTP self-calls).
 * Context (userId, organizationId) is passed as tool input parameters.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

/**
 * Splits a compound "orgId:userId" resourceId into its parts.
 * Returns the raw value if no separator is found.
 */
function splitResourceId(raw: string): { orgId: string | null; userId: string } {
    const idx = raw.indexOf(":");
    if (idx === -1) return { orgId: null, userId: raw };
    return { orgId: raw.slice(0, idx), userId: raw.slice(idx + 1) };
}

const ticketTypeEnum = ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"] as const;
type TicketType = (typeof ticketTypeEnum)[number];

const ticketTypeAliases: Record<string, TicketType> = {
    bug: "BUG",
    feature_request: "FEATURE_REQUEST",
    feature: "FEATURE_REQUEST",
    improvement: "IMPROVEMENT",
    question: "QUESTION"
};

function normalizeTicketType(val: string): TicketType {
    const upper = val.toUpperCase() as TicketType;
    if (ticketTypeEnum.includes(upper)) return upper;
    const alias = ticketTypeAliases[val.toLowerCase()];
    if (alias) return alias;
    return upper;
}

const ticketTypeSchema = z
    .string()
    .transform(normalizeTicketType)
    .describe(
        "Type of ticket: BUG for bugs/errors, FEATURE_REQUEST for new features, IMPROVEMENT for enhancements, QUESTION for general questions"
    );

const ticketStatusEnum = [
    "NEW",
    "TRIAGED",
    "IN_PROGRESS",
    "WAITING_ON_CUSTOMER",
    "RESOLVED",
    "CLOSED"
] as const;

const ticketStatusSchema = z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(ticketStatusEnum))
    .optional()
    .describe("Filter by status (optional)");

// ─── submit-support-ticket ──────────────────────────────────────────────────

export const submitSupportTicketTool = createTool({
    id: "submit-support-ticket",
    description:
        "Submit a support ticket (bug report, feature request, improvement, or question). " +
        "Creates a new ticket in the system that will be reviewed by the platform team. " +
        "Returns the ticket number for future reference.",
    inputSchema: z.object({
        type: ticketTypeSchema,
        title: z.string().describe("Short, descriptive title for the ticket"),
        description: z
            .string()
            .describe(
                "Detailed description. For bugs: include steps to reproduce, expected vs actual behavior. For features: describe the desired functionality and use case."
            ),
        priority: z
            .string()
            .optional()
            .describe("Optional priority: low, medium, high, or critical"),
        tags: z
            .array(z.string())
            .optional()
            .describe("Optional tags for categorization (e.g., 'ui', 'api', 'performance')"),
        userId: z
            .string()
            .optional()
            .describe(
                "The ID of the user submitting the ticket (auto-filled from context if omitted)"
            ),
        organizationId: z
            .string()
            .optional()
            .describe("The organization ID (auto-filled from context if omitted)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        type,
        title,
        description,
        priority,
        tags,
        userId: rawUserId,
        organizationId: rawOrgId
    }) => {
        let userId = rawUserId;
        let organizationId = rawOrgId;

        if (userId && userId.includes(":")) {
            const parts = splitResourceId(userId);
            userId = parts.userId;
            organizationId = organizationId || parts.orgId || undefined;
        }

        if (!userId || !organizationId) {
            return {
                success: false,
                error: "Missing userId or organizationId. Please provide them or ensure the agent has user context."
            };
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true }
        });

        if (!user) {
            return { success: false, error: `User not found for ID: ${userId}` };
        }

        const validPriorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
        type PrismaTicketPriority = (typeof validPriorities)[number];

        let resolvedPriority: PrismaTicketPriority | undefined;
        if (priority) {
            const upper = priority.toUpperCase();
            if (validPriorities.includes(upper as PrismaTicketPriority)) {
                resolvedPriority = upper as PrismaTicketPriority;
            }
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                type: type as "BUG" | "FEATURE_REQUEST" | "IMPROVEMENT" | "QUESTION",
                title,
                description,
                tags: tags ?? [],
                ...(resolvedPriority ? { priority: resolvedPriority } : {}),
                submittedById: userId,
                organizationId
            }
        });

        return {
            success: true,
            ticket: {
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                type: ticket.type,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                createdAt: ticket.createdAt
            },
            message: `Ticket #${ticket.ticketNumber} has been submitted successfully. Our team will review it shortly.`
        };
    }
});

// ─── list-my-tickets ────────────────────────────────────────────────────────

export const listMyTicketsTool = createTool({
    id: "list-my-tickets",
    description:
        "List your submitted support tickets with optional filters. " +
        "Shows ticket number, title, type, status, priority, and creation date. " +
        "Results are ordered by most recent first.",
    inputSchema: z.object({
        status: ticketStatusSchema,
        type: ticketTypeSchema.optional().describe("Filter by ticket type (optional)"),
        limit: z
            .number()
            .optional()
            .describe("Max number of tickets to return (default: 20, max: 50)"),
        userId: z
            .string()
            .optional()
            .describe(
                "The ID of the user whose tickets to list (auto-filled from context if omitted)"
            ),
        organizationId: z
            .string()
            .optional()
            .describe(
                "The organization ID to scope tickets to (auto-filled from context if omitted)"
            )
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ status, type, limit, userId: rawUserId, organizationId: rawOrgId }) => {
        let userId = rawUserId;
        let organizationId = rawOrgId;

        if (userId && userId.includes(":")) {
            const parts = splitResourceId(userId);
            userId = parts.userId;
            organizationId = organizationId || parts.orgId || undefined;
        }

        if (!userId || !organizationId) {
            return {
                success: false,
                error: "Missing userId or organizationId."
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            submittedById: userId,
            organizationId
        };
        if (status) where.status = status;
        if (type) where.type = type;

        const take = Math.min(limit ?? 20, 50);

        const [tickets, total] = await Promise.all([
            prisma.supportTicket.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take,
                include: {
                    _count: {
                        select: { comments: true }
                    }
                }
            }),
            prisma.supportTicket.count({ where })
        ]);

        return {
            success: true,
            tickets: tickets.map((t) => ({
                ticketNumber: t.ticketNumber,
                type: t.type,
                title: t.title,
                status: t.status,
                priority: t.priority,
                commentCount: t._count.comments,
                createdAt: t.createdAt,
                resolvedAt: t.resolvedAt
            })),
            total,
            showing: tickets.length
        };
    }
});

// ─── view-ticket-details ────────────────────────────────────────────────────

export const viewTicketDetailsTool = createTool({
    id: "view-ticket-details",
    description:
        "View full details of a specific support ticket by ticket number, including the comment thread. " +
        "Only shows comments visible to users (excludes internal admin notes).",
    inputSchema: z.object({
        ticketNumber: z.number().describe("The ticket number (e.g., 1, 2, 3)"),
        userId: z
            .string()
            .optional()
            .describe("The ID of the requesting user (auto-filled from context if omitted)"),
        organizationId: z
            .string()
            .optional()
            .describe(
                "The organization ID to scope the lookup to (auto-filled from context if omitted)"
            )
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ ticketNumber, userId: rawUserId, organizationId: rawOrgId }) => {
        let userId = rawUserId;
        let organizationId = rawOrgId;

        if (userId && userId.includes(":")) {
            const parts = splitResourceId(userId);
            userId = parts.userId;
            organizationId = organizationId || parts.orgId || undefined;
        }

        if (!userId || !organizationId) {
            return {
                success: false,
                error: "Missing userId or organizationId."
            };
        }

        const ticket = await prisma.supportTicket.findFirst({
            where: {
                ticketNumber,
                organizationId
            },
            include: {
                submittedBy: {
                    select: { id: true, name: true, email: true }
                },
                comments: {
                    where: { isInternal: false },
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (!ticket) {
            return {
                success: false,
                error: `Ticket #${ticketNumber} not found in your organization`
            };
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            }
        });

        if (!membership) {
            return { success: false, error: "You do not have access to this ticket" };
        }

        return {
            success: true,
            ticket: {
                ticketNumber: ticket.ticketNumber,
                type: ticket.type,
                status: ticket.status,
                priority: ticket.priority,
                title: ticket.title,
                description: ticket.description,
                tags: ticket.tags,
                submittedBy: {
                    name: ticket.submittedBy.name,
                    email: ticket.submittedBy.email
                },
                createdAt: ticket.createdAt,
                triagedAt: ticket.triagedAt,
                resolvedAt: ticket.resolvedAt,
                closedAt: ticket.closedAt,
                comments: ticket.comments.map((c) => ({
                    authorType: c.authorType,
                    authorName: c.authorName,
                    content: c.content,
                    createdAt: c.createdAt
                }))
            }
        };
    }
});

// ─── comment-on-ticket ──────────────────────────────────────────────────────

export const commentOnTicketTool = createTool({
    id: "comment-on-ticket",
    description:
        "Add a comment to an existing support ticket. " +
        "Use this to provide additional information, answer questions from the support team, " +
        "or follow up on a ticket.",
    inputSchema: z.object({
        ticketNumber: z.number().describe("The ticket number to comment on"),
        message: z.string().describe("The comment text to add"),
        userId: z
            .string()
            .optional()
            .describe(
                "The ID of the user adding the comment (auto-filled from context if omitted)"
            ),
        organizationId: z
            .string()
            .optional()
            .describe(
                "The organization ID to scope the lookup to (auto-filled from context if omitted)"
            )
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ ticketNumber, message, userId: rawUserId, organizationId: rawOrgId }) => {
        let userId = rawUserId;
        let organizationId = rawOrgId;

        if (userId && userId.includes(":")) {
            const parts = splitResourceId(userId);
            userId = parts.userId;
            organizationId = organizationId || parts.orgId || undefined;
        }

        if (!userId || !organizationId) {
            return {
                success: false,
                error: "Missing userId or organizationId."
            };
        }

        const ticket = await prisma.supportTicket.findFirst({
            where: {
                ticketNumber,
                organizationId
            }
        });

        if (!ticket) {
            return {
                success: false,
                error: `Ticket #${ticketNumber} not found in your organization`
            };
        }

        if (ticket.status === "CLOSED") {
            return {
                success: false,
                error: `Ticket #${ticketNumber} is closed and cannot receive new comments`
            };
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const comment = await prisma.supportTicketComment.create({
            data: {
                ticketId: ticket.id,
                authorType: "user",
                authorId: userId,
                authorName: user.name,
                content: message,
                isInternal: false
            }
        });

        // If ticket was waiting on customer, move back to in-progress
        if (ticket.status === "WAITING_ON_CUSTOMER") {
            await prisma.supportTicket.update({
                where: { id: ticket.id },
                data: { status: "IN_PROGRESS" }
            });
        }

        return {
            success: true,
            comment: {
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt
            },
            message: `Comment added to ticket #${ticketNumber} successfully.`
        };
    }
});
