"use client";

import { useState } from "react";
import { Badge, Button } from "@repo/ui";
import type { StepData } from "../../types";

/* ---------- Types ---------- */

interface LinkItem {
    url: string;
    label: string;
    icon: string;
}
interface MetadataItem {
    label: string;
    value: string;
    mono?: boolean;
}
interface SummaryItem {
    label: string;
    text: string;
}
interface DecisionInfo {
    decision: string;
    approved: boolean;
    decidedBy?: string;
    channel?: string;
}
interface ErrorInfo {
    message: string;
    validationErrors?: { field: string; errors: string[] }[];
}

/* ---------- Utilities ---------- */

export function formatStepDuration(ms?: number | null) {
    if (!ms || ms <= 0) return "--";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${Math.round(s % 60)}s`;
}

function classifyUrl(url: string): { icon: string; hostname: string } {
    try {
        const u = new URL(url);
        if (u.hostname.includes("github.com")) return { icon: "🐙", hostname: u.hostname };
        if (u.hostname.includes("cursor.com") && u.pathname.startsWith("/agents"))
            return { icon: "🔧", hostname: u.hostname };
        return { icon: "🔗", hostname: u.hostname };
    } catch {
        return { icon: "🔗", hostname: "link" };
    }
}

function humanizeKey(key: string): string {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
}

/* ---------- Extraction helpers ---------- */

export function extractLinks(output: unknown, handledKeys: Set<string>): LinkItem[] {
    if (!output || typeof output !== "object") return [];
    const obj = output as Record<string, unknown>;
    const links: LinkItem[] = [];
    const urlRegex = /^https?:\/\//;

    const paired: Record<string, string> = {
        issueUrl: "issueNumber",
        prUrl: "prNumber"
    };

    const processed = new Set<string>();

    for (const [key, value] of Object.entries(obj)) {
        if (processed.has(key)) continue;
        if (value === null || value === undefined) {
            handledKeys.add(key);
            continue;
        }

        if (key.endsWith("AgentId") && typeof value === "string") {
            links.push({
                url: `https://cursor.com/agents/${value}`,
                label: humanizeKey(key.replace(/AgentId$/, "")),
                icon: "🔧"
            });
            handledKeys.add(key);
            processed.add(key);
            continue;
        }

        if (typeof value === "string" && urlRegex.test(value)) {
            const numberKey = paired[key];
            let label = humanizeKey(key.replace(/Url$/, ""));
            if (numberKey && obj[numberKey] != null) {
                label += ` #${obj[numberKey]}`;
                handledKeys.add(numberKey);
                processed.add(numberKey);
            }
            const { icon } = classifyUrl(value);
            links.push({ url: value, label, icon });
            handledKeys.add(key);
            processed.add(key);
        }
    }

    return links;
}

export function extractMetadata(output: unknown, handledKeys: Set<string>): MetadataItem[] {
    if (!output || typeof output !== "object") return [];
    const obj = output as Record<string, unknown>;
    const items: MetadataItem[] = [];

    const fieldMap: Record<string, { label: string; mono?: boolean }> = {
        repository: { label: "Repository", mono: true },
        channel: { label: "Channel" },
        decidedBy: { label: "Decided By" },
        issueNumber: { label: "Issue #", mono: true },
        prNumber: { label: "PR #", mono: true }
    };

    for (const [key, config] of Object.entries(fieldMap)) {
        if (handledKeys.has(key)) continue;
        const val = obj[key];
        if (val != null && val !== "") {
            items.push({ label: config.label, value: String(val), mono: config.mono });
            handledKeys.add(key);
        }
    }

    for (const [key, val] of Object.entries(obj)) {
        if (handledKeys.has(key)) continue;
        if (key.endsWith("Branch") && typeof val === "string") {
            items.push({ label: humanizeKey(key), value: val, mono: true });
            handledKeys.add(key);
        }
        if (key.endsWith("DurationMs") && typeof val === "number") {
            items.push({
                label: humanizeKey(key.replace(/Ms$/, "")),
                value: formatStepDuration(val)
            });
            handledKeys.add(key);
        }
    }

    return items;
}

export function extractDecision(output: unknown, handledKeys: Set<string>): DecisionInfo | null {
    if (!output || typeof output !== "object") return null;
    const obj = output as Record<string, unknown>;
    if (!("decision" in obj) && !("approved" in obj)) return null;

    const decision = typeof obj.decision === "string" ? obj.decision : undefined;
    const approved =
        typeof obj.approved === "boolean" ? obj.approved : decision?.toLowerCase() === "approved";

    handledKeys.add("decision");
    handledKeys.add("approved");

    const info: DecisionInfo = {
        decision: decision || (approved ? "approved" : "rejected"),
        approved
    };

    if (typeof obj.decidedBy === "string") {
        info.decidedBy = obj.decidedBy;
        handledKeys.add("decidedBy");
    }
    if (typeof obj.channel === "string") {
        info.channel = obj.channel;
        handledKeys.add("channel");
    }

    return info;
}

