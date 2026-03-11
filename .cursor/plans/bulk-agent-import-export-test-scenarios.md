# Test Scenarios: Bulk Agent Import/Export

Comprehensive test cases covering happy paths, error conditions, edge cases, and security scenarios.

---

## 1. Export Test Scenarios

### 1.1 Happy Path - Basic Export

**Scenario:** User exports all agents in their workspace

**Setup:**
- User has 10 agents in workspace "ws-123"
- User is authenticated with `member` role
- All agents have basic configuration (name, instructions, model)

**Steps:**
1. Navigate to `/agents` page
2. Click "Export to CSV" button
3. File download triggers

**Expected Result:**
- ✅ CSV file downloaded: `agents-ws-123-2026-03-11.csv`
- ✅ CSV contains header row + 10 data rows
- ✅ All required columns present
- ✅ Agent names match database records
- ✅ No errors logged

---

### 1.2 Export with Tools

**Scenario:** Export includes tool associations

**Setup:**
- Agent "Support" has tools: `["web-search", "gmail-send-email"]`
- Agent "Research" has tools: `["exa-research", "memory-recall"]`

**Steps:**
1. Export with `includeTools=true`

**Expected Result:**
- ✅ "Support" row has `tools` column: `"web-search;gmail-send-email"`
- ✅ "Research" row has `tools` column: `"exa-research;memory-recall"`
- ✅ Agent with no tools has empty `tools` column

---

### 1.3 Export with Special Characters

**Scenario:** Agent fields contain CSV special characters

**Setup:**
- Agent name: `Support Agent "Pro"`
- Instructions: `You are helpful, kind, and professional.`
- Description contains newlines: `Line 1\nLine 2`

**Expected Result:**
- ✅ Name escaped: `"Support Agent ""Pro"""`
- ✅ Instructions escaped: `"You are helpful, kind, and professional."`
- ✅ Description preserved with newlines: `"Line 1\nLine 2"`
- ✅ CSV opens correctly in Excel without corruption

---

### 1.4 Export with Authorization Filtering

**Scenario:** User has limited access to agents

**Setup:**
- Workspace has 20 agents total
- User owns 5 agents
- 10 agents are ORGANIZATION visibility
- 5 agents are PRIVATE (owned by others)

**Steps:**
1. Export agents

**Expected Result:**
- ✅ CSV contains 15 agents (5 owned + 10 ORGANIZATION)
- ✅ 5 PRIVATE agents owned by others are excluded
- ✅ No authorization error

---

### 1.5 Export Empty Workspace

**Scenario:** Workspace has zero agents

**Steps:**
1. Export agents from empty workspace

**Expected Result:**
- ✅ CSV contains only header row
- ✅ No error (not an error condition)
- ✅ File downloads successfully

---

### 1.6 Export with Archived Agents

**Scenario:** User wants to include archived agents

**Setup:**
- 10 active agents, 5 archived agents

**Steps:**
1. Export with `includeArchived=false` (default)
2. Export with `includeArchived=true`

**Expected Result:**
- ✅ First export: 10 rows (active only)
- ✅ Second export: 15 rows (active + archived)

---

## 2. Import Test Scenarios

### 2.1 Happy Path - Create New Agents

**Scenario:** Import CSV with 5 valid new agents

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent 1","You are helpful","openai","gpt-4o"
"Agent 2","You are smart","anthropic","claude-sonnet-4-5-20250929"
"Agent 3","You research","openai","gpt-4o-mini"
"Agent 4","You analyze","anthropic","claude-opus-4-5-20251101"
"Agent 5","You assist","openai","gpt-4.1"
```

**Steps:**
1. Upload CSV
2. Select mode: "skip"
3. Click "Import"

**Expected Result:**
- ✅ Success response with summary: `{ created: 5, updated: 0, skipped: 0, failed: 0 }`
- ✅ All 5 agents created in database
- ✅ Slugs generated: `agent-1`, `agent-2`, `agent-3`, `agent-4`, `agent-5`
- ✅ Activity feed records created
- ✅ Agent list UI refreshes and shows new agents

---

### 2.2 Import with Tools

**Scenario:** Import agents with tool associations

**CSV:**
```csv
name,instructions,modelProvider,modelName,tools
"Support","Help users","openai","gpt-4o","web-search;gmail-send-email;calculator"
"Research","Find info","anthropic","claude-sonnet-4-5-20250929","exa-research;web-scrape"
```

**Expected Result:**
- ✅ "Support" agent has 3 tool associations in `AgentTool` table
- ✅ "Research" agent has 2 tool associations
- ✅ Tools are validated and only valid tools are attached

---

### 2.3 Import with Name Collision (Skip Mode)

**Scenario:** CSV contains agent name that already exists

**Setup:**
- Existing agent: `{ name: "Assistant", slug: "assistant" }`

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Assistant","You are new","openai","gpt-4o"
"Helper","You help","openai","gpt-4o"
```

