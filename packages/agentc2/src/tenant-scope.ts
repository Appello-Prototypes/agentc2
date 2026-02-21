/**
 * Tenant-scoped identity helpers for multi-org memory and vector isolation.
 *
 * All memory threads, working memory, semantic recall, and RAG operations
 * must use org-scoped identifiers to prevent cross-tenant data leakage.
 *
 * The separator ":" is used because Mastra stores `resource_id` as vector
 * metadata; prefixing with orgId ensures the vector filter naturally
 * partitions by organization.
 */

const ORG_SCOPE_SEPARATOR = ":";

export function orgScopedResourceId(organizationId: string, userId: string): string {
    if (!organizationId) return userId;
    return `${organizationId}${ORG_SCOPE_SEPARATOR}${userId}`;
}

export function orgScopedThreadId(
    organizationId: string,
    source: string,
    agentSlug: string,
    identifier: string
): string {
    const base = `${source}-${agentSlug}-${identifier}`;
    if (!organizationId) return base;
    return `${organizationId}${ORG_SCOPE_SEPARATOR}${base}`;
}

/**
 * Parse an org-scoped resourceId back into its components.
 * Returns { organizationId, userId } or { organizationId: null, userId: raw }
 * if the value was not org-scoped.
 */
export function parseOrgScopedResourceId(resourceId: string): {
    organizationId: string | null;
    userId: string;
} {
    const idx = resourceId.indexOf(ORG_SCOPE_SEPARATOR);
    if (idx === -1) return { organizationId: null, userId: resourceId };
    return {
        organizationId: resourceId.slice(0, idx),
        userId: resourceId.slice(idx + 1)
    };
}

/**
 * Extract the organizationId prefix from an org-scoped identifier.
 * Returns null if the identifier was not org-scoped.
 */
export function extractOrgFromScopedId(scopedId: string): string | null {
    const idx = scopedId.indexOf(ORG_SCOPE_SEPARATOR);
    return idx === -1 ? null : scopedId.slice(0, idx);
}
