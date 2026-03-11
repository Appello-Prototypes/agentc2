# Technical Design: Bulk Agent Import/Export via CSV

**Feature Request:** [E2E Test] Add bulk agent import/export via CSV  
**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/128  
**Scope:** High | **Priority:** Medium  
**Design Date:** March 11, 2026  
**Status:** Design Phase (Not Implemented)

---

## Executive Summary

Users managing 50+ agents need a scalable way to bulk import/export agent configurations. This design proposes a comprehensive solution that:

- **Exports** all agents in a workspace to CSV with configurable columns
- **Imports** agents from CSV with validation, conflict resolution, and rollback support
- **Validates** data integrity with detailed success/failure reporting
- **Integrates** seamlessly with existing UI patterns and authentication flows
- **Scales** to handle hundreds of agents efficiently

The implementation will follow established codebase patterns for file handling, RBAC, and multi-tenant data isolation.

---

## 1. Current Architecture Analysis

### 1.1 Agent Data Model

**Location:** `packages/database/prisma/schema.prisma` (lines 815-952)

**Core Required Fields:**
- `slug` (string, 1-128 chars, workspace-scoped unique)
- `name` (string, 1-255 chars, org-scoped unique)
- `instructions` (text, max 100,000 chars)
- `modelProvider` (enum: "openai" | "anthropic")
- `modelName` (string, 1-255 chars)
- `workspaceId` (string, required for multi-tenant scoping)

**Key Optional Fields with Business Impact:**
- `description` (2000 chars)
- `instructionsTemplate` (templated instructions)
- `temperature` (0-2, default: 0.7)
- `maxTokens` (int, nullable)
- `maxSteps` (1-500, default: 5)
- `memoryEnabled` (boolean, default: false)
- `memoryConfig` (JSON: lastMessages, semanticRecall, workingMemory)
- `modelConfig` (JSON: reasoning, toolChoice, provider-specific)
- `routingConfig` (JSON: model routing strategy)
- `contextConfig` (JSON: context window management)
- `visibility` (enum: PRIVATE | ORGANIZATION | PUBLIC)
- `type` (enum: USER | DEMO)
- `subAgents` (string[], agent slugs for delegation)
- `workflows` (string[], workflow IDs)
- `metadata` (JSON, arbitrary key-value pairs)
- `requiresApproval` (boolean, default: false)
- `maxSpendUsd` (float, cost guardrail)
- `autoVectorize` (boolean, default: true)
- `deploymentMode` (string, default: "singleton")

**Relationship Fields:**
- `tools: AgentTool[]` - Many-to-many junction table with `toolId` and `config`

**Critical Constraints:**
- `@@unique([workspaceId, slug])` - Slugs are workspace-scoped, NOT globally unique
- `@@index([workspaceId])` - All queries must be workspace-scoped

### 1.2 Current CRUD Operations

**CREATE:** `POST /api/agents`
- Validates authentication (session or API key)
- Requires RBAC "create" permission
- Validates model provider via `validateModelSelection()`
- Enforces unique agent names per organization
- Auto-generates slug from name if not provided (with numeric suffix on conflicts)
- Rate limits: `orgMutation:agentCreate:{orgId}`
- Creates `AgentVersion` snapshot and `ChangeLog` entry
- Auto-assigns community skills and records `AGENT_CREATED` activity

**READ:** `GET /api/agents/[id]`
- Supports lookup by ID or slug (workspace-scoped)
- Returns agent with `tools` and `skills` relations
- Validates org ownership via `requireAgentAccess()`

**LIST:** `GET /api/agents`
- Returns all agents for user's organization
- Supports filters: active, keyword search, exclude
- Returns with health scores and skill metadata

**UPDATE:** `PUT /api/agents/[id]`
- Validates ownership and RBAC "update" permission
- Creates version snapshot on meaningful changes (deep JSON diff)
- Deletes and recreates `AgentTool` records on tool list changes
- Tracks customized fields for playbook-sourced agents
- Rate limits: `orgMutation:agent:{orgId}`

**ARCHIVE:** `PATCH /api/agents/[id]` with `{ action: "archive" }`
- Sets `isArchived=true`, `archivedAt=now()`, `isActive=false`

**DELETE:** `DELETE /api/agents/[id]`
- Validates ownership and RBAC "delete" permission
- Cascades to related records (versions, runs, traces, etc.)
- Cleans up playbook installation linkage

### 1.3 Existing File Handling Patterns

**CSV Export Reference:** `apps/agent/src/app/api/agents/[id]/test-cases/export/route.ts`
- Custom CSV generation (no external libraries)
- `csvEscape()` helper for safe quoting
- Supports both CSV and JSONL formats
- Returns with `Content-Disposition: attachment` header

**File Upload Reference:** `apps/agent/src/app/api/documents/upload/route.ts`
- Accepts `multipart/form-data`
- Max size: 10MB
- Validates file type, size, content
- Rate limiting per user
- Returns structured response with success/error details

**UI Upload Component:** `apps/agent/src/app/knowledge/components/upload-document-dialog.tsx`
- Dual mode: file upload or paste content
- Drag-and-drop zone with visual feedback
- Auto-generates slug from filename
- Real-time validation feedback
- Success state with "Add Another" option

### 1.4 Multi-Tenant Security Model

**Key Principles:**
1. **Workspace Scoping:** All queries MUST include `workspaceId` or `workspace.organizationId`
2. **Slug Uniqueness:** Slugs are unique per workspace, NOT globally
3. **RBAC Enforcement:** All mutations require appropriate permissions (create/update/delete)
4. **Rate Limiting:** Org-level mutation limits prevent abuse

**Authentication Flow:**
1. `authenticateRequest()` - Returns `{ userId, organizationId }`
2. `requireEntityAccess()` - Validates RBAC permission
3. `getDefaultWorkspaceIdForUser()` - Resolves workspace context
4. `validateWorkspaceOwnership()` - Confirms workspace belongs to org

### 1.5 Existing Bulk Operation Patterns

**Reference:** `apps/agent/src/components/automation/AutomationTable.tsx`
- Multi-select via checkboxes (header + row-level)
- State: `Set<string>` for selected IDs
- Bulk action buttons appear when items are selected
- Loading states during bulk operations
- Disable checkboxes for archived items

---

## 2. Proposed Solution Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Export Button   │  │  Import Button   │                │
│  │  (agents page)   │  │  (dialog modal)  │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
└───────────┼────────────────────┼─────────────────────────────┘
            │                    │
            ▼                    ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│ Export API Endpoint  │  │    Import API Endpoint           │
│ GET /api/agents/     │  │    POST /api/agents/import       │
│      export          │  │                                  │
│                      │  │  ┌────────────────────────────┐  │
│ ┌────────────────┐   │  │  │ Validation Service         │  │
│ │ CSV Serializer │   │  │  │ - Schema validation        │  │
│ │ - Field mapping│   │  │  │ - Model validation         │  │
│ │ - Truncation   │   │  │  │ - Conflict detection       │  │
│ │ - Escaping     │   │  │  │ - Tool ID resolution       │  │
│ └────────────────┘   │  │  └────────────────────────────┘  │
└──────────┬───────────┘  │  ┌────────────────────────────┐  │
           │              │  │ Import Service             │  │
           │              │  │ - Batch creation           │  │
           │              │  │ - Transaction mgmt         │  │
           │              │  │ - Error reporting          │  │
           │              │  │ - Rollback on failure      │  │
           │              │  └────────────────────────────┘  │
           │              └──────────────┬───────────────────┘
           │                             │
           ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────────────┐  │
│  │   Agent     │  │ AgentTool  │  │  AgentVersion       │  │
│  │   (main)    │──│ (junction) │  │  (audit trail)      │  │
│  └─────────────┘  └────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

#### Export Flow

```
User clicks "Export" → Optional filter dialog → API GET request
                                                      ↓
                                    Query agents (workspace-scoped)
                                                      ↓
                                    Serialize to CSV with field mapping
                                                      ↓
                                    Return file with Content-Disposition
                                                      ↓
                                            Browser downloads file
```

#### Import Flow

```
User clicks "Import" → Upload dialog → File selection
                                              ↓
                                    Parse CSV (client-side preview)
                                              ↓
                                    Show preview table with validation
                                              ↓
                            User confirms → POST multipart/form-data
                                              ↓
                                    Server parses CSV
                                              ↓
                                    Validate each row (schema + business rules)
                                              ↓
                                    Detect conflicts (existing slugs)
                                              ↓
                            ┌─────────────────┴─────────────────┐
                            ▼                                   ▼
                    Skip mode: Skip existing        Overwrite mode: Update existing
                            │                                   │
                            └─────────────────┬─────────────────┘
                                              ↓
                                    Execute in transaction (batch create/update)
                                              ↓
                                    Return validation report (success/errors)
                                              ↓
                                    UI displays results with retry option
```

---

## 3. Detailed Technical Specification

### 3.1 CSV Schema Design

#### Export Schema (Columns)

**Required Columns:**
```
slug, name, modelProvider, modelName, instructions, workspaceId
```

**Extended Columns (Optional via UI toggle):**
```
description, instructionsTemplate, temperature, maxTokens, maxSteps,
memoryEnabled, memoryConfigJson, modelConfigJson, routingConfigJson, 
contextConfigJson, visibility, type, tools, workflows, subAgents, 
requiresApproval, maxSpendUsd, autoVectorize, deploymentMode, 
metadataJson, isActive
```

**Computed/Display Columns (Export-only, not imported):**
```
id, createdAt, updatedAt, createdBy, version, totalRuns, successRate, 
totalCostUsd, lastRunAt
```

**Field Serialization Rules:**
- **Instructions:** Truncated to 1000 chars with "..." suffix in default export (full text in "detailed" mode)
- **JSON fields:** Serialized as minified JSON strings (e.g., `memoryConfigJson: '{"lastMessages":10}'`)
- **Array fields:** Serialized as semicolon-delimited (e.g., `tools: 'calculator;web-fetch;memory-recall'`)
- **Boolean fields:** Exported as `true`/`false` strings
- **Null values:** Exported as empty strings
- **Special characters:** Escaped via `csvEscape()` function

#### Import Schema (Required Columns)

**Minimum Required:**
```csv
slug,name,modelProvider,modelName,instructions
```

**Recognized Optional Columns:**
All export columns are recognized on import (excluding computed fields).

