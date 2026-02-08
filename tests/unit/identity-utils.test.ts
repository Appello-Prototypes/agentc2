import { describe, it, expect, beforeEach } from "vitest";
import { mockPrismaModule, prismaMock, resetPrismaMock } from "../utils/db-mock";

mockPrismaModule();

import { resolveIdentity } from "../../apps/agent/src/lib/identity";

describe("resolveIdentity", () => {
    beforeEach(() => {
        resetPrismaMock();
    });

    it("creates a new identity mapping when none exists", async () => {
        prismaMock.identityMapping.findFirst.mockResolvedValue(null as never);
        prismaMock.organizationDomain.findMany.mockResolvedValue([] as never);
        prismaMock.identityMapping.create.mockResolvedValue({ id: "identity-1" } as never);

        const result = await resolveIdentity({
            organizationId: "org-1",
            email: "user@example.com",
            slackUserId: "U123"
        });

        expect(prismaMock.identityMapping.create).toHaveBeenCalled();
        expect(result).toEqual({ id: "identity-1" });
    });

    it("updates existing identity mapping", async () => {
        prismaMock.identityMapping.findFirst.mockResolvedValue({
            id: "identity-1",
            email: "user@example.com",
            domain: "example.com",
            slackUserId: null,
            hubspotContactId: null,
            hubspotCompanyId: null,
            metadata: {}
        } as never);
        prismaMock.organizationDomain.findMany.mockResolvedValue([] as never);
        prismaMock.identityMapping.update.mockResolvedValue({ id: "identity-1" } as never);

        const result = await resolveIdentity({
            organizationId: "org-1",
            email: "user@example.com",
            slackUserId: "U123"
        });

        expect(prismaMock.identityMapping.update).toHaveBeenCalled();
        expect(result).toEqual({ id: "identity-1" });
    });
});
