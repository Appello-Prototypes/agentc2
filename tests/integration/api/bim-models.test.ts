import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { parseResponse, assertSuccess } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        DbNull: "DbNull"
    }
}));

describe("BIM Models API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("should list BIM models with version counts", async () => {
        const { GET } = await import("../../../apps/agent/src/app/api/bim/models/route");
        prismaMock.bimModel.findMany.mockResolvedValue([
            {
                id: "model-1",
                name: "Sample Model",
                description: null,
                sourceSystem: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { versions: 2 }
            }
        ] as never);

        const response = await GET();
        const parsed = await parseResponse(response);

        assertSuccess(parsed);
        expect(parsed.data.models[0].versionCount).toBe(2);
    });
});
