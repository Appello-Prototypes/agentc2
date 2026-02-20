/**
 * Next.js Instrumentation
 *
 * Runs once when the server starts. Used to register post-bootstrap hooks
 * that connect app-specific logic (Gmail sync) to the shared auth package.
 */

export async function register() {
    // Only register hooks on the Node.js runtime (not during build or edge)
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { onPostBootstrap } = await import("@repo/auth");
        const { syncGmailFromAccount } = await import("@/lib/gmail-sync");
        const { syncMicrosoftFromAccount } = await import("@/lib/microsoft-sync");
        const { provisionOrgKeyPair } = await import("@repo/agentc2/crypto");

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
    }
}
