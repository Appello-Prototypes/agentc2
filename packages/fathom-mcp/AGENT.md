# Fathom MCP Setup Agent

You are helping the user install the Fathom MCP server for Cursor.

## What This Does

This MCP gives you access to Fathom meeting recordings, summaries, and transcripts directly in Cursor conversations.

## Installation Steps

### Step 1: Install Dependencies

Run npm install in this folder:

```bash
cd "{{CURRENT_FOLDER}}"
npm install
```

### Step 2: Get the Index.js Path

After npm install completes, note the full path to `index.js` in this folder. It will be needed for the MCP configuration.

### Step 3: Add MCP Configuration

The user needs to add the Fathom MCP to their Cursor settings.

Open **Cursor Settings → MCP** and add this configuration:

```json
{
  "mcpServers": {
    "Fathom": {
      "command": "node",
      "args": ["FULL_PATH_TO_INDEX_JS"],
      "env": {
        "FATHOM_API_KEY": "ASK_TRAVIS_FOR_API_KEY"
      }
    }
  }
}
```

Replace:
- `FULL_PATH_TO_INDEX_JS` with the actual path (e.g., `/Users/username/fathom-mcp/index.js`)
- `ASK_TRAVIS_FOR_API_KEY` with the shared team API key

### Step 4: Restart Cursor

After saving the MCP configuration, Cursor needs to be restarted for the MCP to load.

### Step 5: Verify Installation

After restart, test by asking: "List my recent Fathom meetings"

## Available Tools After Installation

| Tool | Description |
|------|-------------|
| `list_meetings` | List meetings with optional date filtering |
| `get_meeting_summary` | Get AI summary for a meeting |
| `get_meeting_transcript` | Get full transcript |
| `get_meeting_details` | Get complete meeting info |

## Troubleshooting

- **npm install fails**: Make sure Node.js 18+ is installed
- **MCP not loading**: Check the path to index.js is correct and absolute
- **API errors**: Verify the API key is correct (ask Travis)

## Notes for Agent

When helping the user:
1. First run `npm install` in this directory
2. Get the absolute path to index.js using `pwd`
3. Guide them to add the MCP config in Cursor Settings
4. Remind them to get the API key from Travis
5. Tell them to restart Cursor after configuring

