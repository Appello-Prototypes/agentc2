import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";
import { Resend } from "resend";
import { randomBytes } from "crypto";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const SIGNUP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "AgentC2 <noreply@agentc2.ai>";

function generateCode(): string {
    return randomBytes(6).toString("hex").toUpperCase();
}

/**
 * POST /api/waitlist/approve
 *
 * Bulk approve waitlist entries and send invite emails.
 * Body: { ids: string[] }
 *
 * Flow:
 * 1. Create a shared platform invite code for the batch
 * 2. Send each person an email with their signup link
 * 3. Update each waitlist entry status to "invited"
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

        // Fetch the waitlist entries
        const entries = await prisma.waitlist.findMany({
            where: { id: { in: ids }, status: "pending" }
        });

        if (entries.length === 0) {
            return NextResponse.json(
                { error: "No pending entries found for the given IDs" },
                { status: 404 }
            );
        }

        // Create a platform invite code for this batch
        let code = generateCode();
        let attempts = 0;
        while ((await prisma.platformInvite.findUnique({ where: { code } })) && attempts < 10) {
            code = generateCode();
            attempts++;
        }

        const invite = await prisma.platformInvite.create({
            data: {
                code,
                label: `Waitlist batch — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (${entries.length} invites)`,
                maxUses: entries.length,
                createdBy: admin.adminUserId
            }
        });

        const signupUrl = `${SIGNUP_BASE_URL}/signup?invite=${invite.code}`;

        // Send emails and track results
        const results: { email: string; sent: boolean; error?: string }[] = [];

        for (const entry of entries) {
            if (!resend) {
                results.push({
                    email: entry.email,
                    sent: false,
                    error: "RESEND_API_KEY not configured"
                });
                continue;
            }

            try {
                await resend.emails.send({
                    from: FROM_EMAIL,
                    to: entry.email,
                    subject: "You're in! Your AgentC2 invite is ready",
                    html: buildInviteEmailHtml(entry.name, signupUrl, invite.code)
                });
                results.push({ email: entry.email, sent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                console.error(`[Waitlist] Failed to send email to ${entry.email}:`, message);
                results.push({ email: entry.email, sent: false, error: message });
            }
        }

        // Update waitlist entries to "invited" (even if email failed, they have an invite code)
        await prisma.waitlist.updateMany({
            where: { id: { in: entries.map((e) => e.id) } },
            data: {
                status: "invited",
                inviteId: invite.id
            }
        });

        // Audit log
        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "WAITLIST_BULK_APPROVE",
            entityType: "Waitlist",
            entityId: invite.id,
            afterJson: {
                inviteCode: invite.code,
                count: entries.length,
                emails: entries.map((e) => e.email)
            },
            ipAddress,
            userAgent
        });

        const sentCount = results.filter((r) => r.sent).length;
        const failedCount = results.filter((r) => !r.sent).length;

        return NextResponse.json({
            success: true,
            approved: entries.length,
            emailsSent: sentCount,
            emailsFailed: failedCount,
            inviteCode: invite.code,
            signupUrl,
            results
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Waitlist Approve] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function buildInviteEmailHtml(name: string | null, signupUrl: string, inviteCode: string): string {
    const greeting = name ? `Hi ${name}` : "Hi there";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your AgentC2 Invite</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">AgentC2</h1>
<p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">AI Agent Framework</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:40px;">
<h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">${greeting},</h2>
<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
Great news — you've been approved for early access to <strong>AgentC2</strong>. We're excited to have you on board.
</p>
<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
Click the button below to create your account and get started:
</p>

<!-- CTA Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr>
<td style="border-radius:8px;background-color:#0f172a;">
<a href="${signupUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
Create Your Account &rarr;
</a>
</td>
</tr>
</table>

<!-- Invite code fallback -->
<div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;">
<p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:500;">Your invite code (if prompted):</p>
<p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#0f172a;letter-spacing:1px;">${inviteCode}</p>
</div>

<!-- Getting Started -->
<h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:600;">Getting Started</h3>
<ol style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
<li>Click the signup link above and enter your details</li>
<li>Your workspace will be created automatically</li>
<li>Explore the agent builder, connect your tools, and start automating</li>
</ol>

<p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
If you have questions, just reply to this email — we're here to help.
</p>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:12px;">
&copy; ${new Date().getFullYear()} AgentC2 &middot; AI Agent Framework
</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
