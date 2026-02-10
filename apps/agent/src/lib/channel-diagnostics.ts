/**
 * Channel Diagnostics - Shared utilities for testing voice/messaging integrations
 *
 * Used by:
 * - GET /api/channels/diagnostics (health checks)
 * - POST /api/channels/test/[channel] (E2E tests)
 *
 * All check functions resolve credentials from the database first (per-org),
 * then fall back to process.env for backward compatibility.
 */

import { resolveChannelCredentials, type CredentialSource } from "@/lib/channel-credentials";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckStatus = "pass" | "fail" | "skip";

export interface CheckResult {
    name: string;
    status: CheckStatus;
    message: string;
    durationMs: number;
    details?: unknown;
}

export interface IntegrationResult {
    status: CheckStatus;
    checks: CheckResult[];
    config: Record<string, string | boolean | null>;
    credentialSource: CredentialSource;
}

export interface DiagnosticsResult {
    timestamp: string;
    summary: { total: number; passed: number; failed: number; skipped: number };
    integrations: {
        twilio: IntegrationResult;
        elevenlabs: IntegrationResult;
        telegram: IntegrationResult;
        whatsapp: IntegrationResult;
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask a secret value, showing first 4 and last 3 characters */
export function maskSecret(value: string | undefined): string | null {
    if (!value) return null;
    if (value.length <= 10) return "****";
    return `${value.slice(0, 4)}****${value.slice(-3)}`;
}

/** Run a check function and capture timing + errors */
async function runCheck(
    name: string,
    fn: () => Promise<{ status: CheckStatus; message: string; details?: unknown }>
): Promise<CheckResult> {
    const start = Date.now();
    try {
        const result = await fn();
        return { name, ...result, durationMs: Date.now() - start };
    } catch (error) {
        return {
            name,
            status: "fail",
            message: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start
        };
    }
}

/** Check that required credential keys are present in the resolved set */
function checkCredentialKeys(
    creds: Record<string, string>,
    requiredKeys: string[],
    source: CredentialSource
): CheckResult {
    const missing = requiredKeys.filter((k) => !creds[k]);
    if (missing.length === 0) {
        return {
            name: "Credentials configured",
            status: "pass",
            message: `All ${requiredKeys.length} required fields set (source: ${source})`,
            durationMs: 0,
            details: { source, checked: requiredKeys }
        };
    }
    return {
        name: "Credentials configured",
        status: "fail",
        message: `Missing: ${missing.join(", ")} (source: ${source})`,
        durationMs: 0,
        details: { source, missing, checked: requiredKeys }
    };
}

/** Derive overall status from a set of check results */
function overallStatus(checks: CheckResult[]): CheckStatus {
    if (checks.some((c) => c.status === "fail")) return "fail";
    if (checks.every((c) => c.status === "skip")) return "skip";
    return "pass";
}

// ---------------------------------------------------------------------------
// Twilio Checks
// ---------------------------------------------------------------------------

const TWILIO_REQUIRED = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"];

export async function checkTwilioCredentials(creds: Record<string, string>): Promise<CheckResult> {
    const sid = creds.TWILIO_ACCOUNT_SID;
    const token = creds.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
        return {
            name: "Credential validation",
            status: "skip",
            message: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN",
            durationMs: 0
        };
    }

    return runCheck("Credential validation", async () => {
        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
            headers: { Authorization: `Basic ${auth}` },
            signal: AbortSignal.timeout(10_000)
        });
        if (!res.ok) {
            const body = await res.text();
            return { status: "fail", message: `Twilio API returned ${res.status}`, details: body };
        }
        const data = await res.json();
        return {
            status: "pass",
            message: `Account: ${data.friendly_name} (${data.status})`,
            details: { friendlyName: data.friendly_name, status: data.status }
        };
    });
}

