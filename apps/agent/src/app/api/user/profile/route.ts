import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

/**
 * GET /api/user/profile
 *
 * Get current user's profile
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
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
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

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
            where: { id: session.user.id },
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
