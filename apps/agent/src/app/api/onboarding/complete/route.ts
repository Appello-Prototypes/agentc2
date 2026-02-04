import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserMembership } from "@/lib/organization";

/**
 * POST /api/onboarding/complete
 *
 * Marks onboarding as completed for the current user.
 */
export async function POST() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const membership = await getUserMembership(session.user.id);
        if (!membership) {
            return NextResponse.json(
                { success: false, error: "No organization membership found" },
                { status: 400 }
            );
        }

        const updated = await prisma.membership.update({
            where: { id: membership.id },
            data: {
                onboardingCompletedAt: new Date(),
                onboardingStep: null
            }
        });

        return NextResponse.json({
            success: true,
            membership: updated
        });
    } catch (error) {
        console.error("[Onboarding Complete] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to complete onboarding"
            },
            { status: 500 }
        );
    }
}
