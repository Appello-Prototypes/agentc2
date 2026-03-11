# Technical Design: Bulk Agent Import/Export via CSV

**Feature Request ID:** [GitHub Issue #101](https://github.com/Appello-Prototypes/agentc2/issues/101)  
**Priority:** Medium | **Scope:** High  
**Design Date:** 2026-03-11  
**Status:** Draft for Review

---

## Executive Summary

This design proposes a CSV-based bulk import/export system for agent configurations, targeting users managing 50+ agents who need efficient ways to:
- Export agent configurations for backup, analysis, or migration
- Bulk import agents from spreadsheets or external systems
- Get validation feedback on import success/failure per row

The solution leverages existing patterns from the test-case export system, document upload handling, and playbook bulk deployment, while respecting multi-tenancy boundaries and authorization controls.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model Analysis](#2-data-model-analysis)
3. [API Design](#3-api-design)
4. [CSV Schema Specification](#4-csv-schema-specification)
5. [Validation Strategy](#5-validation-strategy)
6. [UI/UX Design](#6-uiux-design)
7. [Authorization & Security](#7-authorization--security)
8. [Error Handling & Reporting](#8-error-handling--reporting)
9. [Impact Assessment](#9-impact-assessment)
10. [Phased Implementation Plan](#10-phased-implementation-plan)
11. [Testing Strategy](#11-testing-strategy)
12. [Open Questions](#12-open-questions)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend UI                             │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Export Button    │  │ Import Button    │                    │
│  │ (Downloads CSV)  │  │ (Upload CSV)     │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
└───────────┼────────────────────┼──────────────────────────────┘
            │                    │
            ▼                    ▼
┌───────────────────────────────────────────────────────────────┐
│                      API Layer                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  GET /api/agents/export                                │  │
│  │  • Fetches agents from database                         │  │
│  │  • Includes tools, skills (optional)                    │  │
│  │  • Generates CSV with proper escaping                   │  │
│  │  • Returns file download                                │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  POST /api/agents/import                                │  │
│  │  • Parses CSV file (multipart/form-data)               │  │
│  │  • Validates each row                                   │  │
│  │  • Creates/updates agents in transaction               │  │
│  │  • Returns validation report                            │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────┬───────────────────────────┬───────────────────────┘
            │                           │
            ▼                           ▼
┌─────────────────────────┐   ┌────────────────────────────────┐
│  Validation Services    │   │  Database Layer (Prisma)       │
│  • Model validation     │   │  • Agent table                 │
│  • Tool validation      │   │  • AgentTool junction table    │
│  • Skill validation     │   │  • AgentSkill junction table   │
│  • Slug uniqueness      │   │  • AgentVersion table          │
│  • Name uniqueness      │   │  • Activity feed               │
└─────────────────────────┘   └────────────────────────────────┘
```

### 1.2 Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Export API** | `apps/agent/src/app/api/agents/export/route.ts` | Generate CSV from database agents |
| **Import API** | `apps/agent/src/app/api/agents/import/route.ts` | Parse CSV and create/update agents |
| **CSV Parser** | `packages/agentc2/src/agents/csv-parser.ts` | Parse CSV with proper escaping/unescaping |
| **CSV Generator** | `packages/agentc2/src/agents/csv-generator.ts` | Generate CSV from agent records |
| **Import Validator** | `packages/agentc2/src/agents/import-validator.ts` | Validate import rows |
| **UI Component** | `apps/agent/src/components/AgentBulkActions.tsx` | Export/import UI |

### 1.3 Dependencies

- **Existing Systems:**
  - Agent CRUD APIs (`/api/agents`, `/api/agents/[id]`)
  - Model Registry (`@repo/agentc2/agents/model-registry`)
  - Tool Registry (`@repo/agentc2/tools/registry`)
  - Authorization (`requireAuth`, `requireEntityAccess`)
  - Rate Limiting (`checkRateLimit`)
  - Activity Feed (`recordActivity`)

- **New Dependencies:**
  - CSV parsing library (consider `papaparse` or custom parser based on `bim/csv-adapter`)
  - No database schema changes required

---

## 2. Data Model Analysis

### 2.1 Agent Model Fields

Based on `/packages/database/prisma/schema.prisma` (lines 815-951), the Agent model has:

#### **Core Identity Fields** (Required for CSV)
- `name` - Display name (must be unique within organization)
- `description` - Brief description
- `slug` - URL-safe identifier (auto-generated, workspace-unique)

#### **Instructions Fields**
- `instructions` - System prompt (required, TEXT field)
- `instructionsTemplate` - Template with placeholders like `{{userId}}`

#### **Model Configuration**
- `modelProvider` - Provider slug (e.g., "openai", "anthropic")
- `modelName` - Model identifier (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")
- `temperature` - Sampling temperature (default: 0.7)
- `maxTokens` - Max output tokens
- `modelConfig` - Provider-specific JSON config
- `routingConfig` - Model routing configuration (fast/escalation models)
- `contextConfig` - Context management settings

#### **Related Entities** (Junction Tables)
- `tools` - Via `AgentTool` table (many-to-many, stores `toolId` strings)
- `skills` - Via `AgentSkill` table (many-to-many, stores `skillId` references)
- `subAgents` - Array of agent slugs for delegation
- `workflows` - Array of workflow IDs

#### **Memory Configuration**
- `memoryEnabled` - Boolean flag
- `memoryConfig` - JSON configuration

#### **Multi-Tenancy** (Auto-populated, not in CSV)
- `workspaceId` - Required, determined by authenticated user
- `type` - Always "USER" for imported agents
- `visibility` - PRIVATE | ORGANIZATION | PUBLIC

#### **Metadata**
- `metadata` - Free-form JSON
- `isActive` - Boolean (default: true)
- `maxSteps` - Max agentic steps (default: 5)

### 2.2 Fields NOT Included in CSV

The following fields are auto-generated or not suitable for bulk import:
- `id` - Auto-generated CUID
- `slug` - Auto-generated from name with collision handling
- `workspaceId` - Determined from authenticated user context
- `ownerId` - Set to authenticated user
- `publicToken` - Generated only for PUBLIC visibility
- `version` - Starts at 1
- `isArchived`, `archivedAt` - Not relevant for new imports
- `isOnboardingAgent` - System flag
- `createdAt`, `updatedAt`, `createdBy` - Auto-populated
- Related records: `runs`, `traces`, `versions`, etc.

### 2.3 Junction Table Considerations

#### **AgentTool**
- Schema: `{ agentId, toolId, config? }`
- CSV Representation: Semicolon-separated string of tool IDs
- Example: `"calculator;web-fetch;memory-recall"`
- On import: Validate each toolId exists in `toolRegistry` or MCP tools

#### **AgentSkill**
- Schema: `{ agentId, skillId, pinned, pinnedVersion }`
- CSV Representation: Semicolon-separated skill slugs (optionally with pinning syntax)
- Example: `"research-assistant:pinned;data-analysis:discoverable"`
- On import: Resolve skill slugs to IDs within target workspace

### 2.4 Complex JSON Fields

Several fields are JSON and cannot be directly represented in CSV:
- `modelConfig`
- `routingConfig`
- `contextConfig`
- `memoryConfig`
- `metadata`

**Design Decision:** 
- **Phase 1 (MVP):** Exclude complex JSON fields from CSV
- **Phase 2 (Advanced):** Add JSON-serialized columns (e.g., `modelConfig_json`) or separate JSON export format

---

## 3. API Design

### 3.1 Export API

**Endpoint:** `GET /api/agents/export`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | `csv` \| `jsonl` | No | Output format (default: `csv`) |
| `workspaceId` | string | No | Filter by workspace (default: user's default workspace) |
| `includeTools` | boolean | No | Include tool IDs in export (default: `true`) |
| `includeSkills` | boolean | No | Include skill references (default: `false`) |
| `includeArchived` | boolean | No | Include archived agents (default: `false`) |
| `agentIds` | string | No | Comma-separated agent IDs to export (if omitted, exports all) |

**Authorization:**
- Requires valid session or API key
- User must have `read` permission via `requireEntityAccess()`
- Each agent must pass `requireAgentAccess()` check

**Response:**
- **Success (200):** CSV file download
  - Content-Type: `text/csv; charset=utf-8`
  - Content-Disposition: `attachment; filename="agents-{workspaceId}-{timestamp}.csv"`
- **Error (400):** Invalid parameters
- **Error (403):** Insufficient permissions
- **Error (500):** Server error

**Rate Limiting:**
- Apply `RATE_LIMIT_POLICIES.orgMutation` (30 requests per minute per org)

---

### 3.2 Import API

**Endpoint:** `POST /api/agents/import`

**Request Body:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | CSV file to import |
| `workspaceId` | string | No | Target workspace (default: user's default workspace) |
| `mode` | `skip` \| `overwrite` \| `version` | No | Conflict resolution strategy (default: `skip`) |
| `dryRun` | boolean | No | Validate only, don't commit (default: `false`) |
| `createSkills` | boolean | No | Auto-create missing skills as empty skills (default: `false`) |

**Conflict Resolution Modes:**
- `skip` - Skip agents with conflicting slugs (name-derived slug already exists)
- `overwrite` - Update existing agents with matching slugs
- `version` - Create new version of existing agents (increment version number)

**Authorization:**
- Requires valid session or API key
- User must have `create` permission for new agents
- User must have `update` permission for overwrite/version modes
- Rate limit: `RATE_LIMIT_POLICIES.orgMutation`

**Response (200):**
```json
{
  "success": true,
  "summary": {
    "totalRows": 50,
    "created": 42,
    "updated": 5,
    "skipped": 2,
    "failed": 1
  },
  "results": [
    {
      "row": 1,
      "status": "created",
      "agentId": "cuid...",
      "agentSlug": "customer-support",
      "agentName": "Customer Support Agent"
    },
    {
      "row": 2,
      "status": "failed",
      "error": "Invalid model: gpt-5o does not exist for provider openai",
      "suggestion": "Did you mean: gpt-4o?"
    },
    {
      "row": 3,
      "status": "skipped",
      "reason": "Agent with slug 'assistant' already exists (mode=skip)"
    }
  ],
  "warnings": [
    "Row 5: Tool 'hubspot_get-contacts' not available (missing API key or disabled)",
    "Row 12: Skill 'custom-research' not found in workspace, skipped"
  ]
}
```

**Response (400):** Validation errors (e.g., missing required columns, invalid CSV format)

**Response (403):** Insufficient permissions

**Response (429):** Rate limit exceeded

**Response (500):** Server error

---

## 4. CSV Schema Specification

### 4.1 Core Columns (Phase 1 MVP)

| Column Name | Type | Required | Max Length | Description | Example |
|-------------|------|----------|------------|-------------|---------|
| `name` | string | Yes | 255 | Agent display name (must be unique within org) | `"Customer Support Agent"` |
| `description` | string | No | 1000 | Brief description | `"Handles customer inquiries"` |
| `instructions` | text | Yes | 50000 | System prompt/instructions | `"You are a helpful..."` |
| `instructionsTemplate` | text | No | 50000 | Template with placeholders | `"Hello {{userName}}..."` |
| `modelProvider` | string | Yes | 50 | Provider slug | `"openai"` |
| `modelName` | string | Yes | 100 | Model identifier | `"gpt-4o"` |
| `temperature` | float | No | - | Sampling temperature (0.0-2.0) | `0.7` |
| `maxTokens` | integer | No | - | Max output tokens | `4096` |
| `maxSteps` | integer | No | - | Max agentic steps | `5` |
| `memoryEnabled` | boolean | No | - | Enable conversation memory | `true` |
| `tools` | string | No | 5000 | Semicolon-separated tool IDs | `"calculator;web-fetch"` |
| `subAgents` | string | No | 2000 | Semicolon-separated agent slugs | `"research;analyst"` |
| `workflows` | string | No | 2000 | Semicolon-separated workflow IDs | `"approval-flow"` |
| `visibility` | enum | No | - | PRIVATE \| ORGANIZATION \| PUBLIC | `"PRIVATE"` |
| `isActive` | boolean | No | - | Agent active status | `true` |

### 4.2 Advanced Columns (Phase 2)

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| `skills` | string | No | Semicolon-separated skill slugs with pinning syntax | `"research:pinned;data-analysis:discoverable"` |
| `modelConfig_json` | json | No | JSON-serialized model config | `"{\"reasoning\":{\"type\":\"enabled\"}}"` |
| `routingConfig_json` | json | No | JSON-serialized routing config | `"{\"mode\":\"auto\"}"` |
| `memoryConfig_json` | json | No | JSON-serialized memory config | `"{\"lastMessages\":10}"` |
| `metadata_json` | json | No | JSON-serialized metadata | `"{\"slack\":{\"displayName\":\"Bot\"}}"` |

### 4.3 CSV Format Rules

**Encoding:** UTF-8 with BOM for Excel compatibility

**Delimiter:** Comma (`,`)

**Quote Character:** Double quote (`"`)

**Escape Rule:** RFC 4180 - double quotes are escaped as `""`

**Line Endings:** CRLF (`\r\n`) for Windows compatibility, LF (`\n`) accepted

**Header Row:** Required, case-insensitive column matching

**Empty Values:**
- Empty string `""` - Treated as NULL/default
- Quoted empty string `""` - Same as above
- Missing column - Use default value

**Example CSV:**

```csv
name,description,instructions,modelProvider,modelName,temperature,tools,visibility
"Sales Assistant","Helps with sales inquiries","You are a sales agent focused on...","openai","gpt-4o",0.8,"web-search;calculator","ORGANIZATION"
"Research Agent","Conducts research","You are a research agent...","anthropic","claude-sonnet-4-5-20250929",0.7,"exa-research;memory-recall","PRIVATE"
```

**Multiline Instructions:** Supported via quoted fields
```csv
name,instructions
"Agent 1","You are an agent.
Your instructions span
multiple lines."
```

---

## 5. Validation Strategy

### 5.1 Validation Pipeline

Import validation occurs in stages with early exit on critical errors:

```
┌──────────────────────────────────────────────────┐
│ Stage 1: File & Format Validation               │
│ • File size < 10MB                               │
│ • Valid UTF-8 encoding                           │
│ • Valid CSV syntax (parseable)                   │
│ • Header row present                             │
│ • Required columns present                       │
└──────────────┬───────────────────────────────────┘
               │ ✓ Pass
               ▼
┌──────────────────────────────────────────────────┐
│ Stage 2: Row-Level Field Validation (Per Row)   │
│ • Required fields present (name, instructions,   │
│   modelProvider, modelName)                      │
│ • Field length limits enforced                   │
│ • Type coercion (temperature, maxTokens, etc.)   │
│ • Enum validation (visibility, modelProvider)    │
└──────────────┬───────────────────────────────────┘
               │ ✓ Pass
               ▼
┌──────────────────────────────────────────────────┐
│ Stage 3: Business Logic Validation (Per Row)    │
│ • Model exists in registry                       │
│ • Tools exist in registry                        │
│ • Skills exist in workspace                      │
│ • Name uniqueness within organization            │
│ • Slug collision detection (with resolution)     │
└──────────────┬───────────────────────────────────┘
               │ ✓ Pass (all rows or dryRun=true)
               ▼
┌──────────────────────────────────────────────────┐
│ Stage 4: Database Transaction                    │
│ • Create/update agents                           │
│ • Create AgentTool records                       │
│ • Create AgentSkill records                      │
│ • Create activity feed entries                   │
│ • (If overwrite) Create version snapshots        │
└──────────────────────────────────────────────────┘
```

### 5.2 Validation Rules

#### **Required Field Validation**
```typescript
const requiredColumns = ["name", "instructions", "modelProvider", "modelName"];
const missingColumns = requiredColumns.filter(col => !headers.includes(col));
if (missingColumns.length > 0) {
  throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
}
```

#### **Model Validation**
```typescript
const modelValidation = await validateModelSelection(
  modelProvider as ModelProvider,
  modelName,
  organizationId
);
if (!modelValidation.valid) {
  errors.push({
    row: rowIndex,
    field: "modelName",
    error: modelValidation.message,
    suggestion: modelValidation.suggestion
  });
}
```

#### **Tool Validation**
```typescript
const toolIds = row.tools?.split(";").map(t => t.trim()).filter(Boolean) || [];
const invalidTools: string[] = [];
const unavailableTools: string[] = [];

for (const toolId of toolIds) {
  const isStaticTool = hasToolInRegistry(toolId);
  const isMcpTool = toolId.includes("_"); // MCP tools: server_tool format
  
  if (!isStaticTool && !isMcpTool) {
    invalidTools.push(toolId);
  } else if (isMcpTool) {
    // Check if MCP tool is available for this org
    const mcpTools = await getAllMcpTools(organizationId);
    if (!mcpTools[toolId]) {
      unavailableTools.push(toolId);
    }
  }
}

if (invalidTools.length > 0) {
  errors.push({
    row: rowIndex,
    field: "tools",
    error: `Invalid tool IDs: ${invalidTools.join(", ")}`
  });
}

if (unavailableTools.length > 0) {
  warnings.push({
    row: rowIndex,
    field: "tools",
    message: `Tool(s) not available: ${unavailableTools.join(", ")}. These will be skipped.`
  });
}
```

#### **Name Uniqueness Validation**
```typescript
// Check against existing agents in organization
const existingAgent = await prisma.agent.findFirst({
  where: {
    name: row.name,
    workspace: { organizationId }
  }
});

if (existingAgent && mode === "skip") {
  return { status: "skipped", reason: "Name already exists" };
} else if (existingAgent && mode === "overwrite") {
  // Proceed with update
} else if (existingAgent && mode === "version") {
  // Create new version
}
```

#### **Slug Collision Handling**
```typescript
// Generate slug from name
const baseSlug = generateSlug(row.name);
const uniqueSlug = await generateUniqueAgentSlug(baseSlug, workspaceId);
// uniqueSlug may be "assistant-2" if "assistant" exists
```

### 5.3 Error Categorization

| Category | Severity | Behavior | Example |
|----------|----------|----------|---------|
| **Critical** | File-level | Abort entire import | Invalid CSV syntax, missing required columns |
| **Row Error** | Row-level | Skip row, continue | Invalid model name, missing required field |
| **Warning** | Advisory | Import proceeds, log warning | Tool not available, skill not found |

---

## 6. UI/UX Design

### 6.1 UI Integration Points

**Location:** `/apps/agent/src/app/agents/page.tsx` (Agent list page)

**New Component:** `AgentBulkActions` (rendered above agent list)

```tsx
<div className="flex gap-2 mb-4">
  <Button onClick={handleExport}>
    <DownloadIcon className="mr-2" />
    Export Agents to CSV
  </Button>
  <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
    <UploadIcon className="mr-2" />
    Import Agents from CSV
  </Button>
</div>
```

### 6.2 Export Flow

1. User clicks "Export Agents to CSV"
2. Optional: Filter dialog appears (workspace selection, include archived, etc.)
3. API call: `GET /api/agents/export?workspaceId=...&includeTools=true`
4. Browser downloads CSV file: `agents-{workspaceId}-{timestamp}.csv`
5. Success toast: "Exported 52 agents to CSV"

### 6.3 Import Flow

**Step 1: File Selection**
```tsx
<Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Import Agents from CSV</DialogTitle>
      <DialogDescription>
        Upload a CSV file with agent configurations. 
        <a href="/api/agents/export/template" className="underline">
          Download CSV template
        </a>
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      <Input type="file" accept=".csv" onChange={handleFileSelect} />
      
      <Select value={mode} onValueChange={setMode}>
        <SelectTrigger>
          <SelectValue placeholder="Conflict resolution" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="skip">Skip existing agents</SelectItem>
          <SelectItem value="overwrite">Overwrite existing</SelectItem>
          <SelectItem value="version">Create new version</SelectItem>
        </SelectContent>
      </Select>
      
      <div className="flex items-center space-x-2">
        <Checkbox id="dryRun" checked={dryRun} onCheckedChange={setDryRun} />
        <label htmlFor="dryRun">Dry run (validate only)</label>
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleImport} disabled={!file || importing}>
        {importing ? "Importing..." : "Import"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 2: Import Progress**
- Show loading spinner with "Importing agents..."
- API call: `POST /api/agents/import` with FormData

**Step 3: Results Display**
```tsx
<ImportResults>
  <div className="mb-4">
    <div className="text-lg font-semibold">
      Import Complete: {summary.created} created, {summary.updated} updated, 
      {summary.skipped} skipped, {summary.failed} failed
    </div>
  </div>
  
  <Tabs defaultValue="all">
    <TabsList>
      <TabsTrigger value="all">All ({results.length})</TabsTrigger>
      <TabsTrigger value="created">Created ({summary.created})</TabsTrigger>
      <TabsTrigger value="failed">Failed ({summary.failed})</TabsTrigger>
      <TabsTrigger value="skipped">Skipped ({summary.skipped})</TabsTrigger>
    </TabsList>
    
    <TabsContent value="all">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => (
            <TableRow key={result.row}>
              <TableCell>{result.row}</TableCell>
              <TableCell>{result.agentName}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(result.status)}>
                  {result.status}
                </Badge>
              </TableCell>
              <TableCell>
                {result.error || result.reason || result.agentSlug}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TabsContent>
    {/* Similar tabs for created/failed/skipped */}
  </Tabs>
  
  {warnings.length > 0 && (
    <Alert variant="warning" className="mt-4">
      <AlertTitle>Warnings ({warnings.length})</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </AlertDescription>
    </Alert>
  )}
</ImportResults>
```

### 6.4 CSV Template Download

**Endpoint:** `GET /api/agents/export/template`

Returns a minimal CSV with:
- Header row with all supported columns
- 2-3 example rows with realistic data
- Comments in description field explaining each column

---

## 7. Authorization & Security

### 7.1 Permission Requirements

| Operation | Required Permission | Additional Checks |
|-----------|---------------------|-------------------|
| **Export** | `read` (entity-level) | Each agent must pass `requireAgentAccess()` |
| **Import (create)** | `create` (entity-level) | None |
| **Import (overwrite)** | `update` (entity-level) | Each existing agent must pass `requireAgentAccess()` |
| **Import (version)** | `update` (entity-level) | Same as overwrite |

### 7.2 Multi-Tenancy Enforcement

**Critical Rules:**
1. All imported agents are scoped to authenticated user's `workspaceId`
2. Export only returns agents where user has access via `requireAgentAccess()`
3. Tool/skill references must exist in target workspace/organization
4. Slug uniqueness enforced per workspace (not globally)
5. Name uniqueness enforced per organization (not workspace)

### 7.3 Rate Limiting

Apply `RATE_LIMIT_POLICIES.orgMutation` (30 requests/minute) to both endpoints:

```typescript
const rateKey = `orgMutation:agentBulk:${organizationId}`;
const rate = await checkRateLimit(rateKey, RATE_LIMIT_POLICIES.orgMutation);
if (!rate.allowed) {
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}
```

**Consideration:** For very large imports (100+ agents), consider:
- Separate rate limit policy (e.g., `bulkImport: { windowMs: 5*60*1000, max: 3 }`)
- Background job processing via Inngest (Phase 3)

### 7.4 Security Considerations

**1. CSV Injection Prevention**
- Sanitize formula-like values (starting with `=`, `+`, `-`, `@`)
- Prepend single quote (`'`) to escape formulas in exported CSV
- Warn user if imported CSV contains potential formulas

**2. File Size Limits**
- Max upload: 10MB (consistent with document upload)
- Max rows: 1000 agents per import (prevents DoS)
- Max field length: Enforce schema limits (instructions: 50k chars)

**3. Data Leakage Prevention**
- Never export `publicToken` or internal IDs
- Never export API keys from `metadata` JSON fields
- Sanitize error messages (don't expose internal paths/queries)

**4. Input Validation**
- Use Zod schemas for type safety
- Escape all user input before database insertion
- Validate enum values against allowlist

---

## 8. Error Handling & Reporting

### 8.1 Error Types

| Error Type | HTTP Status | User Message | Developer Log |
|------------|-------------|--------------|---------------|
| **Invalid CSV Format** | 400 | "Invalid CSV file. Please check formatting." | Full parse error |
| **Missing Required Column** | 400 | "Missing required column: 'instructions'" | Column list |
| **Invalid Model** | Row-level | "Model 'gpt-5' not found for OpenAI" | Model validation failure |
| **Tool Not Found** | Warning | "Tool 'custom-tool' not found, skipped" | Tool resolution failure |
| **Permission Denied** | 403 | "You don't have permission to create agents" | RBAC check failure |
| **Rate Limit** | 429 | "Too many requests. Try again in 1 minute." | Rate limit breach |
| **Database Error** | 500 | "Import failed. Please contact support." | Full error stack |

### 8.2 Partial Success Handling

**Philosophy:** Continue processing on row-level errors, fail fast on file-level errors.

**Example Scenario:**
- CSV has 50 rows
- Rows 1-40 succeed
- Row 41 fails (invalid model)
- Rows 42-50 continue processing
- Final response: 49 created, 1 failed

**Transaction Strategy:**
- **Per-agent transactions** (not single transaction for all)
- If agent creation succeeds but tool association fails, roll back that agent
- Return detailed per-row status

### 8.3 Validation Report Structure

```typescript
interface ImportResult {
  success: boolean;
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    warnings: number;
  };
  results: RowResult[];
  warnings: string[];
  errors?: string[]; // File-level errors
}

interface RowResult {
  row: number; // 1-indexed row number (excluding header)
  status: "created" | "updated" | "skipped" | "failed";
  agentId?: string; // CUID of created/updated agent
  agentSlug?: string;
  agentName?: string;
  error?: string; // Error message for failed rows
  reason?: string; // Reason for skipped rows
  suggestion?: string; // Suggestion for fixing errors
  warnings?: string[]; // Row-specific warnings
}
```

---

## 9. Impact Assessment

### 9.1 Affected Systems

| System | Impact Level | Changes Required |
|--------|--------------|------------------|
| **Agent API** | Medium | New export/import routes |
| **Database** | None | No schema changes |
| **Authorization** | Low | Reuse existing authz helpers |
| **UI** | Medium | New bulk actions component |
| **Tool Registry** | Low | Validation helper functions |
| **Model Registry** | Low | Reuse existing validation |
| **Activity Feed** | Low | Record bulk import activity |
| **Rate Limiting** | Low | Apply existing policies |

### 9.2 Backward Compatibility

✅ **Fully Backward Compatible**
- No breaking changes to existing APIs
- No database migrations required
- Existing agent CRUD operations unaffected
- New endpoints are additive

### 9.3 Performance Considerations

**Export Performance:**
- Query optimization: Single query with `include: { tools: true, skills: true }`
- Expected latency: ~500ms for 100 agents, ~2s for 1000 agents
- Memory: ~1MB per 100 agents in CSV format
- Bottleneck: Database query, CSV generation (CPU-bound)

**Import Performance:**
- Expected latency: ~50ms per agent (validation + DB insert)
- For 100 agents: ~5 seconds total
- For 1000 agents: ~50 seconds (consider background job)
- Bottleneck: Model validation API calls (cached), database inserts

**Optimization Strategies:**
- Batch model validation (validate unique provider/model pairs once)
- Cache tool registry queries
- Use `prisma.$transaction()` with chunking for large imports
- Consider streaming response for import progress (Phase 3)

### 9.4 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **CSV injection attacks** | Medium | High | Sanitize formula-like values, user education |
| **Large file DoS** | Medium | Medium | File size limit (10MB), row limit (1000) |
| **Slug collisions** | High | Low | Auto-generate unique slugs with numeric suffix |
| **Tool/skill references break** | High | Medium | Validation warnings, skip missing references |
| **Model validation API rate limits** | Medium | Medium | Cache validation results per unique model |
| **Transaction timeouts** | Low | Medium | Per-agent transactions, chunking for large imports |
| **Character encoding issues** | Medium | Low | Enforce UTF-8, BOM for Excel compatibility |

---

## 10. Phased Implementation Plan

### Phase 1: Core Export/Import (MVP)

**Goal:** Basic CSV export/import with core fields only

**Deliverables:**
1. ✅ Export API endpoint (`GET /api/agents/export`)
   - Core fields only (name, description, instructions, model, temperature, tools)
   - CSV format with RFC 4180 escaping
   - Workspace filtering

2. ✅ Import API endpoint (`POST /api/agents/import`)
   - File upload via multipart/form-data
   - CSV parsing with validation
   - Create new agents only (`mode=skip` for conflicts)
   - Per-row validation report

3. ✅ CSV utilities (`packages/agentc2/src/agents/csv-utils.ts`)
   - `parseCsv()` - Parse CSV string to rows
   - `generateCsv()` - Generate CSV from agent records
   - `csvEscape()` / `csvUnescape()` - Handle quoting

4. ✅ Import validator (`packages/agentc2/src/agents/import-validator.ts`)
   - `validateImportRow()` - Validate single row
   - `validateImportBatch()` - Validate entire CSV
   - Return structured error/warning lists

5. ✅ UI component (`apps/agent/src/components/AgentBulkActions.tsx`)
   - Export button with workspace filter
   - Import dialog with file picker, mode selector
   - Results display with filterable table

6. ✅ CSV template endpoint (`GET /api/agents/export/template`)
   - Minimal CSV with example rows

**Acceptance Criteria:**
- Export 100 agents to CSV in <2 seconds
- Import 50 agents with validation report in <5 seconds
- All validation errors clearly reported with suggestions
- Name and slug uniqueness enforced
- Tool validation with warnings for missing tools
- Full authorization checks on both endpoints

**Estimated Complexity:** Medium (3-4 days implementation + testing)

---

### Phase 2: Advanced Features

**Goal:** Support complex fields, skills, and overwrite modes

**Deliverables:**
1. ✅ Skill export/import
   - Export: Include `skills` column with pinning syntax
   - Import: Resolve skill slugs to IDs, create AgentSkill records
   - Validation: Warn if skill not found in workspace

2. ✅ JSON field serialization
   - Add `modelConfig_json`, `routingConfig_json`, etc. columns
   - Export: JSON.stringify() complex fields
   - Import: JSON.parse() with validation

3. ✅ Overwrite mode (`mode=overwrite`)
   - Check `update` permission via `requireEntityAccess()`
   - Update existing agents with matching slugs
   - Create `AgentVersion` snapshot before overwrite
   - Record to `ChangeLog` table

4. ✅ Version mode (`mode=version`)
   - Increment agent version number
   - Create `AgentVersion` record
   - Update agent with new config

5. ✅ Batch optimization
   - Cache model validation results
   - Batch tool registry queries
   - Chunk large imports into transactions of 50

6. ✅ Export filtering
   - Filter by agent type (USER/DEMO)
   - Filter by visibility (PRIVATE/ORGANIZATION/PUBLIC)
   - Filter by active/archived status
   - Filter by specific agent IDs

**Acceptance Criteria:**
- Import agents with skills and complex config
- Overwrite mode updates existing agents with version history
- Export includes all agent configuration (except sensitive fields)
- Large imports (200+ agents) complete without timeout

**Estimated Complexity:** Medium-High (4-5 days)

---

### Phase 3: Enterprise Features

**Goal:** Background processing, audit trail, advanced UI

**Deliverables:**
1. ✅ Background import processing (Inngest)
   - Event: `agents/import.start`
   - Function: Process import in background with progress tracking
   - Webhook: Notify user on completion
   - UI: Poll for import status

2. ✅ Import history (`AgentImportJob` table)
   - Track import jobs with status, summary, results JSON
   - UI: View past imports, re-download validation reports
   - Retention: 90 days

3. ✅ Export presets
   - Save export configurations (filters, columns)
   - UI: Quick export with saved presets

4. ✅ Scheduled exports
   - Create AgentSchedule for recurring exports
   - Send CSV via email or webhook
   - Integration with S3/GCS for backups

5. ✅ Advanced validation options
   - Require all tools to be available (fail on missing tools)
   - Strict mode (fail entire import on any row error)
   - Duplicate detection within CSV (warn if duplicate names)

6. ✅ Import preview
   - Parse CSV and show preview table before committing
   - Highlight validation errors inline
   - Allow row-level selection/deselection

**Acceptance Criteria:**
- Import 1000+ agents via background job
- View import history with downloadable reports
- Schedule weekly agent backups to S3

**Estimated Complexity:** High (6-8 days)

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Location:** `tests/unit/agents/csv-import-export.test.ts`

**Test Cases:**
```typescript
describe("CSV Export", () => {
  it("exports agents with core fields", async () => {
    const csv = await generateCsv(agents, { includeTools: true });
    expect(csv).toContain("name,description,instructions");
    expect(csv).toContain("Customer Support Agent");
  });

  it("escapes CSV special characters", async () => {
    const agent = { name: 'Agent with "quotes"' };
    const csv = await generateCsv([agent]);
    expect(csv).toContain('"Agent with ""quotes"""');
  });

  it("handles multiline instructions", async () => {
    const agent = { instructions: "Line 1\nLine 2" };
    const csv = await generateCsv([agent]);
    expect(csv).toContain('"Line 1\nLine 2"');
  });
});

describe("CSV Import", () => {
  it("imports valid agents successfully", async () => {
    const csv = `name,instructions,modelProvider,modelName
"Test Agent","You are helpful","openai","gpt-4o"`;
    const result = await validateImportBatch(csv, workspaceId, orgId);
    expect(result.errors).toHaveLength(0);
  });

  it("reports missing required fields", async () => {
    const csv = `name,instructions
"Test Agent","You are helpful"`;
    await expect(validateImportBatch(csv, workspaceId, orgId))
      .rejects.toThrow("Missing required columns: modelProvider, modelName");
  });

  it("validates model exists", async () => {
    const csv = `name,instructions,modelProvider,modelName
"Test Agent","Help","openai","gpt-999"`;
    const result = await validateImportBatch(csv, workspaceId, orgId);
    expect(result.results[0].error).toContain("Model 'gpt-999' not found");
  });

  it("handles tool validation", async () => {
    const csv = `name,instructions,modelProvider,modelName,tools
"Test","Help","openai","gpt-4o","calculator;invalid-tool"`;
    const result = await validateImportBatch(csv, workspaceId, orgId);
    expect(result.warnings).toContain("invalid-tool");
  });

  it("generates unique slugs on collision", async () => {
    await createAgent({ name: "Assistant", slug: "assistant" });
    const csv = `name,instructions,modelProvider,modelName
"Assistant","Help","openai","gpt-4o"`;
    const result = await importAgents(csv, workspaceId, { mode: "skip" });
    expect(result.results[0].status).toBe("skipped");
  });
});
```

### 11.2 Integration Tests

**Location:** `tests/integration/api/agents-bulk.test.ts`

**Test Cases:**
- Export API returns valid CSV for authenticated user
- Import API creates agents with correct workspace scoping
- Import respects authorization (401/403 for unauthorized)
- Rate limiting enforced (429 after exceeding limit)
- Import with `mode=overwrite` creates version history
- Import with invalid model returns validation error
- Export filters by workspace correctly
- Import enforces name uniqueness within organization

### 11.3 E2E Tests

**Location:** `tests/e2e/agents-bulk-import-export.spec.ts` (Playwright)

**Scenarios:**
1. User exports agents to CSV, verifies download
2. User imports CSV with 10 agents, views validation report
3. User imports CSV with conflicts, chooses "skip" mode
4. User imports CSV with errors, sees error details in UI
5. User downloads CSV template, fills it out, imports successfully

### 11.4 Performance Tests

**Benchmarks:**
- Export 100 agents: <2s
- Export 1000 agents: <10s
- Import 50 agents: <5s
- Import 100 agents: <10s
- Import 1000 agents: <60s (or background job)

---

## 12. Implementation Details

### 12.1 CSV Parser Implementation

**Option A:** Use `papaparse` library
- ✅ Battle-tested, handles edge cases
- ✅ TypeScript support
- ✅ RFC 4180 compliant
- ❌ Additional dependency (~45KB)

**Option B:** Custom parser (based on `bim/csv-adapter.ts`)
- ✅ No external dependency
- ✅ Full control over behavior
- ❌ Need to handle all edge cases manually

**Recommendation:** Use `papaparse` for Phase 1 (speed), consider custom parser if bundle size is critical.

### 12.2 Slug Collision Resolution

**Strategy:** Append numeric suffix

```typescript
async function generateUniqueAgentSlug(
  baseName: string,
  workspaceId: string
): Promise<string> {
  const baseSlug = generateSlug(baseName); // "customer-support"
  
  let slug = baseSlug;
  let suffix = 2;
  
  while (await prisma.agent.findFirst({ 
    where: { slug, workspaceId } 
  })) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
  
  return slug;
}
```

**Import Behavior:**
- Row with name "Customer Support" generates slug "customer-support"
- If "customer-support" exists, try "customer-support-2"
- Continue until unique slug found
- Report final slug in validation report

**Export Behavior:**
- Export current slug (e.g., "customer-support-2")
- On re-import to different workspace, may generate "customer-support-3"

### 12.3 Tool Validation Strategy

**Validation Logic:**
```typescript
async function validateTools(
  toolIds: string[],
  organizationId: string
): Promise<{ valid: string[], invalid: string[], unavailable: string[] }> {
  const valid: string[] = [];
  const invalid: string[] = [];
  const unavailable: string[] = [];
  
  // Get all available tools (static + MCP)
  const allTools = {
    ...toolRegistry,
    ...(await getAllMcpTools(organizationId))
  };
  
  for (const toolId of toolIds) {
    if (allTools[toolId]) {
      // Check if tool credentials are available
      const credCheck = toolCredentialChecks[toolId];
      if (credCheck && !credCheck()) {
        unavailable.push(toolId);
      } else {
        valid.push(toolId);
      }
    } else {
      invalid.push(toolId);
    }
  }
  
  return { valid, invalid, unavailable };
}
```

**User Feedback:**
- **Invalid tools:** Error - "Tool 'xyz' does not exist"
- **Unavailable tools:** Warning - "Tool 'hubspot_get-contacts' not available (missing API key or disabled). It will be skipped."
- **Valid tools:** Included in agent

### 12.4 Skill Resolution Strategy

**Validation Logic:**
```typescript
async function resolveSkills(
  skillSlugs: string[],
  workspaceId: string,
  organizationId: string
): Promise<{ resolved: Array<{ skillId: string, pinned: boolean }>, missing: string[] }> {
  const resolved: Array<{ skillId: string, pinned: boolean }> = [];
  const missing: string[] = [];
  
  for (const slugWithPinning of skillSlugs) {
    const [slug, pinningMode] = slugWithPinning.split(":");
    const pinned = pinningMode !== "discoverable"; // Default to pinned
    
    const skill = await prisma.skill.findFirst({
      where: {
        slug,
        workspaceId,
        organizationId
      }
    });
    
    if (skill) {
      resolved.push({ skillId: skill.id, pinned });
    } else {
      missing.push(slug);
    }
  }
  
  return { resolved, missing };
}
```

**Import Behavior:**
- Missing skills generate warnings
- Agent is created without missing skills
- User can manually add skills later

---

## 13. Open Questions

### 13.1 Design Decisions Needed

**Q1:** Should we support JSONL format in addition to CSV?
- **Pro:** Better for complex JSON fields, no escaping issues
- **Con:** Less familiar to non-technical users
- **Recommendation:** Phase 1 = CSV only, Phase 2 = add JSONL option

**Q2:** How to handle skill references when skill doesn't exist in target workspace?
- **Option A:** Skip the skill, warn user
- **Option B:** Fail the row entirely
- **Option C:** Create placeholder skill with name only
- **Recommendation:** Option A (skip with warning) for Phase 1

**Q3:** Should import support creating AgentTool with custom `config` JSON?
- **Current:** Only supports toolId (no custom config)
- **Advanced:** Add `tools_config_json` column with JSON array
- **Recommendation:** Phase 1 = no custom config, Phase 2 = add support

**Q4:** Should export include agent statistics (run count, success rate)?
- **Pro:** Useful for analysis, migration planning
- **Con:** Not relevant for re-import, increases complexity
- **Recommendation:** Separate "analytics export" feature, not part of config export

**Q5:** Should import validate `subAgents` and `workflows` references?
- **Current Design:** Accept as-is, no validation (same as current API)
- **Alternative:** Validate references exist in target workspace
- **Recommendation:** Phase 1 = no validation (same as API), Phase 2 = add warnings

**Q6:** How to handle very large imports (1000+ agents)?
- **Option A:** Synchronous with timeout (60s limit)
- **Option B:** Background job via Inngest with polling
- **Option C:** Streaming response with progress updates
- **Recommendation:** Phase 1 = synchronous with 1000 row limit, Phase 3 = background jobs

**Q7:** Should we enforce unique descriptions or allow duplicates?
- **Current:** No uniqueness constraint on description
- **Recommendation:** Allow duplicates (same as current behavior)

### 13.2 Edge Cases

**Case 1:** User imports CSV with 50 agents, 25 have same name
- **Behavior:** First creates "Agent", next creates "Agent (2)", etc.
- **Validation:** Warn user about duplicate names in CSV

**Case 2:** User exports from Workspace A, imports to Workspace B
- **Behavior:** All agents imported to Workspace B
- **Slug Handling:** Generate new unique slugs in Workspace B
- **Tool/Skill References:** Validate against Workspace B's resources

**Case 3:** CSV contains tool references to MCP tools not installed in target org
- **Behavior:** Mark tool as unavailable, exclude from agent, warn user
- **Validation:** Distinguish between "invalid tool ID" vs "tool not available"

**Case 4:** Import CSV has BOM (Byte Order Mark) from Excel
- **Behavior:** Strip BOM before parsing
- **Implementation:** `content.replace(/^\uFEFF/, "")`

**Case 5:** User exports agents with complex `metadata` JSON containing sensitive data
- **Behavior:** Export metadata as-is (user's responsibility to sanitize)
- **Security Note:** Document that users should review exports before sharing

---

## 14. Database Queries

### 14.1 Export Query

```typescript
const agents = await prisma.agent.findMany({
  where: {
    workspaceId,
    isArchived: includeArchived ? undefined : false
  },
  include: {
    tools: {
      select: { toolId: true }
    },
    skills: includeSkills ? {
      select: {
        skill: { select: { slug: true } },
        pinned: true
      }
    } : false
  },
  orderBy: { name: "asc" }
});
```

**Performance:** 
- 100 agents: ~100-200ms
- 1000 agents: ~500-1000ms
- Index coverage: `workspaceId`, `isArchived` are indexed

### 14.2 Import Queries (Per Agent)

```typescript
// 1. Check name uniqueness
const existingByName = await prisma.agent.findFirst({
  where: {
    name: row.name,
    workspace: { organizationId }
  }
});

// 2. Check slug collision
const existingBySlug = await prisma.agent.findFirst({
  where: { slug, workspaceId }
});

// 3. Create agent
const agent = await prisma.agent.create({
  data: {
    slug,
    name: row.name,
    // ... other fields
    workspaceId,
    type: "USER",
    version: 1
  }
});

// 4. Create tool associations
await prisma.agentTool.createMany({
  data: validToolIds.map(toolId => ({
    agentId: agent.id,
    toolId
  }))
});

// 5. Create skill associations (if Phase 2)
await prisma.agentSkill.createMany({
  data: resolvedSkills.map(({ skillId, pinned }) => ({
    agentId: agent.id,
    skillId,
    pinned
  }))
});
```

**Performance:**
- ~5 queries per agent (name check, slug check, create, tools, activity)
- ~50ms per agent
- 100 agents: ~5 seconds
- Optimization: Batch name/slug checks upfront

---

## 15. Code Structure

### 15.1 New Files

```
packages/agentc2/src/agents/
├── csv-utils.ts              # CSV parsing/generation utilities
├── csv-generator.ts          # Generate CSV from agent records
├── csv-parser.ts             # Parse CSV to validated rows
└── import-validator.ts       # Validation logic

apps/agent/src/app/api/agents/
├── export/
│   ├── route.ts              # GET /api/agents/export
│   └── template/
│       └── route.ts          # GET /api/agents/export/template
└── import/
    └── route.ts              # POST /api/agents/import

apps/agent/src/components/
└── AgentBulkActions.tsx      # Export/import UI component

tests/unit/agents/
└── csv-import-export.test.ts # Unit tests

tests/integration/api/
└── agents-bulk.test.ts       # Integration tests

tests/e2e/
└── agents-bulk-import-export.spec.ts  # E2E tests
```

### 15.2 Reusable Utilities

**From Existing Code:**
- `generateSlug()` from `apps/agent/src/app/api/agents/route.ts:21`
- `generateUniqueAgentSlug()` from `apps/agent/src/app/api/agents/route.ts:32`
- `csvEscape()` from `apps/agent/src/app/api/agents/[id]/test-cases/export/route.ts:143`
- `validateModelSelection()` from `@repo/agentc2/agents/model-registry`
- `requireAuth()`, `requireAgentAccess()`, `requireEntityAccess()` from `@/lib/authz`
- `checkRateLimit()` from `@/lib/rate-limit`
- `recordActivity()` from `@repo/agentc2/activity/service`

**New Utilities:**
- `parseCsv()` - Parse CSV string with RFC 4180 compliance
- `generateCsv()` - Generate CSV from agent array
- `validateImportRow()` - Validate single CSV row
- `validateImportBatch()` - Validate entire CSV file
- `importAgent()` - Create/update single agent from row
- `importAgentBatch()` - Process entire import

---

## 16. Migration & Rollout

### 16.1 Rollout Strategy

**Phase 1 MVP:**
1. Deploy export API (low risk, read-only)
2. Test export with production data in staging
3. Deploy import API with `dryRun=true` mode only
4. Test import validation with real user CSVs
5. Enable import creation mode
6. Monitor error rates, adjust validation rules

**Phase 2 Advanced:**
1. Deploy overwrite/version modes (higher risk)
2. Enable for beta users first
3. Collect feedback on UX, validation quality
4. Roll out to all users

**Phase 3 Enterprise:**
1. Deploy background job processing
2. Add import history tracking
3. Release scheduled exports

### 16.2 Feature Flags

Add feature flag in `.env`:
```bash
FEATURE_AGENT_BULK_IMPORT="true"
FEATURE_AGENT_BULK_EXPORT="true"
```

UI checks flag before rendering buttons:
```typescript
const canImport = process.env.FEATURE_AGENT_BULK_IMPORT === "true";
const canExport = process.env.FEATURE_AGENT_BULK_EXPORT === "true";
```

### 16.3 Rollback Plan

**If critical bug found:**
1. Disable via feature flag (instant)
2. Investigate issue in staging
3. Deploy fix or revert API endpoints
4. Re-enable after verification

**Data Integrity:**
- All imports create activity feed entries (audit trail)
- Version history preserved (rollback to previous version via existing UI)
- No cascading deletes (safe to disable feature)

---

## 17. Documentation

### 17.1 User Documentation

**Location:** In-app help, `/docs/bulk-import-export.md`

**Contents:**
- **Getting Started:** Export/import workflow walkthrough
- **CSV Format Reference:** Column descriptions, examples
- **Conflict Resolution:** Skip vs. Overwrite vs. Version modes
- **Troubleshooting:** Common errors and how to fix them
- **Best Practices:** 
  - Review exports before sharing (may contain sensitive instructions)
  - Test with dry run first
  - Use skip mode for safety
  - Validate tool/skill availability in target workspace

### 17.2 Developer Documentation

**Location:** `/CLAUDE.md` (update existing), inline code comments

**Contents:**
- API endpoint specifications
- CSV schema reference
- Validation logic flowcharts
- Error code reference
- Performance benchmarks

---

## 18. Metrics & Observability

### 18.1 Tracking Metrics

**Events to Track:**
- `agent.export.initiated` - User starts export
- `agent.export.completed` - Export succeeds (with agent count, duration)
- `agent.export.failed` - Export fails (with error type)
- `agent.import.initiated` - User starts import (with row count, mode)
- `agent.import.completed` - Import completes (with summary stats)
- `agent.import.failed` - Import fails (with error type)

**Analytics Questions:**
- How many users use bulk import/export?
- What is the median/p95 agent count per export?
- What are the most common import errors?
- What is the success rate (rows created / total rows)?
- Which conflict resolution mode is most popular?

**Implementation:**
- Use existing activity feed system (`recordActivity()`)
- Add structured metadata to activity records

### 18.2 Logging Strategy

**Log Levels:**
- **INFO:** Import started (row count), import completed (summary)
- **WARN:** Validation warnings (missing tools, skills), partial success
- **ERROR:** File-level errors (parse failure, auth failure)

**Log Format:**
```typescript
console.log("[Agent Import]", {
  userId,
  organizationId,
  workspaceId,
  totalRows,
  mode,
  summary: { created, updated, skipped, failed }
});
```

**Monitoring:**
- Alert on error rate >5% for imports
- Alert on export failures (should be rare)
- Dashboard: Weekly import/export volumes

---

## 19. Security Deep Dive

### 19.1 CSV Injection Mitigation

**Attack Vector:** Malicious CSV with formula injection
```csv
name,instructions
"=1+1","You are helpful"
"=cmd|'/c calc'!A1","Be evil"
```

**Mitigation:**
1. **On Export:** Prepend single quote to cells starting with `=`, `+`, `-`, `@`, `\t`, `\r`
   ```typescript
   function csvEscape(value: string): string {
     const dangerous = /^[=+\-@\t\r]/;
     if (dangerous.test(value)) {
       value = "'" + value; // Excel treats this as literal text
     }
     if (value.includes(",") || value.includes('"') || value.includes("\n")) {
       return `"${value.replace(/"/g, '""')}"`;
     }
     return value;
   }
   ```

2. **On Import:** Reject rows with formula-like values, warn user
   ```typescript
   const dangerousPattern = /^[=+\-@\t\r]/;
   if (dangerousPattern.test(row.name) || dangerousPattern.test(row.instructions)) {
     return {
       status: "failed",
       error: "Potential CSV injection detected. Remove formulas from name/instructions."
     };
   }
   ```

3. **User Education:** Warning in UI and docs about CSV injection risks

### 19.2 Data Sanitization

**Instructions Field:**
- Max length: 50,000 characters (enforced in schema)
- No HTML/script sanitization needed (stored as plain text)
- Preserve whitespace, newlines

**Tool/Skill References:**
- Allowlist validation (must exist in registry)
- No arbitrary SQL injection risk (parameterized queries)

### 19.3 Access Control

**Scenario: User tries to import agents to workspace they don't own**
```typescript
const isValidWorkspace = await validateWorkspaceOwnership(
  workspaceId,
  organizationId
);
if (!isValidWorkspace) {
  return NextResponse.json(
    { error: "Invalid workspaceId" },
    { status: 403 }
  );
}
```

**Scenario: User tries to export agents from another org's workspace**
- Each agent filtered through `requireAgentAccess()`
- User only sees agents they have access to
- No cross-tenant data leakage

---

## 20. Alternative Approaches Considered

### 20.1 JSON Format (Not Chosen for Phase 1)

**Pros:**
- Native support for nested structures (modelConfig, routingConfig)
- No escaping complexity
- Better for programmatic consumption

**Cons:**
- Not human-readable in spreadsheets
- Less accessible to non-technical users
- Harder to edit in Excel/Google Sheets

**Decision:** Offer JSON export as secondary format in Phase 2

### 20.2 Excel Format (.xlsx) (Not Chosen)

**Pros:**
- Native Excel format
- Rich data types (dates, numbers)
- Multiple sheets (one for agents, one for tools, etc.)

**Cons:**
- Requires library dependency (`xlsx`, `exceljs`)
- Larger bundle size
- More complex generation logic
- Less universal (CSV works everywhere)

**Decision:** CSV is more universal, easier to implement

### 20.3 UI-Based Import (Not Chosen for Phase 1)

**Approach:** Spreadsheet-like UI in browser for bulk editing

**Pros:**
- No file upload needed
- Real-time validation
- Better UX for small batches (<20 agents)

**Cons:**
- Complex React component (~1000 lines)
- Poor performance for large datasets (100+ agents)
- Harder to integrate with existing tools (Excel, scripts)

**Decision:** CSV import is more scalable and flexible

---

## 21. Success Metrics

### 21.1 Feature Adoption

**Goals:**
- 10% of users with 20+ agents use export within 30 days
- 5% of users with 20+ agents use import within 60 days
- 80% of imports succeed with zero failed rows
- <2% of imports hit validation errors requiring support

### 21.2 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Export latency (100 agents) | <2s | p95 |
| Import latency (50 agents) | <5s | p95 |
| Export error rate | <1% | Monthly |
| Import error rate (file-level) | <5% | Monthly |
| Import success rate (row-level) | >95% | Per import |

### 21.3 Quality Metrics

- Zero security incidents (CSV injection, data leakage)
- Zero data corruption (agents created with wrong workspace)
- <5 support tickets per month related to bulk import/export
- User satisfaction >4/5 stars (in-app feedback)

---

## 22. Future Enhancements (Beyond Phase 3)

1. **Import from URL** - Import CSV from public URL
2. **Import from Google Sheets** - Direct integration
3. **Export to Airtable/Notion** - Push agents to external tools
4. **Diff view** - Show changes before overwrite
5. **Selective column export** - Choose which fields to export
6. **Import mapping** - Map CSV columns to agent fields (flexible schema)
7. **Bulk update** - Import CSV with just ID + changed fields
8. **Export filtering by tags** - Export agents matching metadata tags
9. **Import from Langchain/LlamaIndex** - Convert from other formats
10. **Version comparison export** - Export diff between two versions

---

## 23. Appendix

### 23.1 Example CSV Export (Full)

```csv
name,description,instructions,instructionsTemplate,modelProvider,modelName,temperature,maxTokens,maxSteps,memoryEnabled,tools,subAgents,workflows,visibility,isActive
"Customer Support Agent","Handles customer inquiries","You are a helpful customer support agent. Always be polite and professional.","Hello {{userName}}, how can I assist you today?","openai","gpt-4o",0.7,2048,5,true,"web-search;memory-recall;gmail-send-email","","","ORGANIZATION",true
"Research Assistant","Conducts in-depth research","You are a research agent specialized in finding accurate information from multiple sources.","","anthropic","claude-sonnet-4-5-20250929",0.8,4096,10,true,"exa-research;perplexity-research;web-scrape;rag-query","","","PRIVATE",true
"Sales Bot","Qualifies leads","You are a sales agent focused on qualifying leads and booking meetings.","","openai","gpt-4o-mini",0.6,1024,3,false,"hubspot_hubspot-get-contacts;google-calendar-create-event","customer-support","","ORGANIZATION",true
```

### 23.2 Example CSV Import with Errors

**Input CSV:**
```csv
name,instructions,modelProvider,modelName,tools
"Agent 1","You are helpful","openai","gpt-4o","calculator"
"Agent 2","You are smart","openai","gpt-5","web-search"
"Agent 1","Duplicate name","anthropic","claude-sonnet-4-5-20250929","invalid-tool"
```

**Import Report:**
```json
{
  "success": true,
  "summary": {
    "totalRows": 3,
    "created": 1,
    "updated": 0,
    "skipped": 1,
    "failed": 1
  },
  "results": [
    {
      "row": 1,
      "status": "created",
      "agentId": "clx...",
      "agentSlug": "agent-1",
      "agentName": "Agent 1"
    },
    {
      "row": 2,
      "status": "failed",
      "error": "Model 'gpt-5' not found for provider 'openai'",
      "suggestion": "Did you mean: gpt-4o, gpt-4o-mini?"
    },
    {
      "row": 3,
      "status": "skipped",
      "reason": "Agent name 'Agent 1' already exists in organization"
    }
  ],
  "warnings": [
    "Row 3: Tool 'invalid-tool' not found in registry. It will be skipped."
  ]
}
```

### 23.3 Reference: Agent Create API Pattern

**From:** `apps/agent/src/app/api/agents/route.ts` (POST handler)

**Key Steps:**
1. Authenticate user (`requireAuth()`)
2. Check `create` permission (`requireEntityAccess()`)
3. Validate workspace ownership
4. Rate limiting check
5. Validate required fields
6. Validate model selection
7. Enforce unique name within org
8. Generate unique slug
9. Create agent record
10. Create AgentTool records (if tools provided)
11. Record activity feed
12. Auto-join community boards (optional)
13. Auto-assign community skill (optional)
14. Return created agent

**Import Logic Should Mirror This Pattern** for consistency.

### 23.4 Reference: Test Case Export Pattern

**From:** `apps/agent/src/app/api/agents/[id]/test-cases/export/route.ts`

**Key Patterns:**
- Use `NextResponse` with `Content-Disposition: attachment`
- CSV headers as array, joined with `,`
- CSV rows built via `csvEscape()` helper
- Return `Content-Type: text/csv`
- Filename includes entity ID and timestamp

**Import Should Follow Similar Patterns** for file upload handling.

---

## Conclusion

This design provides a comprehensive, secure, and scalable solution for bulk agent import/export via CSV. The phased approach allows for incremental delivery of value while managing complexity and risk.

**Next Steps:**
1. Review this design with engineering team and stakeholders
2. Prioritize Phase 1 MVP for immediate implementation
3. Create detailed implementation tickets in GitHub
4. Assign developer resources and timeline
5. Begin implementation with export API (lowest risk)

**Estimated Total Effort:**
- Phase 1 (MVP): 4-5 days
- Phase 2 (Advanced): 4-5 days
- Phase 3 (Enterprise): 6-8 days
- **Total:** 14-18 days (2.5-3.5 sprints)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-11  
**Status:** Draft for Review  
**Next Review Date:** TBD
