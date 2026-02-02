# MCP Interactive Testing Guide

This guide explains how to use the `cursor-ide-browser` MCP for interactive and exploratory testing of the Agent Workspace.

## Overview

While the Playwright test suite (`bun run test:e2e:playwright`) runs automated tests, the MCP browser tools enable:

- **Interactive testing** - Manual exploration with AI assistance
- **Ad-hoc verification** - Quick checks without writing test code
- **Debugging** - Step through UI flows to diagnose issues
- **Screenshot capture** - Visual evidence collection

## Prerequisites

The `cursor-ide-browser` MCP server must be enabled in Cursor. Check your MCP settings.

## Workflow

### 1. Navigate to the Application

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_navigate",
    "arguments": { "url": "https://catalyst.localhost/agent/workspace" }
}
```

### 2. Lock the Browser (Required)

After navigating, you must lock the browser before interactions:

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_lock",
    "arguments": {}
}
```

### 3. Take a Snapshot

Get the accessibility tree to find element references:

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_snapshot",
    "arguments": {}
}
```

The snapshot returns element refs like `[ref=button1]` - use these in subsequent interactions.

### 4. Interact with Elements

**Click an element:**

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_click",
    "arguments": {
        "element": "Send button",
        "ref": "button1"
    }
}
```

**Type into a field:**

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_type",
    "arguments": {
        "element": "Chat input",
        "ref": "textarea1",
        "text": "Hello, how can you help me?"
    }
}
```

**Fill a form field (replaces content):**

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_fill",
    "arguments": {
        "element": "Chat input",
        "ref": "textarea1",
        "value": "New message content"
    }
}
```

### 5. Wait for Changes

Wait for text to appear:

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_wait_for",
    "arguments": { "text": "response received" }
}
```

### 6. Take Screenshots

Capture visual evidence:

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_screenshot",
    "arguments": {
        "filename": "test-evidence.png",
        "fullPage": true
    }
}
```

### 7. Unlock When Done

When finished with all interactions:

```json
{
    "server": "cursor-ide-browser",
    "toolName": "browser_unlock",
    "arguments": {}
}
```

## Agent Workspace Testing Scenarios

### Testing Agent Chat

1. Navigate to test page:

    ```json
    { "url": "https://catalyst.localhost/agent/workspace/assistant/test" }
    ```

2. Lock browser

3. Take snapshot

4. Find chat input (look for `[ref=textareaX]` with "chat-input" testid)

5. Fill chat input with test message

6. Find and click send button

7. Wait for response to appear

8. Take screenshot as evidence

9. Unlock browser

### Testing Navigation

1. Navigate to overview:

    ```json
    { "url": "https://catalyst.localhost/agent/workspace/assistant/overview" }
    ```

2. Lock browser

3. Take snapshot

4. Click on each navigation tab and verify page loads

5. Screenshot each page state

6. Unlock browser

### Testing Runs Page

1. Navigate to runs:

    ```json
    { "url": "https://catalyst.localhost/agent/workspace/assistant/runs" }
    ```

2. Lock browser

3. Take snapshot

4. Click on a run to view details

5. Verify run details panel shows

6. Screenshot the detail view

7. Unlock browser

## Common Test IDs

The Agent Workspace uses these `data-testid` attributes:

| Component          | Test ID              |
| ------------------ | -------------------- |
| Chat input         | `chat-input`         |
| Send button        | `send-button`        |
| User message       | `user-message`       |
| Assistant message  | `assistant-message`  |
| Clear chat button  | `clear-chat`         |
| Sending indicator  | `sending-indicator`  |
| Messages container | `messages-container` |

## Tips

1. **Always snapshot before clicking** - Element refs change when the page updates

2. **Use short waits with checks** - Wait 2-3 seconds, snapshot, check if ready, repeat

3. **Lock/Unlock properly** - Always lock before interactions, unlock when done

4. **Capture evidence** - Take screenshots after key actions

5. **Check console messages** - Use `browser_console_messages` to check for errors

## Troubleshooting

**Element not found:**

- Take a fresh snapshot; the page may have updated
- Check if the element is in a modal or hidden section

**Click not working:**

- Make sure browser is locked
- Verify the ref is correct from the latest snapshot

**Page not loading:**

- Check if the dev server is running (`bun run dev`)
- Verify the URL is correct

**Timeout errors:**

- Increase wait time
- Check if the action triggered a page load

## Related Files

- `playwright.config.ts` - Automated test configuration
- `tests-e2e/` - Automated test files
- `tests-e2e/pages/` - Page object models