export async function checkTwilioPhoneNumber(creds: Record<string, string>): Promise<CheckResult> {
    const sid = creds.TWILIO_ACCOUNT_SID;
    const token = creds.TWILIO_AUTH_TOKEN;
    const phone = creds.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !phone) {
        return {
            name: "Phone number active",
            status: "skip",
            message: "Missing Twilio credentials or phone number",
            durationMs: 0
        };
    }

    return runCheck("Phone number active", async () => {
        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`,
            { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(10_000) }
        );
        if (!res.ok) {
            return { status: "fail", message: `Failed to check phone number: HTTP ${res.status}` };
        }
        const data = await res.json();
        if (data.incoming_phone_numbers?.length > 0) {
            const num = data.incoming_phone_numbers[0];
            return {
                status: "pass",
                message: `Phone ${phone} is active (${num.friendly_name})`,
                details: { friendlyName: num.friendly_name, capabilities: num.capabilities }
            };
        }
        return { status: "fail", message: `Phone ${phone} not found on this account` };
    });
}

export async function runTwilioDiagnostics(organizationId?: string): Promise<IntegrationResult> {
    const { credentials: creds, source } = await resolveChannelCredentials(
        "twilio-voice",
        organizationId
    );
    const hasCreds = !!creds.TWILIO_ACCOUNT_SID;
    const enabled = process.env.TWILIO_ENABLED === "true" || hasCreds;

    if (!enabled) {
        return {
            status: "skip",
            checks: [
                {
                    name: "Channel enabled",
                    status: "skip",
                    message: "No Twilio credentials configured",
                    durationMs: 0
                }
            ],
            config: {
                enabled: false,
                credentialSource: source,
                accountSid: maskSecret(creds.TWILIO_ACCOUNT_SID),
                phoneNumber: creds.TWILIO_PHONE_NUMBER || null
            },
            credentialSource: source
        };
    }

    const credCheck = checkCredentialKeys(creds, TWILIO_REQUIRED, source);
    const apiCredCheck = await checkTwilioCredentials(creds);
    const phoneCheck = await checkTwilioPhoneNumber(creds);

    const checks = [credCheck, apiCredCheck, phoneCheck];

    return {
        status: overallStatus(checks),
        checks,
        config: {
            enabled: true,
            credentialSource: source,
            accountSid: maskSecret(creds.TWILIO_ACCOUNT_SID),
            phoneNumber: creds.TWILIO_PHONE_NUMBER || null,
            ttsProvider: creds.VOICE_TTS_PROVIDER || process.env.VOICE_TTS_PROVIDER || "twilio",
            defaultAgentSlug:
                creds.VOICE_DEFAULT_AGENT_SLUG ||
                process.env.VOICE_DEFAULT_AGENT_SLUG ||
                "mcp-agent"
        },
        credentialSource: source
    };
}

// ---------------------------------------------------------------------------
// ElevenLabs Checks
// ---------------------------------------------------------------------------

const ELEVENLABS_REQUIRED = ["ELEVENLABS_API_KEY"];

export async function checkElevenLabsCredentials(
    creds: Record<string, string>
): Promise<CheckResult> {
    const apiKey = creds.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return {
            name: "API key validation",
            status: "skip",
            message: "Missing ELEVENLABS_API_KEY",
            durationMs: 0
        };
    }

    return runCheck("API key validation", async () => {
        const res = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
            signal: AbortSignal.timeout(10_000)
        });
        if (!res.ok) {
            return { status: "fail", message: `ElevenLabs API returned ${res.status}` };
        }
        const data = await res.json();
        const voiceCount = data.voices?.length ?? 0;
        return {
            status: "pass",
            message: `API key valid - ${voiceCount} voices available`,
            details: { voiceCount }
        };
    });
}

export async function checkElevenLabsAgent(creds: Record<string, string>): Promise<CheckResult> {
    const apiKey = creds.ELEVENLABS_API_KEY;
    const agentId = creds.ELEVENLABS_AGENT_ID;
    if (!apiKey || !agentId) {
        return {
            name: "Agent exists",
            status: "skip",
            message: "Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID",
            durationMs: 0
        };
    }

    return runCheck("Agent exists", async () => {
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
            headers: { "xi-api-key": apiKey },
            signal: AbortSignal.timeout(10_000)
        });
        if (!res.ok) {
            return { status: "fail", message: `Agent ${agentId} not found (HTTP ${res.status})` };
        }
        const data = await res.json();
        return {
            status: "pass",
            message: `Agent: ${data.name || agentId}`,
            details: { name: data.name, agentId }
        };
    });
}

export async function checkElevenLabsSignedUrl(
    creds: Record<string, string>
): Promise<CheckResult> {
    const apiKey = creds.ELEVENLABS_API_KEY;
    const agentId = creds.ELEVENLABS_AGENT_ID;
    if (!apiKey || !agentId) {
        return {
            name: "Signed URL generation",
            status: "skip",
            message: "Missing API key or agent ID",
            durationMs: 0
        };
    }

    return runCheck("Signed URL generation", async () => {
        const res = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
            { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(10_000) }
        );
        if (!res.ok) {
            return { status: "fail", message: `Failed to get signed URL (HTTP ${res.status})` };
        }
        const data = await res.json();
        if (data.signed_url) {
            return {
                status: "pass",
                message: "Signed URL generated successfully",
                details: { urlPrefix: data.signed_url.substring(0, 50) + "..." }
            };
        }
        return { status: "fail", message: "No signed URL returned" };
    });
}

export async function checkNgrokTunnel(): Promise<CheckResult> {
    return runCheck("ngrok tunnel", async () => {
        try {
            const res = await fetch("http://127.0.0.1:4040/api/tunnels", {
                signal: AbortSignal.timeout(3000)
            });
            if (!res.ok) {
                return { status: "fail", message: "ngrok API returned error" };
            }
            const data = await res.json();
            const url = data.tunnels?.[0]?.public_url || null;
            if (url) {
                return { status: "pass", message: `Tunnel active: ${url}`, details: { url } };
            }
            return { status: "fail", message: "ngrok running but no tunnels found" };
        } catch {
            return { status: "fail", message: "ngrok not running (localhost:4040 unreachable)" };
        }
    });
}

export async function runElevenLabsDiagnostics(
    organizationId?: string
): Promise<IntegrationResult> {
    const { credentials: creds, source } = await resolveChannelCredentials(
        "elevenlabs",
        organizationId
    );
    const apiKey = creds.ELEVENLABS_API_KEY;

    if (!apiKey) {
        return {
            status: "skip",
            checks: [
                {
                    name: "API key configured",
                    status: "skip",
                    message: "ELEVENLABS_API_KEY not set",
                    durationMs: 0
                }
            ],
            config: {
                credentialSource: source,
                apiKey: null,
                agentId: creds.ELEVENLABS_AGENT_ID || null
            },
            credentialSource: source
        };
    }

    const credCheck = checkCredentialKeys(creds, ELEVENLABS_REQUIRED, source);
    const apiCredCheck = await checkElevenLabsCredentials(creds);
    const agentCheck = await checkElevenLabsAgent(creds);
    const signedUrlCheck = await checkElevenLabsSignedUrl(creds);
    const webhookSecretCheck: CheckResult = {
        name: "Webhook secret",
        status: creds.ELEVENLABS_WEBHOOK_SECRET ? "pass" : "skip",
        message: creds.ELEVENLABS_WEBHOOK_SECRET
            ? "ELEVENLABS_WEBHOOK_SECRET is configured"
            : "ELEVENLABS_WEBHOOK_SECRET not set (optional, needed for MCP tool webhooks)",
        durationMs: 0
    };
    const ngrokCheck = await checkNgrokTunnel();

    const checks = [
        credCheck,
        apiCredCheck,
        agentCheck,
        signedUrlCheck,
        webhookSecretCheck,
        ngrokCheck
    ];

    return {
        status: overallStatus(checks),
        checks,
        config: {
            credentialSource: source,
            apiKey: maskSecret(apiKey),
            agentId: creds.ELEVENLABS_AGENT_ID || null,
            webhookSecret: maskSecret(creds.ELEVENLABS_WEBHOOK_SECRET),
            webhookUrl: creds.ELEVENLABS_MCP_WEBHOOK_URL || null,
            ngrokDomain: process.env.NGROK_DOMAIN || null
        },
        credentialSource: source
    };
}

// ---------------------------------------------------------------------------
// Telegram Checks
// ---------------------------------------------------------------------------

const TELEGRAM_REQUIRED = ["TELEGRAM_BOT_TOKEN"];

export async function checkTelegramBot(creds: Record<string, string>): Promise<CheckResult> {
    const token = creds.TELEGRAM_BOT_TOKEN;
    if (!token) {
        return {
            name: "Bot token validation",
            status: "skip",
            message: "Missing TELEGRAM_BOT_TOKEN",
            durationMs: 0
        };
    }

    return runCheck("Bot token validation", async () => {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
            signal: AbortSignal.timeout(10_000)
        });
        if (!res.ok) {
            return { status: "fail", message: `Telegram API returned ${res.status}` };
        }
        const data = await res.json();
        if (data.ok) {
            return {
                status: "pass",
                message: `Bot: @${data.result.username} (ID: ${data.result.id})`,
                details: {
                    id: data.result.id,
                    username: data.result.username,
                    firstName: data.result.first_name
                }
            };
        }
        return { status: "fail", message: data.description || "Unknown error" };
    });
}

export async function checkTelegramWebhook(creds: Record<string, string>): Promise<CheckResult> {
    const token = creds.TELEGRAM_BOT_TOKEN;
    if (!token) {
        return {
            name: "Webhook status",
            status: "skip",
            message: "Missing TELEGRAM_BOT_TOKEN",
            durationMs: 0
        };
    }

    return runCheck("Webhook status", async () => {
        const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
            signal: AbortSignal.timeout(10_000)
        });
        if (!res.ok) {
            return { status: "fail", message: `Failed to get webhook info (HTTP ${res.status})` };
        }
        const data = await res.json();
        const info = data.result;
        if (info.url) {
            const hasError = !!info.last_error_message;
            return {
                status: hasError ? "fail" : "pass",
                message: hasError
                    ? `Webhook set but has errors: ${info.last_error_message}`
                    : `Webhook active: ${info.url}`,
                details: {
                    url: info.url,
                    pendingUpdates: info.pending_update_count,
                    lastError: info.last_error_message || null
                }
            };
        }
        return {
            status: "pass",
            message: "No webhook set (using polling mode)",
            details: { url: null }
        };
    });
}

export async function runTelegramDiagnostics(organizationId?: string): Promise<IntegrationResult> {
    const { credentials: creds, source } = await resolveChannelCredentials(
        "telegram-bot",
        organizationId
    );
    const hasToken = !!creds.TELEGRAM_BOT_TOKEN;
    const enabled = process.env.TELEGRAM_ENABLED === "true" || hasToken;

    if (!enabled) {
        return {
            status: "skip",
            checks: [
                {
                    name: "Channel enabled",
                    status: "skip",
                    message: "No Telegram credentials configured",
                    durationMs: 0
                }
            ],
            config: {
                enabled: false,
                credentialSource: source,
                botToken: maskSecret(creds.TELEGRAM_BOT_TOKEN)
            },
            credentialSource: source
        };
    }

    const credCheck = checkCredentialKeys(creds, TELEGRAM_REQUIRED, source);
    const botCheck = await checkTelegramBot(creds);
    const webhookCheck = await checkTelegramWebhook(creds);

    const checks = [credCheck, botCheck, webhookCheck];

    return {
        status: overallStatus(checks),
        checks,
        config: {
            enabled: true,
            credentialSource: source,
            botToken: maskSecret(creds.TELEGRAM_BOT_TOKEN),
            defaultAgentSlug: creds.TELEGRAM_DEFAULT_AGENT_SLUG || "mcp-agent",
            useWebhook: creds.TELEGRAM_USE_WEBHOOK || process.env.TELEGRAM_USE_WEBHOOK || "false",
            webhookUrl: creds.TELEGRAM_WEBHOOK_URL || process.env.TELEGRAM_WEBHOOK_URL || null
        },
        credentialSource: source
    };
}

// ---------------------------------------------------------------------------
// WhatsApp Checks
// ---------------------------------------------------------------------------

export async function checkWhatsAppSession(): Promise<CheckResult> {
    return runCheck("Session state", async () => {
        try {
            const { isWhatsAppInitialized, getWhatsAppService } =
                await import("@/app/api/channels/whatsapp/_service");
            if (!isWhatsAppInitialized()) {
                return {
                    status: "fail",
                    message: "WhatsApp service not initialized (call /qr endpoint to start)"
                };
            }
            const service = await getWhatsAppService();
            const status = service.getStatus();
            const hasQR = !!service.getQRCode();
            return {
                status: status === "connected" ? "pass" : "fail",
                message:
                    status === "connected"
                        ? "WhatsApp connected"
                        : hasQR
                          ? "Waiting for QR code scan"
                          : `Status: ${status}`,
                details: { status, hasQR }
            };
        } catch (error) {
            return {
                status: "fail",
                message: error instanceof Error ? error.message : "Failed to check session"
            };
        }
    });
}

export async function runWhatsAppDiagnostics(organizationId?: string): Promise<IntegrationResult> {
    const { credentials: creds, source } = await resolveChannelCredentials(
        "whatsapp-web",
        organizationId
    );
    const enabled = process.env.WHATSAPP_ENABLED === "true";
    if (!enabled) {
        return {
            status: "skip",
            checks: [
                {
                    name: "Channel enabled",
                    status: "skip",
                    message: 'WHATSAPP_ENABLED is not set to "true"',
                    durationMs: 0
                }
            ],
            config: { enabled: false, credentialSource: source },
            credentialSource: source
        };
    }

    const credCheck: CheckResult = {
        name: "Configuration",
        status: "pass",
        message: `WhatsApp enabled (source: ${source})`,
        durationMs: 0
    };
    const sessionCheck = await checkWhatsAppSession();

    const checks = [credCheck, sessionCheck];

    return {
        status: overallStatus(checks),
        checks,
        config: {
            enabled: true,
            credentialSource: source,
            defaultAgentSlug:
                creds.WHATSAPP_DEFAULT_AGENT_SLUG ||
                process.env.WHATSAPP_DEFAULT_AGENT_SLUG ||
                "mcp-agent",
            allowlistConfigured: !!(creds.WHATSAPP_ALLOWLIST || process.env.WHATSAPP_ALLOWLIST),
            sessionPath:
                creds.WHATSAPP_SESSION_PATH ||
                process.env.WHATSAPP_SESSION_PATH ||
                "./.whatsapp-session"
        },
        credentialSource: source
    };
}

// ---------------------------------------------------------------------------
// Full Diagnostics
// ---------------------------------------------------------------------------

export async function runAllDiagnostics(organizationId?: string): Promise<DiagnosticsResult> {
    const [twilio, elevenlabs, telegram, whatsapp] = await Promise.all([
        runTwilioDiagnostics(organizationId),
        runElevenLabsDiagnostics(organizationId),
        runTelegramDiagnostics(organizationId),
        runWhatsAppDiagnostics(organizationId)
    ]);

    const allChecks = [
        ...twilio.checks,
        ...elevenlabs.checks,
        ...telegram.checks,
        ...whatsapp.checks
    ];

    return {
        timestamp: new Date().toISOString(),
        summary: {
            total: allChecks.length,
            passed: allChecks.filter((c) => c.status === "pass").length,
            failed: allChecks.filter((c) => c.status === "fail").length,
            skipped: allChecks.filter((c) => c.status === "skip").length
        },
        integrations: { twilio, elevenlabs, telegram, whatsapp }
    };
}
