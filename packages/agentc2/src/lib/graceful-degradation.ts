/**
 * Graceful Degradation Strategies
 *
 * Defines what happens when each external dependency fails,
 * and provides helper functions for fallback behavior.
 */

export interface DegradationStrategy {
    service: string;
    description: string;
    fallback: string;
    severity: "critical" | "degraded" | "minor";
}

export const DEGRADATION_STRATEGIES: DegradationStrategy[] = [
    {
        service: "mcp-server",
        description: "MCP server connection lost",
        fallback:
            "Agent continues without that server's tools. User informed which tools are unavailable.",
        severity: "degraded"
    },
    {
        service: "openai",
        description: "OpenAI API unreachable or rate-limited",
        fallback:
            "Attempt fallback to Anthropic if configured on agent. Otherwise return clear error: 'AI provider temporarily unavailable.'",
        severity: "critical"
    },
    {
        service: "anthropic",
        description: "Anthropic API unreachable or rate-limited",
        fallback: "Attempt fallback to OpenAI if configured. Otherwise return clear error to user.",
        severity: "critical"
    },
    {
        service: "database",
        description: "PostgreSQL degraded or unreachable",
        fallback:
            "Read-only mode for list/read operations via read replica (if available). Write operations return 503.",
        severity: "critical"
    },
    {
        service: "redis",
        description: "Upstash Redis unreachable",
        fallback:
            "Development: fall back to in-memory rate limiting. Production: apply conservative fixed limits.",
        severity: "degraded"
    },
    {
        service: "inngest",
        description: "Inngest background job service unreachable",
        fallback:
            "Critical webhook events queued to WebhookDeadLetter table for replay. Non-critical jobs logged and dropped.",
        severity: "degraded"
    },
    {
        service: "elevenlabs",
        description: "ElevenLabs voice API unreachable",
        fallback:
            "Voice features disabled. Text-only fallback for agent interactions. User notified.",
        severity: "minor"
    },
    {
        service: "sentry",
        description: "Sentry error tracking unreachable",
        fallback: "Errors logged locally via pino. No impact on user-facing functionality.",
        severity: "minor"
    },
    {
        service: "supabase-storage",
        description: "Supabase storage unreachable",
        fallback: "File uploads return 503. Existing file URLs still served from CDN cache.",
        severity: "degraded"
    }
];

export type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
    service: string;
    status: ServiceStatus;
    lastChecked: Date;
    latencyMs?: number;
    error?: string;
}

const serviceHealthCache = new Map<string, ServiceHealth>();

export function updateServiceHealth(
    service: string,
    status: ServiceStatus,
    latencyMs?: number,
    error?: string
): void {
    serviceHealthCache.set(service, {
        service,
        status,
        lastChecked: new Date(),
        latencyMs,
        error
    });
}

export function getServiceHealth(service: string): ServiceHealth {
    return (
        serviceHealthCache.get(service) || {
            service,
            status: "unknown" as ServiceStatus,
            lastChecked: new Date()
        }
    );
}

export function getAllServiceHealth(): ServiceHealth[] {
    return Array.from(serviceHealthCache.values());
}

export function getStrategy(service: string): DegradationStrategy | undefined {
    return DEGRADATION_STRATEGIES.find((s) => s.service === service);
}

export function isServiceHealthy(service: string): boolean {
    const health = serviceHealthCache.get(service);
    return !health || health.status === "healthy";
}
