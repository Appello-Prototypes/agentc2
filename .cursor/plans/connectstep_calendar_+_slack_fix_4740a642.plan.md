---
name: ConnectStep Calendar + Drive + Slack Fix
overview: Add Google Calendar and Google Drive (read + write) as auto-connected integrations on the ConnectStep, build native Drive tools including Doc creation, fix Slack OAuth on production, and update the bootstrap agent to leverage all Google integrations for immediate value.
todos:
    - id: add-drive-scopes
      content: "Phase 1: Add drive.readonly and drive.file scopes to googleScopes in packages/auth/src/auth.ts so new sign-ups can read existing files AND create new Google Docs."
      status: completed
    - id: build-drive-tools
      content: "Phase 1: Create native Google Drive tools (search-files, read-file, create-doc) following Gmail/Calendar pattern. Shared helper reuses getAccessToken from gmail/shared.ts. Register in registry.ts, oauth-requirements.ts, toolCategoryMap."
      status: completed
    - id: connectstep-ui-update
      content: "Phase 2: Update ConnectStep.tsx to show 3 Google items (Gmail, Calendar, Drive) as auto-connected cards plus Slack connect button. Group Google items visually."
      status: completed
    - id: onboarding-page-integrations
      content: "Phase 2: Update onboarding/page.tsx to include calendar and drive in connectedIntegrations when gmailConnected is true."
      status: completed
    - id: bootstrap-agent-all-tools
      content: "Phase 2: Add google-calendar-search-events, google-drive-search-files, google-drive-read-file, google-drive-create-doc to bootstrap agent tools. Update working memory template and buildStarterInstructions."
      status: completed
    - id: fix-slack-production-env
      content: "Phase 3: Copy SLACK_CLIENT_ID and SLACK_CLIENT_SECRET from local .env to production server .env."
      status: completed
    - id: quality-checks-deploy
      content: "Phase 3: Run type-check, lint, build locally. Commit, push, force-build on production, restart PM2."
      status: completed
isProject: false
---

# ConnectStep: Add Calendar + Drive (Read/Write) + Fix Slack

## Core Insight

Google OAuth sign-up currently requests 3 scopes but only surfaces 1 (Gmail). By adding `drive.readonly` + `drive.file` and surfacing Calendar + Drive, a single Google sign-up instantly unlocks **3 connected integrations** with **8 tools** -- all before the user clicks a single button. The agent can analyze emails, check the calendar, search Drive files, AND produce a Google Doc with findings.

## Problem

1. **Google Calendar is invisible** -- `calendar.readonly` scope is already granted during sign-up (`[packages/auth/src/auth.ts](packages/auth/src/auth.ts)` lines 12-16), and `google-calendar-search-events` exists in the registry, but neither the ConnectStep UI nor the bootstrap agent surface it.
2. **Google Drive has no native tools** -- Drive exists only as an MCP server (`@modelcontextprotocol/server-gdrive`) requiring a separate credentials file. No native tools use the Google OAuth tokens from sign-up.
3. **Slack Connect button returns 500** -- `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` are missing from the production `.env`. The install route (`[apps/agent/src/app/api/slack/install/route.ts](apps/agent/src/app/api/slack/install/route.ts)` line 29) returns 500 when `SLACK_CLIENT_ID` is absent.

## Changes

### 1. Add Drive scopes to Google OAuth

File: `[packages/auth/src/auth.ts](packages/auth/src/auth.ts)` (line 12-16)

Add two Drive scopes:

```typescript
const googleScopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly", // NEW: search + read any file
    "https://www.googleapis.com/auth/drive.file" // NEW: create + edit app-created files
];
```

**Why two scopes:**

- `drive.readonly` -- search, list, and read ANY file in the user's Drive (needed for "find that document")
- `drive.file` -- create and edit files the app creates (needed for "produce a Google Doc"). This is Google's **recommended** scope for doc creation -- classified as non-sensitive, no extra app verification needed.

**Edge case**: Existing users who signed up before this change won't have Drive scopes. The `checkGoogleScopes()` helper in `[packages/mastra/src/tools/gmail/shared.ts](packages/mastra/src/tools/gmail/shared.ts)` will catch this and Drive tools will gracefully return an error prompting re-auth.

### 2. Build native Google Drive tools

New directory: `packages/mastra/src/tools/google-drive/`

Follow the Gmail/Calendar pattern exactly -- reuse `getAccessToken()` from `gmail/shared.ts` (same Google OAuth tokens), use `gmailAddress` as the lookup key.

**Files to create:**

- `packages/mastra/src/tools/google-drive/shared.ts`
    - `callDriveApi(gmailAddress, path, options)` helper wrapping Google Drive REST API v3 (`https://www.googleapis.com/drive/v3`)
    - Auto-retry on 401 with token refresh (same pattern as `callGmailApi`)
    - Scope check helper for Drive-specific scopes
- `packages/mastra/src/tools/google-drive/search-files.ts` -- `**google-drive-search-files**`
    - Input: `gmailAddress`, `query` (string), `maxResults` (default 10)
    - Uses Drive API `files.list` with `q` parameter and `fields=files(id,name,mimeType,modifiedTime,webViewLink,owners)`
    - Returns: file names, IDs, mimeTypes, modified dates, view links
- `packages/mastra/src/tools/google-drive/read-file.ts` -- `**google-drive-read-file**`
    - Input: `gmailAddress`, `fileId`
    - For Google Docs: `files.export` with `mimeType=text/plain`
    - For Google Sheets: `files.export` with `mimeType=text/csv`
    - For Google Slides: `files.export` with `mimeType=text/plain`
    - For other files: `files.get` with `alt=media` (returns raw content, truncated if too large)
    - Returns: file content as text + metadata
