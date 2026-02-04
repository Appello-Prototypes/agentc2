# Fathom MCP Installation Guide

This guide will help you set up the Fathom MCP server in Cursor so you can access Fathom meeting recordings, summaries, and transcripts directly from your AI agent.

---

## Quick Install (2 minutes)

### Step 1: Copy This Folder

Copy this entire `fathom-mcp-package` folder somewhere permanent on your computer.

**Recommended location:**
```
~/fathom-mcp/
```

For example:
```bash
cp -r fathom-mcp-package ~/fathom-mcp
```

### Step 2: Install Dependencies

Open a terminal, navigate to the folder, and run:

```bash
cd ~/fathom-mcp
npm install
```

This installs the required MCP SDK and dependencies.

### Step 3: Add to Cursor MCP Settings

Open Cursor and go to:
**Settings → MCP** (or edit `~/.cursor/mcp.json` directly)

Add this configuration:

```json
{
  "mcpServers": {
    "Fathom": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/fathom-mcp/index.js"],
      "env": {
        "FATHOM_API_KEY": "YOUR_SHARED_API_KEY_HERE"
      }
    }
  }
}
```

**Important:** Replace:
- `/Users/YOUR_USERNAME/fathom-mcp/index.js` with the actual path to where you put the folder
- `YOUR_SHARED_API_KEY_HERE` with the team Fathom API key (ask Travis for this)

### Step 4: Restart Cursor

After saving the MCP configuration, restart Cursor completely.

### Step 5: Verify It Works

In a new Cursor chat, ask:
> "List my recent Fathom meetings"

If configured correctly, you'll see a list of meetings!

---

## Available Tools

Once installed, you'll have these Fathom tools available in Cursor:

| Tool | Description |
|------|-------------|
| `list_meetings` | List all meetings, optionally filtered by date range |
| `get_meeting_summary` | Get AI-generated summary for a specific meeting |
| `get_meeting_transcript` | Get full transcript with speaker labels |
| `get_meeting_details` | Get full metadata, summary, and transcript for a meeting |

---

## Example Usage

### List recent meetings
> "Show me all Fathom meetings from last week"

### Get a meeting summary
> "Get the summary for meeting ID abc123"

### Get meeting details
> "Get the full details including transcript for yesterday's standup meeting"

---

## Troubleshooting

### "FATHOM_API_KEY environment variable is required"
Make sure you added the `env` section with the API key in your MCP config.

### "Fathom API error (401)"  
The API key is invalid or expired. Contact Travis for the correct key.

### "Fathom API error (404)"
The meeting ID doesn't exist or you don't have access to it.

### Server not appearing in Cursor
1. Make sure the path in `args` points to the correct `index.js` location
2. Make sure you ran `npm install` in the fathom-mcp folder
3. Try restarting Cursor completely

---

## Security Notes

- The API key is stored only in your local Cursor configuration
- The MCP server only communicates with Fathom's API (`api.fathom.ai`)
- All code is readable in `index.js` (~200 lines)

---

## Need Help?

Contact Travis if you have any issues setting this up!