**Column Matching:**
- Case-insensitive header matching
- Trims whitespace from headers
- Supports both `memoryConfigJson` and `memory_config_json` naming conventions

### 3.2 CSV Parsing Strategy

**Option A: Custom Parser (Recommended)**
- Follows existing pattern in `packages/agentc2/src/bim/adapters/csv-adapter.ts`
- Handles quoted values, escaped quotes, multi-line values
- No external dependencies
- Full control over error messages

**Option B: External Library (Alternative)**
- Add `papaparse` dependency (`^5.4.1`)
- More robust parsing with edge case handling
- Industry-standard error reporting
- 13KB gzipped bundle size

**Recommendation:** Use **custom parser** initially, migrate to `papaparse` if edge cases emerge.

### 3.3 API Endpoints

#### 3.3.1 Export Endpoint

**Route:** `GET /api/agents/export`

**Query Parameters:**
```typescript
{
  format: "csv" | "jsonl",           // Default: "csv"
  mode: "default" | "detailed",      // Default: "default" (truncates instructions)
  includeArchived: boolean,          // Default: false
  filter?: {
    type?: "USER" | "DEMO",
    visibility?: "PRIVATE" | "ORGANIZATION" | "PUBLIC",
    isActive?: boolean
  }
}
```

**Authentication:**
- Requires valid session or API key
- Uses `authenticateRequest()` pattern

**Authorization:**
- Requires RBAC "read" permission
- Scoped to user's default workspace (or specified workspaceId)

**Response Headers:**
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agents-{workspaceSlug}-{timestamp}.csv"
Cache-Control: no-cache
```

**Response Body (CSV):**
```csv
slug,name,modelProvider,modelName,instructions,description,temperature,...
assistant,AI Assistant,openai,gpt-4o,"You are a helpful assistant...",General purpose assistant,0.7,...
research-agent,Research Agent,anthropic,claude-sonnet-4-20250514,"You are a research expert...",Deep research specialist,0.9,...
```

**Response Body (JSONL):**
```jsonl
{"slug":"assistant","name":"AI Assistant","modelProvider":"openai",...}
{"slug":"research-agent","name":"Research Agent","modelProvider":"anthropic",...}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Workspace not found
- `500 Internal Server Error` - Unexpected failure

**Performance Considerations:**
- Limit to 1000 agents per export (pagination if exceeded)
- Stream response for large datasets
- Add rate limit: 5 exports per minute per user

#### 3.3.2 Import Endpoint

**Route:** `POST /api/agents/import`

**Request Headers:**
```
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```typescript
{
  file: File,                        // CSV file
  mode: "skip" | "overwrite",        // Conflict resolution mode (default: "skip")
  workspaceId?: string,              // Target workspace (default: user's default)
  dryRun?: boolean                   // Validate only, don't commit (default: false)
}
```

**Authentication & Authorization:**
- Same as CREATE endpoint
- Requires RBAC "create" permission for new agents
- Requires RBAC "update" permission if mode="overwrite"

**Validation Rules:**

1. **File Validation:**
   - Max size: 5MB (`MAX_CSV_UPLOAD_BYTES`)
   - Extension: `.csv` only
   - Max rows: 1000 (prevent DoS)

2. **Schema Validation (per row):**
   - Required fields: slug, name, modelProvider, modelName, instructions
   - Field length limits (per Zod schema)
   - Slug format: `/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/`
   - Temperature range: 0-2
   - maxSteps range: 1-500
   - Enum validation: modelProvider, visibility, type

3. **Business Rule Validation:**
   - Model provider validation via `validateModelSelection()`
   - Unique slug per workspace (conflict detection)
   - Unique name per organization (conflict detection)
   - Tool ID existence check (reject invalid toolIds)
   - Workflow ID existence check (reject invalid workflowIds)
   - SubAgent slug existence check (reject invalid subAgent references)

4. **JSON Field Validation:**
   - Parse and validate JSON syntax for: memoryConfig, modelConfig, routingConfig, contextConfig, metadata
   - Validate structure against Zod schemas

**Response Body:**
```typescript
{
  success: boolean,
  summary: {
    total: number,              // Total rows processed
    created: number,            // New agents created
    updated: number,            // Existing agents updated
    skipped: number,            // Rows skipped due to conflicts (skip mode)
    errors: number              // Validation/processing errors
  },
  results: Array<{
    rowNumber: number,          // CSV row number (1-indexed)
    slug: string,
    status: "created" | "updated" | "skipped" | "error",
    message?: string,           // Error message or skip reason
    agentId?: string            // Created/updated agent ID
  }>,
  errors: Array<{               // Validation errors by row
    rowNumber: number,
    field?: string,             // Field name if field-specific error
    message: string,
    value?: string              // Invalid value for debugging
  }>
}
```

**Example Response:**
```json
{
  "success": true,
  "summary": {
    "total": 50,
    "created": 45,
    "updated": 0,
    "skipped": 3,
    "errors": 2
  },
  "results": [
    {"rowNumber": 1, "slug": "assistant", "status": "created", "agentId": "clu..."},
    {"rowNumber": 2, "slug": "research", "status": "skipped", "message": "Agent with slug 'research' already exists"},
    {"rowNumber": 3, "slug": "invalid", "status": "error", "message": "Model 'gpt-99' not found for provider 'openai'"}
  ],
  "errors": [
    {"rowNumber": 3, "field": "modelName", "message": "Model not found", "value": "gpt-99"},
    {"rowNumber": 7, "field": "temperature", "message": "Must be between 0 and 2", "value": "5.0"}
  ]
}
```

**Transaction Strategy:**
- **No full rollback** - Partial success allowed (users may want to fix errors and re-import)
- Each agent creation/update is its own transaction
- Failed rows do not block successful rows
- Users can download error report and fix issues

**Rate Limiting:**
- Same as CREATE: `orgMutation:agentCreate:{orgId}` (applies per agent created)
- Import-specific: 1 import per minute per user (`agentImport:{userId}`)

---

### 3.4 UI/UX Design

#### 3.4.1 Export UI

**Location:** `apps/agent/src/app/agents/page.tsx` (add to existing page)

**UI Elements:**

1. **Export Button** (header toolbar, next to "Create Agent")
   - Icon: DownloadIcon
   - Label: "Export"
   - Dropdown menu:
     - "Export All (CSV)"
     - "Export All (JSON)"
     - "Export Selected (CSV)" - only enabled when agents are selected
     - "Export Selected (JSON)" - only enabled when agents are selected

2. **Export Options Dialog** (optional, for advanced users)
   - **Format:** CSV / JSONL (radio buttons)
   - **Detail Level:** 
     - Default (truncated instructions, core fields only)
     - Detailed (full instructions, all fields)
   - **Filters:**
     - Include archived agents (checkbox)
     - Agent type: All / USER / DEMO
     - Visibility: All / PRIVATE / ORGANIZATION / PUBLIC
     - Active status: All / Active / Inactive
   - **Preview:** Shows column list based on selections
   - **Export Button:** Triggers download

**Interaction Flow:**
1. User clicks "Export" → Dropdown menu appears
2. User selects export type → File downloads immediately (simple export)
   OR user selects "Export with options..." → Dialog opens → Configure → Export

**Visual Design:**
- Follows existing button/dropdown patterns in agents page
- Uses `@repo/ui` components: `Button`, `DropdownMenu`, `Dialog`
- Success feedback via toast notification: "Exported 47 agents"

#### 3.4.2 Import UI

**Location:** `apps/agent/src/app/agents/page.tsx` (new dialog component)

**Component:** `ImportAgentsDialog` (new component)

**UI Elements:**

1. **Import Button** (header toolbar, next to "Export")
   - Icon: UploadIcon
   - Label: "Import"
   - Opens dialog

2. **Import Dialog** (modal)
   
   **Tab 1: Upload File**
   - Drag-and-drop zone (dashed border, hover effect)
   - File input (hidden, triggered by zone click)
   - Accepted formats: `.csv` only
   - Max size: 5MB
   - Shows selected filename with remove button
   
   **Tab 2: Paste CSV** (optional, for power users)
   - Textarea for pasting CSV content
   - Syntax highlighting (if feasible)
   
   **Common Elements:**
   - **Conflict Resolution:**
     - Radio buttons: "Skip existing" (default) / "Overwrite existing"
     - Warning icon + text explaining implications
   - **Workspace Selector:** (if user has multiple workspaces)
     - Dropdown with workspace names
     - Default: Current workspace
   - **Dry Run Toggle:** (checkbox)
     - "Validate only (don't save)"
     - For previewing results without committing

3. **Preview Step** (after file selected)
   - Shows first 10 rows in table format
   - Highlights validation errors (red background)
   - Shows column mapping (CSV header → Agent field)
   - Shows detected conflicts (yellow warning icon)
   - "Back" button to re-select file
   - "Import" button to proceed

4. **Results Screen** (after import completes)
   - **Summary Cards:**
     - Total Processed: 50
     - ✓ Created: 45 (green)
     - ↻ Updated: 0 (blue)
     - ⊘ Skipped: 3 (yellow)
     - ✕ Errors: 2 (red)
   - **Detailed Results Table:**
     - Columns: Row #, Slug, Status, Message, Actions
     - Filterable by status
     - Sortable by row number
     - Export error rows as CSV (for fixing)
   - **Actions:**
     - "Import Another File" (returns to upload step)
     - "View Agents" (closes dialog, navigates to agents list)
     - "Download Error Report" (CSV with only failed rows)

**Error Display Patterns:**
- Inline errors in preview table (red border + tooltip)
- Summary error counts with breakdown by error type
- Downloadable error report for bulk fixing

**Loading States:**
- Parsing: "Parsing CSV..." (spinner)
- Validation: "Validating X rows..." (progress bar)
- Import: "Importing agents... X/Y completed" (progress bar)

**Visual Design:**
- Follows existing `upload-document-dialog.tsx` pattern
- Uses `@repo/ui` components throughout
- Responsive layout (mobile-friendly)

#### 3.4.3 Bulk Select & Export (Enhanced)

**Enhancement to existing agents page:**

1. **Add Checkbox Column** (table view only)
   - Header checkbox: Select/deselect all (current page)
   - Row checkboxes: Individual selection
   - State: `Set<string>` for selected agent IDs

2. **Bulk Actions Toolbar** (appears when selection active)
   - Shows count: "3 agents selected"
   - "Export Selected" button
   - "Archive Selected" button
   - "Delete Selected" button (with confirmation)
   - "Clear Selection" link

3. **Select All Pages** (optional enhancement)
   - Banner: "All 15 agents on this page are selected. Select all 247 agents?"
   - Button: "Select all 247 agents"

---

### 3.5 Backend Implementation Details

#### 3.5.1 Export Service

**File:** `apps/agent/src/lib/agent-export.ts` (new)

```typescript
export interface ExportOptions {
    workspaceId: string;
    organizationId: string;
    format: "csv" | "jsonl";
    mode: "default" | "detailed";
    includeArchived: boolean;
    filters?: {
        type?: AgentType;
        visibility?: AgentVisibility;
        isActive?: boolean;
        agentIds?: string[];  // For "export selected"
    };
}

