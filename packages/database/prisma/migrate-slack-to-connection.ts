/**
 * Migration Script: Seed Slack IntegrationConnection from Environment Variables
 *
 * Migrates the current single-workspace Slack configuration (env vars) into a
 * database-backed IntegrationConnection record. Also creates
 * SlackChannelPreference records for known channels.
 *
 * Usage:
 *   # Full migration (credentials + channels) for Appello org
 *   dotenv -e ../../.env -- bun run prisma/migrate-slack-to-connection.ts
 *
 *   # Seed channel preferences only (skip credential migration)
 *   dotenv -e ../../.env -- bun run prisma/migrate-slack-to-connection.ts --seed-channels-only
 *
 *   # Target a specific organization by slug
 *   dotenv -e ../../.env -- bun run prisma/migrate-slack-to-connection.ts --org=appello
 *
 * Prerequisites:
 *   - SLACK_BOT_TOKEN must be set (for full migration)
 *   - CREDENTIAL_ENCRYPTION_KEY must be set (for full migration)
 *   - Organization must exist in the database
 *   - IntegrationProvider "slack" must exist
 *
 * Idempotent: safe to re-run. Existing connections are updated, existing
 * channel preferences are skipped.
 */

import { createCipheriv, randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Inline AES-256-GCM encryption (mirrors credential-crypto.ts) ──────────

function encryptCredentials(value: Record<string, unknown>): Record<string, unknown> {
    const keyHex = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!keyHex) {
        console.warn(
            "[Migration] CREDENTIAL_ENCRYPTION_KEY not set – storing credentials in plaintext"
        );
        return value;
    }
    const keyBuffer = Buffer.from(keyHex, "hex");
    if (keyBuffer.length !== 32) {
        console.warn("[Migration] Invalid CREDENTIAL_ENCRYPTION_KEY length – storing in plaintext");
        return value;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
    const plaintext = JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        __enc: "v1",
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64")
    };
}

// ─── Resolve bot user ID via Slack API ──────────────────────────────────────