export function extractError(
    output: unknown,
    errorJson: unknown,
    handledKeys: Set<string>
): ErrorInfo | null {
    const errors: ErrorInfo[] = [];

    if (output && typeof output === "object") {
        const obj = output as Record<string, unknown>;
        if (obj.error) {
            const info: ErrorInfo = {
                message: typeof obj.message === "string" ? obj.message : "Unknown error"
            };
            handledKeys.add("error");
            handledKeys.add("message");

            if (obj.validationErrors && typeof obj.validationErrors === "object") {
                const ve = obj.validationErrors as Record<string, unknown>;
                const parsed: { field: string; errors: string[] }[] = [];
                for (const [field, val] of Object.entries(ve)) {
                    if (field === "_errors") continue;
                    if (
                        val &&
                        typeof val === "object" &&
                        "_errors" in (val as Record<string, unknown>)
                    ) {
                        const fieldErrors = (val as Record<string, unknown>)._errors;
                        if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
                            parsed.push({ field, errors: fieldErrors.map(String) });
                        }
                    }
                }
                if (parsed.length > 0) info.validationErrors = parsed;
                handledKeys.add("validationErrors");
            }
            errors.push(info);
        }
    }

    if (errorJson != null) {
        if (typeof errorJson === "string") {
            errors.push({ message: errorJson });
        } else if (typeof errorJson === "object") {
            const ej = errorJson as Record<string, unknown>;
            errors.push({
                message: typeof ej.message === "string" ? ej.message : JSON.stringify(errorJson)
            });
        }
    }

    if (errors.length === 0) return null;
    if (errors.length === 1) return errors[0]!;
    return {
        message: errors.map((e) => e.message).join("\n\n"),
        validationErrors: errors.flatMap((e) => e.validationErrors || [])
    };
}

export function extractSummaries(output: unknown, handledKeys: Set<string>): SummaryItem[] {
    if (!output || typeof output !== "object") return [];
    const obj = output as Record<string, unknown>;
    const items: SummaryItem[] = [];

    for (const [key, val] of Object.entries(obj)) {
        if (handledKeys.has(key)) continue;
        if (val === null || val === undefined) {
            handledKeys.add(key);
            continue;
        }
        const isSummaryKey =
            key.endsWith("Summary") ||
            key === "text" ||
            key === "response" ||
            key === "result" ||
            key === "verdict";
        if (isSummaryKey && typeof val === "string") {
            items.push({ label: humanizeKey(key), text: val });
            handledKeys.add(key);
        }
    }

    return items;
}

export function getRemainingFields(
    output: unknown,
    handledKeys: Set<string>
): Record<string, unknown> {
    if (!output || typeof output !== "object") return {};
    const obj = output as Record<string, unknown>;
    const remaining: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (!handledKeys.has(key) && val !== null && val !== undefined) {
            remaining[key] = val;
        }
    }
    return remaining;
}

/* ---------- SummaryBlock ---------- */

function SummaryBlock({ label, text }: { label: string; text: string }) {
    const [collapsed, setCollapsed] = useState(text.length > 300);
    const isLong = text.length > 300;

    return (
        <div>
            <div className="text-muted-foreground mb-0.5 text-xs font-medium">{label}</div>
            <pre
                className={`overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap ${
                    collapsed ? "max-h-20" : "max-h-64"
                }`}
            >
                {text}
            </pre>
            {isLong && (
                <button
                    type="button"
                    className="text-muted-foreground mt-0.5 text-[10px] hover:underline"
                    onClick={() => setCollapsed((p) => !p)}
                >
                    {collapsed ? "Show more" : "Show less"}
                </button>
            )}
        </div>
    );
}

/* ---------- StepDetailPanel ---------- */

export interface StepDetailPanelProps {
    step: StepData;
    isSuspended?: boolean;
    suspendedStep?: string | null;
    onRetryStep?: (stepId: string) => void;
    retryingStepId?: string | null;
    confirmRetryStepId?: string | null;
    onConfirmRetry?: (stepId: string) => void;
    onCancelRetry?: () => void;
    onExecuteRetry?: (stepId: string) => void;
    onSkipStep?: (stepId: string, reason?: string) => void;
    skippingStepId?: string | null;
    confirmSkipStepId?: string | null;
    onConfirmSkip?: (stepId: string) => void;
    onCancelSkip?: () => void;
    onExecuteSkip?: (stepId: string, reason?: string) => void;
    skipReason?: string;
    onSkipReasonChange?: (reason: string) => void;
    compact?: boolean;
}

