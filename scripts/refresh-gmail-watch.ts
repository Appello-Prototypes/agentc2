/**
 * Refresh Gmail Watch with INBOX-only filter.
 * Copy to packages/database/ and run: bun run refresh-gmail-watch.ts
 */
import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env (script lives in packages/database/ when run)
const envPath = resolve(import.meta.dir, "../../.env");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
        let val = match[2].trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        process.env[match[1].trim()] = val;
    }
}

const prisma = new PrismaClient();

/** Matches the v1 encryption format from credential-crypto.ts (base64 encoded) */
function decryptCredentials(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value as any;
    const v = value as Record<string, unknown>;
    if (v.__enc !== "v1") return v;

    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) throw new Error("No CREDENTIAL_ENCRYPTION_KEY");

    const keyBuf = Buffer.from(key, "hex");
    const iv = Buffer.from(v.iv as string, "base64");
    const tag = Buffer.from(v.tag as string, "base64");
    const encrypted = Buffer.from(v.data as string, "base64");

    const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        "utf8"
    );
    return JSON.parse(decrypted);
}

async function refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
): Promise<string> {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        })
    });
    const data = (await resp.json()) as { access_token?: string; error?: string };
    if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
    return data.access_token;
}

async function main() {
    const integration = await prisma.gmailIntegration.findFirst({
        where: { isActive: true, gmailAddress: "corey@useappello.com" },
        include: { workspace: { select: { organizationId: true } } }
    });
    if (!integration) {
        console.error("No integration found");
        process.exit(1);
    }
    console.log("Integration:", integration.id);

    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    if (!provider) {
        console.error("No gmail provider");
        process.exit(1);
    }

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            organizationId: integration.workspace.organizationId,
            providerId: provider.id,
            isActive: true,
            OR: [
                { metadata: { path: ["gmailAddress"], equals: "corey@useappello.com" } },
                { credentials: { path: ["gmailAddress"], equals: "corey@useappello.com" } }
            ]
        }
    });
    if (!connection) {
        console.error("No connection found");
        process.exit(1);
    }
    console.log("Connection:", connection.id);

    const creds = decryptCredentials(connection.credentials);
    console.log("Decrypted creds keys:", Object.keys(creds));
    console.log("Gmail address:", creds.gmailAddress || creds.email || "unknown");

    // Find refresh token
    const refreshToken = (creds.refreshToken || creds.refresh_token) as string | undefined;
    if (!refreshToken)
        throw new Error(`No refresh token found. Available keys: ${Object.keys(creds).join(", ")}`);

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID || "";
    const clientSecret =
        process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET || "";

    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    console.log("Got fresh access token");

    const topicName = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topicName) throw new Error("No GMAIL_PUBSUB_TOPIC");
    console.log("Topic:", topicName);

    const watchResp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            topicName,
            labelFilterAction: "include",
            labelIds: ["INBOX"]
        })
    });

    const watchData = (await watchResp.json()) as {
        historyId?: string;
        expiration?: string;
        error?: { message: string };
    };
    if (watchData.error) {
        throw new Error(`Watch API error: ${JSON.stringify(watchData.error)}`);
    }
    console.log("Watch response:", JSON.stringify(watchData));

    const expiration = watchData.expiration ? new Date(Number(watchData.expiration)) : null;
    const hid = watchData.historyId ? String(watchData.historyId) : null;

    await prisma.gmailIntegration.update({
        where: { id: integration.id },
        data: {
            ...(expiration ? { watchExpiration: expiration } : {}),
            ...(hid ? { historyId: hid } : {})
        }
    });

    console.log("Gmail watch refreshed with INBOX-only filter.");
    console.log("New expiration:", expiration);
    console.log("New historyId:", hid);
    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