**Steps:**
1. Import with mode: "skip"

**Expected Result:**
- ✅ Summary: `{ created: 1, skipped: 1, failed: 0 }`
- ✅ Row 1 status: `"skipped"`, reason: `"Agent 'Assistant' already exists"`
- ✅ Row 2 status: `"created"`, slug: `"helper"`
- ✅ Existing "Assistant" agent unchanged

---

### 2.4 Import with Name Collision (Overwrite Mode)

**Scenario:** Update existing agent via import

**Setup:**
- Existing agent: `{ id: "clx1", name: "Assistant", version: 1, instructions: "Old" }`

**CSV:**
```csv
name,instructions,modelProvider,modelName,temperature
"Assistant","New instructions","anthropic","claude-sonnet-4-5-20250929",0.9
```

**Steps:**
1. Import with mode: "overwrite"

**Expected Result:**
- ✅ Summary: `{ created: 0, updated: 1, skipped: 0, failed: 0 }`
- ✅ Agent updated: `{ instructions: "New instructions", temperature: 0.9, version: 2 }`
- ✅ `AgentVersion` record created with snapshot of version 1
- ✅ `ChangeLog` entry created
- ✅ Activity feed: "Agent 'Assistant' updated via bulk import"

---

### 2.5 Import with Invalid Model

**Scenario:** CSV contains non-existent model

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent 1","Help","openai","gpt-5o"
"Agent 2","Assist","openai","gpt-4o"
```

**Expected Result:**
- ✅ Summary: `{ created: 1, failed: 1 }`
- ✅ Row 1 status: `"failed"`, error: `"Model 'gpt-5o' not found for provider 'openai'"`, suggestion: `"Did you mean: gpt-4o, gpt-4o-mini?"`
- ✅ Row 2 status: `"created"`

---

### 2.6 Import with Invalid Tools

**Scenario:** CSV references non-existent tools

**CSV:**
```csv
name,instructions,modelProvider,modelName,tools
"Agent","Help","openai","gpt-4o","calculator;invalid-tool;web-search"
```

**Expected Result:**
- ✅ Agent created successfully
- ✅ Only valid tools attached: `calculator`, `web-search`
- ✅ Warning: `"Row 1: Tool 'invalid-tool' not found. It will be skipped."`

---

### 2.7 Import with Unavailable MCP Tools

**Scenario:** CSV references MCP tool without credentials

**Setup:**
- Organization does not have HubSpot integration configured
- Tool `hubspot_hubspot-get-contacts` exists in MCP registry but unavailable

**CSV:**
```csv
name,instructions,modelProvider,modelName,tools
"CRM Agent","Manage contacts","openai","gpt-4o","hubspot_hubspot-get-contacts;calculator"
```

**Expected Result:**
- ✅ Agent created
- ✅ Only `calculator` attached
- ✅ Warning: `"Row 1: Tool 'hubspot_hubspot-get-contacts' not available (missing API key or disabled). It will be skipped."`

---

### 2.8 Import with Missing Required Fields

**Scenario:** CSV rows missing required data

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent 1","Help","openai","gpt-4o"
"Agent 2","","openai","gpt-4o"
"Agent 3","Help","",""
```

**Expected Result:**
- ✅ Summary: `{ created: 1, failed: 2 }`
- ✅ Row 1: `"created"`
- ✅ Row 2: `"failed"`, error: `"Instructions are required"`
- ✅ Row 3: `"failed"`, error: `"Model provider and model name are required"`

---

### 2.9 Import with Multiline Instructions

**Scenario:** Agent instructions span multiple lines in CSV

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent","You are helpful.
You respond politely.
You follow instructions.","openai","gpt-4o"
```

**Expected Result:**
- ✅ Agent created with instructions preserving newlines
- ✅ Database stores: `"You are helpful.\nYou respond politely.\nYou follow instructions."`

---

### 2.10 Import Dry Run

**Scenario:** Validate CSV without creating agents

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Valid Agent","Help","openai","gpt-4o"
"Invalid Agent","Help","openai","gpt-invalid"
```

**Steps:**
1. Upload CSV
2. Check "Dry run" checkbox
3. Click "Import"

**Expected Result:**
- ✅ Response: `{ success: true, dryRun: true, summary: { ... } }`
- ✅ Validation report shows 1 valid, 1 invalid
- ✅ No agents created in database
- ✅ User can fix errors and re-import

---

## 3. Edge Cases

### 3.1 Unicode Characters (Emoji)

**Scenario:** Agent name/instructions contain emoji

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Support Agent 🎧","You are helpful 👍","openai","gpt-4o"
```

**Expected Result:**
- ✅ Agent created with emoji preserved
- ✅ CSV export re-exports emoji correctly
- ✅ No encoding errors

---

### 3.2 Very Long Instructions

**Scenario:** Instructions field at maximum length (50,000 chars)

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent","<50,000 character instruction text>","openai","gpt-4o"
```

