import { describe, it, expect, beforeEach } from "vitest";
import { mockPrismaModule, prismaMock, resetPrismaMock } from "../utils/db-mock";

mockPrismaModule();

import { handleSlackApprovalReaction } from "../../apps/agent/src/lib/approvals";

describe("approvals", () => {
    beforeEach(() => {
        resetPrismaMock();
    });

    it("updates approval requests on approval reactions", async () => {
        prismaMock.approvalRequest.findFirst.mockResolvedValue({
            id: "approval-1",
            organizationId: "org-1",
            workspaceId: null,
            payloadJson: { outputText: "draft" },
            status: "pending",
            metadata: null
        } as never);
        prismaMock.approvalRequest.update.mockResolvedValue({
            id: "approval-1",
            organizationId: "org-1",
            workspaceId: null,
            payloadJson: { outputText: "draft" },
            status: "approved",
            metadata: null,
            workflowRunId: null
        } as never);

        const result = await handleSlackApprovalReaction({
            channelId: "C1",
            messageTs: "123.456",
            reaction: "white_check_mark",
            slackUserId: "U1"
        });

        expect(prismaMock.approvalRequest.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: "approved" })
            })
        );
        expect(result?.status).toBe("approved");
    });

    it("ignores non-approval reactions", async () => {
        const result = await handleSlackApprovalReaction({
            channelId: "C1",
            messageTs: "123.456",
            reaction: "eyes",
            slackUserId: "U1"
        });

        expect(result).toBeNull();
        expect(prismaMock.approvalRequest.findFirst).not.toHaveBeenCalled();
    });
});
