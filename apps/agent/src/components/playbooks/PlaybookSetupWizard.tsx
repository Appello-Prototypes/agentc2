"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    CheckCircle2Icon,
    XCircleIcon,
    Loader2Icon,
    PlugIcon,
    ShieldCheckIcon,
    RocketIcon,
    RefreshCwIcon,
    ArrowRightIcon,
    WrenchIcon
} from "lucide-react";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    Badge
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { SetupWizard } from "@/components/integrations/SetupWizard";
import { RepoSelectStep } from "./steps/RepoSelectStep";
import { WebhookCreateStep } from "./steps/WebhookCreateStep";

interface IntegrationInfo {
    provider: string;
    name: string;
    authType: string;
    category: string;
    connected: boolean;
    connectionId: string | null;
    toolsReady?: boolean;
    disabledTools?: string[];
    missingTools?: string[];
}

interface ConfigStepInfo {
    id: string;
    type: string;
    label: string;
    description: string;
    provider?: string;
    completed: boolean;
    data: Record<string, unknown> | null;
}

interface SetupState {
    installation: {
        id: string;
        status: string;
        playbookSlug: string;
    };
    playbook: {
        slug: string;
        name: string;
        iconUrl: string | null;
        requiredIntegrations: string[];
    };
    setupConfig: {
        headline?: string;
        description?: string;
        steps?: ConfigStepInfo[];
    } | null;
    integrations: IntegrationInfo[];
    configSteps: ConfigStepInfo[];
    readyToActivate: boolean;
}

interface VerifyResult {
    provider: string;
    success: boolean;
    toolCount?: number;
    error?: string;
}

export interface StepRendererProps {
    installationId: string;
    step: ConfigStepInfo;
    integrations: IntegrationInfo[];
    onComplete: () => void;
}

const STEP_RENDERERS: Record<string, React.ComponentType<StepRendererProps>> = {
    "repo-select": RepoSelectStep,
    "webhook-create": WebhookCreateStep
};

