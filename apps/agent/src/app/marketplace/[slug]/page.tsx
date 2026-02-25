"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    MessageResponse
} from "@repo/ui";
import {
    StarIcon,
    DownloadIcon,
    ShieldCheckIcon,
    PackageIcon,
    MessageSquareIcon
} from "lucide-react";

import { PlaybookHero } from "@/components/marketplace/PlaybookHero";
import { AgentProfileCard } from "@/components/marketplace/AgentProfileCard";
import { NetworkTopologyPreview } from "@/components/marketplace/NetworkTopologyPreview";
import { WorkflowStepFlow } from "@/components/marketplace/WorkflowStepFlow";
import { CampaignCard } from "@/components/marketplace/CampaignCard";
import { PlaybookSandbox } from "@/components/marketplace/PlaybookSandbox";

// ── Types ────────────────────────────────────────────────────────────────

interface PlaybookDetail {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string;
    longDescription: string | null;
    category: string;
    tags: string[];
    status: string;
    pricingModel: string;
    priceUsd: number | null;
    monthlyPriceUsd: number | null;
    installCount: number;
    averageRating: number | null;
    reviewCount: number;
    trustScore: number | null;
    requiredIntegrations: string[];
    version: number;
    publisherOrg: { id: string; name: string; slug: string; logoUrl: string | null };
    components: Array<{
        id: string;
        componentType: string;
        sourceSlug: string;
        configSnapshot: unknown;
        isEntryPoint: boolean;
    }>;
    versions: Array<{
        id: string;
        version: number;
        changelog: string | null;
        createdAt: string;
    }>;
    reviews: Array<{
        id: string;
        rating: number;
        title: string | null;
        body: string | null;
        createdAt: string;
        reviewerOrg: { name: string; slug: string };
    }>;
}

interface ManifestData {
    entryPoint?: { type: string; slug: string };
    agents?: Array<{
        slug: string;
        name: string;
        description: string | null;
        instructions: string;
        modelProvider: string;
        modelName: string;
        temperature: number | null;
        memoryEnabled: boolean;
        memoryConfig: unknown;
        maxSteps: number | null;
        scorers: string[];
        tools: Array<{ toolId: string; config: unknown }>;
        skills: string[];
        metadata: unknown;
    }>;
    networks?: Array<{
        slug: string;
        name: string;
        description: string | null;
        primitives: Array<{
            primitiveType: string;
            agentSlug: string | null;
            workflowSlug: string | null;
            toolId: string | null;
            description: string | null;
        }>;
    }>;
    workflows?: Array<{
        slug: string;
        name: string;
        description: string | null;
        definitionJson: unknown;
        inputSchemaJson: unknown;
        maxSteps: number;
    }>;
    campaignTemplates?: Array<{
        slug: string;
        name: string;
        intent: string;
        endState: string;
        description: string | null;
        constraints: string[];
        restraints: string[];
        requireApproval: boolean;
    }>;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function MarketplaceDetailPage(props: { params: Promise<{ slug: string }> }) {
    const { slug } = use(props.params);
    const router = useRouter();
    const [playbook, setPlaybook] = useState<PlaybookDetail | null>(null);
    const [manifest, setManifest] = useState<ManifestData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlaybook() {
            try {
                const res = await fetch(`${getApiBase()}/api/playbooks/${slug}`);
                const data = await res.json();
                setPlaybook(data.playbook);
                setManifest(data.manifest ?? null);
            } catch (error) {
                console.error("Failed to fetch playbook:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPlaybook();
    }, [slug]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!playbook) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Playbook not found</div>
            </div>
        );
    }

