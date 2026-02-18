/**
 * Microsoft OAuth scopes — single source of truth for the entire platform.
 *
 * Used by:
 *   - Better Auth server config (packages/auth/src/auth.ts)
 *   - Sign-up / sign-in forms (client components)
 *   - AppProvidersWrapper reauth flow
 *   - Microsoft sync validation (apps/agent/src/lib/microsoft-sync.ts)
 *
 * If you add or remove a scope here, also update the Azure AD app registration
 * (API permissions → Add a permission → Microsoft Graph → Delegated permissions).
 */

/** Full set of scopes requested during Microsoft sign-in / sign-up. */
export const MICROSOFT_OAUTH_SCOPES = [
    // User profile
    "User.Read",

    // Outlook Mail — read, compose, send, manage
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",

    // Calendar — full CRUD on events
    "Calendars.Read",
    "Calendars.ReadWrite",

    // Teams — list teams/channels, send messages, read/write chats
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "ChannelMessage.Send",
    "Chat.ReadWrite",

    // Refresh token support
    "offline_access"
] as const;

/**
 * Subset required for the Outlook Mail + Calendar integration to function.
 * Used by sync checks to detect partial consent.
 * Teams scopes are optional — agents work without Teams.
 */
export const MICROSOFT_REQUIRED_SCOPES = [
    "User.Read",
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.Read",
    "Calendars.ReadWrite",
    "offline_access"
] as const;

/** Scopes specifically required for Teams functionality. */
export const MICROSOFT_TEAMS_SCOPES = [
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "ChannelMessage.Send",
    "Chat.ReadWrite"
] as const;