**Expected Result:**
- ✅ Agent created successfully
- ✅ Instructions stored completely
- ✅ Export regenerates CSV without truncation

---

### 3.3 Instructions Exceeding Limit

**Scenario:** Instructions field over 50,000 characters

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent","<60,000 character instruction text>","openai","gpt-4o"
```

**Expected Result:**
- ✅ Row fails validation
- ✅ Error: `"Instructions exceed maximum length of 50,000 characters"`

---

### 3.4 CSV with BOM (Excel Export)

**Scenario:** User exports from Excel with UTF-8 BOM

**CSV (hex):** `EF BB BF 6E 61 6D 65...` (BOM prefix)

**Expected Result:**
- ✅ Parser strips BOM before processing
- ✅ Import succeeds normally
- ✅ No "�" characters in parsed data

---

### 3.5 Duplicate Names in CSV

**Scenario:** CSV contains multiple rows with same name

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Assistant","Help 1","openai","gpt-4o"
"Assistant","Help 2","openai","gpt-4o"
"Assistant","Help 3","openai","gpt-4o"
```

**Expected Result:**
- ✅ First "Assistant" creates agent with slug `assistant`
- ✅ Second "Assistant" fails (name not unique in org)
- ✅ Third "Assistant" fails (name not unique in org)
- ✅ Summary: `{ created: 1, failed: 2 }`
- ⚠️ Warning: `"Duplicate names detected in CSV: Assistant (appears 3 times)"`

**Alternative Behavior (Phase 2):**
- Auto-append suffix to names: "Assistant", "Assistant (2)", "Assistant (3)"

---

### 3.6 Empty CSV File

**Scenario:** User uploads empty CSV file

**CSV:**
```
(empty file)
```

**Expected Result:**
- ✅ HTTP 400 error
- ✅ Error: `"CSV must have a header row and at least one data row"`

---

### 3.7 CSV with Only Header Row

**Scenario:** CSV has headers but no data

**CSV:**
```csv
name,instructions,modelProvider,modelName
```

**Expected Result:**
- ✅ HTTP 400 error
- ✅ Error: `"CSV must have at least one data row"`

---

### 3.8 CSV with Extra Columns

**Scenario:** CSV contains columns not in schema

**CSV:**
```csv
name,instructions,modelProvider,modelName,customField,anotherField
"Agent","Help","openai","gpt-4o","custom value","another value"
```

**Expected Result:**
- ✅ Import succeeds
- ✅ Extra columns ignored
- ✅ Agent created with standard fields only
- ⚠️ Optional: Warning about unknown columns

---

### 3.9 CSV with Missing Optional Columns

**Scenario:** CSV omits optional columns

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent","Help","openai","gpt-4o"
```

**Expected Result:**
- ✅ Agent created with default values
- ✅ `temperature`: 0.7 (default)
- ✅ `maxSteps`: 5 (default)
- ✅ `visibility`: "PRIVATE" (default)
- ✅ `isActive`: true (default)

---

### 3.10 Export → Import Roundtrip

**Scenario:** Export agents, then re-import to different workspace

**Steps:**
1. Export 10 agents from Workspace A
2. Switch to Workspace B
3. Import the same CSV

**Expected Result:**
- ✅ All 10 agents created in Workspace B
- ✅ New slugs generated (workspace-scoped uniqueness)
- ✅ Tool/skill references validated against Workspace B
- ✅ Original Workspace A agents unchanged

---

## 4. Authorization & Security Test Scenarios

### 4.1 Unauthorized Export Attempt

**Scenario:** User not authenticated tries to export

**Steps:**
1. Send request to `/api/agents/export` without session/API key

**Expected Result:**
- ✅ HTTP 401 Unauthorized
- ✅ Error: `"Unauthorized"`
- ✅ No data returned

---

### 4.2 Export from Workspace Without Access

**Scenario:** User tries to export agents from workspace they're not a member of

**Steps:**
1. User A (org "acme") tries to export from workspace owned by org "other-corp"

**Expected Result:**
- ✅ HTTP 403 Forbidden
- ✅ Error: `"Not a member of this organization"`
- ✅ No data leaked

---

### 4.3 Import Without Create Permission

**Scenario:** User with `viewer` role tries to import

**Setup:**
- User has `viewer` role (can read, but not create)

**Steps:**
1. Upload valid CSV
2. Try to import

**Expected Result:**
- ✅ HTTP 403 Forbidden
- ✅ Error: `"Insufficient permissions: 'viewer' role cannot 'create'"`

---

### 4.4 Overwrite Without Update Permission

**Scenario:** User with `viewer` role tries to overwrite

**Steps:**
1. Upload CSV with existing agent names
2. Select mode: "overwrite"
3. Try to import

**Expected Result:**
- ✅ HTTP 403 Forbidden
- ✅ Error: `"Insufficient permissions: 'viewer' role cannot 'update'"`

---

### 4.5 CSV Injection Attack (Formula)

**Scenario:** Malicious CSV with Excel formula injection

**CSV:**
```csv
name,instructions,modelProvider,modelName
"=1+1","You are helpful","openai","gpt-4o"
"=cmd|'/c calc'!A1","Be evil","openai","gpt-4o"
"+1234567890","Call this number","openai","gpt-4o"
```

**Expected Result:**
- ✅ All rows fail validation
- ✅ Error: `"Potential CSV injection detected. Remove formulas from name."`
- ✅ No agents created
- ✅ Attack prevented

**Export Mitigation:**
- ✅ On export, prepend `'` to formulas: `"'=1+1"`
- ✅ Excel treats as literal text, not formula

