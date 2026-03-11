import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, parseResponse, assertSuccess } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const computeTakeoffMock = vi.fn();
const authenticateRequestMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        DbNull: "DbNull"
    }
}));

vi.mock("@repo/agentc2/bim", () => ({
    computeTakeoff: computeTakeoffMock
}));

vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: (...args: unknown[]) => authenticateRequestMock(...args)
}));

describe("BIM Takeoff API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        authenticateRequestMock.mockResolvedValue({ userId: "user-1", organizationId: "org-1" });
    });

    it("should compute and store a takeoff", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/bim/takeoff/route");
        computeTakeoffMock.mockResolvedValue({
            summary: { elementCount: 2, totalLength: 10, totalArea: 5, totalVolume: 2 },
            groups: []
        });
        prismaMock.bimModelVersion.findFirst.mockResolvedValue({
            id: "version-1",
            modelId: "model-1"
        } as never);
        prismaMock.bimTakeoff.create.mockResolvedValue({ id: "takeoff-1" } as never);

        const request = createMockRequest("/api/bim/takeoff", {
            method: "POST",
            body: { versionId: "version-1" }
        });
        const response = await POST(request);
        const parsed = await parseResponse(response);

        assertSuccess(parsed);
        expect(parsed.data.recordId).toBe("takeoff-1");
        expect(computeTakeoffMock).toHaveBeenCalledWith(
            expect.objectContaining({ versionId: "version-1" })
        );
    });
});
