import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    getAdminSettingValue,
    INTEGRATION_PROVIDERS,
    integrationSettingKey,
    type IntegrationSettingValue
} from "@/lib/admin-settings";
import { decryptCredentials } from "@/lib/credential-crypto";

const SECRET_FIELDS: Record<string, string[]> = {
    slack: ["botToken", "signingSecret", "clientSecret"],
    email: ["apiKey"],
    stripe: ["secretKey", "webhookSecret"],
    inngest: ["eventKey", "signingKey"]
};

function maskValue(value: string): string {
    if (value.length <= 8) return "••••••••";
    return value.slice(0, 4) + "••••" + value.slice(-4);
}

function maskCredentials(
    provider: string,
    credentials: Record<string, unknown>
): Record<string, unknown> {
    const secrets = SECRET_FIELDS[provider] ?? [];
    const masked: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(credentials)) {
        if (secrets.includes(key) && typeof val === "string" && val.length > 0) {
            masked[key] = maskValue(val);
        } else {
            masked[key] = val;
        }
    }
    return masked;
}

export async function GET(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");

        const statuses: Record<
            string,
            {
                configured: boolean;
                configuredAt: string | null;
                configuredBy: string | null;
                fields: Record<string, unknown>;
                metadata: Record<string, unknown>;
            }
        > = {};

        for (const provider of INTEGRATION_PROVIDERS) {
            const key = integrationSettingKey(provider);
            const setting = await getAdminSettingValue<IntegrationSettingValue>(key);

            if (!setting?.credentials) {
                statuses[provider] = {
                    configured: false,
                    configuredAt: null,
                    configuredBy: null,
                    fields: {},
                    metadata: {}
                };
                continue;
            }

            const decrypted = decryptCredentials(setting.credentials) as Record<string, unknown>;
            statuses[provider] = {
                configured: true,
                configuredAt: setting.configuredAt,
                configuredBy: setting.configuredBy,
                fields: maskCredentials(provider, decrypted),
                metadata: setting.metadata ?? {}
            };
        }

        return NextResponse.json({ integrations: statuses });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
