/**
 * Circuit Breaker pattern implementation.
 *
 * States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 *
 * - CLOSED: Normal operation. Track failures.
 * - OPEN: Reject all calls immediately. Wait for reset timeout.
 * - HALF_OPEN: Allow a single test call. Success closes, failure re-opens.
 *
 * Usage:
 *   const breaker = new CircuitBreaker("openai", { failureThreshold: 5 });
 *   const result = await breaker.execute(() => callOpenAI(prompt));
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
    failureThreshold?: number;
    failureWindowMs?: number;
    resetTimeoutMs?: number;
    successThreshold?: number;
    onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
    failureThreshold: 5,
    failureWindowMs: 60000,
    resetTimeoutMs: 30000,
    successThreshold: 3,
    onStateChange: () => {}
};

export class CircuitBreakerError extends Error {
    constructor(
        public readonly circuitName: string,
        public readonly state: CircuitState
    ) {
        super(`Circuit breaker "${circuitName}" is ${state} — call rejected`);
        this.name = "CircuitBreakerError";
    }
}

export class CircuitBreaker {
    private state: CircuitState = "CLOSED";
    private failures: number[] = [];
    private consecutiveSuccesses = 0;
    private lastFailureTime = 0;
    private readonly options: Required<CircuitBreakerOptions>;

    constructor(
        public readonly name: string,
        options?: CircuitBreakerOptions
    ) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    getState(): CircuitState {
        this.evaluateState();
        return this.state;
    }

    getStats() {
        return {
            name: this.name,
            state: this.getState(),
            recentFailures: this.failures.length,
            consecutiveSuccesses: this.consecutiveSuccesses,
            lastFailureTime: this.lastFailureTime || null
        };
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.evaluateState();

        if (this.state === "OPEN") {
            throw new CircuitBreakerError(this.name, this.state);
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private evaluateState(): void {
        if (this.state === "OPEN") {
            const elapsed = Date.now() - this.lastFailureTime;
            if (elapsed >= this.options.resetTimeoutMs) {
                this.transition("HALF_OPEN");
            }
        }

        const windowStart = Date.now() - this.options.failureWindowMs;
        this.failures = this.failures.filter((t) => t > windowStart);
    }

    private onSuccess(): void {
        if (this.state === "HALF_OPEN") {
            this.consecutiveSuccesses++;
            if (this.consecutiveSuccesses >= this.options.successThreshold) {
                this.failures = [];
                this.consecutiveSuccesses = 0;
                this.transition("CLOSED");
            }
        } else if (this.state === "CLOSED") {
            this.consecutiveSuccesses++;
        }
    }

    private onFailure(): void {
        this.consecutiveSuccesses = 0;
        this.lastFailureTime = Date.now();

        if (this.state === "HALF_OPEN") {
            this.transition("OPEN");
            return;
        }

        this.failures.push(Date.now());

        const windowStart = Date.now() - this.options.failureWindowMs;
        const recentFailures = this.failures.filter((t) => t > windowStart);

        if (recentFailures.length >= this.options.failureThreshold) {
            this.transition("OPEN");
        }
    }

    private transition(to: CircuitState): void {
        const from = this.state;
        if (from === to) return;
        this.state = to;
        this.options.onStateChange(from, to, this.name);
    }
}

const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = registry.get(name);
    if (!breaker) {
        breaker = new CircuitBreaker(name, options);
        registry.set(name, breaker);
    }
    return breaker;
}

export function getAllCircuitBreakerStats() {
    return Array.from(registry.values()).map((b) => b.getStats());
}
