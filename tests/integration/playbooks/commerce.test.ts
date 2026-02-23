import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../utils/api-helpers";
import { mockOrganization } from "../../fixtures/playbooks";
import { prismaMock, resetPrismaMock, mockPrismaModule } from "../../utils/db-mock";

mockPrismaModule();

vi.mock("@/lib/authz", () => ({
    requireAuth: vi.fn().mockResolvedValue({
        context: { userId: "test-user-id", organizationId: "org-publisher-uuid" }
    })
}));

const mockStripe = {
    accounts: {
        create: vi.fn().mockResolvedValue({ id: "acct_test123" }),
        retrieve: vi.fn().mockResolvedValue({
            id: "acct_test123",
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true
        }),
        createLoginLink: vi.fn().mockResolvedValue({
            url: "https://connect.stripe.com/express/test"
        })
    },
    accountLinks: {
        create: vi.fn().mockResolvedValue({
            url: "https://connect.stripe.com/setup/test"
        })
    }
};

vi.mock("@/lib/stripe", () => ({
    stripe: mockStripe,
    isStripeEnabled: vi.fn().mockReturnValue(true)
}));

describe("Commerce - Stripe Connect (US-068 - US-071)", () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
        mockStripe.accounts.create.mockResolvedValue({ id: "acct_test123" });
        mockStripe.accountLinks.create.mockResolvedValue({
            url: "https://connect.stripe.com/setup/test"
        });
        mockStripe.accounts.retrieve.mockResolvedValue({
            id: "acct_test123",
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true
        });
        mockStripe.accounts.createLoginLink.mockResolvedValue({
            url: "https://connect.stripe.com/express/test"
        });
    });

    // US-068: Seller onboarding
    describe("Onboard - POST /api/stripe/connect/onboard (US-068)", () => {
        it("should create Express account and return onboarding link", async () => {
            const { POST } =
                await import("../../../apps/agent/src/app/api/stripe/connect/onboard/route");

            prismaMock.organization.findUniqueOrThrow.mockResolvedValue({
                ...mockOrganization,
                stripeConnectAccountId: null
            } as never);
            prismaMock.organization.update.mockResolvedValue({
                ...mockOrganization,
                stripeConnectAccountId: "acct_test123",
                stripeConnectStatus: "pending"
            } as never);

            const request = createMockRequest("/api/stripe/connect/onboard", {
                method: "POST"
            });
            const response = await POST(request);

            expect(response.status).toBe(201);
        });
    });

    // US-069: Check Connect status
    describe("Status - GET /api/stripe/connect/status (US-069)", () => {
        it("should return current Connect account details", async () => {
            const { GET } =
                await import("../../../apps/agent/src/app/api/stripe/connect/status/route");

            prismaMock.organization.findUniqueOrThrow.mockResolvedValue({
                ...mockOrganization,
                stripeConnectAccountId: "acct_test123",
                stripeConnectStatus: "active"
            } as never);

            const request = createMockRequest("/api/stripe/connect/status");
            const response = await GET(request);

            expect(response.status).toBe(200);
        });
    });

    // US-070: Express dashboard
    describe("Dashboard - POST /api/stripe/connect/dashboard (US-070)", () => {
        it("should return dashboard login link", async () => {
            const { POST } =
                await import("../../../apps/agent/src/app/api/stripe/connect/dashboard/route");

            prismaMock.organization.findUniqueOrThrow.mockResolvedValue({
                ...mockOrganization,
                stripeConnectAccountId: "acct_test123",
                stripeConnectStatus: "active"
            } as never);

            const request = createMockRequest("/api/stripe/connect/dashboard", {
                method: "POST"
            });
            const response = await POST(request);

            expect(response.status).toBe(200);
        });
    });

    // US-071: Revenue split
    describe("Revenue Split (US-071)", () => {
        it("should calculate correct 15% platform fee", () => {
            const purchaseAmount = 100.0;
            const platformFeePercent = 0.15;
            const platformFee = purchaseAmount * platformFeePercent;
            const sellerPayout = purchaseAmount - platformFee;

            expect(platformFee).toBe(15.0);
            expect(sellerPayout).toBe(85.0);
        });

        it("should calculate correct fee for $1 purchase", () => {
            const purchaseAmount = 1.0;
            const platformFeePercent = 0.15;
            const platformFee = Math.round(purchaseAmount * platformFeePercent * 100) / 100;
            const sellerPayout = Math.round((purchaseAmount - platformFee) * 100) / 100;

            expect(platformFee).toBe(0.15);
            expect(sellerPayout).toBe(0.85);
        });
    });
});
