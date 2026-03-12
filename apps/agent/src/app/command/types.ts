/* ─── Types ───────────────────────────────────────────────────────────── */

export interface ReviewContext {
    summary?: string;
    issueUrl?: string;
    issueNumber?: number;
    repository?: string;
    analysisUrl?: string;
    riskLevel?: string;
    filesChanged?: string[];
    prompt?: string;
}

export interface ReviewItem {
    id: string;
    status: string;
    workflowSlug?: string;
    workflowName?: string;
    runId?: string;
    runStatus?: string;
    originChannel?: string;
    suspendedStep?: string;
    reviewContext?: ReviewContext;
    githubRepo?: string;
    githubIssueNumber?: number;
    notifiedChannels: string[];
    responseChannel?: string;
    feedbackRound: number;
    feedbackText?: string;
    decidedBy?: string;
    decidedAt?: string;
    decisionReason?: string;
    orgName?: string;
    createdAt: string;
    sourceType?: string;
}

export const CHANNEL_ICONS: Record<string, string> = {
    slack: "💬",
    github: "🐙",
    telegram: "📨",
    whatsapp: "📱",
    admin: "🖥️",
    api: "🔌",
    web: "🌐"
};

export interface LearningProposal {
    id: string;
    status: string;
    agentId: string;
    agentSlug: string;
    agentName: string;
    agentVersion: number;
    triggerReason: string;
    riskTier: string;
    proposal: {
        id: string;
        title: string;
        description: string;
        changeDescription?: string;
        candidateInstructions?: string;
        candidateVersionId?: string;
    } | null;
    experiment: {
        id: string;
        status: string;
        winRate: number | null;
        gatingDecision: string | null;
        baselineRuns: number;
        candidateRuns: number;
    } | null;
    approval: {
        id: string;
        status: string;
        decidedBy?: string;
        decidedAt?: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}

export interface MetricsData {
    pendingCount: number;
    avgWaitMinutes: number;
    approvalRate7d: number;
    decisionsToday: number;
    avgDecisionMinutes: number;
    resolved24h: number;
    queueTrend: number;
}

export interface ToastItem {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

export type SortOption = "newest" | "oldest" | "highest-risk" | "by-source";

/* ─── Constants ───────────────────────────────────────────────────────── */

export const POLL_INTERVAL_MS = 15_000;
export const TIME_UPDATE_INTERVAL_MS = 30_000;
export const TOAST_DURATION_MS = 3000;

export const RISK_COLORS: Record<string, string> = {
    trivial: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
};

export const RISK_BORDER_COLORS: Record<string, string> = {
    trivial: "border-l-gray-400",
    low: "border-l-green-500",
    medium: "border-l-amber-500",
    high: "border-l-orange-500",
    critical: "border-l-red-500"
};

export const RISK_SORT_ORDER: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    trivial: 4,
    unknown: 5
};

export const SOURCE_TYPE_STYLES: Record<string, string> = {
    workflow: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    campaign: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    financial: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    integration: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
};

export const URGENCY_THRESHOLDS = [
    { maxMinutes: 30, className: "text-green-600 dark:text-green-400" },
    { maxMinutes: 120, className: "text-amber-600 dark:text-amber-400" },
    { maxMinutes: 480, className: "text-orange-600 dark:text-orange-400" }
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

export function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function formatDuration(minutes: number): string {
    if (minutes < 1) return "<1m";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function getUrgencyClass(dateStr: string): string {
    const minutes = (Date.now() - new Date(dateStr).getTime()) / 60_000;
    for (const t of URGENCY_THRESHOLDS) {
        if (minutes < t.maxMinutes) return t.className;
    }
    return "text-red-600 dark:text-red-400";
}

export function getRiskLevel(review: ReviewItem): string {
    return review.reviewContext?.riskLevel || "unknown";
}

export function getDecisionPrompt(review: ReviewItem): string {
    const ctx = review.reviewContext;
    if (ctx?.prompt) return ctx.prompt;

    const step = review.suspendedStep || "action";
    const workflow = review.workflowName || review.workflowSlug || "workflow";

    if (ctx?.summary) {
        const firstSentence = ctx.summary.split(/[.!?\n]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
            return firstSentence.endsWith("?") ? firstSentence : `${firstSentence}?`;
        }
    }

    return `Approve ${step} in ${workflow}?`;
}
