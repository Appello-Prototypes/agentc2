/**
 * Next.js Instrumentation
 *
 * Runs once when the server starts. Used to register post-bootstrap hooks
 * that connect app-specific logic (Gmail sync) to the shared auth package.
 */

export async function register() {
    // Only register hooks on the Node.js runtime (not during build or edge)
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { onPostBootstrap, onAuthEvent } = await import("@repo/auth");
        const { syncGmailFromAccount } = await import("@/lib/gmail-sync");
        const { syncMicrosoftFromAccount } = await import("@/lib/microsoft-sync");
        const { provisionOrgKeyPair } = await import("@repo/agentc2/crypto");
        const { createAuditLog } = await import("@/lib/audit-log");

        onAuthEvent(async (event) => {
            const actionMap = {
                login_success: "AUTH_LOGIN_SUCCESS",
                login_failure: "AUTH_LOGIN_FAILURE",
                logout: "AUTH_LOGOUT",
                session_created: "AUTH_SESSION_CREATED"
            } as const;

            await createAuditLog({
                action: actionMap[event.type],
                entityType: "Session",
                entityId: event.userId || "unknown",
                actorId: event.userId,
                metadata: {
                    ip: event.ip,
                    path: event.path
                }
            });
        });

        onPostBootstrap(async (userId, organizationId) => {
            console.log("[PostBootstrap] Syncing Gmail for user:", userId);
            const result = await syncGmailFromAccount(userId, organizationId);
            if (result.success) {
                console.log("[PostBootstrap] Gmail synced:", result.gmailAddress);
            } else if (!result.skipped) {
                console.warn("[PostBootstrap] Gmail sync failed:", result.error);
            }
        });

        onPostBootstrap(async (userId, organizationId) => {
            console.log("[PostBootstrap] Syncing Microsoft for user:", userId);
            const result = await syncMicrosoftFromAccount(userId, organizationId);
            if (result.success) {
                console.log("[PostBootstrap] Microsoft synced:", result.email, result.connections);
            } else if (!result.skipped) {
                console.warn("[PostBootstrap] Microsoft sync failed:", result.error);
            }
        });

        onPostBootstrap(async (_userId, organizationId) => {
            const keyPair = await provisionOrgKeyPair(organizationId);
            if (keyPair) {
                console.log(
                    "[PostBootstrap] Ed25519 key pair provisioned for org:",
                    organizationId
                );
            }
        });

        console.log(
            "[Instrumentation] Post-bootstrap hooks registered (Gmail, Microsoft, KeyPair)"
        );

        // Verify Docker availability for sandboxed code execution
        try {
            const { execSync } = await import("child_process");
            execSync("docker info", { stdio: "ignore", timeout: 5000 });
            console.log("[Instrumentation] Docker is available for sandboxed code execution");
        } catch {
            const fallbackAllowed =
                process.env.SANDBOX_ALLOW_UNSANDBOXED_FALLBACK === "true" &&
                process.env.NODE_ENV !== "production";
            if (process.env.NODE_ENV === "production") {
                console.error(
                    "[Instrumentation] WARNING: Docker is NOT available. Code execution tool will fail."
                );
            } else if (fallbackAllowed) {
                console.warn(
                    "[Instrumentation] Docker unavailable. Unsandboxed fallback is enabled (dev only)."
                );
            } else {
                console.warn(
                    "[Instrumentation] Docker unavailable. Code execution tool will be disabled."
                );
            }
        }

        // Security: verify CREDENTIAL_ENCRYPTION_KEY in production
        if (process.env.NODE_ENV === "production") {
            const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
            if (!key) {
                console.error(
                    "[FATAL] CREDENTIAL_ENCRYPTION_KEY is not set. Credentials will not be encrypted."
                );
                process.exit(1);
            }
            const buf = Buffer.from(key, "hex");
            if (buf.length !== 32) {
                console.error(
                    "[FATAL] CREDENTIAL_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Got:",
                    key.length,
                    "chars"
                );
                process.exit(1);
            }
            console.log("[Instrumentation] CREDENTIAL_ENCRYPTION_KEY validated");
        }
    }
}
