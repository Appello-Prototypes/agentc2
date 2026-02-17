import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { sendSlackMessage } from "@/lib/slack";

/**
 * Send a Slack notification for a new waitlist signup.
 * Fire-and-forget — failures are logged but do not block the API response.
 */
async function notifySlack(email: string, name: string | null, isNew: boolean) {
    const channel = process.env.SLACK_ALERTS_CHANNEL;
    if (!channel || !process.env.SLACK_BOT_TOKEN) return;

    // Only notify for brand-new signups, not re-submissions
    if (!isNew) return;

    try {
        const totalCount = await prisma.waitlist.count();
        const displayName = name ? `${name} (${email})` : email;
        const message = `:wave: *New waitlist signup* — ${displayName}\nTotal on waitlist: ${totalCount}`;
        await sendSlackMessage(channel, message);
    } catch (err) {
        console.error("[Waitlist] Slack notification failed:", err);
    }
}

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

        // Check if this email already exists on the waitlist
        const existing = await prisma.waitlist.findUnique({
            where: { email: normalizedEmail }
        });
        const isNew = !existing;

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

        // Fire-and-forget Slack notification for new signups
        void notifySlack(normalizedEmail, name?.trim() || null, isNew);

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