- `packages/mastra/src/tools/google-drive/create-doc.ts` -- `**google-drive-create-doc**`
    - Input: `gmailAddress`, `title` (string), `content` (string, plain text or markdown)
    - Uses Drive API multipart upload: `POST /upload/drive/v3/files?uploadType=multipart`
    - Metadata: `{ name: title, mimeType: "application/vnd.google-apps.document" }`
    - Body: plain text content (Google auto-converts to Doc format)
    - Returns: `{ success, fileId, fileName, webViewLink }` -- the link lets the user open the doc immediately
    - Requires `drive.file` scope
- `packages/mastra/src/tools/google-drive/index.ts` -- Exports all three tools

**Registration in existing files:**

- `[packages/mastra/src/tools/registry.ts](packages/mastra/src/tools/registry.ts)` -- Import and add all three tools to `toolRegistry` and `toolCategoryMap` (category: "File Storage")
- `[packages/mastra/src/tools/oauth-requirements.ts](packages/mastra/src/tools/oauth-requirements.ts)` -- Map all three tools to `"gmail"` provider (same as Calendar)
- `[packages/mastra/src/tools/index.ts](packages/mastra/src/tools/index.ts)` -- Export from google-drive

### 3. ConnectStep UI -- Show all Google integrations + Slack

File: `[apps/agent/src/components/onboarding/ConnectStep.tsx](apps/agent/src/components/onboarding/ConnectStep.tsx)`

Redesign to show 4 integration cards grouped by source:

**Google section** (auto-connected via sign-up):

- **Gmail** -- green "Connected" badge + checkmark, "Email access enabled"
- **Google Calendar** -- green "Connected" badge + checkmark, "Calendar awareness enabled"
- **Google Drive** -- green "Connected" badge + checkmark, "Read files and create Docs"

All three derive their connected state from `gmailConnected` (same OAuth). Group them visually with a subtle "Included with Google sign-in" label.

**Communication section:**

- **Slack** -- "Connect" button (popup OAuth, already implemented)

Update:

- `connectionCount` logic: `(gmailConnected ? 3 : 0) + (slackConnected ? 1 : 0)`
- Subtitle text thresholds for 0/1-3/4 connections
- Privacy copy: "Gmail lets your agent read emails and create drafts. Calendar is read-only. Drive lets your agent search files and create Docs on your behalf. Nothing is sent or shared without your approval."
- Add `CalendarIcon`, `HardDriveIcon` imports from lucide-react

### 4. Onboarding page -- Pass all integrations

File: `[apps/agent/src/app/onboarding/page.tsx](apps/agent/src/app/onboarding/page.tsx)`

In `handleConnectComplete`, when `gmailConnected` is true, automatically include `"gmail"`, `"calendar"`, and `"drive"` in the `connectedIntegrations` array.

### 5. Bootstrap agent -- Add all tools

File: `[apps/agent/src/app/api/onboarding/bootstrap-agent/route.ts](apps/agent/src/app/api/onboarding/bootstrap-agent/route.ts)`

When `hasGmail` is true, push all Google tools:

```typescript
if (hasGmail) {
    tools.push(
        "gmail-search-emails",
        "gmail-read-email",
        "gmail-send-email",
        "gmail-draft-email",
        "google-calendar-search-events", // NEW
        "google-drive-search-files", // NEW
        "google-drive-read-file", // NEW
        "google-drive-create-doc" // NEW
    );
}
```

Update `buildStarterInstructions()`:

- Add calendar instructions: "Check their calendar for upcoming meetings to provide schedule context"
- Add drive instructions: "Search Drive files when the user asks about documents. When asked to analyze or summarize, offer to create a Google Doc with the findings and share the link."
- Update first interaction to mention: "I can also check your calendar, search your Drive, and even create Google Docs"
- Update working memory `connected_tools` to include Calendar and Drive

**Killer demo in agent instructions**: When the user asks to analyze their recent emails, the agent can:

1. Search Gmail for recent important emails
2. Check Calendar for upcoming meetings with those contacts
3. Produce a Google Doc with the analysis
4. Return the link so the user can open it immediately

### 6. Fix Slack OAuth on production

No code changes. Deployment task:

- Copy `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` from local `.env` to production `/var/www/mastra/.env`

### 7. Deploy

- `bun run type-check`, `bun run lint`, `bun run build` locally
- Commit and push
- SSH to production: add Slack env vars + force-build + restart PM2

## What the user will see after this

ConnectStep shows 4 items:

```
Google (included with sign-in)
  [x] Gmail         -- Connected -- Email access enabled
  [x] Calendar      -- Connected -- Calendar awareness enabled
  [x] Drive         -- Connected -- Read files and create Docs

Communication
  [ ] Slack          -- [Connect] button
```

The starter agent will have **8 Google tools** (4 Gmail + 1 Calendar + 3 Drive) + optionally Slack tools. The agent can analyze emails, check the calendar for context, search Drive for related documents, and produce a Google Doc with its findings -- all from a single Google sign-in.

## Important note for existing users

Users who signed up before the Drive scopes were added will NOT have Drive access. Their Drive tools will gracefully fail with a "re-authorize" message. This only affects users who re-enter onboarding; normal dashboard usage is unaffected since Drive tools are only attached to new onboarding agents.
