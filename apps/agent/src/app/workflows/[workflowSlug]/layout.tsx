"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Badge, Button, HugeiconsIcon, cn, icons } from "@repo/ui";
import type { IconName } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { DetailPageShell } from "@/components/DetailPageShell";
import { ShareEmbedDialog } from "@/components/ShareEmbedDialog";

interface WorkflowDetail {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    version: number;
    isPublished: boolean;
    isActive: boolean;
    runCount: number;
    visibility: string;
    publicToken: string | null;
}

const navItems: { id: string; label: string; icon: IconName; path: string }[] = [
    { id: "overview", label: "Overview", icon: "dashboard", path: "" },
    { id: "design", label: "Design", icon: "file", path: "/design" },
    { id: "test", label: "Test", icon: "test-tube", path: "/test" },
    { id: "runs", label: "Runs", icon: "play-circle", path: "/runs" },
    { id: "traces", label: "Traces", icon: "activity", path: "/traces" },
    { id: "versions", label: "Versions", icon: "git-branch", path: "/versions" },
    { id: "deploy", label: "Deploy", icon: "checkmark-circle", path: "/deploy" }
];

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const workflowSlug = params.workflowSlug as string;

    const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [shareOpen, setShareOpen] = useState(false);

    useEffect(() => {
        const fetchWorkflow = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}`);
                const data = await res.json();
                setWorkflow(data.workflow || null);
            } catch (error) {
                console.error("Failed to load workflow:", error);
                setWorkflow(null);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkflow();
    }, [workflowSlug]);

    const activePath = useMemo(() => {
        const basePath = `/workflows/${workflowSlug}`;
        if (pathname === basePath) return "overview";
        const lastSegment = pathname.replace(basePath, "").split("/").filter(Boolean).pop();
        return lastSegment || "overview";
    }, [pathname, workflowSlug]);

    if (!loading && !workflow) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h1 className="mb-2 text-2xl font-bold">Workflow Not Found</h1>
                    <p className="text-muted-foreground mb-4">
                        The workflow &ldquo;{workflowSlug}&rdquo; could not be found.
                    </p>
                    <Button onClick={() => router.push("/workflows")}>Back to Workflows</Button>
                </div>
            </div>
        );
    }

    return (
        <DetailPageShell
            loading={loading}
            sidebarTitle={workflow?.name ?? "Workflow"}
            sidebar={
                workflow && (
                    <>
                        <div className="border-b p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">{workflow.name}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {workflow.description || "No description"}
                                    </div>
                                </div>
                                <Badge
                                    variant={workflow.isActive ? "default" : "secondary"}
                                    className="h-5 text-[10px]"
                                >
                                    {workflow.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                            <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-[10px]">
                                <span>Version {workflow.version}</span>
                                <span>Runs {workflow.runCount}</span>
                                <span>{workflow.isPublished ? "Published" : "Draft"}</span>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => router.push("/workflows")}
                                >
                                    All workflows
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
                                        href={`/workflows/${workflow.slug}${item.path}`}
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
                            entityType="workflow"
                            entity={{
                                id: workflow.id,
                                slug: workflow.slug,
                                name: workflow.name,
                                visibility: workflow.visibility ?? "PRIVATE",
                                publicToken: workflow.publicToken ?? null
                            }}
                            onVisibilityChange={(visibility, publicToken) => {
                                setWorkflow((prev) =>
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
