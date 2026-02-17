import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * POST /api/waitlist
 *
 * Accepts { email, name?, source? } and upserts into the Waitlist table.
 * Returns 200 even if already on waitlist (idempotent, no leak of existing emails).
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { email, name, source } = body;

        if (!email || typeof email !== "string") {
            return NextResponse.json(
                { success: false, error: "Email is required" },
                { status: 400 }
            );
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return NextResponse.json(
                { success: false, error: "Invalid email format" },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Upsert: create if new, update name/source if existing
        await prisma.waitlist.upsert({
            where: { email: normalizedEmail },
            create: {
                email: normalizedEmail,
                name: name?.trim() || null,
                source: source || "landing",
                status: "pending"
            },
            update: {
                name: name?.trim() || undefined,
                source: source || undefined
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Waitlist] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Something went wrong. Please try again."
            },
            { status: 500 }
        );
    }
}
