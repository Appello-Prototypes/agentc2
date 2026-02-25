"use client";

import Link from "next/link";
import { Badge, Button } from "@repo/ui";
import {
    ArrowLeftIcon,
    DownloadIcon,
    StarIcon,
    ShieldCheckIcon,
    RocketIcon,
    BotIcon,
    NetworkIcon,
    WorkflowIcon,
    FileTextIcon,
    FlagIcon
} from "lucide-react";

interface PlaybookHeroProps {
    slug: string;
    name: string;
    tagline: string | null;
    category: string;
    publisherOrgName: string;
    pricingModel: string;
    priceUsd: number | null;
    monthlyPriceUsd: number | null;
    installCount: number;
    averageRating: number | null;
    reviewCount: number;
    trustScore: number | null;
    componentsByType: Record<string, number>;
    onBack: () => void;
}

const COMPONENT_TYPE_META: Record<string, { icon: typeof BotIcon; label: string }> = {
    AGENT: { icon: BotIcon, label: "Agent" },
    NETWORK: { icon: NetworkIcon, label: "Network" },
    WORKFLOW: { icon: WorkflowIcon, label: "Workflow" },
    CAMPAIGN_TEMPLATE: { icon: FlagIcon, label: "Campaign" },
    DOCUMENT: { icon: FileTextIcon, label: "Document" },
    SKILL: { icon: FileTextIcon, label: "Skill" }
};

function formatPrice(
    pricingModel: string,
    priceUsd: number | null,
    monthlyPriceUsd: number | null
) {
    if (pricingModel === "FREE") return "Free";
    if (pricingModel === "ONE_TIME") return `$${priceUsd}`;
    if (pricingModel === "SUBSCRIPTION") return `$${monthlyPriceUsd}/mo`;
    return `$${priceUsd}/use`;
}

export function PlaybookHero({
    slug,
    name,
    tagline,
    category,
    publisherOrgName,
    pricingModel,
    priceUsd,
    monthlyPriceUsd,
    installCount,
    averageRating,
    reviewCount,
    trustScore,
    componentsByType,
    onBack
}: PlaybookHeroProps) {
    return (
        <div className="relative overflow-hidden rounded-xl border bg-linear-to-br from-zinc-900 via-zinc-900 to-zinc-800">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-purple-500/5" />
            <div className="relative px-8 py-10">
                <button
                    onClick={onBack}
                    className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Marketplace
                </button>

                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs capitalize">
                                {category.replace(/-/g, " ")}
                            </Badge>
                            <span className="text-muted-foreground text-sm">
                                by {publisherOrgName}
                            </span>
                        </div>

                        <h1 className="text-4xl font-bold tracking-tight">{name}</h1>

                        {tagline && (
                            <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
                                {tagline}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            {Object.entries(componentsByType).map(([type, count]) => {
                                const meta = COMPONENT_TYPE_META[type];
                                if (!meta) return null;
                                const Icon = meta.icon;
                                return (
                                    <div
                                        key={type}
                                        className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1"
                                    >
                                        <Icon className="h-3.5 w-3.5 text-blue-400" />
                                        <span className="text-sm">
                                            {count} {meta.label}
                                            {count !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-5 pt-1">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                                <DownloadIcon className="h-4 w-4" />
                                {installCount} install{installCount !== 1 ? "s" : ""}
                            </span>
                            {averageRating != null && (
                                <span className="flex items-center gap-1.5 text-sm">
                                    <StarIcon className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    {averageRating.toFixed(1)} ({reviewCount} review
                                    {reviewCount !== 1 ? "s" : ""})
                                </span>
                            )}
                            {trustScore != null && trustScore > 0 && (
                                <span className="flex items-center gap-1.5 text-sm text-green-400">
                                    <ShieldCheckIcon className="h-4 w-4" />
                                    Trust: {Math.round(trustScore)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-center gap-3 lg:items-end">
                        <p className="text-3xl font-bold">
                            {formatPrice(pricingModel, priceUsd, monthlyPriceUsd)}
                        </p>
                        <Link href={`/marketplace/${slug}/deploy`}>
                            <Button size="lg" className="min-w-[200px]">
                                <RocketIcon className="mr-2 h-4 w-4" />
                                {pricingModel === "FREE" ? "Deploy Free" : "Purchase & Deploy"}
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
