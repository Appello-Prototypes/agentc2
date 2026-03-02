# ATLAS MCP Setup for Cursor

ATLAS is Appello's Retrieval-Augmented Generation (RAG) knowledge base containing thousands of hours of meeting transcripts, onboarding calls, internal documents, and operational context.

---

## Step 1: Add ATLAS to Cursor MCP Config

Open your Cursor MCP config file at `~/.cursor/mcp.json` and add the following entry inside `"mcpServers"`:

```json
"ATLAS": {
  "url": "https://useappello.app.n8n.cloud/mcp/dfbad0dd-acf3-4796-ab7a-87fdd03f51a8/sse"
}
```

If the file doesn't exist yet, create it with:

```json
{
    "mcpServers": {
        "ATLAS": {
            "url": "https://useappello.app.n8n.cloud/mcp/dfbad0dd-acf3-4796-ab7a-87fdd03f51a8/sse"
        }
    }
}
```

No authentication is required.

## Step 2: Restart Cursor

After saving the config, restart Cursor or reload the window (Cmd+Shift+P > "Developer: Reload Window"). Verify the ATLAS server shows as connected in **Cursor Settings > MCP**.

---

## How to Use ATLAS

ATLAS exposes one tool: **`Query_ATLAS`**

| Parameter | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| `query`   | string | Yes      | The query for the ATLAS database |

### Query Best Practices

- **Use full sentences**, not keywords. ATLAS uses semantic search.
- **Include specific entities** — customer names, project names, people, features.
- **Include concrete topics** — requirements, blockers, workflows, decisions.
- **Add time/context anchors** when relevant — timeframes, systems, meeting types.
- **Break complex questions into multiple focused queries** for better results.

### Example Queries

```
"What decisions were made about the work order feature?"
"What feedback did AARCon give during their onboarding?"
"What is Appello's AI strategy as discussed in investor calls?"
"What are the current pain points customers report with payroll?"
```

### What ATLAS Returns

Each result includes:

- **pageContent** — the relevant text excerpt
- **metadata** — source file, document title, line numbers
- **score** — relevance score (higher is better, typically 0.3–0.7)

Results are ranked by relevance. Use the metadata to trace information back to its original source document or meeting transcript.