    const componentsByType = playbook.components.reduce(
        (acc, comp) => {
            acc[comp.componentType] = (acc[comp.componentType] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const entryPointSlug = manifest?.entryPoint?.slug;

    const agents = manifest?.agents ?? [];
    const networks = manifest?.networks ?? [];
    const workflows = manifest?.workflows ?? [];
    const campaigns = manifest?.campaignTemplates ?? [];

    const hasComponents =
        agents.length > 0 || networks.length > 0 || workflows.length > 0 || campaigns.length > 0;

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            {/* Hero */}
            <PlaybookHero
                slug={slug}
                name={playbook.name}
                tagline={playbook.tagline}
                category={playbook.category}
                publisherOrgName={playbook.publisherOrg.name}
                pricingModel={playbook.pricingModel}
                priceUsd={playbook.priceUsd}
                monthlyPriceUsd={playbook.monthlyPriceUsd}
                installCount={playbook.installCount}
                averageRating={playbook.averageRating}
                reviewCount={playbook.reviewCount}
                trustScore={playbook.trustScore}
                componentsByType={componentsByType}
                onBack={() => router.push("/marketplace")}
            />

            {/* Tabbed Content */}
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
                <div>
                    <Tabs defaultValue="overview">
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="components">
                                Components ({playbook.components.length})
                            </TabsTrigger>
                            {playbook.reviews.length > 0 && (
                                <TabsTrigger value="reviews">
                                    Reviews ({playbook.reviewCount})
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="sandbox">
                                <MessageSquareIcon className="mr-1.5 h-3.5 w-3.5" />
                                Try It
                            </TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview">
                            <Card className="border-zinc-800 bg-zinc-900/50">
                                <CardContent className="pt-6">
                                    {playbook.longDescription ? (
                                        <div className="prose prose-sm prose-invert max-w-none">
                                            <MessageResponse>
                                                {playbook.longDescription}
                                            </MessageResponse>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap">
                                            {playbook.description}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Components Tab */}
                        <TabsContent value="components">
                            {hasComponents ? (
                                <div className="space-y-4">
                                    {agents.map((agent) => (
                                        <AgentProfileCard
                                            key={agent.slug}
                                            snapshot={agent}
                                            isEntryPoint={agent.slug === entryPointSlug}
                                        />
                                    ))}

                                    {networks.map((network) => (
                                        <NetworkTopologyPreview
                                            key={network.slug}
                                            network={network}
                                        />
                                    ))}

                                    {workflows.map((workflow) => (
                                        <WorkflowStepFlow key={workflow.slug} workflow={workflow} />
                                    ))}

                                    {campaigns.map((campaign) => (
                                        <CampaignCard key={campaign.slug} campaign={campaign} />
                                    ))}
                                </div>
                            ) : (
                                <Card className="border-zinc-800 bg-zinc-900/50">
                                    <CardContent className="py-12 text-center">
                                        <PackageIcon className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                                        <p className="text-muted-foreground text-sm">
                                            Component details are not available for this playbook
                                            version.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* Reviews Tab */}
                        {playbook.reviews.length > 0 && (
                            <TabsContent value="reviews">
                                <Card className="border-zinc-800 bg-zinc-900/50">
                                    <CardHeader>
                                        <CardTitle>Reviews</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {playbook.reviews.map((review) => (
                                            <div
                                                key={review.id}
                                                className="border-b border-zinc-800 pb-4 last:border-0"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="flex">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <StarIcon
                                                                key={i}
                                                                className={`h-3.5 w-3.5 ${
                                                                    i < review.rating
                                                                        ? "fill-yellow-400 text-yellow-400"
                                                                        : "text-zinc-600"
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">
                                                        {review.reviewerOrg.name}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {new Date(
                                                            review.createdAt
                                                        ).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {review.title && (
                                                    <p className="mt-1 text-sm font-medium">
                                                        {review.title}
                                                    </p>
                                                )}
                                                {review.body && (
                                                    <p className="text-muted-foreground mt-1 text-sm">
                                                        {review.body}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}

                        {/* Sandbox Tab */}
                        <TabsContent value="sandbox">
                            <PlaybookSandbox playbookSlug={slug} playbookName={playbook.name} />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {playbook.requiredIntegrations.length > 0 && (
                        <Card className="border-zinc-800 bg-zinc-900/50">
                            <CardHeader>
                                <CardTitle className="text-sm">Required Integrations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {playbook.requiredIntegrations.map((int) => (
                                        <div
                                            key={int}
                                            className="flex items-center gap-2 text-sm capitalize"
                                        >
                                            <PackageIcon className="text-muted-foreground h-3.5 w-3.5" />
                                            {int}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {playbook.versions.length > 0 && (
                        <Card className="border-zinc-800 bg-zinc-900/50">
                            <CardHeader>
                                <CardTitle className="text-sm">Version History</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {playbook.versions.map((v) => (
                                    <div key={v.id} className="text-sm">
                                        <span className="font-medium">v{v.version}</span>
                                        <span className="text-muted-foreground ml-2 text-xs">
                                            {new Date(v.createdAt).toLocaleDateString()}
                                        </span>
                                        {v.changelog && (
                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                {v.changelog}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {playbook.tags.length > 0 && (
                        <Card className="border-zinc-800 bg-zinc-900/50">
                            <CardHeader>
                                <CardTitle className="text-sm">Tags</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1">
                                    {playbook.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardContent className="pt-6">
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Publisher</span>
                                    <span>{playbook.publisherOrg.name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Version</span>
                                    <span>v{playbook.version}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Installs</span>
                                    <span className="flex items-center gap-1">
                                        <DownloadIcon className="h-3.5 w-3.5" />
                                        {playbook.installCount}
                                    </span>
                                </div>
                                {playbook.averageRating != null && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Rating</span>
                                        <span className="flex items-center gap-1">
                                            <StarIcon className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                            {playbook.averageRating.toFixed(1)}
                                        </span>
                                    </div>
                                )}
                                {playbook.trustScore != null && playbook.trustScore > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Trust Score</span>
                                        <span className="flex items-center gap-1 text-green-400">
                                            <ShieldCheckIcon className="h-3.5 w-3.5" />
                                            {Math.round(playbook.trustScore)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
