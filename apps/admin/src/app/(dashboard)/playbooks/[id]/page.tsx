import Link from "next/link";
import { prisma } from "@repo/database";
import { notFound } from "next/navigation";
import {
    ArrowLeftIcon,
    PackageIcon,
    BuildingIcon,
    CalendarIcon,
    TagIcon,
    DownloadIcon,
    StarIcon
} from "lucide-react";
import { PlaybookReviewActions } from "@/components/playbook-review-actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "bg-zinc-500/10 text-zinc-400",
    PENDING_REVIEW: "bg-yellow-500/10 text-yellow-400",
    PUBLISHED: "bg-green-500/10 text-green-400",
    SUSPENDED: "bg-red-500/10 text-red-400",
    ARCHIVED: "bg-zinc-500/10 text-zinc-500"
};

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_REVIEW: "Pending Review",
    PUBLISHED: "Published",
    SUSPENDED: "Suspended",
    ARCHIVED: "Archived"
};

export default async function PlaybookDetailPage(props: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await props.params;

    const playbook = await prisma.playbook.findUnique({
        where: { id },
        include: {
            publisherOrg: {
                select: { id: true, name: true, slug: true }
            },
            components: {
                orderBy: { sortOrder: "asc" }
            },
            versions: {
                orderBy: { version: "desc" },
                take: 5,
                select: {
                    id: true,
                    version: true,
                    changelog: true,
                    manifest: true,
                    createdAt: true
                }
            },
            _count: {
                select: { installations: true, reviews: true }
            }
        }
    });

    if (!playbook) notFound();

    const latestManifest = playbook.versions[0]?.manifest as Record<string, unknown> | null;
    const entryComponent = playbook.components.find((c) => c.isEntryPoint);

    return (
        <div className="space-y-6">
            <Link
                href="/playbooks"
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Playbooks
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{playbook.name}</h1>
                        <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[playbook.status] ?? ""}`}
                        >
                            {STATUS_LABELS[playbook.status] ?? playbook.status}
                        </span>
                    </div>
                    {playbook.tagline && (
                        <p className="text-muted-foreground mt-1">{playbook.tagline}</p>
                    )}
                    <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <BuildingIcon className="h-3.5 w-3.5" />
                            <Link
                                href={`/tenants/${playbook.publisherOrg.slug}`}
                                className="hover:underline"
                            >
                                {playbook.publisherOrg.name}
                            </Link>
                        </span>
                        <span className="flex items-center gap-1">
                            <TagIcon className="h-3.5 w-3.5" />
                            {playbook.slug}
                        </span>
                        <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            Updated {playbook.updatedAt.toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Review Actions */}
            {(playbook.status === "PENDING_REVIEW" ||
                playbook.status === "PUBLISHED" ||
                playbook.status === "SUSPENDED") && (
                <div className="bg-card border-border rounded-lg border p-4">
                    <h3 className="mb-3 text-sm font-medium">
                        {playbook.status === "PENDING_REVIEW"
                            ? "Review Actions"
                            : "Status Management"}
                    </h3>
                    <PlaybookReviewActions
                        playbookId={playbook.id}
                        currentStatus={playbook.status}
                    />
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main content */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Description */}
                    <div className="bg-card border-border rounded-lg border p-4">
                        <h3 className="mb-2 text-sm font-medium">Description</h3>
                        <p className="text-sm whitespace-pre-wrap">{playbook.description}</p>
                        {playbook.longDescription && (
                            <>
                                <h4 className="text-muted-foreground mt-4 mb-1 text-xs font-medium uppercase">
                                    Full Description
                                </h4>
                                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                                    {playbook.longDescription}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Components */}
                    <div className="bg-card border-border rounded-lg border p-4">
                        <h3 className="mb-3 text-sm font-medium">
                            Components ({playbook.components.length})
                        </h3>
                        {playbook.components.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No components packaged.</p>
                        ) : (
                            <div className="space-y-2">
                                {playbook.components.map((comp) => (
                                    <div
                                        key={comp.id}
                                        className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <PackageIcon className="text-muted-foreground h-4 w-4" />
                                            <span className="text-sm font-medium">
                                                {comp.sourceSlug}
                                            </span>
                                            <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs">
                                                {comp.componentType}
                                            </span>
                                        </div>
                                        {comp.isEntryPoint && (
                                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                                                Entry Point
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Manifest preview */}
                    {latestManifest && (
                        <div className="bg-card border-border rounded-lg border p-4">
                            <h3 className="mb-3 text-sm font-medium">
                                Latest Manifest (v{playbook.versions[0]?.version})
                            </h3>
                            <pre className="bg-background max-h-96 overflow-auto rounded-md p-3 text-xs">
                                {JSON.stringify(latestManifest, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Version History */}
                    {playbook.versions.length > 0 && (
                        <div className="bg-card border-border rounded-lg border p-4">
                            <h3 className="mb-3 text-sm font-medium">Version History</h3>
                            <div className="space-y-3">
                                {playbook.versions.map((v) => (
                                    <div
                                        key={v.id}
                                        className="border-border border-b pb-3 last:border-0"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">
                                                v{v.version}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {v.createdAt.toLocaleDateString()}
                                            </span>
                                        </div>
                                        {v.changelog && (
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                {v.changelog}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <div className="bg-card border-border rounded-lg border p-4">
                        <h3 className="mb-3 text-sm font-medium">Details</h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <dt className="text-muted-foreground">Category</dt>
                                <dd className="font-medium">{playbook.category}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-muted-foreground">Pricing</dt>
                                <dd className="font-medium">
                                    {playbook.pricingModel === "FREE"
                                        ? "Free"
                                        : `$${playbook.priceUsd ?? 0} (${playbook.pricingModel.toLowerCase()})`}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-muted-foreground">Version</dt>
                                <dd className="font-medium">v{playbook.version}</dd>
                            </div>
                            {entryComponent && (
                                <div className="flex items-center justify-between">
                                    <dt className="text-muted-foreground">Entry Point</dt>
                                    <dd className="font-medium">
                                        {entryComponent.sourceSlug} ({entryComponent.componentType})
                                    </dd>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <dt className="text-muted-foreground flex items-center gap-1">
                                    <DownloadIcon className="h-3.5 w-3.5" />
                                    Installs
                                </dt>
                                <dd className="font-medium">{playbook.installCount}</dd>
                            </div>
                            {playbook.averageRating != null && (
                                <div className="flex items-center justify-between">
                                    <dt className="text-muted-foreground flex items-center gap-1">
                                        <StarIcon className="h-3.5 w-3.5" />
                                        Rating
                                    </dt>
                                    <dd className="font-medium">
                                        {playbook.averageRating.toFixed(1)} (
                                        {playbook._count.reviews})
                                    </dd>
                                </div>
                            )}
                            {playbook.trustScore != null && (
                                <div className="flex items-center justify-between">
                                    <dt className="text-muted-foreground">Trust Score</dt>
                                    <dd className="font-medium">
                                        {Math.round(playbook.trustScore)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    {playbook.requiredIntegrations.length > 0 && (
                        <div className="bg-card border-border rounded-lg border p-4">
                            <h3 className="mb-2 text-sm font-medium">Required Integrations</h3>
                            <div className="flex flex-wrap gap-1">
                                {playbook.requiredIntegrations.map((int) => (
                                    <span
                                        key={int}
                                        className="bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-xs"
                                    >
                                        {int}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {playbook.tags.length > 0 && (
                        <div className="bg-card border-border rounded-lg border p-4">
                            <h3 className="mb-2 text-sm font-medium">Tags</h3>
                            <div className="flex flex-wrap gap-1">
                                {playbook.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-xs"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
