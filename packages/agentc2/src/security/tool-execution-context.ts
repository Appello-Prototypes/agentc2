/**
 * ToolExecutionContext
 *
 * Carries identity and access-control metadata through every tool invocation.
 * Built by the AgentResolver at resolution time and threaded into each tool
 * call via bindWorkspaceContext.
 */

export interface ToolExecutionContext {
    /** Organization that owns the workspace the agent belongs to */
    organizationId: string;
    /** Authenticated user who initiated the request */
    callingUserId: string;
    /** Membership role of the calling user within the organization */
    callingUserRole: "owner" | "admin" | "member" | "viewer";
    /**
     * "user"  = personal agent: tools access only the calling user's data
     * "org"   = org-level agent: tools access based on role and connection policies
     */
    executionMode: "user" | "org";
    /**
     * Pre-computed credential scope based on executionMode + role:
     *   "own"      = only the calling user's connections
     *   "org-wide" = all org-wide connections
     *   "all"      = all connections in the org (admin/owner in org mode)
     */
    connectionScope: "own" | "org-wide" | "all";
}

export type UserRole = ToolExecutionContext["callingUserRole"];

/**
 * Compute the connectionScope from executionMode and role.
 */
export function computeConnectionScope(
    executionMode: ToolExecutionContext["executionMode"],
    role: UserRole
): ToolExecutionContext["connectionScope"] {
    if (executionMode === "user") return "own";
    if (role === "owner" || role === "admin") return "all";
    return "org-wide";
}