export interface ExportResult {
    filename: string;
    content: string;
    mimeType: string;
    count: number;
}

export async function exportAgents(options: ExportOptions): Promise<ExportResult>
```

**Implementation Logic:**

1. **Query agents** (workspace-scoped, with filters)
   ```typescript
   const agents = await prisma.agent.findMany({
       where: {
           workspaceId: options.workspaceId,
           workspace: { organizationId: options.organizationId },
           ...(options.filters?.type && { type: options.filters.type }),
           ...(options.filters?.agentIds && { id: { in: options.filters.agentIds } }),
           ...(!options.includeArchived && { isArchived: false })
       },
       include: {
           tools: { select: { toolId: true, config: true } },
           workspace: { select: { slug: true } }
       },
       orderBy: { createdAt: "asc" }
   });
   ```

2. **Serialize to CSV:**
   - Map each agent to CSV row
   - Truncate instructions if `mode === "default"` (max 1000 chars)
   - Serialize tools as semicolon-delimited: `tool1;tool2;tool3`
   - Serialize JSON fields as minified JSON strings
   - Escape all values via `csvEscape()`
   - Join rows with `\n`

3. **Serialize to JSONL:**
   - Map each agent to JSON object
   - Stringify each object
   - Join with `\n`

4. **Return formatted content** with appropriate headers

**Field Mapping Function:**
```typescript
function agentToCsvRow(agent: Agent, mode: "default" | "detailed"): string[] {
    const instructions = mode === "default" 
        ? truncateWithEllipsis(agent.instructions, 1000)
        : agent.instructions;
    
    const tools = agent.tools.map(t => t.toolId).join(";");
    const subAgents = agent.subAgents.join(";");
    const workflows = agent.workflows.join(";");
    
    return [
        agent.slug,
        agent.name,
        agent.modelProvider,
        agent.modelName,
        instructions,
        agent.description || "",
        agent.instructionsTemplate || "",
        agent.temperature?.toString() || "",
        agent.maxTokens?.toString() || "",
        agent.maxSteps?.toString() || "",
        agent.memoryEnabled.toString(),
        agent.memoryConfig ? JSON.stringify(agent.memoryConfig) : "",
        agent.modelConfig ? JSON.stringify(agent.modelConfig) : "",
        agent.routingConfig ? JSON.stringify(agent.routingConfig) : "",
        agent.contextConfig ? JSON.stringify(agent.contextConfig) : "",
        agent.visibility,
        agent.type,
        tools,
        workflows,
        subAgents,
        agent.requiresApproval.toString(),
        agent.maxSpendUsd?.toString() || "",
        agent.autoVectorize.toString(),
        agent.deploymentMode || "",
        agent.metadata ? JSON.stringify(agent.metadata) : "",
        agent.isActive.toString()
    ].map(csvEscape);
}
```

#### 3.5.2 Import Service

**File:** `apps/agent/src/lib/agent-import.ts` (new)

```typescript
export interface ImportOptions {
    csvContent: string;
    workspaceId: string;
    organizationId: string;
    userId: string;
    mode: "skip" | "overwrite";
    dryRun: boolean;
}

export interface ImportResult {
    success: boolean;
    summary: {
        total: number;
        created: number;
        updated: number;
        skipped: number;
        errors: number;
    };
    results: ImportRowResult[];
    errors: ValidationError[];
}

export interface ImportRowResult {
    rowNumber: number;
    slug: string;
    status: "created" | "updated" | "skipped" | "error";
    message?: string;
    agentId?: string;
}

export interface ValidationError {
    rowNumber: number;
    field?: string;
    message: string;
    value?: string;
}

export async function importAgents(options: ImportOptions): Promise<ImportResult>
```

**Implementation Logic:**

1. **Parse CSV:**
   ```typescript
   const rows = parseCSV(csvContent);  // Returns array of objects
   const headers = Object.keys(rows[0]);
   
   // Validate required columns
   const required = ["slug", "name", "modelProvider", "modelName", "instructions"];
   const missing = required.filter(h => !headers.includes(h));
   if (missing.length > 0) {
       throw new Error(`Missing required columns: ${missing.join(", ")}`);
   }
   ```

2. **Validate Each Row:**
   ```typescript
   const validationResults: ValidationResult[] = [];
   
   for (const [index, row] of rows.entries()) {
       const rowNumber = index + 2;  // +2 because: 0-indexed + header row
       const result = await validateImportRow(row, options, rowNumber);
       validationResults.push(result);
   }
   ```

3. **Detect Conflicts:**
   ```typescript
   // Batch query for existing agents
   const existingSlugs = new Set(
       await prisma.agent.findMany({
           where: {
               workspaceId: options.workspaceId,
               slug: { in: rows.map(r => r.slug) }
           },
           select: { slug: true, id: true, name: true }
       }).then(agents => agents.map(a => a.slug))
   );
   
   for (const result of validationResults) {
       if (existingSlugs.has(result.slug)) {
           result.conflict = "slug_exists";
       }
   }
   ```

4. **Execute Import (Transaction per Agent):**
   ```typescript
   const results: ImportRowResult[] = [];
   
   for (const validation of validationResults) {
       if (validation.errors.length > 0) {
           results.push({ rowNumber: validation.rowNumber, slug: validation.slug, status: "error", message: validation.errors[0] });
           continue;
       }
       
       if (validation.conflict && options.mode === "skip") {
           results.push({ rowNumber: validation.rowNumber, slug: validation.slug, status: "skipped", message: "Agent already exists" });
           continue;
       }
       
       try {
           if (validation.conflict && options.mode === "overwrite") {
               // Update existing agent
               const agent = await updateAgentFromRow(validation.data, options);
               results.push({ rowNumber: validation.rowNumber, slug: validation.slug, status: "updated", agentId: agent.id });
           } else {
               // Create new agent
               const agent = await createAgentFromRow(validation.data, options);
               results.push({ rowNumber: validation.rowNumber, slug: validation.slug, status: "created", agentId: agent.id });
           }
       } catch (error) {
           results.push({ rowNumber: validation.rowNumber, slug: validation.slug, status: "error", message: error.message });
       }
   }
   ```

5. **Return Results:**
   ```typescript
   return {
       success: results.some(r => r.status === "created" || r.status === "updated"),
       summary: {
           total: rows.length,
           created: results.filter(r => r.status === "created").length,
           updated: results.filter(r => r.status === "updated").length,
           skipped: results.filter(r => r.status === "skipped").length,
           errors: results.filter(r => r.status === "error").length
       },
       results,
       errors: validationResults.flatMap(v => v.errors)
   };
   ```

#### 3.5.3 Validation Service

**File:** `apps/agent/src/lib/agent-import-validation.ts` (new)

```typescript
export interface ValidationResult {
    rowNumber: number;
    slug: string;
    data: ParsedAgentData;
    errors: ValidationError[];
    warnings: string[];
    conflict?: "slug_exists" | "name_exists";
}

export async function validateImportRow(
    row: Record<string, string>,
    options: ImportOptions,
    rowNumber: number
): Promise<ValidationResult>
```

**Validation Steps:**

1. **Required Field Check:**
   ```typescript
   if (!row.slug?.trim()) errors.push({ field: "slug", message: "Required field missing" });
   ```

2. **Schema Validation (Zod):**
   ```typescript
   const result = agentCreateSchema.safeParse(data);
   if (!result.success) {
       errors.push(...result.error.issues.map(i => ({
           field: i.path.join("."),
           message: i.message
       })));
   }
   ```

3. **Model Validation:**
   ```typescript
   const modelValidation = await validateModelSelection(
       row.modelProvider as ModelProvider,
       row.modelName,
       options.organizationId
   );
   if (!modelValidation.valid) {
       errors.push({ field: "modelName", message: modelValidation.message });
   }
   ```

4. **Tool Existence Check:**
   ```typescript
   const toolIds = row.tools?.split(";").map(t => t.trim()).filter(Boolean) || [];
   const validTools = await toolRegistry.getToolsByNames(toolIds);
   const invalidTools = toolIds.filter(id => !validTools.find(t => t.name === id));
   if (invalidTools.length > 0) {
       warnings.push(`Unknown tools (will be skipped): ${invalidTools.join(", ")}`);
   }
   ```

5. **JSON Field Parsing:**
   ```typescript
   if (row.memoryConfigJson) {
       try {
           const parsed = JSON.parse(row.memoryConfigJson);
           const validated = memoryConfigSchema.safeParse(parsed);
           if (!validated.success) {
               errors.push({ field: "memoryConfigJson", message: "Invalid structure" });
           }
       } catch (e) {
           errors.push({ field: "memoryConfigJson", message: "Invalid JSON syntax" });
       }
   }
   ```

6. **Cross-Reference Validation:**
   ```typescript
   // Validate subAgents exist
   if (row.subAgents) {
       const subAgentSlugs = row.subAgents.split(";").map(s => s.trim()).filter(Boolean);
       const existing = await prisma.agent.findMany({
           where: { workspaceId: options.workspaceId, slug: { in: subAgentSlugs } },
           select: { slug: true }
       });
       const invalid = subAgentSlugs.filter(s => !existing.find(a => a.slug === s));
       if (invalid.length > 0) {
           warnings.push(`Unknown subAgents (will be ignored): ${invalid.join(", ")}`);
       }
   }
   ```

#### 3.5.4 CSV Parser

**File:** `apps/agent/src/lib/csv-parser.ts` (new)

```typescript
export interface ParseOptions {
    maxRows?: number;      // Default: 1000
    trim?: boolean;        // Default: true
    skipEmptyLines?: boolean;  // Default: true
}

