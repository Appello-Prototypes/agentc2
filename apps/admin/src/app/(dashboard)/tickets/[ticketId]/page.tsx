import { prisma } from "@repo/database";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TicketTriagePanel } from "./triage-panel";
import { TicketCommentForm } from "./comment-form";
import { EditableTitle, EditableDescription, EditableType } from "./edit-fields";
import { DeleteTicketButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
    params
}: {
    params: Promise<{ ticketId: string }>;
}) {
    const { ticketId } = await params;

    const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
            organization: { select: { id: true, name: true, slug: true } },
            submittedBy: { select: { id: true, name: true, email: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            comments: { orderBy: { createdAt: "asc" } }
        }
    });

    if (!ticket) notFound();

    const adminUsers = await prisma.adminUser.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" }
    });

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
                <Link
                    href="/tickets"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Tickets
                </Link>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-2xl font-bold">
                            #{ticket.ticketNumber}:
                        </span>
                        <EditableTitle
                            ticket={{
                                id: ticket.id,
                                title: ticket.title,
                                description: ticket.description,
                                type: ticket.type
                            }}
                        />
                        <EditableType
                            ticket={{
                                id: ticket.id,
                                title: ticket.title,
                                description: ticket.description,
                                type: ticket.type
                            }}
                        />
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Submitted by {ticket.submittedBy.name} ({ticket.submittedBy.email}) from{" "}
                        <Link
                            href={`/tenants/${ticket.organization.slug}`}
                            className="hover:underline"
                        >
                            {ticket.organization.name}
                        </Link>{" "}
                        on {ticket.createdAt.toLocaleDateString()}
                    </p>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                {/* Left column: Description + Comments */}
                <div className="space-y-6">
                    {/* Description */}
                    <div className="bg-card border-border rounded-lg border p-6">
                        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                            Description
                        </h2>
                        <EditableDescription
                            ticket={{
                                id: ticket.id,
                                title: ticket.title,
                                description: ticket.description,
                                type: ticket.type
                            }}
                        />
                    </div>

                    {/* Comment Thread */}
                    <div className="bg-card border-border rounded-lg border">
                        <div className="border-border border-b px-6 py-4">
                            <h2 className="text-sm font-semibold tracking-wide uppercase">
                                Comments ({ticket.comments.length})
                            </h2>
                        </div>

                        {ticket.comments.length === 0 ? (
                            <div className="text-muted-foreground px-6 py-8 text-center text-sm">
                                No comments yet
                            </div>
                        ) : (
                            <div className="divide-border divide-y">
                                {ticket.comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className={`px-6 py-4 ${comment.isInternal ? "border-l-2 border-l-yellow-500 bg-yellow-500/5" : ""}`}
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">
                                                    {comment.authorName}
                                                </span>
                                                <span
                                                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                                                        comment.authorType === "admin"
                                                            ? "bg-primary/10 text-primary"
                                                            : "bg-secondary text-secondary-foreground"
                                                    }`}
                                                >
                                                    {comment.authorType === "admin"
                                                        ? "Admin"
                                                        : "Customer"}
                                                </span>
                                                {comment.isInternal && (
                                                    <span className="rounded-full bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-600">
                                                        Internal Note
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-muted-foreground text-xs">
                                                {comment.createdAt.toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">
                                            {comment.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Comment Input */}
                        <div className="border-border border-t px-6 py-4">
                            <TicketCommentForm ticketId={ticket.id} />
                        </div>
                    </div>
                </div>

                {/* Right column: Triage Panel + Actions */}
                <div className="space-y-4">
                    <TicketTriagePanel
                        ticket={{
                            id: ticket.id,
                            ticketNumber: ticket.ticketNumber,
                            title: ticket.title,
                            description: ticket.description ?? "",
                            type: ticket.type,
                            status: ticket.status,
                            priority: ticket.priority,
                            assignedToId: ticket.assignedToId,
                            tags: ticket.tags,
                            pipelineRunId:
                                (ticket as { pipelineRunId?: string | null }).pipelineRunId ?? null,
                            triagedAt: ticket.triagedAt?.toISOString() ?? null,
                            resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
                            closedAt: ticket.closedAt?.toISOString() ?? null,
                            createdAt: ticket.createdAt.toISOString(),
                            updatedAt: ticket.updatedAt.toISOString()
                        }}
                        adminUsers={adminUsers}
                    />
                    <DeleteTicketButton ticketId={ticket.id} ticketNumber={ticket.ticketNumber} />
                </div>
            </div>
        </div>
    );
}
