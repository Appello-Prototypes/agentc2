// Store recent webhook calls for debugging
const recentCalls: Array<{
    timestamp: string;
    tool: string;
    parameters: Record<string, unknown>;
    success: boolean;
    response?: string;
    error?: string;
    duration?: number;
}> = [];

const MAX_CALLS = 20;

/**
 * Add a call to the debug log (called from the main tools route)
 */
export function logWebhookCall(call: (typeof recentCalls)[0]) {
    recentCalls.unshift(call);
    if (recentCalls.length > MAX_CALLS) {
        recentCalls.pop();
    }
}

/**
 * Get recent webhook calls for debugging
 */
export function getRecentCalls() {
    return recentCalls;
}