export function parseCSV(content: string, options?: ParseOptions): Record<string, string>[]
```

**Implementation:**
- Split by newlines, handle quoted fields
- Parse header row
- Map each row to object with header keys
- Handle edge cases: escaped quotes, multi-line values, commas in quoted strings
- Validate row structure (consistent column count)

**Error Handling:**
- Throw on malformed CSV (unclosed quotes, inconsistent columns)
- Provide helpful error messages with line numbers

---

### 3.6 Security Considerations

#### 3.6.1 Authentication & Authorization

**Export Endpoint:**
- Requires authentication (session or API key)
- Requires RBAC "read" permission
- Scoped to user's workspace (no cross-workspace leaks)

**Import Endpoint:**
- Requires authentication (session or API key)
- Requires RBAC "create" permission (for new agents)
- Requires RBAC "update" permission (for overwrite mode)
- Validates workspace ownership
- Enforces same validation as single-agent CREATE

#### 3.6.2 Rate Limiting

**Export:**
- `agentExport:{userId}` → 5 requests per minute
- `agentExport:org:{orgId}` → 20 requests per minute (org-wide)

**Import:**
- `agentImport:{userId}` → 1 request per minute
- `agentImportRows:{userId}` → 100 rows per minute (cumulative across imports)
- Reuse `orgMutation:agentCreate:{orgId}` for per-agent creation

#### 3.6.3 Input Validation

**File Size Limits:**
- CSV upload: 5MB max (`MAX_CSV_UPLOAD_BYTES`)
- Rows: 1000 max per import
- Instructions field: 100,000 chars (existing limit)

**Content Validation:**
- CSV structure validation (header consistency)
- Schema validation via Zod
- Business rule validation (model exists, unique names, etc.)
- JSON syntax validation for JSON fields

**Injection Prevention:**
- All CSV values are escaped via `csvEscape()`
- No formula injection risk (CSV readers like Excel will show raw text)
- Parameterized SQL queries (Prisma ORM)

#### 3.6.4 Data Isolation

**Workspace Scoping:**
- All exports are scoped to a single workspace
- All imports target a single workspace
- No cross-workspace or cross-org data leakage

**RBAC Enforcement:**
- Same permissions as single-agent operations
- Cannot import agents into workspaces user doesn't own
- Cannot export agents from workspaces user doesn't have access to

---

### 3.7 Error Handling Strategy

#### 3.7.1 Export Errors

**Scenarios:**
1. **No agents found:** Return 404 with message "No agents found in workspace"
2. **Database error:** Return 500 with generic error message (log details server-side)
3. **Serialization error:** Return 500 (should not happen with proper escaping)

**User Experience:**
- Toast notification: "Failed to export agents. Please try again."
- Option to retry or contact support

#### 3.7.2 Import Errors

**Scenarios & Handling:**

| Error Type | HTTP Status | User Action |
|------------|-------------|-------------|
| **File too large** | 413 | Show error: "File exceeds 5MB limit. Split into smaller files." |
| **Invalid CSV format** | 400 | Show parse error with line number: "Malformed CSV at line 23: unclosed quote" |
| **Missing required columns** | 400 | Show missing columns: "CSV missing required columns: slug, instructions" |
| **Too many rows** | 400 | Show error: "CSV contains 1500 rows. Maximum is 1000. Split into multiple files." |
| **Validation errors** | 200 (partial success) | Show results screen with error breakdown. Allow export of failed rows for fixing. |
| **All rows failed** | 400 | Show error summary. Provide downloadable error report. |
| **Rate limit exceeded** | 429 | Show error: "Rate limit exceeded. Please wait 60 seconds." |

**Partial Success Handling:**
- Treat as success if at least one agent was created/updated
- Show detailed results with errors highlighted
- Provide option to download failed rows as CSV
- Allow user to fix and re-import failed rows

**Transaction Strategy:**
- Each agent creation/update is its own transaction
- Failed agents don't block successful ones
- No full rollback (users expect partial imports to succeed)

---

## 4. Data Model Changes

### 4.1 Schema Changes

**No schema changes required.** The feature uses existing Agent, AgentTool, AgentVersion, and related models.

### 4.2 New Database Queries

**Export Query:**
```sql
SELECT a.*, at.toolId, at.config, w.slug as workspaceSlug
FROM agent a
LEFT JOIN agent_tool at ON a.id = at.agentId
LEFT JOIN workspace w ON a.workspaceId = w.id
WHERE a.workspaceId = ? 
  AND w.organizationId = ?
  AND a.isArchived = false
ORDER BY a.createdAt ASC;
```

**Import Conflict Detection:**
```sql
SELECT slug, id, name
FROM agent
WHERE workspaceId = ?
  AND slug IN (?, ?, ?, ...);  -- Batch query
```

**Import Name Uniqueness Check:**
```sql
SELECT id, name
FROM agent a
JOIN workspace w ON a.workspaceId = w.id
WHERE w.organizationId = ?
  AND a.name IN (?, ?, ?, ...);  -- Batch query
```

### 4.3 Indexing Considerations

**Existing indexes are sufficient:**
- `@@index([workspaceId])` on Agent - Supports workspace-scoped queries
- `@@unique([workspaceId, slug])` - Conflict detection
- `@@unique([agentId, toolId])` on AgentTool - Tool assignment

**No new indexes needed.**

---

## 5. API Design

### 5.1 Export API

**Endpoint:** `GET /api/agents/export`

**Query Parameters:**
```typescript
interface ExportQueryParams {
    format?: "csv" | "jsonl";        // Default: "csv"
    mode?: "default" | "detailed";   // Default: "default"
    includeArchived?: string;        // "true" | "false", default: "false"
    type?: "USER" | "DEMO";          // Filter by type
    visibility?: "PRIVATE" | "ORGANIZATION" | "PUBLIC";  // Filter by visibility
    isActive?: string;               // "true" | "false"
    ids?: string;                    // Comma-separated agent IDs (for "export selected")
}
```

**Success Response:**
- Status: 200
- Headers:
  - `Content-Type: text/csv` or `application/jsonl`
  - `Content-Disposition: attachment; filename="agents-{workspace}-{timestamp}.csv"`
- Body: CSV or JSONL content

**Error Responses:**
```typescript
// 401 Unauthorized
{ "success": false, "error": "Unauthorized" }

// 403 Forbidden
{ "success": false, "error": "Insufficient permissions to export agents" }

// 404 Not Found
{ "success": false, "error": "No agents found in workspace" }

// 429 Rate Limit
{ "success": false, "error": "Rate limit exceeded. Try again in 60 seconds." }

// 500 Internal Error
{ "success": false, "error": "Failed to export agents" }
```

### 5.2 Import API

**Endpoint:** `POST /api/agents/import`

**Request Headers:**
```
Content-Type: multipart/form-data
```

**Request Body:**
```typescript
{
    file: File,                   // CSV file (required)
    mode: "skip" | "overwrite",  // Default: "skip"
    workspaceId?: string,        // Default: user's default workspace
    dryRun?: "true" | "false"    // Default: "false"
}
```

**Success Response:**
```json
{
  "success": true,
  "summary": {
    "total": 50,
    "created": 45,
    "updated": 0,
    "skipped": 3,
    "errors": 2
  },
  "results": [
    {
      "rowNumber": 1,
      "slug": "assistant",
      "status": "created",
      "agentId": "clu1234..."
    },
    {
      "rowNumber": 2,
      "slug": "research",
      "status": "skipped",
      "message": "Agent with slug 'research' already exists"
    },
    {
      "rowNumber": 3,
      "slug": "invalid",
      "status": "error",
      "message": "Model 'gpt-99' not found for provider 'openai'"
    }
  ],
  "errors": [
    {
      "rowNumber": 3,
      "field": "modelName",
      "message": "Model 'gpt-99' not found for provider 'openai'",
      "value": "gpt-99"
    }
  ]
}
```

**Error Responses:**
```typescript
// 400 Bad Request - File validation
{
  "success": false,
  "error": "File exceeds maximum size of 5MB"
}
{
  "success": false,
  "error": "CSV missing required columns: slug, instructions"
}
{
  "success": false,
  "error": "CSV contains 1500 rows. Maximum is 1000."
}

// 400 Bad Request - All rows failed
{
  "success": false,
  "error": "All rows failed validation",
  "summary": { "total": 10, "created": 0, "updated": 0, "skipped": 0, "errors": 10 },
  "errors": [...]
}

// 401 Unauthorized
{
  "success": false,
  "error": "Unauthorized"
}

// 403 Forbidden
{
  "success": false,
  "error": "Insufficient permissions to import agents"
}
{
  "success": false,
  "error": "Cannot import to workspace: insufficient access"
}

// 413 Payload Too Large
{
  "success": false,
  "error": "File size exceeds maximum allowed size"
}

// 429 Rate Limit
{
  "success": false,
  "error": "Rate limit exceeded. Please wait 60 seconds."
}

