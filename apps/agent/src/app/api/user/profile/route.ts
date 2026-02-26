import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireUser } from "@/lib/authz/require-auth";

/**
 * GET /api/user/profile
 *
 * Get current user's profile
 */
export async function GET() {
    try {
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                timezone: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            user
        });
    } catch (error) {
        console.error("[User Profile] Error fetching:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch profile"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/user/profile
 *
 * Update current user's profile
 */
export async function PATCH(request: NextRequest) {
    try {
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const body = await request.json();
        const { name, image, timezone } = body;

        const updateData: { name?: string; image?: string | null; timezone?: string | null } = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length === 0) {
                return NextResponse.json(
                    { success: false, error: "Name cannot be empty" },
                    { status: 400 }
                );
            }
            updateData.name = name.trim();
        }

        if (image !== undefined) {
            updateData.image = image ? image.trim() : null;
        }

        if (timezone !== undefined) {
            if (timezone === null || timezone === "") {
                updateData.timezone = null;
            } else {
                try {
                    Intl.DateTimeFormat(undefined, { timeZone: timezone });
                    updateData.timezone = timezone;
                } catch {
                    return NextResponse.json(
                        { success: false, error: "Invalid timezone" },
                        { status: 400 }
                    );
                }
            }
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                timezone: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return NextResponse.json({
            success: true,
            user
        });
    } catch (error) {
        console.error("[User Profile] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update profile"
            },
            { status: 500 }
        );
    }
}
