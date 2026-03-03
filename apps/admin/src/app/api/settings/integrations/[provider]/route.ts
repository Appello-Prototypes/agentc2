import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    getAdminSettingValue,
    upsertAdminSetting,
    deleteAdminSetting,
    INTEGRATION_PROVIDERS,
    integrationSettingKey,
    type IntegrationProvider,
    type IntegrationSettingValue
} from "@/lib/admin-settings";
import { encryptCredentials, decryptCredentials } from "@/lib/credential-crypto";
import { createAdminAuditLog, getRequestContext } from "@/lib/admin-audit";

const REQUIRED_FIELDS: Record<string, string[]> = {
    slack: ["botToken", "signingSecret"],
    email: ["apiKey", "fromEmail"],
    stripe: ["secretKey", "webhookSecret"],
    inngest: ["eventKey", "signingKey"]
};

const ALL_FIELDS: Record<string, string[]> = {
    slack: ["botToken", "signingSecret", "clientId", "clientSecret", "alertChannelId"],
    email: ["apiKey", "fromEmail", "replyToEmail"],
    stripe: ["secretKey", "webhookSecret", "publishableKey"],
    inngest: ["eventKey", "signingKey"]
};

function isValidProvider(provider: string): provider is IntegrationProvider {
    return INTEGRATION_PROVIDERS.includes(provider as IntegrationProvider);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    try {
        const admin = await requireAdmin(request, "platform_admin");
        const { provider } = await params;

        if (!isValidProvider(provider)) {
            return NextResponse.json({ error: "Invalid integration provider" }, { status: 400 });
        }

        const body = (await request.json()) as Record<string, unknown>;
        const fields = ALL_FIELDS[provider] ?? [];
        const required = REQUIRED_FIELDS[provider] ?? [];

        const credentials: Record<string, unknown> = {};

        const existing = await getAdminSettingValue<IntegrationSettingValue>(
            integrationSettingKey(provider)
        );
        const existingCreds = existing?.credentials
            ? (decryptCredentials(existing.credentials) as Record<string, unknown>)
            : {};

        for (const field of fields) {
            const val = body[field];
            if (typeof val === "string" && val.length > 0 && !val.includes("••••")) {
                credentials[field] = val;
            } else if (existingCreds[field]) {
                credentials[field] = existingCreds[field];
            }
        }

        for (const field of required) {
            if (!credentials[field] || typeof credentials[field] !== "string") {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        const settingValue: IntegrationSettingValue = {
            configuredAt: new Date().toISOString(),
            configuredBy: admin.adminUserId,
            credentials: encryptCredentials(credentials) as Record<string, unknown>,
            metadata: existing?.metadata ?? {}
        };

        await upsertAdminSetting(integrationSettingKey(provider), settingValue, admin.adminUserId);

        const { ipAddress, userAgent } = getRequestContext(request);
        await createAdminAuditLog({
            adminUserId: admin.adminUserId,
            action: "INTEGRATION_CONFIGURE",
            entityType: "Integration",
            entityId: provider,
            afterJson: { provider, fields: Object.keys(credentials) },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[IntegrationConfigure]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    try {
        const admin = await requireAdmin(request, "platform_admin");
        const { provider } = await params;

        if (!isValidProvider(provider)) {
            return NextResponse.json({ error: "Invalid integration provider" }, { status: 400 });
        }

        await deleteAdminSetting(integrationSettingKey(provider));

        const { ipAddress, userAgent } = getRequestContext(request);
        await createAdminAuditLog({
            adminUserId: admin.adminUserId,
            action: "INTEGRATION_DISCONNECT",
            entityType: "Integration",
            entityId: provider,
            ipAddress,
            userAgent
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
