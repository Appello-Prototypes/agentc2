/**
 * Maps OAuth-dependent tool IDs to their required integration provider key.
 * Used by the AgentResolver to automatically exclude tools when the
 * required OAuth connection is not active for the organization.
 */
export const TOOL_OAUTH_REQUIREMENTS: Record<string, string> = {
    // Google (Gmail OAuth — also covers Calendar and Drive)
    "gmail-archive-email": "gmail",
    "gmail-search-emails": "gmail",
    "gmail-read-email": "gmail",
    "gmail-draft-email": "gmail",
    "gmail-send-email": "gmail",
    "google-calendar-search-events": "gmail",
    "google-calendar-list-events": "gmail",
    "google-calendar-get-event": "gmail",
    "google-calendar-create-event": "gmail",
    "google-calendar-update-event": "gmail",
    "google-calendar-delete-event": "gmail",
    "google-drive-search-files": "gmail",
    "google-drive-read-file": "gmail",
    "google-drive-create-doc": "gmail",

    // Microsoft (Outlook OAuth)
    "outlook-mail-list-emails": "microsoft",
    "outlook-mail-get-email": "microsoft",
    "outlook-mail-send-email": "microsoft",
    "outlook-mail-archive-email": "microsoft",
    "outlook-calendar-list-events": "microsoft",
    "outlook-calendar-get-event": "microsoft",
    "outlook-calendar-create-event": "microsoft",
    "outlook-calendar-update-event": "microsoft",

    // Dropbox
    "dropbox-list-files": "dropbox",
    "dropbox-get-file": "dropbox",
    "dropbox-upload-file": "dropbox",
    "dropbox-search-files": "dropbox",
    "dropbox-get-sharing-links": "dropbox"
};
