import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserMembership } from "@/lib/organization";

/**
 * POST /api/onboarding/complete
 *
 * Marks onboarding as completed for the current user.
 *
 * Optional body fields (for analytics tracking):
 * - onboardingPath: "google_oauth" | "email_password" | "invite_join" | "domain_join"
 * - connectedDuringOnboarding: string[] -- integration keys connected during onboarding
 */
export async function POST(request: NextRequest) {
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

        // Parse optional tracking fields from body
        const body = await request.json().catch(() => ({}));
        const onboardingPath =
            typeof body?.onboardingPath === "string" ? body.onboardingPath : undefined;
        const connectedDuringOnboarding = Array.isArray(body?.connectedDuringOnboarding)
            ? body.connectedDuringOnboarding.filter((v: unknown) => typeof v === "string")
            : undefined;

        const updateData: Record<string, unknown> = {
            onboardingCompletedAt: new Date(),
            onboardingStep: null
        };
        if (onboardingPath) {
            updateData.onboardingPath = onboardingPath;
        }
        if (connectedDuringOnboarding) {
            updateData.connectedDuringOnboarding = connectedDuringOnboarding;
        }

        const updated = await prisma.membership.update({
            where: { id: membership.id },
            data: updateData
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
