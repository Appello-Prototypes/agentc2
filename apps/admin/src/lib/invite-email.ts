export function buildInviteEmailHtml(
    name: string | null,
    signupUrl: string,
    inviteCode: string
): string {
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
