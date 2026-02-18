type PolicyDef = {
    windowMs: number;
    max: number;
};

export const RATE_LIMIT_POLICIES = {
    auth: { windowMs: 15 * 60 * 1000, max: 20 },
    chat: { windowMs: 60 * 1000, max: 30 },
    invoke: { windowMs: 60 * 1000, max: 20 },
    mcp: { windowMs: 60 * 1000, max: 50 },
    uploads: { windowMs: 60 * 1000, max: 10 },
    orgMutation: { windowMs: 60 * 1000, max: 30 }
} as const satisfies Record<string, PolicyDef>;

export type RateLimitPolicyKey = keyof typeof RATE_LIMIT_POLICIES;