export function PlaybookSetupWizard({
    installationId,
    onComplete
}: {
    installationId: string;
    onComplete?: () => void;
}) {
    const base = getApiBase();
    const [setupState, setSetupState] = useState<SetupState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verifyResults, setVerifyResults] = useState<VerifyResult[] | null>(null);
    const [activating, setActivating] = useState(false);

    const fetchSetupState = useCallback(async () => {
        try {
            const res = await fetch(`${base}/api/playbooks/installations/${installationId}/setup`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
            }
            const data = (await res.json()) as SetupState;
            setSetupState(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load setup");
        } finally {
            setLoading(false);
        }
    }, [base, installationId]);

    useEffect(() => {
        fetchSetupState();
    }, [fetchSetupState]);

    useEffect(() => {
        if (!setupState || setupState.installation.status === "ACTIVE") return;
        const interval = setInterval(fetchSetupState, 5000);
        return () => clearInterval(interval);
    }, [setupState, fetchSetupState]);

    const handleVerify = useCallback(async () => {
        setVerifying(true);
        setVerifyResults(null);
        try {
            const res = await fetch(
                `${base}/api/playbooks/installations/${installationId}/setup/verify`,
                { method: "POST" }
            );
            const data = (await res.json()) as {
                allPassed: boolean;
                results: VerifyResult[];
            };
            setVerifyResults(data.results);
            await fetchSetupState();
        } catch {
            setError("Verification failed");
        } finally {
            setVerifying(false);
        }
    }, [base, installationId, fetchSetupState]);

    const handleActivate = useCallback(async () => {
        setActivating(true);
        try {
            const res = await fetch(
                `${base}/api/playbooks/installations/${installationId}/setup/activate`,
                { method: "POST" }
            );
            if (res.ok) {
                await fetchSetupState();
                onComplete?.();
            } else {
                const data = (await res.json()) as { error?: string };
                setError(data.error ?? "Activation failed");
            }
        } catch {
            setError("Activation failed");
        } finally {
            setActivating(false);
        }
    }, [base, installationId, fetchSetupState, onComplete]);

    const connectedCount = useMemo(
        () => setupState?.integrations.filter((i) => i.connected).length ?? 0,
        [setupState]
    );
    const totalIntegrations = setupState?.integrations.length ?? 0;
    const completedConfigSteps = useMemo(
        () => setupState?.configSteps.filter((s) => s.completed).length ?? 0,
        [setupState]
    );
    const totalConfigSteps = setupState?.configSteps.length ?? 0;
    const totalSteps = totalIntegrations + totalConfigSteps;
    const completedSteps = connectedCount + completedConfigSteps;
    const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (error && !setupState) {
        return (
            <div className="mx-auto max-w-lg py-12 text-center">
                <XCircleIcon className="mx-auto mb-4 h-10 w-10 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
                <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                        setLoading(true);
                        setError(null);
                        fetchSetupState();
                    }}
                >
                    Retry
                </Button>
            </div>
        );
    }

    if (!setupState) return null;

    if (setupState.installation.status === "ACTIVE") {
        return (
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                        <CheckCircle2Icon className="h-8 w-8 text-green-500" />
                    </div>
                    <h2 className="text-xl font-semibold">{setupState.playbook.name} is Active</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        All integrations are connected and verified.
                    </p>
                </div>
                {onComplete && (
                    <div className="text-center">
                        <Button onClick={onComplete}>
                            <RocketIcon className="mr-2 h-4 w-4" />
                            Continue
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold">
                    {setupState.setupConfig?.headline ?? `Set up ${setupState.playbook.name}`}
                </h2>
                {setupState.setupConfig?.description && (
                    <p className="text-muted-foreground mt-1 text-sm">
                        {setupState.setupConfig.description}
                    </p>
                )}
            </div>

            {/* Progress bar */}
            <div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                        className="bg-primary h-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs">
                    {completedSteps} of {totalSteps} steps complete
                </p>
            </div>

            {error && (
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Integration Checklist */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <PlugIcon className="h-4 w-4" />
                        Integrations
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {setupState.integrations.map((integration) => {
                        const verifyResult = verifyResults?.find(
                            (r) => r.provider === integration.provider
                        );
                        return (
                            <IntegrationChecklistItem
                                key={integration.provider}
                                integration={integration}
                                verifyResult={verifyResult}
                                onConnect={() => setConnectingProvider(integration.provider)}
                            />
                        );
                    })}
                </CardContent>
            </Card>

            {/* Config Steps */}
            {setupState.configSteps.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <WrenchIcon className="h-4 w-4" />
                            Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {setupState.configSteps.map((step) => {
                            const depProvider = step.provider;
                            const depConnected = depProvider
                                ? (setupState.integrations.find((i) => i.provider === depProvider)
                                      ?.connected ?? false)
                                : true;

                            const Renderer = STEP_RENDERERS[step.type];

                            if (step.completed) {
                                return (
                                    <div
                                        key={step.id}
                                        className="flex items-center gap-3 rounded-md border p-3"
                                    >
                                        <CheckCircle2Icon className="h-5 w-5 shrink-0 text-green-500" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{step.label}</p>
                                            <p className="text-muted-foreground text-xs">
                                                Complete
                                            </p>
                                        </div>
                                    </div>
                                );
                            }

                            if (!depConnected) {
                                return (
                                    <div
                                        key={step.id}
                                        className="rounded-md border border-dashed p-3 opacity-50"
                                    >
                                        <p className="text-sm font-medium">{step.label}</p>
                                        <p className="text-muted-foreground text-xs">
                                            Connect {depProvider ?? "integration"} first
                                        </p>
                                    </div>
                                );
                            }

                            if (Renderer) {
                                return (
                                    <div key={step.id} className="rounded-md border p-3">
                                        <Renderer
                                            installationId={installationId}
                                            step={step}
                                            integrations={setupState.integrations}
                                            onComplete={fetchSetupState}
                                        />
                                    </div>
                                );
                            }

                            return (
                                <div key={step.id} className="rounded-md border p-3">
                                    <p className="text-sm font-medium">{step.label}</p>
                                    <p className="text-muted-foreground text-xs">
                                        {step.description}
                                    </p>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Verify & Activate */}
            <Card>
                <CardContent className="flex flex-col gap-3 pt-6">
                    {verifyResults && (
                        <div className="space-y-2">
                            {verifyResults.map((r) => (
                                <div key={r.provider} className="flex items-center gap-2 text-sm">
                                    {r.success ? (
                                        <CheckCircle2Icon className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <XCircleIcon className="h-4 w-4 text-red-400" />
                                    )}
                                    <span>
                                        {r.provider}
                                        {r.toolCount ? ` (${r.toolCount} tools)` : ""}
                                    </span>
                                    {r.error && (
                                        <span className="text-muted-foreground text-xs">
                                            {r.error}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={handleVerify}
                            disabled={verifying || connectedCount === 0}
                            className="flex-1"
                        >
                            {verifying ? (
                                <>
                                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <ShieldCheckIcon className="mr-2 h-4 w-4" />
                                    Verify All Connections
                                </>
                            )}
                        </Button>

                        <Button
                            onClick={handleActivate}
                            disabled={!setupState.readyToActivate || activating}
                            className="flex-1"
                        >
                            {activating ? (
                                <>
                                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                    Activating...
                                </>
                            ) : (
                                <>
                                    <RocketIcon className="mr-2 h-4 w-4" />
                                    Activate
                                </>
                            )}
                        </Button>
                    </div>

                    {!setupState.readyToActivate && (
                        <p className="text-muted-foreground text-center text-xs">
                            Connect all integrations
                            {totalConfigSteps > 0 ? " and complete all configuration steps" : ""} to
                            activate.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Connection Sheet */}
            <Sheet
                open={!!connectingProvider}
                onOpenChange={(open) => {
                    if (!open) {
                        setConnectingProvider(null);
                        fetchSetupState();
                    }
                }}
            >
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle>
                            Connect{" "}
                            {setupState.integrations.find((i) => i.provider === connectingProvider)
                                ?.name ?? connectingProvider}
                        </SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                        {connectingProvider && <SetupWizard providerKey={connectingProvider} />}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function IntegrationChecklistItem({
    integration,
    verifyResult,
    onConnect
}: {
    integration: IntegrationInfo;
    verifyResult?: VerifyResult;
    onConnect: () => void;
}) {
    const hasVerifyError = verifyResult && !verifyResult.success;
    const hasDisabledTools = integration.disabledTools && integration.disabledTools.length > 0;
    const hasMissingTools = integration.missingTools && integration.missingTools.length > 0;
    const toolIssues = hasDisabledTools || hasMissingTools;

    const getStatusIcon = () => {
        if (!integration.connected) {
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-zinc-500" />
            );
        }
        if (toolIssues) {
            return <XCircleIcon className="h-5 w-5 text-amber-500" />;
        }
        return <CheckCircle2Icon className="h-5 w-5 text-green-500" />;
    };

    const getStatusLabel = () => {
        if (!integration.connected) return null;
        if (hasMissingTools) {
            return (
                <Badge className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600">
                    Tools Not Validated
                </Badge>
            );
        }
        if (hasDisabledTools) {
            return (
                <Badge className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600">
                    Tools Disabled
                </Badge>
            );
        }
        if (integration.toolsReady) {
            return (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                    Ready
                </Badge>
            );
        }
        return null;
    };

    return (
        <div
            className={`flex items-center gap-3 rounded-md border p-3 ${
                hasVerifyError
                    ? "border-red-500/30 bg-red-500/5"
                    : toolIssues
                      ? "border-amber-500/30 bg-amber-500/5"
                      : ""
            }`}
        >
            <div className="shrink-0">{getStatusIcon()}</div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{integration.name}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                        {integration.category}
                    </Badge>
                    {getStatusLabel()}
                </div>
                {hasVerifyError && (
                    <p className="mt-0.5 text-xs text-red-400">{verifyResult.error}</p>
                )}
                {verifyResult?.success && verifyResult.toolCount && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {verifyResult.toolCount} tools available
                    </p>
                )}
                {hasDisabledTools && (
                    <p className="mt-0.5 text-xs text-amber-600">
                        {integration.disabledTools!.length} required tool(s) disabled
                    </p>
                )}
                {hasMissingTools && (
                    <p className="mt-0.5 text-xs text-amber-600">
                        {integration.missingTools!.length} required tool(s) not yet discovered
                    </p>
                )}
            </div>

            {!integration.connected && (
                <Button size="sm" variant="outline" onClick={onConnect}>
                    Connect
                    <ArrowRightIcon className="ml-1.5 h-3 w-3" />
                </Button>
            )}

            {integration.connected && hasDisabledTools && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/mcp/providers/${integration.provider}`, "_blank")}
                >
                    Enable Tools
                    <ArrowRightIcon className="ml-1.5 h-3 w-3" />
                </Button>
            )}

            {integration.connected && !toolIssues && (
                <Button size="sm" variant="ghost" onClick={onConnect}>
                    <RefreshCwIcon className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    );
}
