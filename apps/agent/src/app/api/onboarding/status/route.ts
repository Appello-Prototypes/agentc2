import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getUserMembership } from "@/lib/organization";

/**
 * GET /api/onboarding/status
 *
 * Returns onboarding completion status for the current user.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const membership = await getUserMembership(session.user.id);

        if (!membership) {
            return NextResponse.json({
                success: true,
                onboardingComplete: false,
                needsBootstrap: true
            });
        }

        return NextResponse.json({
            success: true,
            onboardingComplete: Boolean(membership.onboardingCompletedAt),
            onboardingCompletedAt: membership.onboardingCompletedAt
        });
    } catch (error) {
        console.error("[Onboarding Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get onboarding status"
            },
            { status: 500 }
        );
    }
}
