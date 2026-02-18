/**
 * Shared Content Security Policy for agent workspace files.
 *
 * Used by both the workspace serve route (route.ts) and next.config.ts
 * to ensure a single source of truth. Tightened to block eval-based XSS
 * and data exfiltration from agent-generated HTML.
 */

const WORKSPACE_CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self' data: blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'none'"
];

export const WORKSPACE_CSP = WORKSPACE_CSP_DIRECTIVES.join("; ");