---

### 4.6 Rate Limiting

**Scenario:** User exceeds rate limit

**Setup:**
- Rate limit: 30 requests per minute
- User already made 30 agent operations in last minute

**Steps:**
1. Try to import CSV

**Expected Result:**
- ✅ HTTP 429 Too Many Requests
- ✅ Error: `"Rate limit exceeded. Try again in X seconds."`
- ✅ No import processed

---

### 4.7 File Size Limit

**Scenario:** User uploads CSV >10MB

**CSV:** 11MB file with 10,000 agents

**Expected Result:**
- ✅ HTTP 413 Payload Too Large
- ✅ Error: `"File exceeds size limit of 10MB"`
- ✅ No processing attempted

---

### 4.8 Row Count Limit

**Scenario:** CSV contains >1000 rows

**CSV:** 1,500 agents

**Expected Result:**
- ✅ HTTP 400 Bad Request
- ✅ Error: `"CSV exceeds maximum of 1000 rows"`
- ✅ Suggestion: `"Consider splitting into multiple files or contact support for bulk import assistance."`

---

## 5. Validation Test Scenarios

### 5.1 Missing Required Column

**Scenario:** CSV missing "instructions" column

**CSV:**
```csv
name,modelProvider,modelName
"Agent 1","openai","gpt-4o"
```

**Expected Result:**
- ✅ HTTP 400 error (file-level, abort import)
- ✅ Error: `"Missing required columns: instructions"`

---

### 5.2 Invalid Model Provider

**Scenario:** Model provider not supported

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent","Help","invalid-provider","some-model"
```

**Expected Result:**
- ✅ Row fails validation
- ✅ Error: `"Model provider 'invalid-provider' is not supported"`
- ✅ Suggestion: `"Supported providers: openai, anthropic, google, groq, ..."`

---

### 5.3 Model Name Typo with Suggestion

**Scenario:** User typos model name

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent","Help","openai","gpt-4o-minni"
```

**Expected Result:**
- ✅ Row fails validation
- ✅ Error: `"Model 'gpt-4o-minni' not found for provider 'openai'"`
- ✅ Suggestion: `"Did you mean: gpt-4o-mini?"` (Levenshtein distance)

---

### 5.4 Invalid Temperature Range

**Scenario:** Temperature outside valid range

**CSV:**
```csv
name,instructions,modelProvider,modelName,temperature
"Agent","Help","openai","gpt-4o",3.5
```

**Expected Result:**
- ✅ Agent created with temperature clamped or default used
- ⚠️ Warning: `"Row 1: Temperature 3.5 outside recommended range [0, 2]. Using 0.7."`

**Alternative:** Fail row with error (stricter validation)

---

### 5.5 Malformed CSV (Unclosed Quotes)

