import { prisma } from "@repo/database";

// ── Rule types stored as JSON in CommunicationPolicy.rules ──

export type CommunicationRule =
    | { type: "deny_pair"; from: string; to: string; reason?: string }
    | { type: "deny_outbound"; agentSlug: string; reason?: string }
    | { type: "deny_inbound"; agentSlug: string; reason?: string }
    | { type: "max_peer_calls"; limit: number }
    | { type: "max_depth"; limit: number }
    | { type: "require_approval"; agentSlugs: string[] }
    | { type: "allowed_agents_only"; agentSlugs: string[] }
    | { type: "memory_access"; agentSlug: string; access: "read_only" | "none" }
    | { type: "deny_all"; reason?: string };

// ── Evaluation context & decision ──

export interface PolicyEvaluationContext {
    fromAgentSlug: string;
    toAgentSlug: string;
    sessionId?: string;
    organizationId?: string;
    workspaceId?: string;
    networkId?: string;
    userId?: string;
    currentDepth?: number;
    currentPeerCalls?: number;
}

export interface PolicyDecision {
    allowed: boolean;
    reason?: string;
    restrictions: {
        maxDepth: number;
        maxPeerCalls: number;
        memoryAccess: "full" | "read_only" | "none";
        requiresApproval: boolean;
    };
    appliedPolicies: string[];
}

// Scope breadth ordering — broader scopes evaluated first
const SCOPE_ORDER: Record<string, number> = {
    organization: 0,
    workspace: 1,
    network: 2,
    agent: 3,
    user: 4
};

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_PEER_CALLS = 50;

/**
 * Evaluate the communication policy cascade for an agent-to-agent invocation.
 *
 * Default-open: when no policies exist, everything is allowed.
 * Policies are purely restrictive — they can deny, limit, or require approval
 * but never expand permissions beyond the default.
 */
export async function evaluateCommunicationPolicy(
    ctx: PolicyEvaluationContext
): Promise<PolicyDecision> {
    const scopeFilters: Array<{ scope: string; scopeId: string }> = [];

    if (ctx.organizationId)
        scopeFilters.push({ scope: "organization", scopeId: ctx.organizationId });
    if (ctx.workspaceId) scopeFilters.push({ scope: "workspace", scopeId: ctx.workspaceId });
    if (ctx.networkId) scopeFilters.push({ scope: "network", scopeId: ctx.networkId });
    // Agent-level policies apply to the source agent
    scopeFilters.push({ scope: "agent", scopeId: ctx.fromAgentSlug });
    if (ctx.userId) scopeFilters.push({ scope: "user", scopeId: ctx.userId });

    // Default-open: if no scopes to check, allow everything
    if (scopeFilters.length <= 1) {
        return defaultDecision();
    }

    const policies = await prisma.communicationPolicy.findMany({
        where: {
            enabled: true,
            OR: scopeFilters
        },
        orderBy: [{ priority: "asc" }]
    });

    if (policies.length === 0) {
        return defaultDecision();
    }

    // Sort by scope breadth (org first), then by priority within scope
    policies.sort((a, b) => {
        const scopeDiff = (SCOPE_ORDER[a.scope] ?? 99) - (SCOPE_ORDER[b.scope] ?? 99);
        if (scopeDiff !== 0) return scopeDiff;
        return a.priority - b.priority;
    });

    // Start with default-open restrictions
    let allowed = true;
    let reason: string | undefined;
    let maxDepth = DEFAULT_MAX_DEPTH;
    let maxPeerCalls = DEFAULT_MAX_PEER_CALLS;
    let memoryAccess: "full" | "read_only" | "none" = "full";
    let requiresApproval = false;
    const appliedPolicies: string[] = [];

    for (const policy of policies) {
        const rules = policy.rules as unknown as CommunicationRule[];
        if (!Array.isArray(rules)) continue;

        let policyApplied = false;

        for (const rule of rules) {
            switch (rule.type) {
                case "deny_all":
                    allowed = false;
                    reason = rule.reason || `Blocked by ${policy.scope} policy`;
                    policyApplied = true;
                    break;

                case "deny_pair":
                    if (rule.from === ctx.fromAgentSlug && rule.to === ctx.toAgentSlug) {
                        allowed = false;
                        reason = rule.reason || `Communication denied: ${rule.from} → ${rule.to}`;
                        policyApplied = true;
                    }
                    break;

                case "deny_outbound":
                    if (rule.agentSlug === ctx.fromAgentSlug) {
                        allowed = false;
                        reason =
                            rule.reason || `Outbound communication denied for ${rule.agentSlug}`;
                        policyApplied = true;
                    }
                    break;

                case "deny_inbound":
                    if (rule.agentSlug === ctx.toAgentSlug) {
                        allowed = false;
                        reason =
                            rule.reason || `Inbound communication denied for ${rule.agentSlug}`;
                        policyApplied = true;
                    }
                    break;

                case "max_peer_calls":
                    maxPeerCalls = Math.min(maxPeerCalls, rule.limit);
                    policyApplied = true;
                    break;

                case "max_depth":
                    maxDepth = Math.min(maxDepth, rule.limit);
                    policyApplied = true;
                    break;

                case "require_approval":
                    if (
                        rule.agentSlugs.includes(ctx.toAgentSlug) ||
                        rule.agentSlugs.includes(ctx.fromAgentSlug)
                    ) {
                        requiresApproval = true;
                        policyApplied = true;
                    }
                    break;

                case "allowed_agents_only":
                    if (!rule.agentSlugs.includes(ctx.toAgentSlug)) {
                        allowed = false;
                        reason = `Agent "${ctx.toAgentSlug}" not in allowed list`;
                        policyApplied = true;
                    }
                    break;

                case "memory_access":
                    if (
                        rule.agentSlug === ctx.fromAgentSlug ||
                        rule.agentSlug === ctx.toAgentSlug
                    ) {
                        if (rule.access === "none") {
                            memoryAccess = "none";
                        } else if (rule.access === "read_only" && memoryAccess === "full") {
                            memoryAccess = "read_only";
                        }
                        policyApplied = true;
                    }
                    break;
            }
        }

        if (policyApplied) {
            appliedPolicies.push(policy.id);
        }
    }

    // Enforce runtime counters against effective limits
    if (allowed && ctx.currentDepth !== undefined && ctx.currentDepth >= maxDepth) {
        allowed = false;
        reason = `Maximum invocation depth (${maxDepth}) exceeded`;
    }
    if (allowed && ctx.currentPeerCalls !== undefined && ctx.currentPeerCalls >= maxPeerCalls) {
        allowed = false;
        reason = `Maximum peer calls (${maxPeerCalls}) exceeded`;
    }

    return {
        allowed,
        reason,
        restrictions: { maxDepth, maxPeerCalls, memoryAccess, requiresApproval },
        appliedPolicies
    };
}

function defaultDecision(): PolicyDecision {
    return {
        allowed: true,
        restrictions: {
            maxDepth: DEFAULT_MAX_DEPTH,
            maxPeerCalls: DEFAULT_MAX_PEER_CALLS,
            memoryAccess: "full",
            requiresApproval: false
        },
        appliedPolicies: []
    };
}
