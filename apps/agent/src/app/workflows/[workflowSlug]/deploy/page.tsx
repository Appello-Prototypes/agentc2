"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Input
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Deployment {
    id: string;
    environment: string;
    status: string;
    trafficPercent?: number | null;
    createdAt: string;
}

const statusVariant = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "deployed" || normalized === "approved") return "default";
    if (normalized === "rejected") return "destructive";
    if (normalized === "pending_review" || normalized === "testing") return "secondary";
    return "outline";
};

export default function WorkflowDeployPage() {
    const params = useParams();
    const workflowSlug = params.workflowSlug as string;
    const [workflowId, setWorkflowId] = useState<string | null>(null);
    const [versionId, setVersionId] = useState<string | null>(null);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [environment, setEnvironment] = useState("dev");
    const [trafficPercent, setTrafficPercent] = useState("100");

    const fetchDeployments = async (entityId: string) => {
        const res = await fetch(
            `${getApiBase()}/api/deployments?entityType=workflow&entityId=${entityId}`
        );
        const data = await res.json();
        setDeployments(data.deployments || []);
    };

    useEffect(() => {
        const fetchWorkflow = async () => {
            const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}`);
            const data = await res.json();
            if (data.workflow) {
                setWorkflowId(data.workflow.id);
                setVersionId(String(data.workflow.version));
                fetchDeployments(data.workflow.id);
            }
        };
        fetchWorkflow();
    }, [workflowSlug]);

    const createDeployment = async () => {
        if (!workflowId || !versionId) return;
        await fetch(`${getApiBase()}/api/deployments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                entityType: "workflow",
                entityId: workflowId,
                versionId,
                environment,
                status: "DRAFT",
                trafficPercent: trafficPercent ? Number(trafficPercent) : null
            })
        });
        fetchDeployments(workflowId);
    };

    const updateDeploymentStatus = async (deploymentId: string, status: string) => {
        await fetch(`${getApiBase()}/api/deployments/${deploymentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status,
                approvedAt: status === "APPROVED" ? new Date().toISOString() : null
            })
        });
        if (workflowId) {
            fetchDeployments(workflowId);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create deployment</CardTitle>
                    <CardDescription>
                        Promote a workflow version to an environment and track approval status.
                        Deployments currently record intent and traffic allocation metadata.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        <Select
                            value={environment}
                            onValueChange={(value) => setEnvironment(value ?? "dev")}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="dev">Dev</SelectItem>
                                <SelectItem value="staging">Staging</SelectItem>
                                <SelectItem value="prod">Production</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            type="number"
                            value={trafficPercent}
                            onChange={(e) => setTrafficPercent(e.target.value)}
                            placeholder="Traffic %"
                        />
                        <Button onClick={createDeployment} disabled={!workflowId}>
                            Create deployment
                        </Button>
                    </div>
                    <div className="text-muted-foreground text-xs">
                        Deployments do not change runtime routing yet. Use them to document
                        approvals and rollout plans until automated promotion is enabled.
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Deployments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {deployments.length === 0 ? (
                        <div className="text-muted-foreground">No deployments yet.</div>
                    ) : (
                        deployments.map((deployment) => (
                            <div
                                key={deployment.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium">{deployment.environment}</div>
                                        <Badge variant={statusVariant(deployment.status)}>
                                            {deployment.status.toLowerCase()}
                                        </Badge>
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        Created {new Date(deployment.createdAt).toLocaleString()} ·
                                        Traffic {deployment.trafficPercent ?? 0}%
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            updateDeploymentStatus(deployment.id, "APPROVED")
                                        }
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            updateDeploymentStatus(deployment.id, "DEPLOYED")
                                        }
                                    >
                                        Deploy
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