// 500 Internal Error
{
  "success": false,
  "error": "Failed to process import",
  "details": "..." // Only in development
}
```

---

## 6. Implementation Phases

### Phase 1: Basic Export (Minimal Viable Feature)

**Goal:** Enable users to download their agent configurations as CSV

**Deliverables:**
1. ✅ Export API endpoint (`GET /api/agents/export?format=csv`)
   - Default mode only (truncated instructions)
   - CSV format only
   - No filters (exports all active agents)
   - Workspace-scoped
2. ✅ Export button in agents page UI
   - Simple button with download icon
   - Triggers immediate download
   - Toast notification on success/error
3. ✅ CSV serialization utility
   - `csvEscape()` function
   - Field mapping with truncation
   - Tool list serialization (semicolon-delimited)
4. ✅ Basic documentation
   - CSV column reference
   - Example CSV file

**Testing:**
- Unit tests for CSV serialization
- Integration test for export endpoint
- E2E test: Export 50 agents, verify CSV structure

**Estimated Complexity:** Low  
**Risks:** Minimal (read-only operation)

---

### Phase 2: Advanced Export Options

**Goal:** Provide users with control over export format and content

**Deliverables:**
1. ✅ Export options dialog
   - Format selector (CSV / JSONL)
   - Detail level (default / detailed)
   - Include archived toggle
   - Type/visibility filters
2. ✅ Export selected agents
   - Add checkbox column to agents table
   - Bulk select state management
   - "Export Selected" button
3. ✅ JSONL format support
4. ✅ Detailed mode (full instructions, all fields)
5. ✅ Enhanced filename: `agents-{workspaceSlug}-{timestamp}-{count}.csv`

**Testing:**
- UI tests for options dialog
- Export with various filter combinations
- Export selected (subset of agents)
- JSONL format validation

**Estimated Complexity:** Low-Medium  
**Risks:** Low (still read-only)

---

### Phase 3: Basic Import (Core Functionality)

**Goal:** Enable users to import agents from CSV

**Deliverables:**
1. ✅ CSV parser utility
   - Handle quoted values, escaped characters
   - Multi-line value support
   - Column count validation
2. ✅ Import validation service
   - Required field checks
   - Schema validation (Zod)
   - Model provider validation
   - Conflict detection
3. ✅ Import API endpoint (`POST /api/agents/import`)
   - File upload handling (multipart/form-data)
   - Batch validation
   - Skip mode only (no overwrite yet)
   - Transaction per agent
   - Detailed results response
4. ✅ Basic import UI
   - Upload dialog with file picker
   - Loading state during upload/processing
   - Results screen with success/error counts
5. ✅ Error reporting
   - Downloadable error report (CSV with failed rows)

**Testing:**
- Unit tests for CSV parser (edge cases)
- Unit tests for validation service
- Integration tests for import endpoint:
  - Valid import (all succeed)
  - Partial failure (some rows fail)
  - All fail (no agents created)
  - Duplicate slugs (skip mode)
- E2E test: Import 20 agents, verify creation

**Estimated Complexity:** Medium  
**Risks:** 
- Data integrity (mitigated by validation)
- Partial failure handling (handled via per-agent transactions)

---

### Phase 4: Advanced Import Features

**Goal:** Provide power users with advanced import capabilities

**Deliverables:**
1. ✅ Overwrite mode
   - Conflict resolution: update existing agents
   - Preserve relationships (runs, versions) on update
   - Version snapshot on update
2. ✅ Preview step
   - Client-side CSV parsing
   - Preview table (first 10 rows)
   - Inline validation feedback
   - Conflict highlighting (yellow)
   - Error highlighting (red)
3. ✅ Dry run mode
   - Validate without saving
   - Show what would happen
   - Full validation including model checks
4. ✅ Paste CSV mode
   - Textarea for direct CSV input
   - Useful for small imports or programmatic generation
5. ✅ Enhanced results screen
   - Filterable/sortable results table
   - Per-row status with expandable error details
   - "Retry failed rows" action
   - Navigate to created agents

**Testing:**
- Overwrite mode with existing agents
- Preview validation accuracy
- Dry run vs. actual import comparison
- Paste mode with various CSV inputs

**Estimated Complexity:** Medium-High  
**Risks:**
- Overwrite mode could accidentally modify production agents (mitigated by preview + confirmation)
- Preview validation must match server-side validation (mitigated by shared validation logic)

---

### Phase 5: Batch Operations & Optimizations

**Goal:** Optimize for large-scale operations (100+ agents)

**Deliverables:**
1. ✅ Batch database operations
   - Single query for conflict detection (currently implemented per-row)
   - Batch tool existence checks
   - Batch model validation
2. ✅ Streaming import (for 500+ rows)
   - Process in chunks of 50
   - WebSocket or SSE for progress updates
   - Pause/resume support
3. ✅ Background job processing (Inngest)
   - Queue import job for large files (>200 rows)
   - Progress tracking
   - Email notification on completion
4. ✅ Export filters UI
   - Filter by date range (createdAt)
   - Filter by owner
   - Filter by health score
   - Filter by tool usage
5. ✅ Import from URL
   - Accept CSV URL instead of file upload
   - Fetch and process remotely hosted CSV

**Testing:**
- Performance benchmarks (1000 agent import)
- Concurrent import handling
- Background job execution
- Memory usage profiling

**Estimated Complexity:** High  
**Risks:**
- Memory exhaustion on large files (mitigated by streaming)
- Long-running imports timing out (mitigated by background jobs)

---

### Phase 6: Advanced Features & Polish

**Goal:** Enterprise-grade features for power users

**Deliverables:**
1. ✅ Import templates
   - Downloadable CSV template with headers and example rows
   - Field descriptions as CSV comments
   - Multiple template variants (basic, advanced, with-tools)
2. ✅ Field mapping UI
   - Map CSV columns to agent fields
   - Handle custom column names
   - Save mapping presets
3. ✅ Import history
   - Track all imports in database (new model: `AgentImportLog`)
   - Show import history page
   - Rollback capability (delete agents from specific import)
4. ✅ Export presets
   - Save export configurations
   - Quick export buttons (e.g., "Export Active Agents", "Export with Tools")
5. ✅ Scheduled exports
   - Weekly/monthly export schedules
   - Email delivery or cloud storage upload (S3, Google Drive)
6. ✅ Audit trail
   - Record all import/export operations in `ChangeLog`
   - Who, when, what (count), workspace

**Testing:**
- Template download and re-import (round-trip)
- Field mapping with various CSV formats
- Import history and rollback
- Scheduled export execution

**Estimated Complexity:** High  
**Risks:**
- Feature creep (mitigated by phased approach)
- Maintenance burden (mitigated by comprehensive testing)

---

## 7. Impact Assessment

### 7.1 Affected Systems

#### Direct Impact (High)

1. **Agent Management UI** (`apps/agent/src/app/agents/page.tsx`)
   - Add export/import buttons
   - Add checkbox column for bulk select
   - Integrate new dialogs

2. **API Routes** (`apps/agent/src/app/api/agents/`)
   - New export endpoint
   - New import endpoint
   - Reuse existing validation logic

3. **Agent Services** (`packages/agentc2/src/agents/`)
   - New export service module
   - New import service module
   - New CSV parser utility

#### Indirect Impact (Medium)

1. **Rate Limiting** (`apps/agent/src/lib/rate-limit.ts`)
   - Add new rate limit policies for export/import

2. **RBAC System** (`apps/agent/src/lib/authz/`)
   - Reuse existing permissions (create, update, read)
   - No new permissions needed

3. **Activity Logging** (`apps/agent/src/lib/activity-log.ts`)
   - Optional: Log export/import operations

#### No Impact (Low Risk)

1. **Agent Runtime** - No changes to agent execution
2. **Database Schema** - No schema changes
3. **Mastra Framework** - No framework modifications
4. **Other Apps** (`apps/frontend/`) - No changes

### 7.2 Breaking Changes

**None.** This is an additive feature with no breaking changes to existing APIs or behavior.

### 7.3 Backward Compatibility

**Fully compatible.** 
- Existing agent CRUD operations unchanged
- No database migrations required
- New endpoints do not conflict with existing routes

---

## 8. Security & Compliance

### 8.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Unauthorized export** | Authentication + RBAC checks, workspace scoping |
| **Cross-tenant data leak** | All queries scoped by workspaceId + organizationId |
| **Malicious CSV injection** | All values escaped, no formula execution |
| **CSV formula injection (Excel)** | Prefix suspicious values with single quote (optional enhancement) |
| **Denial of Service (large files)** | File size limits (5MB), row limits (1000), rate limiting |
| **Denial of Service (many imports)** | Rate limiting (1 import/min per user, 100 rows/min) |
| **Malicious tool/workflow references** | Validation: only existing tools/workflows can be referenced |
| **Privilege escalation (import to other org)** | Validate workspaceOwnership before import |
| **Model API key exposure** | API keys stored in IntegrationConnection (database), not in CSV |

### 8.2 Data Privacy

**Sensitive Data Handling:**
- **Instructions field:** May contain sensitive prompts or business logic
  - Mitigation: Export is authenticated and scoped to user's workspace
  - CSV files are downloaded to user's local machine (not stored server-side)
  - Recommend: Add warning in UI about sensitive data in CSV

- **Metadata field:** May contain internal identifiers or configuration
  - Same mitigation as instructions

- **Model configurations:** May reveal AI strategy
  - Same mitigation

**GDPR/Compliance:**
- No PII in agent configurations (agents don't store user data)
- Export is user-initiated (data portability right)
- No server-side storage of CSV files (privacy by design)

### 8.3 Audit Trail

**Recommended (Phase 6):**
- Log all export operations: `{ userId, workspaceId, exportedCount, timestamp }`
- Log all import operations: `{ userId, workspaceId, importedCount, createdCount, updatedCount, timestamp }`
- Store in `ChangeLog` or new `BulkOperationLog` table

---

## 9. Performance Considerations

### 9.1 Export Performance

**Bottlenecks:**
1. Database query for large agent counts
2. CSV serialization (string concatenation)
3. Network transfer for large files

**Optimizations:**
- Use Prisma's `findMany()` with `select` to fetch only needed fields
- Stream response for 100+ agents (NextResponse with ReadableStream)
- Add pagination: export in batches (e.g., 500 agents per file)
- Consider compression (gzip) for large exports

**Benchmarks (Estimated):**
- 50 agents: <1s
- 500 agents: 2-5s
- 1000 agents: 5-10s

### 9.2 Import Performance

**Bottlenecks:**
1. CSV parsing (large files)
2. Validation (per-row model checks)
3. Database writes (per-agent transactions)
4. AgentTool junction table writes

**Optimizations:**
- Parse CSV in chunks (streaming parser)
- Batch conflict detection (single query for all slugs)
- Batch model validation (cache results)
- Prisma batch create for AgentTool records
- Consider Inngest background jobs for 200+ rows

**Benchmarks (Estimated):**
- 50 agents: 5-10s
- 200 agents: 20-40s
- 1000 agents: 60-120s (should use background job)

### 9.3 Memory Usage

**Export:**
- Keep full result set in memory (array of agents)
- Estimated: 1KB per agent × 1000 = 1MB
- Risk: Low (CSV serialization is lightweight)

**Import:**
- Parse entire CSV into memory
- Estimated: 2KB per row × 1000 = 2MB
- Risk: Low (5MB file limit)

**Mitigation (if needed):**
- Stream processing for exports >500 agents
- Background jobs for imports >200 rows

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Export Service Tests:**
```typescript
describe("exportAgents", () => {
  test("exports agents as CSV with required columns");
  test("truncates instructions in default mode");
  test("includes full instructions in detailed mode");
  test("serializes tools as semicolon-delimited");
  test("serializes JSON fields correctly");
  test("escapes special characters (quotes, commas, newlines)");
  test("handles agents with no tools");
  test("handles agents with null optional fields");
  test("filters by type/visibility");
  test("excludes archived agents by default");
});
```

**Import Service Tests:**
```typescript
describe("importAgents", () => {
  test("imports valid agents successfully");
  test("validates required fields");
  test("rejects invalid modelProvider");
  test("rejects invalid modelName");
  test("rejects invalid slug format");
  test("parses JSON fields correctly");
  test("parses tool list (semicolon-delimited)");
  test("skips existing slugs in skip mode");
  test("updates existing slugs in overwrite mode");
  test("handles partial failures (some rows succeed, some fail)");
  test("returns detailed error report");
  test("respects max row limit (1000)");
  test("validates workspace ownership");
});
```

**CSV Parser Tests:**
```typescript
describe("parseCSV", () => {
  test("parses basic CSV with quoted values");
  test("handles escaped quotes (\"\")");
  test("handles multi-line values");
  test("handles empty fields");
  test("trims whitespace from values");
  test("rejects inconsistent column counts");
  test("rejects unclosed quotes");
  test("handles UTF-8 characters");
});
```

### 10.2 Integration Tests

**Export Endpoint:**
```typescript
describe("GET /api/agents/export", () => {
  test("returns 401 without authentication");
  test("returns 403 without read permission");
  test("exports agents for authenticated user's workspace");
  test("returns CSV with correct Content-Type and Content-Disposition");
  test("respects includeArchived parameter");
  test("filters by agent IDs (export selected)");
  test("returns 429 on rate limit exceeded");
  test("handles workspace with no agents (404)");
});
```

**Import Endpoint:**
```typescript
describe("POST /api/agents/import", () => {
  test("returns 401 without authentication");
  test("returns 403 without create permission");
  test("returns 400 on file too large");
  test("returns 400 on invalid CSV format");
  test("returns 400 on missing required columns");
  test("returns 400 on too many rows (>1000)");
  test("creates new agents from valid CSV");
  test("skips existing slugs in skip mode");
  test("updates existing slugs in overwrite mode");
  test("returns detailed validation report");
  test("handles partial success correctly");
  test("returns 429 on rate limit exceeded");
  test("enforces workspace ownership");
  test("validates tool IDs exist");
  test("validates model provider combinations");
});
```

### 10.3 E2E Tests

**Export Flow:**
```typescript
test("User exports all agents", async () => {
  // 1. Login as user
  // 2. Navigate to /agents
  // 3. Click "Export" button
  // 4. Verify download triggered
  // 5. Parse downloaded CSV
  // 6. Verify all active agents are present
  // 7. Verify CSV structure matches schema
});

