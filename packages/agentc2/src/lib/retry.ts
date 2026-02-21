/**
 * Retry utility with exponential backoff and full jitter.
 *
 * Usage:
 *   const result = await withRetry(() => fetch(url), {
 *       maxRetries: 3,
 *       initialDelayMs: 1000,
 *   });
 */

export interface RetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    jitter?: boolean;
    isRetryable?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    jitter: true,
    isRetryable: defaultIsRetryable,
    onRetry: () => {}
};

function defaultIsRetryable(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("econnreset") || msg.includes("econnrefused")) return true;
        if (msg.includes("timeout") || msg.includes("etimedout")) return true;
        if (msg.includes("socket hang up") || msg.includes("epipe")) return true;
    }

    if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number"
    ) {
        const status = (error as { status: number }).status;
        return status === 429 || status === 502 || status === 503 || status === 504;
    }

    return false;
}

function computeDelay(attempt: number, options: Required<RetryOptions>): number {
    const expDelay = Math.min(options.maxDelayMs, options.initialDelayMs * Math.pow(2, attempt));
    if (!options.jitter) return expDelay;
    return Math.random() * expDelay;
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    let lastError: unknown;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt >= opts.maxRetries || !opts.isRetryable(error)) {
                throw error;
            }

            opts.onRetry(error, attempt + 1);

            const delay = computeDelay(attempt, opts);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}