**Scenario:** CSV has syntax error

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent,"Help","openai","gpt-4o"
```

**Expected Result:**
- ✅ HTTP 400 error (file-level)
- ✅ Error: `"Invalid CSV format: Unclosed quote at line 2"`

---

### 5.6 Empty Name Field

**Scenario:** Agent name is empty string

**CSV:**
```csv
name,instructions,modelProvider,modelName
"","You are helpful","openai","gpt-4o"
```

**Expected Result:**
- ✅ Row fails validation
- ✅ Error: `"Name is required"`

---

### 5.7 Whitespace-Only Name

**Scenario:** Agent name is only whitespace

**CSV:**
```csv
name,instructions,modelProvider,modelName
"   ","You are helpful","openai","gpt-4o"
```

**Expected Result:**
- ✅ Row fails validation
- ✅ Error: `"Name is required"`

---

## 6. Performance Test Scenarios

### 6.1 Export 100 Agents

**Setup:** Workspace with 100 agents

**Steps:**
1. Export all agents with tools

**Expected Result:**
- ✅ Response time: <2 seconds (p95)
- ✅ CSV file size: ~500KB - 2MB
- ✅ All agents included
- ✅ No timeout errors

---

### 6.2 Import 50 Agents (Sequential)

**Setup:** CSV with 50 valid agents

**Steps:**
1. Import with default settings

**Expected Result:**
- ✅ Response time: <5 seconds (p95)
- ✅ All agents created
- ✅ No database connection pool exhaustion

---

### 6.3 Import 100 Agents

**Setup:** CSV with 100 valid agents

**Expected Result:**
- ✅ Response time: <10 seconds (p95)
- ✅ All agents created
- ✅ Database handles load

---

### 6.4 Import 1000 Agents (Limit)

**Setup:** CSV with exactly 1000 agents

**Expected Result:**
- ✅ Import succeeds (at limit)
- ✅ Response time: <60 seconds
- ⚠️ Consider background job for Phase 3

---

### 6.5 Import 1001 Agents (Over Limit)

**Setup:** CSV with 1001 agents

**Expected Result:**
- ✅ HTTP 400 error
- ✅ Error: `"CSV exceeds maximum of 1000 rows"`
- ✅ No import processed

---

### 6.6 Concurrent Imports

**Scenario:** Same user imports two CSVs simultaneously

**Setup:**
- Upload CSV A (50 agents)
- Upload CSV B (50 agents) before A completes

**Expected Result:**
- ✅ Rate limiting may throttle second request
- ✅ Both imports process correctly (no race conditions)
- ✅ No duplicate agents created

---

## 7. Integration Test Scenarios

### 7.1 Import → Execute Agent

**Scenario:** Import agent, then execute it

**Steps:**
1. Import agent with tools: `["calculator"]`
2. Navigate to agent chat UI
3. Send message: "What is 2+2?"

**Expected Result:**
- ✅ Agent responds correctly using calculator tool
- ✅ Tool is available at runtime

---

### 7.2 Export → Modify → Import (Update Workflow)

**Scenario:** Export, edit CSV, re-import with overwrite

**Steps:**
1. Export agent "Assistant" (version 1)
2. Edit CSV: Change instructions
3. Import with mode: "overwrite"

**Expected Result:**
- ✅ Agent updated to version 2
- ✅ AgentVersion snapshot created
- ✅ Instructions updated
- ✅ Version history accessible in UI

---

### 7.3 Import with SubAgents References

**Scenario:** Agent references other agents as subAgents

**CSV:**
```csv
name,instructions,modelProvider,modelName,subAgents
"Manager","Delegate tasks","openai","gpt-4o","researcher;analyst"
"Researcher","Research topics","openai","gpt-4o",""
"Analyst","Analyze data","openai","gpt-4o",""
```

**Steps:**
1. Import all three agents

**Expected Result:**
- ✅ All three created
- ✅ "Manager" has `subAgents: ["researcher", "analyst"]`
- ⚠️ If "researcher" or "analyst" don't exist yet, references are still stored (validation in Phase 2)

---

### 7.4 Import with Workflows References

**Scenario:** Agent references workflows

**CSV:**
```csv
name,instructions,modelProvider,modelName,workflows
"Approver","Approve requests","openai","gpt-4o","approval-workflow"
```

**Expected Result:**
- ✅ Agent created
- ✅ `workflows: ["approval-workflow"]`
- ⚠️ If workflow doesn't exist, stored as-is (validation in Phase 2)

---

## 8. Multi-Tenancy Test Scenarios

### 8.1 Import to Different Workspaces

**Scenario:** Same user imports to two different workspaces

**Setup:**
- User is member of Workspace A and Workspace B

**Steps:**
1. Import CSV to Workspace A
2. Import same CSV to Workspace B

**Expected Result:**
- ✅ Agents created in both workspaces independently
- ✅ Workspace A agents have slugs: `agent-1`, `agent-2`
- ✅ Workspace B agents have slugs: `agent-1`, `agent-2` (duplicate slugs OK across workspaces)
- ✅ No cross-workspace interference

---

### 8.2 Export Respects Organization Boundaries

**Scenario:** User exports agents, only sees agents in their org

**Setup:**
- Organization "acme" has 10 agents
- Organization "other-corp" has 20 agents
- User is member of "acme" only

**Steps:**
1. Export agents (no workspace filter)

**Expected Result:**
- ✅ CSV contains 10 agents from "acme"
- ✅ 20 agents from "other-corp" not included
- ✅ No data leakage

---

### 8.3 Slug Uniqueness Per Workspace

**Scenario:** Slug collision only checked within workspace

**Setup:**
- Workspace A has agent with slug "assistant"
- Workspace B has no agents

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Assistant","Help","openai","gpt-4o"
```

**Steps:**
1. Import to Workspace A with mode: "skip"
2. Import to Workspace B

**Expected Result:**
- ✅ Workspace A: Row skipped (slug exists)
- ✅ Workspace B: Agent created with slug "assistant" (no collision)

---

## 9. Error Recovery Test Scenarios

### 9.1 Partial Import Failure

**Scenario:** Import fails halfway through

**CSV:** 100 agents, row 50 causes database error

