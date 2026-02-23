"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    AlertCircleIcon,
    RocketIcon,
    LoaderIcon
} from "lucide-react";

interface Workspace {
    id: string;
    name: string;
    slug: string;
    environment: string;
}

export default function DeployPage(props: { params: Promise<{ slug: string }> }) {
    const { slug } = use(props.params);
    const router = useRouter();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [deploying, setDeploying] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [deployResult, setDeployResult] = useState<{
        success: boolean;
        message: string;
        installationId?: string;
    } | null>(null);
    const [playbookName, setPlaybookName] = useState("");
    const [pricingModel, setPricingModel] = useState("FREE");

    useEffect(() => {
        async function fetchData() {
            try {
                const [workspacesRes, playbookRes] = await Promise.all([
                    fetch(`${getApiBase()}/api/workspaces`),
                    fetch(`${getApiBase()}/api/playbooks/${slug}`)
                ]);
                const workspacesData = await workspacesRes.json();
                const playbookData = await playbookRes.json();

                setWorkspaces(workspacesData.workspaces ?? []);
                if (workspacesData.workspaces?.length > 0) {
                    setSelectedWorkspace(workspacesData.workspaces[0].id);
                }
                setPlaybookName(playbookData.playbook?.name ?? slug);
                setPricingModel(playbookData.playbook?.pricingModel ?? "FREE");
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [slug]);

    async function handleDeploy() {
        if (!selectedWorkspace) return;

        try {
            // For paid playbooks, purchase first
            if (pricingModel !== "FREE") {
                setPurchasing(true);
                const purchaseRes = await fetch(`${getApiBase()}/api/playbooks/${slug}/purchase`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
                if (!purchaseRes.ok) {
                    const data = await purchaseRes.json();
                    if (purchaseRes.status !== 409) {
                        setDeployResult({
                            success: false,
                            message: data.error || "Purchase failed"
                        });
                        return;
                    }
                }
                setPurchasing(false);
            } else {
                // Free playbooks need a purchase record too
                await fetch(`${getApiBase()}/api/playbooks/${slug}/purchase`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                }).catch(() => {});
            }

            setDeploying(true);
            const res = await fetch(`${getApiBase()}/api/playbooks/${slug}/deploy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId: selectedWorkspace })
            });

            const data = await res.json();
            if (res.ok) {
                setDeployResult({
                    success: true,
                    message: "Playbook deployed successfully!",
                    installationId: data.installation?.id
                });
            } else {
                setDeployResult({
                    success: false,
                    message: data.error || "Deployment failed"
                });
            }
        } catch (error) {
            setDeployResult({
                success: false,
                message: error instanceof Error ? error.message : "Deployment failed"
            });
        } finally {
            setDeploying(false);
            setPurchasing(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-lg px-6 py-8">
            <button
                onClick={() => router.push(`/marketplace/${slug}`)}
                className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to {playbookName}
            </button>

            <h1 className="mb-6 text-2xl font-bold">Deploy Playbook</h1>

            {deployResult ? (
                <Card>
                    <CardContent className="py-8 text-center">
                        {deployResult.success ? (
                            <>
                                <CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-green-400" />
                                <h3 className="mb-2 text-lg font-medium">{deployResult.message}</h3>
                                <p className="text-muted-foreground mb-4 text-sm">
                                    Your new agents, skills, and workflows are ready.
                                </p>
                                <div className="flex justify-center gap-3">
                                    <Button onClick={() => router.push("/marketplace/installed")}>
                                        View Installed
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push("/agents")}
                                    >
                                        Go to Agents
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertCircleIcon className="mx-auto mb-4 h-12 w-12 text-red-400" />
                                <h3 className="mb-2 text-lg font-medium">Deployment Failed</h3>
                                <p className="text-muted-foreground mb-4 text-sm">
                                    {deployResult.message}
                                </p>
                                <Button onClick={() => setDeployResult(null)}>Try Again</Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Select Workspace</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            Choose which workspace to deploy &ldquo;{playbookName}&rdquo; into.
                        </p>

                        {workspaces.length === 0 ? (
                            <p className="text-sm text-red-400">
                                No workspaces available. Create a workspace first.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {workspaces.map((ws) => (
                                    <label
                                        key={ws.id}
                                        className={`flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors ${
                                            selectedWorkspace === ws.id
                                                ? "border-primary bg-primary/5"
                                                : "hover:border-zinc-600"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="workspace"
                                                value={ws.id}
                                                checked={selectedWorkspace === ws.id}
                                                onChange={() => setSelectedWorkspace(ws.id)}
                                                className="accent-primary"
                                            />
                                            <div>
                                                <p className="text-sm font-medium">{ws.name}</p>
                                                <p className="text-muted-foreground text-xs">
                                                    {ws.slug} · {ws.environment}
                                                </p>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}

                        <Button
                            onClick={handleDeploy}
                            disabled={!selectedWorkspace || deploying || purchasing}
                            className="w-full"
                            size="lg"
                        >
                            {purchasing ? (
                                <>
                                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                    Processing payment...
                                </>
                            ) : deploying ? (
                                <>
                                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                    Deploying...
                                </>
                            ) : (
                                <>
                                    <RocketIcon className="mr-2 h-4 w-4" />
                                    Deploy to Workspace
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