test("User exports selected agents", async () => {
  // 1. Login as user
  // 2. Navigate to /agents
  // 3. Select 5 agents via checkboxes
  // 4. Click "Export Selected"
  // 5. Verify download contains only 5 agents
});
```

**Import Flow:**
```typescript
test("User imports agents from CSV", async () => {
  // 1. Login as user
  // 2. Navigate to /agents
  // 3. Click "Import" button
  // 4. Upload valid CSV file (10 agents)
  // 5. Verify preview shows 10 rows
  // 6. Click "Import"
  // 7. Wait for results screen
  // 8. Verify summary: 10 created, 0 errors
  // 9. Navigate to agents list
  // 10. Verify 10 new agents appear
});

test("User imports CSV with conflicts (skip mode)", async () => {
  // 1. Create 3 agents manually
  // 2. Import CSV with 10 agents (3 have same slugs)
  // 3. Verify results: 7 created, 3 skipped
  // 4. Verify existing agents unchanged
});

test("User imports CSV with errors", async () => {
  // 1. Upload CSV with validation errors (invalid modelName)
  // 2. Verify results screen shows errors
  // 3. Download error report
  // 4. Verify error report contains failed rows with error messages
});
```

**Round-Trip Test:**
```typescript
test("Export then import preserves agent configuration", async () => {
  // 1. Create 5 agents with various configurations
  // 2. Export to CSV (detailed mode)
  // 3. Delete agents
  // 4. Import CSV (overwrite mode)
  // 5. Query agents from database
  // 6. Assert all fields match original (except IDs, timestamps)
});
```

### 10.4 Manual Testing Checklist

**Export:**
- [ ] Export with 0 agents (verify 404)
- [ ] Export with 1 agent
- [ ] Export with 50+ agents
- [ ] Export with agents containing special characters (quotes, commas, newlines)
- [ ] Export with agents containing JSON configs
- [ ] Export with archived agents (includeArchived=true)
- [ ] Export selected (5 agents)
- [ ] Export in JSONL format
- [ ] Verify CSV opens correctly in Excel/Google Sheets/LibreOffice

**Import:**
- [ ] Import CSV with 1 agent
- [ ] Import CSV with 50+ agents
- [ ] Import CSV with missing required column (verify error)
- [ ] Import CSV with invalid modelName (verify error)
- [ ] Import CSV with existing slugs in skip mode (verify skipped)
- [ ] Import CSV with existing slugs in overwrite mode (verify updated)
- [ ] Import CSV with malformed JSON field (verify error)
- [ ] Import CSV with invalid tool IDs (verify warning)
- [ ] Import CSV with all rows failing (verify error)
- [ ] Import CSV with mixed success/failure (verify partial success)
- [ ] Import then export (verify round-trip accuracy)
- [ ] Import as non-admin user (verify permission denial)
- [ ] Import to workspace user doesn't own (verify 403)

---

## 11. Alternative Approaches Considered

### 11.1 JSON vs. CSV

**CSV (Proposed):**
- ✅ Familiar to non-technical users
- ✅ Easy to edit in Excel/Google Sheets
- ✅ Human-readable
- ❌ Limited support for nested structures (requires JSON serialization)
- ❌ Escape character complexity

**JSON:**
- ✅ Native support for nested objects
- ✅ No escaping issues
- ❌ Less familiar to non-developers
- ❌ Harder to edit manually

**Decision:** Support **both CSV (primary) and JSONL (secondary)**. CSV for accessibility, JSONL for programmatic use.

### 11.2 Import Validation Strategy

**Option A: Validate All, Then Import All (Rejected)**
- ✅ Cleaner UX (all-or-nothing)
- ❌ Blocks entire import if one row fails
- ❌ Users with 45 valid + 5 invalid rows must fix and re-upload all 50

**Option B: Import with Partial Success (Proposed)**
- ✅ Pragmatic for large imports
- ✅ Users can fix errors and re-import only failed rows
- ❌ Slightly more complex UX
- ❌ Database state is partially modified

**Decision:** **Partial success model** - more user-friendly for large-scale operations.

### 11.3 Conflict Resolution

**Option A: Fail on Conflict (Rejected)**
- ❌ Forces users to manually deduplicate CSVs
- ❌ Poor UX for incremental imports

**Option B: Skip Existing (Proposed Default)**
- ✅ Safe default behavior
- ✅ Idempotent imports
- ❌ Doesn't allow updating agents

**Option C: Overwrite Existing (Proposed Optional)**
- ✅ Enables bulk updates
- ✅ Useful for template-based agent management
- ❌ Risk of accidental overwrites (mitigated by preview + confirmation)

**Decision:** Support **both skip and overwrite modes** with skip as default.

### 11.4 Large File Handling

**Option A: Synchronous (Proposed for Phase 1-4)**
- ✅ Simple implementation
- ✅ Immediate feedback
- ❌ Request timeout risk (>200 agents)

**Option B: Background Job (Proposed for Phase 5)**
- ✅ Handles unlimited file sizes
- ✅ No timeout issues
- ❌ More complex (requires Inngest integration)
- ❌ Async feedback (email notification)

**Decision:** Start with **synchronous** for MVP, add **background jobs** in Phase 5 for 200+ agent imports.

---

## 12. Edge Cases & Considerations

### 12.1 CSV Parsing Edge Cases

1. **Multi-line instructions field:**
   - CSV standard: Wrap in quotes, preserve newlines
   - Parser must handle quoted multi-line values

2. **Commas in description/instructions:**
   - Wrap entire value in quotes
   - Escape internal quotes as `""`

3. **Unicode characters (emoji in names):**
   - UTF-8 encoding throughout
   - Test with emoji: "🤖 Robot Assistant"

4. **Extremely long instructions (50,000+ chars):**
   - Default export mode truncates to 1000 chars
   - Detailed mode includes full text
   - CSV cell may be large (Excel has 32,767 char limit per cell)
   - Recommendation: Warn users if instructions >30,000 chars

5. **Empty optional fields:**
   - Export as empty string (no quotes)
   - Import as null (Prisma default)

6. **Boolean fields:**
   - Export as lowercase "true"/"false"
   - Import: case-insensitive parsing ("true", "True", "1", "yes" → true)

7. **JSON fields with nested quotes:**
   - Serialize as minified JSON string
   - Escape entire JSON string in CSV
   - Example: `"{""lastMessages"":10}"`

### 12.2 Business Logic Edge Cases

1. **Agent name conflicts:**
   - Names must be unique per organization
   - On import, check existing names across all workspaces in org
   - If conflict, append numeric suffix: "Assistant" → "Assistant 2"

2. **Slug conflicts:**
   - Slugs must be unique per workspace
   - Skip mode: Skip the row
   - Overwrite mode: Update the existing agent

3. **Invalid tool references:**
   - Tool IDs in CSV may not exist in target workspace
   - Behavior: Warn user, skip invalid tools, import agent with valid tools only

4. **Circular subAgent references:**
   - Agent A references Agent B as subAgent, but Agent B is imported after Agent A
   - Behavior: Skip subAgent references during import, require manual setup

5. **Model availability:**
   - Model may exist in source workspace but not in target (different API keys)
   - Behavior: Validate models during import, fail row if model unavailable

6. **Workspace migration:**
   - User exports from Workspace A, imports to Workspace B
   - `workspaceId` column is exported but ignored on import (always uses target workspace)

7. **Agent versions:**
   - Export does NOT include historical versions (only current state)
   - Import creates new agents (version = 1)
   - Overwrite mode increments version and creates AgentVersion snapshot

### 12.3 UI/UX Edge Cases

1. **No agents to export:**
   - Disable export button with tooltip: "No agents to export"

2. **Import file parsing fails:**
   - Show error dialog: "Failed to parse CSV. Please check file format."
   - Provide link to CSV template download

3. **Import takes longer than expected:**
   - Show progress indicator: "Importing... 35/50 processed"
   - Allow cancellation (Phase 5)

4. **User closes browser during import:**
   - Synchronous: Import will be incomplete (some agents created)
   - Background job: Import continues, user notified via email

5. **Multiple users importing simultaneously:**
   - Rate limiting prevents abuse
   - Each import is scoped to user's workspace
   - No conflicts (workspace-scoped slugs)

---

## 13. Documentation Requirements

### 13.1 User Documentation

**Required Docs:**

1. **CSV Format Reference** (`docs/user/agent-import-export.md`)
   - Column definitions
   - Required vs. optional columns
   - Data type specifications
   - Example CSV snippets
   - Common errors and solutions

2. **Import/Export Guide** (in-app help or docs site)
   - Step-by-step instructions with screenshots
   - Use cases: backup, migration, bulk editing
   - Best practices: file size, testing, validation
   - Troubleshooting: common errors, how to fix

3. **CSV Template Files** (downloadable)
   - `agent-import-template-basic.csv` - Minimal required fields
   - `agent-import-template-full.csv` - All fields with examples
   - Include comments (if CSV reader supports) or separate README

### 13.2 Developer Documentation

**Required Docs:**

1. **API Documentation** (`docs/api/agents-bulk.md`)
   - Endpoint specifications
   - Request/response schemas
   - Authentication requirements
   - Rate limits
   - Example cURL commands

2. **Architecture Documentation** (this document)
   - System design
   - Component interactions
   - Data flow diagrams
   - Security model

3. **Code Comments**
   - Document validation rules
   - Document serialization logic
   - Document error handling strategy

---

## 14. Monitoring & Observability

### 14.1 Metrics to Track

**Export Metrics:**
- `agent_export_requests_total` (counter) - Total export requests
- `agent_export_count` (histogram) - Number of agents per export
- `agent_export_duration_ms` (histogram) - Export processing time
- `agent_export_errors_total` (counter) - Export failures by error type

**Import Metrics:**
- `agent_import_requests_total` (counter) - Total import requests
- `agent_import_rows_total` (counter) - Total rows processed
- `agent_import_created_total` (counter) - Agents created
- `agent_import_updated_total` (counter) - Agents updated
- `agent_import_errors_total` (counter) - Import failures by error type
- `agent_import_duration_ms` (histogram) - Import processing time

### 14.2 Logging

**Log Events:**
- Export initiated: `{ userId, workspaceId, format, mode, filters }`
- Export completed: `{ userId, workspaceId, count, duration }`
- Export failed: `{ userId, workspaceId, error }`
- Import initiated: `{ userId, workspaceId, mode, rowCount }`
- Import completed: `{ userId, workspaceId, created, updated, skipped, errors, duration }`
- Import failed: `{ userId, workspaceId, error }`
- Validation errors: `{ userId, workspaceId, rowNumber, errors }`

**Log Levels:**
- INFO: All export/import operations
- WARN: Validation warnings (invalid tool IDs, etc.)
- ERROR: Import failures, parsing errors

### 14.3 Alerts

**Recommended Alerts:**
- High import error rate (>50% errors) → Investigate data quality or validation bugs
- Large import volume spike → Potential abuse or migration activity
- Export errors → API or database issues

---

## 15. Future Enhancements (Beyond Phase 6)

### 15.1 Template Gallery

**Feature:** Pre-built agent templates downloadable as CSV
- "Customer Support Agent Pack" (5 agents)
- "Research Team" (3 agents)
- "Sales Automation Suite" (7 agents)

**Implementation:**
- Store templates in `/public/templates/`
- Gallery page with preview and download buttons
- Import directly from gallery (no manual download)

### 15.2 Google Sheets Integration

**Feature:** Export directly to Google Sheets, import from Sheets URL

**Implementation:**
- OAuth with Google Sheets API
- Export → Create new Sheet in user's Drive
- Import → Fetch Sheet via URL, convert to CSV, import

**Benefits:**
- Collaborative editing
- Version control (Sheet history)
- Formulas for bulk editing

### 15.3 Import Diff Preview

**Feature:** Show side-by-side diff before overwriting

**Implementation:**
- Fetch existing agent configuration
- Compare with incoming CSV data
- Highlight changed fields (red/green diff)
- User approves each conflict individually

### 15.4 Multi-Workspace Import

**Feature:** Import agents to multiple workspaces simultaneously

**Implementation:**
- CSV includes `targetWorkspaceSlug` column
- Validates user has access to all target workspaces
- Creates agents in respective workspaces

### 15.5 Agent Dependency Graph Export

**Feature:** Export agents with their subAgents/workflows as nested structure

**Implementation:**
- Detect dependency tree
- Export as hierarchical JSON
- Import resolves dependencies automatically

### 15.6 Import from URL

**Feature:** Import CSV from public URL (GitHub, S3, etc.)

**Implementation:**
- Add `url` field to import form
- Fetch CSV via HTTP
- Validate and import as normal

---

## 16. Open Questions & Decisions Needed

### 16.1 Product Decisions

1. **Should exported CSV include agent IDs?**
   - Pro: Enables overwrite by ID instead of slug
   - Con: IDs change between environments (not portable)
   - **Recommendation:** Include in detailed mode only, don't use for import matching

2. **Should import support updating by name instead of slug?**
   - Pro: More intuitive for users ("update Assistant")
   - Con: Names can change, less reliable than slugs
   - **Recommendation:** Match by slug only (primary key)

3. **Should we support Excel-specific features (formulas)?**
   - Pro: Power users can use formulas for bulk editing
   - Con: Security risk (formula injection)
   - **Recommendation:** No formula support. Treat all values as strings.

4. **Should archived agents be included by default?**
   - **Recommendation:** No (exclude by default, opt-in via `includeArchived=true`)

5. **Should import validate uniqueness of names in CSV?**
   - Scenario: CSV has 2 rows with same name
   - **Recommendation:** Allow duplicates in CSV, enforce uniqueness at DB level (second row fails)

### 16.2 Technical Decisions

1. **CSV parser library: custom vs. papaparse?**
   - **Recommendation:** Start with custom (Phase 1-3), evaluate papaparse in Phase 4 if issues arise

2. **Transaction scope: all-or-nothing vs. per-agent?**
   - **Recommendation:** Per-agent transactions (partial success allowed)

3. **Streaming vs. buffered response?**
   - **Recommendation:** Buffered for <500 agents, streaming for 500+

4. **Background jobs: when to trigger?**
   - **Recommendation:** Auto-trigger for imports >200 rows

5. **Tool config export: include or exclude?**
   - AgentTool junction table has `config` JSON field (tool-specific overrides)
   - **Recommendation:** Exclude from Phase 1-4 (complexity), add in Phase 5 as separate column

---

## 17. Success Criteria

### 17.1 Functional Requirements

- [ ] Users can export all agents in their workspace as CSV
- [ ] Users can import agents from CSV with validation
- [ ] Import skips existing agents by default (skip mode)
- [ ] Import can overwrite existing agents (overwrite mode)
- [ ] Validation errors are clearly reported with row numbers
- [ ] Partial import success is handled gracefully
- [ ] Round-trip export → import preserves core fields

### 17.2 Non-Functional Requirements

- [ ] Export 50 agents completes in <2 seconds
- [ ] Import 50 agents completes in <10 seconds
- [ ] CSV parsing handles special characters correctly
- [ ] Rate limiting prevents abuse
- [ ] RBAC enforced on all operations
- [ ] No cross-tenant data leakage
- [ ] Works in all modern browsers (Chrome, Firefox, Safari, Edge)

### 17.3 Quality Requirements

- [ ] Test coverage >80% for new code
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Storybook stories for new UI components
- [ ] User documentation published
- [ ] API documentation complete

---

## 18. Dependencies & Prerequisites

### 18.1 No New External Dependencies Required (Phase 1-4)

All functionality can be implemented with existing libraries.

### 18.2 Optional Dependencies (Phase 5-6)

**For enhanced CSV parsing:**
- `papaparse` (`^5.4.1`) - Robust CSV parsing with streaming support

**For streaming exports:**
- `web-streams-polyfill` (if targeting older browsers)

**For background jobs:**
- Already using `inngest` (`^3.50.0`)

### 18.3 Environment Variables

**No new environment variables required.**

Optionally, for Phase 5+:
```bash
AGENT_IMPORT_MAX_ROWS=1000           # Max rows per import (default: 1000)
AGENT_IMPORT_MAX_FILE_SIZE_MB=5      # Max file size in MB (default: 5)
AGENT_EXPORT_MAX_AGENTS=1000         # Max agents per export (default: 1000)
AGENT_IMPORT_BG_JOB_THRESHOLD=200    # Rows before triggering background job
```

---

## 19. Migration & Rollout Plan

### 19.1 Rollout Strategy

**Phase 1: Internal Testing (Week 1)**
- Deploy to staging environment
- Internal team testing with real agent data
- Gather feedback on UX and validation

**Phase 2: Beta Release (Week 2)**
- Enable for select customers (opt-in via feature flag)
- Monitor metrics and error rates
- Iterate on feedback

**Phase 3: General Availability (Week 3)**
- Enable for all users
- Announce in changelog
- Provide user documentation and video tutorial

### 19.2 Feature Flag

**Recommended:**
```bash
FEATURE_AGENT_BULK_IMPORT_EXPORT="true"  # Default: "false" during beta
```

**Code:**
```typescript
const isBulkImportExportEnabled = process.env.FEATURE_AGENT_BULK_IMPORT_EXPORT === "true";

