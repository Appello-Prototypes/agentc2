import { vi } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Reset function for use in beforeEach
export function resetPrismaMock() {
    mockReset(prismaMock);
}

// Helper to mock prisma module
export function mockPrismaModule() {
    vi.mock("@repo/database", () => ({
        prisma: prismaMock,
        Prisma: {
            JsonNull: "DbNull",
            InputJsonValue: {}
        }
    }));
}

// Type export for use in tests
export type MockPrismaClient = DeepMockProxy<PrismaClient>;

// Helper to create a mock transaction
export function createMockTransaction() {
    const txMock = mockDeep<PrismaClient>();
    prismaMock.$transaction.mockImplementation(
        async (fn: (tx: PrismaClient) => Promise<unknown>) => {
            return fn(txMock as unknown as PrismaClient);
        }
    );
    return txMock;
}

// Helper to mock findUnique/findFirst returning an entity
export function mockFindAgent(agent: Record<string, unknown> | null) {
    prismaMock.agent.findUnique.mockResolvedValue(agent as never);
    prismaMock.agent.findFirst.mockResolvedValue(agent as never);
}

// Helper to mock findMany returning an array
export function mockFindManyRuns(runs: Record<string, unknown>[]) {
    prismaMock.agentRun.findMany.mockResolvedValue(runs as never);
}

// Helper to mock count
export function mockCountRuns(count: number) {
    prismaMock.agentRun.count.mockResolvedValue(count);
}

// Helper to mock create
export function mockCreateRun(run: Record<string, unknown>) {
    prismaMock.agentRun.create.mockResolvedValue(run as never);
}

// Helper to mock update
export function mockUpdateRun(run: Record<string, unknown>) {
    prismaMock.agentRun.update.mockResolvedValue(run as never);
}