**Expected Result:**
- ✅ Rows 1-49 created successfully
- ✅ Row 50 fails
- ✅ Rows 51-100 continue processing
- ✅ Final summary: `{ created: 99, failed: 1 }`
- ✅ User can fix row 50 and re-import (will skip 1-49)

---

### 9.2 Database Connection Loss During Import

**Scenario:** Database connection drops mid-import

**Expected Result:**
- ✅ Import fails with 500 error
- ✅ Partial agents may be created (depends on transaction boundaries)
- ✅ Error logged for debugging
- ✅ User can retry (idempotent with skip mode)

---

### 9.3 Model Validation API Timeout

**Scenario:** OpenAI API times out during model validation

**Expected Result:**
- ✅ Validation fails gracefully
- ✅ Row marked as failed with error: `"Model validation timed out"`
- ✅ Other rows continue processing

---

## 10. UI/UX Test Scenarios

### 10.1 Export Button Disabled State

**Scenario:** User has no agents in workspace

**Expected Behavior:**
- ✅ Export button is enabled (exports empty CSV)
- OR
- ✅ Export button shows tooltip: "No agents to export"

---

### 10.2 Import Progress Indication

**Scenario:** Large import takes 10 seconds

**Expected UX:**
- ✅ Import button shows loading state: "Importing..."
- ✅ Button is disabled during import
- ✅ User cannot start another import simultaneously

---

### 10.3 Results Display Filtering

**Scenario:** Import has mixed results (50 created, 10 failed)

**Expected UX:**
- ✅ Tabs: "All (60)", "Created (50)", "Failed (10)"
- ✅ Click "Failed" tab shows only failed rows
- ✅ Failed rows show error messages
- ✅ User can export failed rows for fixing

---

### 10.4 Template Download

**Scenario:** New user clicks "Download CSV template"

**Expected Result:**
- ✅ CSV file downloads: `agents-template.csv`
- ✅ Contains header row + 2-3 example rows
- ✅ Example rows have realistic data
- ✅ Comments/descriptions in CSV explain each column

---

## 11. Cross-Browser Test Scenarios

### 11.1 Chrome Export

**Browser:** Chrome 120+

**Expected:**
- ✅ CSV downloads correctly
- ✅ Filename preserved

---

### 11.2 Safari Export

**Browser:** Safari 17+

**Expected:**
- ✅ CSV downloads correctly
- ✅ UTF-8 encoding preserved

---

### 11.3 Firefox Import

**Browser:** Firefox 120+

**Expected:**
- ✅ File picker works
- ✅ Import succeeds
- ✅ Results display correctly

---

## 12. Excel Compatibility Test Scenarios

### 12.1 Export → Open in Excel

**Steps:**
1. Export agents to CSV
2. Open in Microsoft Excel

**Expected Result:**
- ✅ All columns display correctly
- ✅ Special characters preserved (quotes, commas)
- ✅ Multiline instructions preserved
- ✅ No encoding issues (use UTF-8 with BOM)

---

### 12.2 Edit in Excel → Import

**Steps:**
1. Export agents to CSV
2. Open in Excel
3. Edit some fields
4. Save as CSV (UTF-8)
5. Import back

**Expected Result:**
- ✅ Import succeeds with updates
- ✅ Changed fields updated
- ✅ Unchanged fields preserved

---

### 12.3 Export → Open in Google Sheets

**Steps:**
1. Export agents to CSV
2. Upload to Google Sheets
3. Edit and download as CSV
4. Import back

**Expected Result:**
- ✅ Round-trip preserves data
- ✅ No encoding corruption

---

## 13. Regression Test Scenarios

### 13.1 Existing Agent CRUD Unaffected

**Scenario:** Verify existing API endpoints still work

**Steps:**
1. Create agent via `POST /api/agents`
2. Update agent via `PUT /api/agents/[id]`
3. Delete agent via `DELETE /api/agents/[id]`

**Expected Result:**
- ✅ All operations succeed
- ✅ No regressions introduced by bulk import/export code

---

### 13.2 Agent Execution Unaffected

**Scenario:** Verify imported agents execute correctly

**Steps:**
1. Import agent via CSV
2. Execute agent via `/api/agents/[slug]/execute`

**Expected Result:**
- ✅ Agent executes normally
- ✅ Tools are available
- ✅ No runtime errors

---

### 13.3 Agent UI Unaffected

**Scenario:** Verify agent configuration UI still works

**Steps:**
1. Import agent via CSV
2. Navigate to `/agents/[slug]/configure`
3. Edit agent configuration
4. Save changes

**Expected Result:**
- ✅ Configuration UI loads correctly
- ✅ All fields editable
- ✅ Updates save successfully

---

## 14. Stress Test Scenarios

### 14.1 Maximum Field Lengths

**Scenario:** All fields at maximum allowed length

**CSV:**
- name: 255 characters
- description: 1000 characters
- instructions: 50,000 characters
- tools: 100 tool IDs

