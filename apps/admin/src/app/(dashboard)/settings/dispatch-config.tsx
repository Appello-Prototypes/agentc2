"use client";

import { useEffect, useState } from "react";

type OrgOption = {
    id: string;
    name: string;
    slug: string;
    status: string;
};

type WorkflowOption = {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isActive: boolean;
    version: number;
    workspaceName: string | null;
    playbookSource: { name: string; slug: string } | null;
};

type SavedConfig = {
    targetOrganizationId: string;
    targetOrganizationName: string;
    workflowId: string;
    workflowSlug: string;
    workflowName: string;
};

export function DispatchConfigManager() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [orgs, setOrgs] = useState<OrgOption[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState("");
    const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
    const [workflowsLoading, setWorkflowsLoading] = useState(false);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState("");

    const [savedConfig, setSavedConfig] = useState<SavedConfig | null>(null);

    useEffect(() => {
        void loadInitialData();
    }, []);

    async function loadInitialData() {
        setLoading(true);
        setError("");
        try {
            const [orgsRes, configRes] = await Promise.all([
                fetch("/admin/api/tenants?limit=100", { credentials: "include" }),
                fetch("/admin/api/settings/dispatch-config", { credentials: "include" })
            ]);

            const orgsData = await orgsRes.json().catch(() => ({}));
            if (orgsRes.ok && orgsData.tenants) {
                const activeOrgs = (orgsData.tenants as OrgOption[]).filter(
                    (o) => o.status === "active"
                );
                setOrgs(activeOrgs);
            }

            const configData = await configRes.json().catch(() => ({}));
            if (configRes.ok && configData.config) {
                setSavedConfig(configData.config);
                setSelectedOrgId(configData.config.targetOrganizationId);
                setSelectedWorkflowId(configData.config.workflowId);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load configuration");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!selectedOrgId) {
            setWorkflows([]);
            return;
        }
        void loadWorkflows(selectedOrgId);
    }, [selectedOrgId]);

    async function loadWorkflows(orgId: string) {
        setWorkflowsLoading(true);
        setError("");
        try {
            const res = await fetch(`/admin/api/tenants/${orgId}/workflows`, {
                credentials: "include"
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to load workflows");
            setWorkflows((data.workflows ?? []) as WorkflowOption[]);
        } catch (err) {
            setWorkflows([]);
            setError(err instanceof Error ? err.message : "Failed to load workflows");
        } finally {
            setWorkflowsLoading(false);
        }
    }

    function handleOrgChange(orgId: string) {
        setSelectedOrgId(orgId);
        setSelectedWorkflowId("");
        setSuccess("");
    }

    async function handleSave() {
        if (!selectedOrgId || !selectedWorkflowId) return;
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const selectedOrg = orgs.find((o) => o.id === selectedOrgId);
            const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);
            if (!selectedOrg || !selectedWorkflow) {
                throw new Error("Selected organization or workflow not found");
            }

            const res = await fetch("/admin/api/settings/dispatch-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    targetOrganizationId: selectedOrg.id,
                    targetOrganizationName: selectedOrg.name,
                    workflowId: selectedWorkflow.id,
                    workflowSlug: selectedWorkflow.slug,
                    workflowName: selectedWorkflow.name
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to save configuration");

            setSavedConfig(data.config);
            setSuccess("Dispatch configuration saved.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setSaving(false);
        }
    }

    const selectedOrg = orgs.find((o) => o.id === selectedOrgId);
    const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);
    const hasChanges =
        savedConfig?.targetOrganizationId !== selectedOrgId ||
        savedConfig?.workflowId !== selectedWorkflowId;

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Dispatch Configuration</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Dispatch Configuration</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Configure which organization and workflow to use when dispatching tickets to the
                    coding pipeline.
                </p>
            </div>

            {error && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600">
                    {success}
                </div>
            )}

            {savedConfig && (
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-green-600 uppercase">
                        Current Configuration
                    </p>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Target Instance</span>
                            <span className="font-medium">
                                {savedConfig.targetOrganizationName}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Workflow</span>
                            <span className="font-medium">
                                {savedConfig.workflowName}{" "}
                                <span className="text-muted-foreground">
                                    ({savedConfig.workflowSlug})
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-card border-border rounded-lg border p-4">
                <div className="space-y-4">
                    <div>
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                            Target Instance
                        </label>
                        <select
                            value={selectedOrgId}
                            onChange={(e) => handleOrgChange(e.target.value)}
                            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        >
                            <option value="">Select organization...</option>
                            {orgs.map((org) => (
                                <option key={org.id} value={org.id}>
                                    {org.name} ({org.slug})
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedOrgId && (
                        <div>
                            <label className="text-muted-foreground mb-1 block text-xs font-medium">
                                Workflow
                            </label>
                            {workflowsLoading ? (
                                <div className="text-muted-foreground rounded-md bg-gray-500/10 px-3 py-2 text-sm">
                                    Loading workflows...
                                </div>
                            ) : workflows.length === 0 ? (
                                <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
                                    No workflows installed for this organization.
                                </div>
                            ) : (
                                <select
                                    value={selectedWorkflowId}
                                    onChange={(e) => {
                                        setSelectedWorkflowId(e.target.value);
                                        setSuccess("");
                                    }}
                                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                                >
                                    <option value="">Select workflow...</option>
                                    {workflows
                                        .filter((wf) => wf.isActive)
                                        .map((wf) => (
                                            <option key={wf.id} value={wf.id}>
                                                {wf.name} ({wf.slug})
                                                {wf.playbookSource
                                                    ? ` — from ${wf.playbookSource.name}`
                                                    : ""}
                                                {` — v${wf.version}`}
                                            </option>
                                        ))}
                                </select>
                            )}
                        </div>
                    )}

                    {selectedWorkflow && (
                        <div className="rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-600">
                            <p className="font-medium">{selectedWorkflow.name}</p>
                            {selectedWorkflow.description && (
                                <p className="mt-1 text-xs opacity-80">
                                    {selectedWorkflow.description}
                                </p>
                            )}
                            {selectedWorkflow.workspaceName && (
                                <p className="mt-1 text-xs opacity-70">
                                    Workspace: {selectedWorkflow.workspaceName}
                                </p>
                            )}
                            {selectedWorkflow.playbookSource && (
                                <p className="mt-1 text-xs opacity-70">
                                    Playbook: {selectedWorkflow.playbookSource.name}
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedOrgId || !selectedWorkflowId || !hasChanges}
                        className="rounded-md bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Configuration"}
                    </button>
                </div>
            </div>
        </div>
    );
}
