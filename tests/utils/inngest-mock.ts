import { vi } from "vitest";

/**
 * Create a mock Inngest step object
 */
export function createMockStep() {
    return {
        run: vi.fn(async <T>(_name: string, fn: () => Promise<T>) => {
            return fn();
        }),
        sleep: vi.fn(async () => {}),
        sleepUntil: vi.fn(async () => {}),
        waitForEvent: vi.fn(async () => null),
        sendEvent: vi.fn(async () => ({ ids: ["mock-event-id"] })),
        invoke: vi.fn(async () => ({}))
    };
}

/**
 * Create a mock Inngest event
 */
export function createMockEvent<T extends Record<string, unknown>>(
    name: string,
    data: T
): { name: string; data: T; id: string; ts: number } {
    return {
        name,
        data,
        id: `mock-event-${Date.now()}`,
        ts: Date.now()
    };
}

/**
 * Helper to test Inngest function execution
 */
export async function executeInngestFunction<T, E extends Record<string, unknown>>(
    fn: (ctx: { event: { data: E }; step: ReturnType<typeof createMockStep> }) => Promise<T>,
    eventData: E
): Promise<{ result: T; step: ReturnType<typeof createMockStep> }> {
    const step = createMockStep();
    const event = { data: eventData };

    const result = await fn({ event, step });

    return { result, step };
}

/**
 * Assert that a step was called with specific name
 */
export function assertStepCalled(step: ReturnType<typeof createMockStep>, stepName: string) {
    const calls = step.run.mock.calls;
    const found = calls.some((call) => call[0] === stepName);
    if (!found) {
        const calledSteps = calls.map((call) => call[0]).join(", ");
        throw new Error(`Expected step "${stepName}" to be called. Called steps: ${calledSteps}`);
    }
}

/**
 * Assert step was not called
 */
export function assertStepNotCalled(step: ReturnType<typeof createMockStep>, stepName: string) {
    const calls = step.run.mock.calls;
    const found = calls.some((call) => call[0] === stepName);
    if (found) {
        throw new Error(`Expected step "${stepName}" NOT to be called, but it was`);
    }
}