**Expected Result:**
- ✅ Agent created successfully
- ✅ All fields stored completely
- ✅ Export regenerates same data

---

### 14.2 Special Character Torture Test

**Scenario:** Names/instructions with all CSV special chars

**CSV:**
```csv
name,instructions,modelProvider,modelName
"Agent with , comma","Instructions with ""quotes"" and, commas
and newlines","openai","gpt-4o"
```

**Expected Result:**
- ✅ Agent created with exact text
- ✅ Export → Import round-trip preserves data

---

### 14.3 Concurrent Exports

**Scenario:** 10 users export simultaneously

**Setup:**
- 10 users in same organization
- Each exports their workspace

**Expected Result:**
- ✅ All exports succeed
- ✅ No data corruption
- ✅ Each user gets their own workspace's agents

---

## 15. Accessibility Test Scenarios

### 15.1 Keyboard Navigation

**Steps:**
1. Tab to "Export to CSV" button
2. Press Enter
3. Tab to "Import from CSV" button
4. Press Enter to open dialog

**Expected Result:**
- ✅ All buttons accessible via keyboard
- ✅ Dialog opens on Enter
- ✅ File picker accessible

---

### 15.2 Screen Reader Compatibility

**Steps:**
1. Use NVDA/JAWS screen reader
2. Navigate to agent list page
3. Hear "Export to CSV" button announced
4. Activate button

**Expected Result:**
- ✅ Button labels announced clearly
- ✅ File download announced
- ✅ Error messages readable by screen reader

---

## 16. Mobile Test Scenarios

### 16.1 Export on Mobile

**Device:** iPhone/Android

**Steps:**
1. Navigate to `/agents` on mobile browser
2. Tap "Export to CSV"

**Expected Result:**
- ✅ CSV downloads to device
- ✅ Button tap area adequate (44x44px min)

---

### 16.2 Import on Mobile

**Device:** iPhone/Android

**Expected Behavior:**
- ⚠️ File picker may be limited on mobile
- ✅ If file selected, import proceeds normally
- ✅ Results display readable on small screen

---

## 17. Localization Test Scenarios (Future)

### 17.1 Non-English Characters

**CSV:**
```csv
name,instructions,modelProvider,modelName
"エージェント","日本語の指示","openai","gpt-4o"
"代理人","中文说明","anthropic","claude-sonnet-4-5-20250929"
```

**Expected Result:**
- ✅ Agent created with Unicode preserved
- ✅ Slug generated: `エージェント` or ASCII fallback
- ✅ Export preserves Unicode

---

### 17.2 RTL Languages (Arabic, Hebrew)

**CSV:**
```csv
name,instructions,modelProvider,modelName
"وكيل","أنت مساعد مفيد","openai","gpt-4o"
```

**Expected Result:**
- ✅ Text stored correctly
- ✅ UI displays RTL text properly
- ✅ Export preserves text direction

---

## 18. Regression Prevention Test Scenarios

### 18.1 Activity Feed Integration

**Scenario:** Verify bulk operations logged

**Steps:**
1. Export 50 agents
2. Import 20 agents
3. Check activity feed

**Expected Result:**
- ✅ Activity entry: "Exported 50 agents to CSV"
- ✅ Activity entries: 20× "Agent 'X' created via bulk import"
- OR single entry: "Imported 20 agents from CSV"

---

### 18.2 Agent Version History

**Scenario:** Overwrite mode creates versions

**Steps:**
1. Create agent "Assistant" (version 1)
2. Export agents
3. Modify "Assistant" instructions in CSV
4. Import with mode: "overwrite"
5. Navigate to `/agents/assistant/versions`

**Expected Result:**
- ✅ Version 1 visible in history
- ✅ Version 2 created with changes
- ✅ Diff shows instruction changes
- ✅ Can rollback to version 1

---

## 19. Test Data Fixtures

### Fixture 1: Minimal Valid CSV
```csv
name,instructions,modelProvider,modelName
"Test Agent","You are helpful","openai","gpt-4o"
```

### Fixture 2: Full Configuration
```csv
name,description,instructions,instructionsTemplate,modelProvider,modelName,temperature,maxTokens,maxSteps,memoryEnabled,tools,subAgents,workflows,visibility,isActive
"Support Agent","Handles support tickets","You help customers with their questions","Hello {{userName}}, how can I assist?","openai","gpt-4o",0.7,2048,5,true,"web-search;gmail-send-email;calculator","","","ORGANIZATION",true
```

### Fixture 3: Invalid Models
```csv
name,instructions,modelProvider,modelName
"Agent 1","Help","openai","gpt-5o"
"Agent 2","Help","anthropic","claude-invalid"
"Agent 3","Help","invalid-provider","some-model"
```

### Fixture 4: Special Characters
```csv
name,instructions,modelProvider,modelName
"Agent with ""quotes""","Instructions with, commas","openai","gpt-4o"
"Agent with
newlines","Multiline
instructions","anthropic","claude-sonnet-4-5-20250929"
```

