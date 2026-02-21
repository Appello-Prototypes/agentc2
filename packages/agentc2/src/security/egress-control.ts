import { prisma } from "@repo/database";

export interface EgressCheckResult {
    allowed: boolean;
    reason?: string;
    policyMode?: string;
}

/**
 * Check if an outbound request to a domain is allowed by the org's egress policy.
 * Returns allowed=true if no policy exists (backwards compatible).
 */
export async function checkEgressPermission(
    organizationId: string,
    targetUrl: string
): Promise<EgressCheckResult> {
    const policy = await prisma.networkEgressPolicy.findUnique({
        where: { organizationId }
    });

    if (!policy || !policy.enabled) {
        return { allowed: true };
    }

    let hostname: string;
    try {
        hostname = new URL(targetUrl).hostname.toLowerCase();
    } catch {
        return { allowed: false, reason: "Invalid URL", policyMode: policy.mode };
    }

    const matchesDomain = policy.domains.some((pattern) => {
        if (pattern.startsWith("*.")) {
            const suffix = pattern.slice(1); // ".example.com"
            return hostname.endsWith(suffix) || hostname === pattern.slice(2);
        }
        return hostname === pattern.toLowerCase();
    });

    if (policy.mode === "allowlist") {
        return matchesDomain
            ? { allowed: true, policyMode: "allowlist" }
            : {
                  allowed: false,
                  reason: `Domain '${hostname}' not in allowlist`,
                  policyMode: "allowlist"
              };
    }

    // denylist mode
    return matchesDomain
        ? {
              allowed: false,
              reason: `Domain '${hostname}' is in denylist`,
              policyMode: "denylist"
          }
        : { allowed: true, policyMode: "denylist" };
}