export function StepDetailPanel({
    step,
    isSuspended,
    onRetryStep,
    retryingStepId,
    confirmRetryStepId,
    onConfirmRetry,
    onCancelRetry,
    onExecuteRetry,
    onSkipStep,
    skippingStepId,
    confirmSkipStepId,
    onConfirmSkip,
    onCancelSkip,
    onExecuteSkip,
    skipReason,
    onSkipReasonChange,
    compact = false
}: StepDetailPanelProps) {
    const [showRaw, setShowRaw] = useState(false);

    const isFailed = step.status.toUpperCase() === "FAILED";
    const hasOutput = step.outputJson !== null || step.errorJson != null;

    if (isSuspended && !hasOutput) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50/50 px-3 py-2 dark:border-cyan-800 dark:bg-cyan-950/20">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
                    <span className="text-sm text-cyan-700 dark:text-cyan-300">
                        Awaiting human approval
                    </span>
                </div>
                {onSkipStep && (
                    <>
                        {confirmSkipStepId === step.stepId ? (
                            <div className="flex flex-col gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-950/30">
                                <div className="flex items-start gap-2">
                                    <span className="mt-0.5 text-sm">⏭</span>
                                    <div>
                                        <span className="text-sm font-medium">
                                            Skip this approval step?
                                        </span>
                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                            Skip this approval step and continue the workflow. A
                                            synthetic approval will be injected.
                                        </p>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Reason (optional)"
                                    value={skipReason || ""}
                                    onChange={(e) => onSkipReasonChange?.(e.target.value)}
                                    className="bg-background w-full rounded-md border px-2 py-1 text-xs"
                                />
                                <div className="flex gap-2 self-end">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs"
                                        onClick={() => onCancelSkip?.()}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-7 border-cyan-300 bg-cyan-500 text-xs text-white hover:bg-cyan-600 dark:border-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-700"
                                        onClick={() =>
                                            onExecuteSkip?.(step.stepId, skipReason || undefined)
                                        }
                                        disabled={skippingStepId === step.stepId}
                                    >
                                        {skippingStepId === step.stepId ? (
                                            <>
                                                <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                Skipping…
                                            </>
                                        ) : (
                                            "Yes, Skip & Continue"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-cyan-200 px-2 text-xs text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950/30 dark:hover:text-cyan-300"
                                onClick={() => onConfirmSkip?.(step.stepId)}
                                disabled={skippingStepId != null}
                            >
                                {skippingStepId === step.stepId ? (
                                    <>
                                        <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Skipping…
                                    </>
                                ) : (
                                    <>⏭ Skip & Continue</>
                                )}
                            </Button>
                        )}
                    </>
                )}
            </div>
        );
    }

    if (step.outputJson === null && step.errorJson == null) {
        return <div className="text-muted-foreground py-1 text-xs italic">No output recorded</div>;
    }

    if (typeof step.outputJson === "string") {
        return (
            <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap">
                {step.outputJson}
            </pre>
        );
    }

    if (
        step.outputJson &&
        typeof step.outputJson === "object" &&
        Object.keys(step.outputJson as Record<string, unknown>).length === 0 &&
        step.errorJson == null
    ) {
        return <div className="text-muted-foreground py-1 text-xs italic">Empty output</div>;
    }

    const handledKeys = new Set<string>();

    const links = extractLinks(step.outputJson, handledKeys);
    const metadata = extractMetadata(step.outputJson, handledKeys);
    const decision = extractDecision(step.outputJson, handledKeys);
    const error = extractError(step.outputJson, step.errorJson, handledKeys);
    const summaries = extractSummaries(step.outputJson, handledKeys);
    const remaining = getRemainingFields(step.outputJson, handledKeys);
    const remainingCount = Object.keys(remaining).length;

    return (
        <div className={compact ? "space-y-1.5" : "space-y-2"}>
            {/* Metadata row */}
            {metadata.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {metadata.map((m) => (
                        <span key={m.label} className="text-muted-foreground text-xs">
                            <span className="font-medium">{m.label}:</span>{" "}
                            <span className={m.mono ? "font-mono" : ""}>{m.value}</span>
                        </span>
                    ))}
                </div>
            )}

            {/* Links */}
            {links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {links.map((l) => (
                        <a
                            key={l.url}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:bg-primary/10 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-blue-600 transition-colors hover:border-blue-300 dark:text-blue-400"
                        >
                            <span>{l.icon}</span>
                            <span>{l.label}</span>
                        </a>
                    ))}
                </div>
            )}

            {/* Decision chip */}
            {decision && (
                <div className="flex items-center gap-2">
                    <Badge variant={decision.approved ? "default" : "destructive"}>
                        {decision.decision}
                    </Badge>
                    {decision.decidedBy && (
                        <span className="text-muted-foreground text-xs">
                            by {decision.decidedBy}
                        </span>
                    )}
                    {decision.channel && (
                        <span className="text-muted-foreground text-xs">
                            via {decision.channel}
                        </span>
                    )}
                </div>
            )}

            {/* Error block */}
            {error && (
                <div className="bg-destructive/5 border-destructive/20 rounded-md border p-2">
                    <pre className="text-destructive text-xs whitespace-pre-wrap">
                        {error.message}
                    </pre>
                    {error.validationErrors && error.validationErrors.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                            {error.validationErrors.map((ve) => (
                                <div key={ve.field} className="text-xs">
                                    <span className="text-destructive font-mono font-medium">
                                        {ve.field}:
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                        {ve.errors.join(", ")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Retry + Skip step actions for FAILED steps */}
            {isFailed && (onRetryStep || onSkipStep) && (
                <>
                    {confirmRetryStepId === step.stepId ? (
                        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                            <div className="flex items-start gap-2">
                                <span className="mt-0.5 text-sm">⚠️</span>
                                <div>
                                    <span className="text-sm font-medium">Retry this step?</span>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        The step{" "}
                                        <code className="bg-muted rounded px-1">
                                            {step.stepName || step.stepId}
                                        </code>{" "}
                                        will be re-executed. All prior completed steps will be
                                        preserved. Make sure the underlying issue (e.g., expired
                                        token) has been resolved.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 self-end">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => onCancelRetry?.()}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 border-amber-300 bg-amber-500 text-xs text-white hover:bg-amber-600 dark:border-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
                                    onClick={() => onExecuteRetry?.(step.stepId)}
                                    disabled={retryingStepId === step.stepId}
                                >
                                    {retryingStepId === step.stepId ? (
                                        <>
                                            <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Retrying…
                                        </>
                                    ) : (
                                        "Yes, Retry"
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : confirmSkipStepId === step.stepId ? (
                        <div className="flex flex-col gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-950/30">
                            <div className="flex items-start gap-2">
                                <span className="mt-0.5 text-sm">⏭</span>
                                <div>
                                    <span className="text-sm font-medium">Skip this step?</span>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        Skip this step and continue. The step output will be
                                        replaced with a synthetic &quot;skipped&quot; marker.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Reason (optional)"
                                value={skipReason || ""}
                                onChange={(e) => onSkipReasonChange?.(e.target.value)}
                                className="bg-background w-full rounded-md border px-2 py-1 text-xs"
                            />
                            <div className="flex gap-2 self-end">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => onCancelSkip?.()}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 border-cyan-300 bg-cyan-500 text-xs text-white hover:bg-cyan-600 dark:border-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-700"
                                    onClick={() =>
                                        onExecuteSkip?.(step.stepId, skipReason || undefined)
                                    }
                                    disabled={skippingStepId === step.stepId}
                                >
                                    {skippingStepId === step.stepId ? (
                                        <>
                                            <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Skipping…
                                        </>
                                    ) : (
                                        "Yes, Skip & Continue"
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            {onRetryStep && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-amber-200 px-2 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-300"
                                    onClick={() => onConfirmRetry?.(step.stepId)}
                                    disabled={retryingStepId != null || skippingStepId != null}
                                >
                                    {retryingStepId === step.stepId ? (
                                        <>
                                            <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Retrying…
                                        </>
                                    ) : (
                                        <>↻ Retry Step</>
                                    )}
                                </Button>
                            )}
                            {onSkipStep && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-cyan-200 px-2 text-xs text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950/30 dark:hover:text-cyan-300"
                                    onClick={() => onConfirmSkip?.(step.stepId)}
                                    disabled={retryingStepId != null || skippingStepId != null}
                                >
                                    {skippingStepId === step.stepId ? (
                                        <>
                                            <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Skipping…
                                        </>
                                    ) : (
                                        <>⏭ Skip & Continue</>
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Summaries */}
            {summaries.map((s) => (
                <SummaryBlock key={s.label} label={s.label} text={s.text} />
            ))}

            {/* Raw JSON toggle */}
            <div className="pt-1">
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                    onClick={() => setShowRaw((p) => !p)}
                >
                    {showRaw ? "▼ Hide" : "▶ View"} raw output
                    {remainingCount > 0
                        ? ` (${remainingCount} field${remainingCount !== 1 ? "s" : ""})`
                        : " (all fields rendered above)"}
                </button>
                {showRaw && (
                    <pre className="bg-muted/30 mt-1.5 max-h-48 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap">
                        {remainingCount > 0
                            ? JSON.stringify(remaining, null, 2)
                            : JSON.stringify(step.outputJson, null, 2)}
                    </pre>
                )}
            </div>
        </div>
    );
}
