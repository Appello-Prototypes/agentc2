import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    getAdminSettingValue,
    INTEGRATION_PROVIDERS,
    integrationSettingKey,
    type IntegrationProvider,
    type IntegrationSettingValue
} from "@/lib/admin-settings";
import { decryptCredentials } from "@/lib/credential-crypto";
import { createAdminAuditLog, getRequestContext } from "@/lib/admin-audit";

function isValidProvider(provider: string): provider is IntegrationProvider {
    return INTEGRATION_PROVIDERS.includes(provider as IntegrationProvider);
}

async function testSlack(
    creds: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
    const token = creds.botToken as string | undefined;
    if (!token) return { ok: false, message: "Bot token not configured" };

    try {
        const res = await fetch("https://slack.com/api/auth.test", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        const data = (await res.json()) as {
            ok: boolean;
            team?: string;
            user?: string;
            error?: string;
        };
        if (data.ok) {
            return { ok: true, message: `Connected to ${data.team} as ${data.user}` };
        }
        return { ok: false, message: data.error || "Authentication failed" };
    } catch {
        return { ok: false, message: "Failed to connect to Slack API" };
    }
}

async function testEmail(
    creds: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
    const apiKey = creds.apiKey as string | undefined;
    if (!apiKey) return { ok: false, message: "API key not configured" };

    try {
        const res = await fetch("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (res.ok) {
            const data = (await res.json()) as { data?: { name: string }[] };
            const domains = data.data?.map((d) => d.name).join(", ") || "none";
            return { ok: true, message: `API key valid. Domains: ${domains}` };
        }
        if (res.status === 401 || res.status === 403) {
            return { ok: false, message: "Invalid API key" };
        }
        return { ok: false, message: `Resend API returned ${res.status}` };
    } catch {
        return { ok: false, message: "Failed to connect to Resend API" };
    }
}

async function testStripe(
    creds: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
    const secretKey = creds.secretKey as string | undefined;
    if (!secretKey) return { ok: false, message: "Secret key not configured" };

    try {
        const res = await fetch("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${secretKey}` }
        });
        if (res.ok) {
            const data = (await res.json()) as {
                available?: { amount: number; currency: string }[];
            };
            const currency = data.available?.[0]?.currency?.toUpperCase() || "USD";
            const isTest = secretKey.startsWith("sk_test_");
            return {
                ok: true,
                message: `Connected (${isTest ? "test" : "live"} mode, ${currency})`
            };
        }
        if (res.status === 401) {
            return { ok: false, message: "Invalid secret key" };
        }
        return { ok: false, message: `Stripe API returned ${res.status}` };
    } catch {
        return { ok: false, message: "Failed to connect to Stripe API" };
    }
}

async function testInngest(
    creds: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
    const eventKey = creds.eventKey as string | undefined;
    const signingKey = creds.signingKey as string | undefined;
    if (!eventKey) return { ok: false, message: "Event key not configured" };
    if (!signingKey) return { ok: false, message: "Signing key not configured" };

    if (!eventKey.startsWith("test-") && eventKey.length < 10) {
        return { ok: false, message: "Event key appears invalid" };
    }
    if (!signingKey.startsWith("signkey-") && signingKey.length < 10) {
        return { ok: false, message: "Signing key appears invalid" };
    }

    return { ok: true, message: "Keys configured (format valid)" };
}

const testers: Record<
    string,
    (creds: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>
> = {
    slack: testSlack,
    email: testEmail,
    stripe: testStripe,
    inngest: testInngest
};

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    try {
        const admin = await requireAdmin(request, "platform_admin");
        const { provider } = await params;

        if (!isValidProvider(provider)) {
            return NextResponse.json({ error: "Invalid integration provider" }, { status: 400 });
        }

        const setting = await getAdminSettingValue<IntegrationSettingValue>(
            integrationSettingKey(provider)
        );

        if (!setting?.credentials) {
            return NextResponse.json(
                { ok: false, message: "Integration not configured" },
                { status: 400 }
            );
        }

        const creds = decryptCredentials(setting.credentials) as Record<string, unknown>;
        const tester = testers[provider];
        const result = tester
            ? await tester(creds)
            : { ok: false, message: "No test available for this integration" };

        const { ipAddress, userAgent } = getRequestContext(request);
        await createAdminAuditLog({
            adminUserId: admin.adminUserId,
            action: "INTEGRATION_TEST",
            entityType: "Integration",
            entityId: provider,
            afterJson: { success: result.ok, message: result.message },
            ipAddress,
            userAgent
        });

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[IntegrationTest]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