async function resolveBotUserId(botToken: string): Promise<string | null> {
    try {
        const res = await fetch("https://slack.com/api/auth.test", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${botToken}`,
                "Content-Type": "application/json"
            }
        });
        const data = (await res.json()) as {
            ok: boolean;
            user_id?: string;
            error?: string;
        };
        if (data.ok && data.user_id) return data.user_id;
        console.warn("[Migration] auth.test returned:", data.error);
        return null;
    } catch (error) {
        console.warn("[Migration] Failed to resolve bot user ID:", error);
        return null;
    }
}

// ─── Known channel mappings for Appello workspace ───────────────────────────

// Purpose keys that the Admin UI expects: support, sales, alerts, general
// Plus Appello-specific channels for backward compatibility.
const KNOWN_CHANNELS: {
    purposeKey: string;
    channelId: string;
    channelName: string;
}[] = [
    // Admin UI standard keys
    {
        purposeKey: "general",
        channelId: "C053S06FP",
        channelName: "#general"
    },
    {
        purposeKey: "support",
        channelId: "C053S06FP",
        channelName: "#general"
    },
    {
        purposeKey: "sales",
        channelId: "C01VDEG6UDU",
        channelName: "#hubspot-incoming"
    },
    {
        purposeKey: "alerts",
        channelId: "C0148KPHXCN",
        channelName: "#developers"
    },
    // Appello-specific channels (legacy)
    {
        purposeKey: "developers",
        channelId: "C0148KPHXCN",
        channelName: "#developers"
    },
    {
        purposeKey: "hubspot-incoming",
        channelId: "C01VDEG6UDU",
        channelName: "#hubspot-incoming"
    }
];

// ─── CLI flags ───────────────────────────────────────────────────────────────

const SEED_CHANNELS_ONLY = process.argv.includes("--seed-channels-only");
const TARGET_ORG_SLUG =
    process.argv.find((a) => a.startsWith("--org="))?.split("=")[1] || "appello";

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n=== Slack → IntegrationConnection Migration ===\n");

    if (SEED_CHANNELS_ONLY) {
        console.log("Mode: --seed-channels-only (skip credential migration)\n");
    }
    console.log(`Target org: ${TARGET_ORG_SLUG}\n`);

    // 1. Find the Slack IntegrationProvider
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "slack" }
    });

    if (!provider) {
        console.error('❌ IntegrationProvider "slack" not found. Seed providers first.');
        process.exit(1);
    }
    console.log(`✅ Provider found: ${provider.name} (${provider.id})`);

    // 2. Find the target organization by slug
    const org = await prisma.organization.findFirst({
        where: { slug: TARGET_ORG_SLUG }
    });

    if (!org) {
        console.error(`❌ Organization with slug "${TARGET_ORG_SLUG}" not found.`);
        const allOrgs = await prisma.organization.findMany({ select: { slug: true, name: true } });
        console.log("   Available orgs:", allOrgs.map((o) => `${o.slug} (${o.name})`).join(", "));
        process.exit(1);
    }
    console.log(`✅ Organization: ${org.name} (${org.id})`);

    // Fast path: seed channel preferences only (skip credential migration)
    if (SEED_CHANNELS_ONLY) {
        const existingConn = await prisma.integrationConnection.findFirst({
            where: { providerId: provider.id, organizationId: org.id, isActive: true },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        });
        if (!existingConn) {
            console.error(
                "❌ No active Slack IntegrationConnection found. Run full migration first."
            );
            process.exit(1);
        }
        console.log(`✅ Found connection: ${existingConn.id}`);
        await seedChannelPreferences(existingConn.id);
        console.log("\n=== Channel seeding complete ===\n");
        return;
    }

    // 3. Read env vars for full migration
    const botToken = process.env.SLACK_BOT_TOKEN;
    const teamId = process.env.SLACK_TEAM_ID;
    const defaultAgentSlug = process.env.SLACK_DEFAULT_AGENT_SLUG || "assistant";
    const alertsChannel = process.env.SLACK_ALERTS_CHANNEL;

    if (!botToken) {
        console.error("❌ SLACK_BOT_TOKEN is not set. Nothing to migrate.");
        process.exit(1);
    }

    console.log("✅ SLACK_BOT_TOKEN found");
    console.log(`   SLACK_TEAM_ID: ${teamId || "(not set – will be omitted)"}`);
    console.log(`   SLACK_DEFAULT_AGENT_SLUG: ${defaultAgentSlug}`);
    console.log(`   SLACK_ALERTS_CHANNEL: ${alertsChannel || "(not set)"}`);

    // 4. Resolve bot user ID
    console.log("\n→ Resolving bot user ID via auth.test...");
    const botUserId = await resolveBotUserId(botToken);
    console.log(`  Bot user ID: ${botUserId || "(failed to resolve)"}`);

    // 5. Check for existing connection
    const existing = await prisma.integrationConnection.findFirst({
        where: {
            providerId: provider.id,
            organizationId: org.id
        }
    });

    if (existing) {
        console.log(`\n⚠️  IntegrationConnection already exists (${existing.id}).`);
        console.log("   Updating credentials and metadata...\n");

        const credentials = encryptCredentials({
            botToken,
            ...(botUserId ? { botUserId } : {})
        });

        const metadata: Record<string, unknown> = {
            ...(typeof existing.metadata === "object" && existing.metadata !== null
                ? existing.metadata
                : {}),
            ...(teamId ? { teamId } : {}),
            defaultAgentSlug,
            ...(alertsChannel ? { alertsChannelId: alertsChannel } : {}),
            ...(botUserId ? { botUserId } : {}),
            migratedFromEnvAt: new Date().toISOString()
        };

        await prisma.integrationConnection.update({
            where: { id: existing.id },
            data: {
                credentials,
                metadata,
                isActive: true
            }
        });

        console.log(`✅ Updated connection: ${existing.id}`);

        // Seed channel preferences
        await seedChannelPreferences(existing.id);
    } else {
        console.log("\n→ Creating new IntegrationConnection...");

        const credentials = encryptCredentials({
            botToken,
            ...(botUserId ? { botUserId } : {})
        });

        const metadata: Record<string, unknown> = {
            ...(teamId ? { teamId } : {}),
            defaultAgentSlug,
            ...(alertsChannel ? { alertsChannelId: alertsChannel } : {}),
            ...(botUserId ? { botUserId } : {}),
            migratedFromEnvAt: new Date().toISOString()
        };

        const connection = await prisma.integrationConnection.create({
            data: {
                providerId: provider.id,
                organizationId: org.id,
                scope: "org",
                name: "Appello Slack Workspace",
                isDefault: true,
                isActive: true,
                credentials,
                metadata
            }
        });

        console.log(`✅ Created connection: ${connection.id}`);

        // Seed channel preferences
        await seedChannelPreferences(connection.id);
    }

    console.log("\n=== Migration complete ===\n");
}

async function seedChannelPreferences(integrationConnectionId: string) {
    console.log("\n→ Seeding SlackChannelPreference records...");

    for (const ch of KNOWN_CHANNELS) {
        // Use findFirst since userId is nullable and Prisma's findUnique
        // doesn't handle null in composite keys well
        const existing = await prisma.slackChannelPreference.findFirst({
            where: {
                integrationConnectionId,
                userId: null,
                purposeKey: ch.purposeKey
            }
        });

        if (existing) {
            console.log(`   ⚠️  ${ch.purposeKey} → ${ch.channelName} (already exists)`);
            continue;
        }

        await prisma.slackChannelPreference.create({
            data: {
                integrationConnectionId,
                userId: null,
                purposeKey: ch.purposeKey,
                channelId: ch.channelId,
                channelName: ch.channelName
            }
        });
        console.log(`   ✅ ${ch.purposeKey} → ${ch.channelName} (${ch.channelId})`);
    }
}

main()
    .catch((error) => {
        console.error("Migration failed:", error);
        process.exit(1);
    })
    .finally(() => {
        void prisma.$disconnect();
    });
