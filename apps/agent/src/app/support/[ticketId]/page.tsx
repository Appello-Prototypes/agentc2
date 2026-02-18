import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";
import { ArrowLeft } from "lucide-react";
import { TicketCommentForm } from "./comment-form";
import { EditTicketButton } from "./edit-ticket";
import { DeleteTicketButton } from "./delete-ticket";
import { SupportChatWidget } from "../support-chat-widget";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
    params
}: {
    params: Promise<{ ticketId: string }>;
}) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) redirect("/login");

    const organizationId = await getUserOrganizationId(session.user.id);
    if (!organizationId) redirect("/login");

    const { ticketId } = await params;

    const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
            submittedBy: { select: { name: true, email: true } },
            comments: {
                where: { isInternal: false },
                orderBy: { createdAt: "asc" }
            }
        }
    });

    if (!ticket || ticket.organizationId !== organizationId) notFound();

    const isSubmitter = ticket.submittedById === session.user.id;
    const canEdit = isSubmitter && ticket.status !== "CLOSED";

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
                {/* Breadcrumb */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/support"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Tickets
                    </Link>
                    {isSubmitter && (
                        <div className="flex items-center gap-1">
                            {canEdit && (
                                <EditTicketButton
                                    ticketId={ticket.id}
                                    currentTitle={ticket.title}
                                    currentDescription={ticket.description}
                                    currentType={ticket.type}
                                    currentTags={ticket.tags}
                                />
                            )}
                            <DeleteTicketButton ticketId={ticket.id} />
                        </div>
                    )}
                </div>

                {/* Header */}
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">
                            #{ticket.ticketNumber}: {ticket.title}
                        </h1>
                        <TypeBadge type={ticket.type} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Submitted by {ticket.submittedBy.name} ({ticket.submittedBy.email}) on{" "}
                        {ticket.createdAt.toLocaleDateString()}
                    </p>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
                    {/* Left column: Description + Comments */}
                    <div className="space-y-6">
                        {/* Description */}
                        <div className="bg-card border-border rounded-lg border p-6">
                            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                                Description
                            </h2>
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                {ticket.description}
                            </div>
                            {ticket.tags.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-1">
                                    {ticket.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
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
                                        <div key={comment.id} className="px-6 py-4">
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
                                                            ? "Support Team"
                                                            : "You"}
                                                    </span>
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
                            {ticket.status !== "CLOSED" && (
                                <div className="border-border border-t px-6 py-4">
                                    <TicketCommentForm ticketId={ticket.id} />
                                </div>
                            )}

                            {ticket.status === "CLOSED" && (
                                <div className="border-border border-t px-6 py-4">
                                    <p className="text-muted-foreground text-center text-sm">
                                        This ticket is closed and cannot receive new comments.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column: Status Card */}
                    <div className="space-y-4">
                        <div className="bg-card border-border rounded-lg border p-4">
                            <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase">
                                Status
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Status</span>
                                    <StatusBadge status={ticket.status} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Priority</span>
                                    <PriorityBadge priority={ticket.priority} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Type</span>
                                    <TypeBadge type={ticket.type} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border-border rounded-lg border p-4">
                            <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase">
                                Timeline
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created</span>
                                    <span>{ticket.createdAt.toLocaleDateString()}</span>
                                </div>
                                {ticket.triagedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Triaged</span>
                                        <span>{ticket.triagedAt.toLocaleDateString()}</span>
                                    </div>
                                )}
                                {ticket.resolvedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Resolved</span>
                                        <span>{ticket.resolvedAt.toLocaleDateString()}</span>
                                    </div>
                                )}
                                {ticket.closedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Closed</span>
                                        <span>{ticket.closedAt.toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <SupportChatWidget />
        </div>
    );
}

function formatLabel(s: string) {
    return s
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypeBadge({ type }: { type: string }) {
    const colors: Record<string, string> = {
        BUG: "bg-red-500/10 text-red-500",
        FEATURE_REQUEST: "bg-purple-500/10 text-purple-500",
        IMPROVEMENT: "bg-blue-500/10 text-blue-500",
        QUESTION: "bg-gray-500/10 text-gray-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(type)}
        </span>
    );
}

function PriorityBadge({ priority }: { priority: string }) {
    const colors: Record<string, string> = {
        CRITICAL: "bg-red-500/10 text-red-500",
        HIGH: "bg-orange-500/10 text-orange-500",
        MEDIUM: "bg-yellow-500/10 text-yellow-500",
        LOW: "bg-green-500/10 text-green-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(priority)}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        NEW: "bg-blue-500/10 text-blue-500",
        TRIAGED: "bg-indigo-500/10 text-indigo-500",
        IN_PROGRESS: "bg-yellow-500/10 text-yellow-500",
        WAITING_ON_CUSTOMER: "bg-orange-500/10 text-orange-500",
        RESOLVED: "bg-green-500/10 text-green-500",
        CLOSED: "bg-gray-500/10 text-gray-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(status)}
        </span>
    );
}