### Fixture 5: CSV Injection Attempt
```csv
name,instructions,modelProvider,modelName
"=1+1","You are helpful","openai","gpt-4o"
"=cmd|'/c calc'!A1","Be evil","openai","gpt-4o"
"+1234567890","Call this","openai","gpt-4o"
```

---

## 20. Acceptance Test Checklist

**Phase 1 MVP Acceptance:**
- [ ] Export 100 agents in <2 seconds
- [ ] Import 50 agents in <5 seconds
- [ ] Validation report shows per-row status
- [ ] Skip mode handles conflicts correctly
- [ ] Tool validation works (valid/invalid/unavailable)
- [ ] Model validation works with suggestions
- [ ] Authorization enforced on both endpoints
- [ ] Rate limiting applied
- [ ] CSV special characters handled (quotes, commas, newlines)
- [ ] CSV injection prevented
- [ ] Activity feed records created
- [ ] UI shows results table
- [ ] Template download works
- [ ] Round-trip (export → import) preserves data
- [ ] No data leakage between organizations
- [ ] No regression in existing agent APIs

**Phase 2 Acceptance:**
- [ ] Skill export/import works
- [ ] JSON fields serialized correctly
- [ ] Overwrite mode creates version history
- [ ] Version mode increments version
- [ ] Large imports (200+ agents) complete
- [ ] Export filtering works (type, visibility, IDs)

**Phase 3 Acceptance:**
- [ ] Background import processes 1000+ agents
- [ ] Import history tracked and viewable
- [ ] Scheduled exports work
- [ ] Import preview shows parsed data

---

## 21. Manual Testing Script

**Test Session:** 30 minutes

**Prerequisites:**
- Staging environment with test data
- Test user with `admin` role
- Browser: Chrome latest

**Steps:**

1. **Export Test (5 min)**
   - [ ] Navigate to `/agents`
   - [ ] Click "Export to CSV"
   - [ ] Verify download
   - [ ] Open CSV in Excel
   - [ ] Check data integrity

2. **Template Test (2 min)**
   - [ ] Click "Import from CSV"
   - [ ] Click "Download template"
   - [ ] Open template in Excel
   - [ ] Verify example rows

3. **Import Happy Path (5 min)**
   - [ ] Create CSV with 3 new agents
   - [ ] Upload CSV
   - [ ] Select mode: "skip"
   - [ ] Click "Import"
   - [ ] Verify results display
   - [ ] Check agents created in UI

4. **Import with Errors (5 min)**
   - [ ] Create CSV with invalid model
   - [ ] Import CSV
   - [ ] Verify error message shown
   - [ ] Verify suggestion provided

5. **Import Skip Mode (5 min)**
   - [ ] Export existing agents
   - [ ] Re-import same CSV
   - [ ] Verify all rows skipped
   - [ ] Check existing agents unchanged

6. **Import Overwrite Mode (5 min)**
   - [ ] Export existing agent
   - [ ] Modify instructions in CSV
   - [ ] Import with mode: "overwrite"
   - [ ] Verify agent updated
   - [ ] Check version history

7. **Authorization Test (3 min)**
   - [ ] Logout
   - [ ] Try to export (expect 401)
   - [ ] Login as viewer
   - [ ] Try to import (expect 403)

---

## 22. QA Sign-Off Criteria

**Phase 1 can be released when:**
- ✅ All happy path tests pass
- ✅ All error condition tests pass
- ✅ All security tests pass
- ✅ No critical bugs
- ✅ Performance targets met
- ✅ Cross-browser testing complete
- ✅ Accessibility audit complete
- ✅ Documentation complete
- ✅ Code review approved

---

## 23. Known Limitations (Phase 1)

**Documented Limitations:**
1. Max 1000 rows per import
2. No JSON field support (modelConfig, routingConfig, etc.)
3. No skill import/export
4. No custom AgentTool config import
5. Tool/skill references not validated for existence (warnings only)
6. SubAgents/workflows references not validated
7. No import preview (applied immediately)
8. No progress indication for slow imports
9. No background job support (synchronous only)
10. No import history tracking

**These are acceptable for MVP and addressed in Phase 2-3.**

---

## 24. Bug Report Template (For QA)

**Title:** [Import/Export] Brief description

**Environment:**
- Platform: AgentC2
- Feature: Bulk Agent Import/Export
- Phase: 1 (MVP)
- Build: [commit hash]

**Reproduction Steps:**
1. 
2. 
3. 

**Expected Result:**


**Actual Result:**


**Severity:** Critical / High / Medium / Low

**CSV Sample:** (attach or paste)

**Error Message:** (if any)

**Screenshots:** (if applicable)

**Workaround:** (if known)

---

**Test Scenarios Document Version:** 1.0  
**Last Updated:** 2026-03-11  
**Total Scenarios:** 60+  
**Status:** Ready for QA Planning
