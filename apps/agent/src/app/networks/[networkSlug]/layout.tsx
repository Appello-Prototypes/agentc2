"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Badge, Button, HugeiconsIcon, cn, icons } from "@repo/ui";
import type { IconName } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { DetailPageShell } from "@/components/DetailPageShell";
import { ShareEmbedDialog } from "@/components/ShareEmbedDialog";

interface NetworkDetail {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    version: number;
    isPublished: boolean;
    isActive: boolean;
    runCount: number;
    primitiveCount: number;
    visibility: string;
    publicToken: string | null;
}

const navItems: { id: string; label: string; icon: IconName; path: string }[] = [
    { id: "overview", label: "Overview", icon: "dashboard", path: "" },
    { id: "topology", label: "Design", icon: "ai-network", path: "/topology" },
    { id: "primitives", label: "Primitives", icon: "folder", path: "/primitives" },
    { id: "test", label: "Test", icon: "test-tube", path: "/test" },
    { id: "runs", label: "Runs", icon: "play-circle", path: "/runs" },
    { id: "traces", label: "Traces", icon: "activity", path: "/traces" },
    { id: "versions", label: "Versions", icon: "git-branch", path: "/versions" },
    { id: "deploy", label: "Deploy", icon: "checkmark-circle", path: "/deploy" }
];

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const networkSlug = params.networkSlug as string;

    const [network, setNetwork] = useState<NetworkDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [shareOpen, setShareOpen] = useState(false);

    useEffect(() => {
        const fetchNetwork = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}`);
                const data = await res.json();
                setNetwork(data.network || null);
            } catch (error) {
                console.error("Failed to load network:", error);
                setNetwork(null);
            } finally {
                setLoading(false);
            }
        };
        fetchNetwork();
    }, [networkSlug]);

    const activePath = useMemo(() => {
        const basePath = `/networks/${networkSlug}`;
        if (pathname === basePath) return "overview";
        const lastSegment = pathname.replace(basePath, "").split("/").filter(Boolean).pop();
        return lastSegment || "overview";
    }, [pathname, networkSlug]);

    if (!loading && !network) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h1 className="mb-2 text-2xl font-bold">Network Not Found</h1>
                    <p className="text-muted-foreground mb-4">
                        The network &ldquo;{networkSlug}&rdquo; could not be found.
                    </p>
                    <Button onClick={() => router.push("/networks")}>Back to Networks</Button>
                </div>
            </div>
        );
    }

    return (
        <DetailPageShell
            loading={loading}
            sidebarTitle={network?.name ?? "Network"}
            sidebar={
                network && (
                    <>
                        <div className="border-b p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">{network.name}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {network.description || "No description"}
                                    </div>
                                </div>
                                <Badge
                                    variant={network.isActive ? "default" : "secondary"}
                                    className="h-5 text-[10px]"
                                >
                                    {network.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                            <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-[10px]">
                                <span>Version {network.version}</span>
                                <span>Runs {network.runCount}</span>
                                <span>Primitives {network.primitiveCount}</span>
                                <span>{network.isPublished ? "Published" : "Draft"}</span>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => router.push("/networks")}
                                >
                                    All networks
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => setShareOpen(true)}
                                >
                                    <HugeiconsIcon
                                        icon={icons.share!}
                                        className="size-3.5"
                                        strokeWidth={1.5}
                                    />
                                    Share
                                </Button>
                            </div>
                        </div>

                        <nav className="flex-1 overflow-y-auto p-2">
                            {navItems.map((item) => {
                                const isActive = activePath === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={`/networks/${network.slug}${item.path}`}
                                        className={cn(
                                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <HugeiconsIcon
                                            icon={icons[item.icon]!}
                                            className="h-4 w-4"
                                        />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>

                        <ShareEmbedDialog
                            open={shareOpen}
                            onOpenChange={setShareOpen}
                            entityType="network"
                            entity={{
                                id: network.id,
                                slug: network.slug,
                                name: network.name,
                                visibility: network.visibility ?? "PRIVATE",
                                publicToken: network.publicToken ?? null
                            }}
                            onVisibilityChange={(visibility, publicToken) => {
                                setNetwork((prev) =>
                                    prev ? { ...prev, visibility, publicToken } : prev
                                );
                            }}
                        />
                    </>
                )
            }
        >
            {children}
        </DetailPageShell>
    );
}
