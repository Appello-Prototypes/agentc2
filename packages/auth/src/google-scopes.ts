/**
 * Google OAuth scopes — single source of truth for the entire platform.
 *
 * Used by:
 *   - Better Auth server config (packages/auth/src/auth.ts)
 *   - Sign-up / sign-in forms (client components)
 *   - AppProvidersWrapper reauth flow
 *   - GMAIL_REQUIRED_SCOPES validation (apps/agent/src/lib/gmail.ts)
 *
 * If you add or remove a scope here, also update the Google Cloud Console
 * OAuth consent screen (Data Access → Add or remove scopes).
 */

/** Full set of scopes requested during Google sign-in / sign-up. */
export const GOOGLE_OAUTH_SCOPES = [
    // Gmail — gmail.modify is a superset covering read, compose, draft, send, label.
    // No need for gmail.send separately since gmail.modify already includes it.
    "https://www.googleapis.com/auth/gmail.modify",

    // Calendar — full CRUD on events
    "https://www.googleapis.com/auth/calendar.events",

    // Drive — read/search files + create Google Docs
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file"
] as const;

/**
 * Subset of scopes required for Gmail/Calendar integration to function.
 * Used by sync checks to detect partial consent.
 * Drive scopes are optional — agents work without Drive.
 *
 * Note: gmail.modify already covers gmail.send, gmail.readonly, gmail.compose,
 * and gmail.labels — so we only check for gmail.modify here.
 */
export const GOOGLE_REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.events"
] as const;