// In UI:
{isBulkImportExportEnabled && <ExportButton />}

// In API:
if (!isBulkImportExportEnabled) {
  return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
}
```

### 19.3 Rollback Plan

**If critical bug discovered:**
1. Disable feature flag immediately
2. Hide UI buttons via config (no code deploy needed)
3. API endpoints return 403 "Feature temporarily disabled"
4. Fix bug, test thoroughly, re-enable

**Risk:** Low (read-only export + validated import)

---

## 20. Cost & Resource Estimation

### 20.1 Development Effort

| Phase | Deliverables | Complexity | Estimated Effort |
|-------|--------------|------------|------------------|
| **Phase 1** | Basic export (CSV) | Low | 2-3 days |
| **Phase 2** | Export options, JSONL, filters | Low-Medium | 2-3 days |
| **Phase 3** | Basic import, validation, skip mode | Medium | 4-5 days |
| **Phase 4** | Preview, overwrite, dry run | Medium-High | 3-4 days |
| **Phase 5** | Optimizations, background jobs | High | 5-6 days |
| **Phase 6** | Advanced features, polish | High | 5-7 days |
| **Total** | Full feature (all phases) | | **21-28 days** |

**Recommended MVP:** Phase 1-3 (8-11 days) provides core value.

### 20.2 Infrastructure Impact

**Storage:**
- No persistent storage of CSV files (download only)
- AgentVersion snapshots created on overwrite (existing behavior)

**Database:**
- Batch queries for conflict detection
- Per-agent transactions for import
- No schema changes

**Bandwidth:**
- CSV file downloads (minimal impact)
- CSV file uploads (5MB max)

**Compute:**
- Synchronous processing (Phase 1-4): negligible
- Background jobs (Phase 5): Inngest worker capacity

**Cost Estimate:** Negligible additional infrastructure cost.

---

## 21. Risk Assessment

### 21.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **CSV parsing edge cases** | Medium | Medium | Comprehensive unit tests, use papaparse if needed |
| **Import validation misses edge cases** | Medium | High | Extensive testing, dry run mode for users |
| **Performance issues (1000+ agents)** | Low | Medium | Row limits, streaming, background jobs |
| **Data corruption on import** | Low | Critical | Per-agent transactions, validation, dry run mode |
| **Cross-tenant data leak** | Very Low | Critical | Workspace scoping, auth checks, code review |

### 21.2 Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Users accidentally overwrite agents** | Medium | Medium | Preview step, confirmation dialog, default to skip mode |
| **CSV format confusion** | Medium | Low | Clear documentation, downloadable templates |
| **Feature complexity overwhelming users** | Low | Low | Phased rollout, simple default UX, advanced options hidden |
| **Low adoption** | Low | Low | User research, onboarding tutorial, changelog announcement |

### 21.3 Security Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **CSV injection attack** | Low | Low | All values escaped, no formula execution, user education |
| **DoS via large file upload** | Low | Medium | File size limits, row limits, rate limiting |
| **Unauthorized export of sensitive agents** | Very Low | Medium | Authentication, RBAC, workspace scoping |

**Overall Risk Level:** **Low-Medium** - Mitigations are straightforward and follow existing patterns.

---

## 22. Alternatives to CSV

### 22.1 YAML

**Pros:**
- More human-readable than JSON
- Native support for multi-line strings (no escaping needed for instructions)
- Comments supported

**Cons:**
- Less familiar to non-developers
- No Excel editing
- Parsing complexity (indentation-sensitive)

**Verdict:** Not recommended for primary format, but could be added in Phase 6.

### 22.2 Excel (XLSX)

**Pros:**
- Native Excel format (no conversion needed)
- Rich formatting (colors, validation, dropdowns)
- Multiple sheets (agents, tools, workflows)

**Cons:**
- Requires external library (`xlsx`, `exceljs`)
- Binary format (harder to version control)
- More complex parsing

**Verdict:** Consider for Phase 6 as premium feature.

### 22.3 JSON (Full Structure)

**Pros:**
- Native support for nested objects
- No serialization/deserialization complexity
- Standard format for APIs

**Cons:**
- Not editable in Excel
- Less accessible to non-developers

**Verdict:** Support as **JSONL** (newline-delimited JSON) for programmatic use, not as primary format.

---

## 23. Acceptance Criteria (Definition of Done)

### Phase 1 (MVP) Acceptance Criteria:

- [ ] User can click "Export" button on agents page
- [ ] Export downloads CSV file with format: `agents-{workspace}-{timestamp}.csv`
- [ ] CSV contains columns: slug, name, modelProvider, modelName, instructions (truncated), description, temperature, maxTokens, memoryEnabled, visibility, type, isActive
- [ ] CSV opens correctly in Excel without formatting issues
- [ ] Export is scoped to user's workspace (no cross-tenant leaks)
- [ ] Export returns 401 for unauthenticated users
- [ ] Export returns 404 if workspace has no agents
- [ ] Toast notification shows: "Exported {count} agents"

### Phase 3 (Import MVP) Acceptance Criteria:

- [ ] User can click "Import" button on agents page
- [ ] Import dialog opens with file upload zone
- [ ] User can drag-and-drop CSV file
- [ ] User can select conflict mode (skip/overwrite)
- [ ] Import validates CSV structure and shows errors
- [ ] Import creates agents from valid rows
- [ ] Import skips existing slugs in skip mode
- [ ] Import returns detailed results with row-by-row status
- [ ] Results screen shows summary (created, skipped, errors)
- [ ] User can download error report as CSV
- [ ] Import returns 401 for unauthenticated users
- [ ] Import returns 403 for users without create permission
- [ ] Import returns 400 for files >5MB
- [ ] Import returns 400 for CSVs with >1000 rows
- [ ] Import enforces all validation rules from single-agent creation
- [ ] Round-trip test passes: export → import → verify data integrity

---

## 24. Appendix

### 24.1 Example CSV (Basic)

```csv
slug,name,modelProvider,modelName,instructions
assistant,AI Assistant,openai,gpt-4o,"You are a helpful AI assistant. Be concise and accurate."
research,Research Agent,anthropic,claude-sonnet-4-20250514,"You are a research expert. Provide detailed analysis with sources."
support,Customer Support,openai,gpt-4o-mini,"You are a friendly customer support agent. Be empathetic and helpful."
```

### 24.2 Example CSV (Full)

```csv
slug,name,modelProvider,modelName,instructions,description,temperature,maxTokens,maxSteps,memoryEnabled,memoryConfigJson,tools,visibility,type,requiresApproval,isActive
assistant,AI Assistant,openai,gpt-4o,"You are a helpful AI assistant. Be concise and accurate.",General purpose assistant,0.7,4096,5,true,"{""lastMessages"":10}",calculator;web-fetch;memory-recall,PRIVATE,USER,false,true
research,Research Agent,anthropic,claude-sonnet-4-20250514,"You are a research expert. Provide detailed analysis with sources.",Deep research specialist,0.9,8192,10,true,"{""lastMessages"":20,""semanticRecall"":{""topK"":10}}",web-fetch;web-search;rag-query,ORGANIZATION,USER,false,true
```

### 24.3 Error Report Example CSV

```csv
rowNumber,slug,error,field,value
3,invalid-agent,"Model 'gpt-99' not found for provider 'openai'",modelName,gpt-99
7,bad-temp,"Temperature must be between 0 and 2",temperature,5.0
12,missing-name,"Required field missing",name,
```

### 24.4 Validation Error Message Catalog

**Field-Specific Errors:**
- `slug`: "Slug must be 1-128 characters, lowercase alphanumeric with hyphens"
- `name`: "Name is required and must be 1-255 characters"
- `instructions`: "Instructions are required and must not exceed 100,000 characters"
- `modelProvider`: "Model provider must be 'openai' or 'anthropic'"
- `modelName`: "Model '{value}' not found for provider '{provider}'"
- `temperature`: "Temperature must be between 0 and 2"
- `maxTokens`: "Max tokens must be a positive integer"
- `maxSteps`: "Max steps must be between 1 and 500"
- `memoryConfigJson`: "Invalid JSON syntax in memoryConfig"
- `tools`: "Unknown tool IDs: {list}"
- `visibility`: "Visibility must be 'PRIVATE', 'ORGANIZATION', or 'PUBLIC'"
- `type`: "Type must be 'USER' or 'DEMO'"

**Row-Level Errors:**
- "Missing required columns: {list}"
- "Row has inconsistent column count (expected {expected}, got {actual})"
- "Unclosed quote at row {number}"
- "Agent with slug '{slug}' already exists (use overwrite mode to update)"
- "Agent with name '{name}' already exists in organization"

---

## 25. Related Work & References

### 25.1 Similar Features in Codebase

1. **Test Case Export** (`apps/agent/src/app/api/agents/[id]/test-cases/export/route.ts`)
   - Provides CSV/JSONL export pattern
   - Implements `csvEscape()` function
   - Demonstrates Content-Disposition headers

2. **Document Upload** (`apps/agent/src/app/api/documents/upload/route.ts`)
   - Provides file upload pattern
   - Demonstrates FormData handling
   - Implements file size/type validation

3. **BIM Ingest** (`apps/agent/src/app/api/bim/ingest/route.ts`)
   - Large file handling (50MB)
   - Background job queuing
   - Checksum generation

4. **Automation Table Bulk Operations** (`apps/agent/src/components/automation/AutomationTable.tsx`)
   - Multi-select with checkboxes
   - Bulk action buttons
   - Loading states

### 25.2 External References

- **RFC 4180** (CSV standard): https://tools.ietf.org/html/rfc4180
- **Papaparse Documentation**: https://www.papaparse.com/docs
- **OWASP CSV Injection**: https://owasp.org/www-community/attacks/CSV_Injection
- **Prisma Batch Operations**: https://www.prisma.io/docs/concepts/components/prisma-client/crud#create-multiple-records

---

## 26. Conclusion

This design provides a **comprehensive, production-ready blueprint** for bulk agent import/export functionality. Key highlights:

✅ **Follows existing patterns** - Reuses established authentication, validation, and UI patterns  
✅ **Secure by design** - Multi-tenant isolation, RBAC enforcement, rate limiting  
✅ **User-friendly** - Preview, validation feedback, partial success handling  
✅ **Scalable** - Phased approach from MVP to enterprise features  
✅ **Testable** - Clear testing strategy with unit, integration, and E2E tests  
✅ **Maintainable** - No external dependencies (Phase 1-4), modular architecture  

**Recommended Next Steps:**
1. Review this design with product and engineering teams
2. Prioritize phases based on user feedback
3. Begin Phase 1 implementation (basic export)
4. Iterate based on user adoption and feedback

---

**Document Version:** 1.0  
**Last Updated:** March 11, 2026  
**Author:** AI Design Agent  
**Reviewers:** TBD
