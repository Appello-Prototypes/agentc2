import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";
import { Resend } from "resend";
import { buildInviteEmailHtml } from "@/lib/invite-email";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const SIGNUP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "AgentC2 <noreply@agentc2.ai>";

/**
 * POST /api/waitlist/resend
 *
 * Resend invite emails to already-invited waitlist entries.
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "waitlist:approve");
        const body = await request.json().catch(() => ({}));

        const { ids } = body as { ids?: string[] };
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: "ids array is required and must not be empty" },
                { status: 400 }
            );
        }

        const entries = await prisma.waitlist.findMany({
            where: { id: { in: ids }, status: "invited" }
        });

        if (entries.length === 0) {
            return NextResponse.json(
                {
                    error: "No invited entries found for the given IDs"
                },
                { status: 404 }
            );
        }

        // Look up invite codes for these entries
        const inviteIds = entries.map((e) => e.inviteId).filter((id): id is string => !!id);
        const inviteMap: Record<string, string> = {};
        if (inviteIds.length > 0) {
            const invites = await prisma.platformInvite.findMany({
                where: { id: { in: inviteIds } },
                select: { id: true, code: true }
            });
            for (const inv of invites) {
                inviteMap[inv.id] = inv.code;
            }
        }

        const results: { email: string; sent: boolean; error?: string }[] = [];

        for (const entry of entries) {
            const inviteCode = entry.inviteId ? inviteMap[entry.inviteId] : null;

            if (!inviteCode) {
                results.push({
                    email: entry.email,
                    sent: false,
                    error: "No invite code found for this entry"
                });
                continue;
            }

            if (!resend) {
                results.push({
                    email: entry.email,
                    sent: false,
                    error: "RESEND_API_KEY not configured"
                });
                continue;
            }

            const signupUrl = `${SIGNUP_BASE_URL}/signup?invite=${inviteCode}`;

            try {
                await resend.emails.send({
                    from: FROM_EMAIL,
                    to: entry.email,
                    subject: "Reminder: Your AgentC2 invite is waiting",
                    html: buildInviteEmailHtml(entry.name, signupUrl, inviteCode)
                });
                results.push({ email: entry.email, sent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                console.error(`[Waitlist Resend] Failed to send email to ${entry.email}:`, message);
                results.push({
                    email: entry.email,
                    sent: false,
                    error: message
                });
            }
        }

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "WAITLIST_RESEND_INVITE",
            entityType: "Waitlist",
            entityId: entries.map((e) => e.id).join(","),
            afterJson: {
                emails: entries.map((e) => e.email),
                results
            },
            ipAddress,
            userAgent
        });

        const sentCount = results.filter((r) => r.sent).length;
        const failedCount = results.filter((r) => !r.sent).length;

        return NextResponse.json({
            success: true,
            resent: entries.length,
            emailsSent: sentCount,
            emailsFailed: failedCount,
            results
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Waitlist Resend] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
