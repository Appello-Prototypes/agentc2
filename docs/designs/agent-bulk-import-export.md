# Technical Design: Bulk Agent Import/Export via CSV

**Feature Request**: [GitHub Issue #128](https://github.com/Appello-Prototypes/agentc2/issues/128)  
**Scope**: Medium | **Priority**: Medium  
**Author**: AI Agent  
**Date**: 2026-03-11  
**Status**: Design Phase

---

## Executive Summary

This design introduces bulk agent import and export functionality via CSV files, enabling workspace administrators to:

1. **Export** all agents from a workspace to a portable CSV file
2. **Import** agents from a CSV file to quickly populate new workspaces
3. **Migrate** agent configurations between environments
4. **Backup** agent definitions for disaster recovery

The CSV format will include agent name, slug, model provider, model name, instructions, tool attachments, and key configuration settings.

---

## 1. Architecture Overview

### 1.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend UI Layer                        │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Export Button  │  │ Import Dialog   │  │ File Upload  │ │
│  └────────────────┘  └─────────────────┘  └──────────────┘ │
└────────────────┬────────────────┬────────────────┬──────────┘
                 │                │                │
                 v                v                v
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (REST)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GET /api/agents/export?workspaceId={id}&format=csv    │ │
│  │  POST /api/agents/import (multipart/form-data)         │ │
│  │  POST /api/agents/validate-import                      │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────┬───────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer (New)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  packages/agentc2/src/import-export/                   │ │
│  │    - csv-serializer.ts  (Agent → CSV)                  │ │
│  │    - csv-parser.ts      (CSV → Agent)                  │ │
│  │    - validator.ts       (Schema validation)            │ │
│  │    - conflict-resolver.ts (Duplicate handling)         │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────┬───────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (Prisma)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Agent model (read/write)                              │ │
│  │  AgentTool model (read/write)                          │ │
│  │  Workspace model (validation)                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

**Export Flow:**
```
User clicks Export → GET /api/agents/export → Fetch agents from DB 
→ Serialize to CSV → Download file
```

**Import Flow:**
```
User uploads CSV → POST /api/agents/import → Parse CSV → Validate schema 
→ Check conflicts → Create agents → Return summary report
```

---

## 2. CSV Format Specification

### 2.1 CSV Schema

The CSV will use the following columns (33 total):

| Column Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `name` | String | ✅ | Agent display name | "Customer Support Bot" |
| `slug` | String | ✅ | URL-safe identifier (workspace-scoped) | "customer-support" |
| `description` | String | ❌ | Agent description | "Handles tier-1 support" |
| `instructions` | Text | ✅ | Agent system prompt | "You are a helpful..." |
| `instructionsTemplate` | Text | ❌ | Templated instructions | "Hello {{userName}}..." |
| `modelProvider` | String | ✅ | AI provider | "openai", "anthropic" |
| `modelName` | String | ✅ | Model identifier | "gpt-4o", "claude-sonnet-4" |
| `temperature` | Float | ❌ | Model temperature | 0.7 |
| `maxTokens` | Integer | ❌ | Max output tokens | 4096 |
| `maxSteps` | Integer | ❌ | Max tool use steps | 5 |
| `memoryEnabled` | Boolean | ❌ | Enable conversation memory | true, false |
| `memoryConfig` | JSON | ❌ | Memory configuration | `{"lastMessages": 10}` |
| `modelConfig` | JSON | ❌ | Provider-specific config | `{"reasoning": {"type": "enabled"}}` |
| `routingConfig` | JSON | ❌ | Model routing config | `{"mode": "auto"}` |
| `contextConfig` | JSON | ❌ | Context window config | `{"maxContextTokens": 50000}` |
| `tools` | Array | ❌ | Tool IDs (semicolon-separated) | "calculator;web-fetch;memory-recall" |
| `subAgents` | Array | ❌ | Sub-agent slugs | "researcher;writer" |
| `workflows` | Array | ❌ | Workflow IDs | "approval-flow;parallel-tasks" |
| `visibility` | Enum | ❌ | Access level | "PRIVATE", "ORGANIZATION", "PUBLIC" |
| `requiresApproval` | Boolean | ❌ | Require human approval | true, false |
| `maxSpendUsd` | Float | ❌ | Max spend per run | 0.50 |
| `autoVectorize` | Boolean | ❌ | Auto-embed outputs | true, false |
| `deploymentMode` | String | ❌ | Deployment strategy | "singleton", "multi-instance" |
| `metadata` | JSON | ❌ | Custom metadata | `{"department": "support"}` |
| `isActive` | Boolean | ❌ | Agent active status | true, false |

**Not included in CSV** (system-managed or relational):
- `id`, `workspaceId`, `ownerId` (set during import)
- `version`, `createdAt`, `updatedAt`, `createdBy` (auto-generated)
- `isArchived`, `archivedAt`, `publicToken` (runtime state)
- Relations: `runs`, `traces`, `evaluations`, `feedback`, etc. (not portable)

### 2.2 CSV Format Examples

**Basic Agent (minimal required fields):**
```csv
name,slug,modelProvider,modelName,instructions
"Simple Bot",simple-bot,openai,gpt-4o,"You are a helpful assistant."
```

**Full Agent (all fields):**
```csv
name,slug,description,instructions,modelProvider,modelName,temperature,maxTokens,tools,memoryEnabled,visibility,isActive
"Research Assistant",research-agent,"Conducts web research","You are an expert researcher...","openai","gpt-4o",0.7,4096,"web-search;exa-research;memory-recall",true,ORGANIZATION,true
```

**Multi-line Instructions (RFC 4180 compliant):**
```csv
name,slug,instructions
"Support Bot",support,"You are a customer support agent.
Your role is to:
1. Listen carefully
2. Provide solutions
3. Escalate when needed"
```

### 2.3 CSV Encoding Rules

- **Character Encoding**: UTF-8 with BOM
- **Line Endings**: CRLF (`\r\n`)
- **Delimiter**: Comma (`,`)
- **Quote Character**: Double quote (`"`)
- **Escape Sequence**: Double double-quote (`""`) per RFC 4180
- **Array Separator**: Semicolon (`;`) for multi-value fields
- **Boolean Format**: Lowercase `true`/`false`
- **Null Values**: Empty string (`""`) or omitted

**Examples:**
```csv
# Comma in text → quoted
name,instructions
"Sales Bot","You handle sales, support, and inquiries."

# Double quote in text → escaped
name,instructions
"Quote Bot","Say ""Hello"" to users."

# Multi-line text → quoted with literal newlines
name,instructions
"Multi Bot","Line 1
Line 2
Line 3"

# Arrays → semicolon-separated
tools
"web-fetch;calculator;memory-recall"

# JSON → escaped quotes
modelConfig
"{""reasoning"": {""type"": ""enabled""}}"
```

---

## 3. API Design

### 3.1 Export Endpoint

#### **GET `/api/agents/export`**

**Purpose**: Export all agents from a workspace to CSV

**Authentication**: 
- Session cookie (Better Auth)
- API key (via `X-API-Key` header)

**Authorization**:
- User must have `read` access to the workspace
- Enforces `workspaceId` scoping

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workspaceId` | String | ❌ | Current workspace | Workspace to export from |
| `format` | String | ❌ | `csv` | Export format (`csv` only for v1) |
| `includeArchived` | Boolean | ❌ | `false` | Include archived agents |
| `includeInactive` | Boolean | ❌ | `false` | Include inactive agents |

**Response**:
- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="agents-{workspaceId}-{timestamp}.csv"`
- **Status Codes**:
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Forbidden (no workspace access)
  - `404`: Workspace not found
  - `500`: Server error

**Example Request**:
```bash
curl -X GET "https://agentc2.ai/agent/api/agents/export?workspaceId=ws_123&includeArchived=false" \
  -H "Cookie: better-auth.session_token=..." \
  -o agents.csv
```

**Example Response** (CSV):
```csv
name,slug,description,instructions,modelProvider,modelName,temperature,tools,memoryEnabled,visibility,isActive
"Support Bot",support-bot,"Handles support","You are a support agent...","openai","gpt-4o",0.7,"web-fetch;memory-recall",true,ORGANIZATION,true
"Research Bot",research-bot,"Conducts research","You are a researcher...","anthropic","claude-sonnet-4",0.8,"exa-search;brave-search",false,PRIVATE,true
```

---

### 3.2 Import Validation Endpoint

#### **POST `/api/agents/import/validate`**

**Purpose**: Validate CSV before import (dry-run)

**Authentication**: Same as export

**Request Body** (multipart/form-data):
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="agents.csv"
Content-Type: text/csv

name,slug,modelProvider,modelName,instructions
"Bot 1",bot-1,openai,gpt-4o,"Instructions..."
------WebKitFormBoundary
Content-Disposition: form-data; name="workspaceId"

ws_123
------WebKitFormBoundary--
```

**Response** (JSON):
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "totalRows": 10,
    "validRows": 8,
    "errors": [
      {
        "row": 3,
        "field": "modelProvider",
        "message": "Invalid provider 'gpt'. Must be one of: openai, anthropic, google",
        "severity": "error"
      },
      {
        "row": 5,
        "field": "slug",
        "message": "Slug 'support-bot' already exists in workspace",
        "severity": "warning",
        "resolution": "Will be renamed to 'support-bot-2'"
      }
    ],
    "warnings": [
      {
        "row": 7,
        "field": "tools",
        "message": "Tool 'legacy-tool' not found in registry",
        "severity": "warning"
      }
    ],
    "conflicts": [
      {
        "row": 2,
        "type": "slug_conflict",
        "existingAgent": {
          "id": "agent_abc123",
          "name": "Support Bot",
          "slug": "support-bot"
        },
        "suggestedSlug": "support-bot-2"
      }
    ]
  }
}
```

---

### 3.3 Import Endpoint

#### **POST `/api/agents/import`**

**Purpose**: Import agents from CSV

**Authentication**: Same as export

**Authorization**:
- User must have `create` access to the workspace
- Enforces organization-level rate limiting

**Request Body** (multipart/form-data):
```
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="agents.csv"
Content-Type: text/csv

[CSV content]
------WebKitFormBoundary
Content-Disposition: form-data; name="workspaceId"

ws_123
------WebKitFormBoundary
Content-Disposition: form-data; name="conflictStrategy"

rename
------WebKitFormBoundary
Content-Disposition: form-data; name="skipInvalid"

true
------WebKitFormBoundary--
```

**Form Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ | CSV file (max 10MB) |
| `workspaceId` | String | ❌ | Target workspace (default: user's default) |
| `conflictStrategy` | Enum | ❌ | `rename` (default), `skip`, `fail` |
| `skipInvalid` | Boolean | ❌ | Skip invalid rows (default: `true`) |
| `dryRun` | Boolean | ❌ | Validate only, don't create (default: `false`) |

**Conflict Strategies**:
- **`rename`**: Auto-rename conflicting slugs (e.g., `bot` → `bot-2`)
- **`skip`**: Skip rows with conflicts
- **`fail`**: Abort entire import on first conflict

**Response** (JSON):
```json
{
  "success": true,
  "summary": {
    "totalRows": 10,
    "created": 8,
    "skipped": 2,
    "failed": 0,
    "durationMs": 1243
  },
  "results": [
    {
      "row": 1,
      "status": "created",
      "agent": {
        "id": "agent_xyz789",
        "name": "Support Bot",
        "slug": "support-bot"
      }
    },
    {
      "row": 2,
      "status": "renamed",
      "agent": {
        "id": "agent_abc456",
        "name": "Research Bot",
        "slug": "research-bot-2"
      },
      "originalSlug": "research-bot",
      "reason": "Slug conflict with existing agent"
    },
    {
      "row": 3,
      "status": "skipped",
      "error": "Invalid model provider 'gpt'",
      "originalData": {
        "name": "Bad Bot",
        "slug": "bad-bot"
      }
    }
  ],
  "warnings": [
    "2 agents had tools not found in registry and were omitted",
    "1 agent was renamed due to slug conflict"
  ]
}
```

**Status Codes**:
- `200`: Success (even if some rows failed/skipped)
- `400`: Invalid request (bad CSV format, missing file)
- `401`: Unauthorized
- `403`: Forbidden
- `413`: File too large (>10MB)
- `422`: Unprocessable (all rows invalid)
- `500`: Server error

---

## 4. Implementation Details

### 4.1 New Package Structure

Create a new module: `packages/agentc2/src/import-export/`

```
packages/agentc2/src/import-export/
├── index.ts                   # Public exports
├── csv-serializer.ts          # Agent → CSV
├── csv-parser.ts              # CSV → AgentImportRecord[]
├── validator.ts               # Schema and business rule validation
├── conflict-resolver.ts       # Slug deduplication logic
├── types.ts                   # TypeScript interfaces
└── __tests__/
    ├── csv-serializer.test.ts
    ├── csv-parser.test.ts
    └── validator.test.ts
```

---

### 4.2 Core Module: `types.ts`

```typescript
/**
 * Parsed CSV row before validation
 */
export interface AgentImportRecord {
    // Row metadata
    rowNumber: number;
    
    // Required fields
    name: string;
    slug: string;
    instructions: string;
    modelProvider: string;
    modelName: string;
    
    // Optional fields
    description?: string;
    instructionsTemplate?: string;
    temperature?: number;
    maxTokens?: number;
    maxSteps?: number;
    memoryEnabled?: boolean;
    memoryConfig?: Record<string, unknown>;
    modelConfig?: Record<string, unknown>;
    routingConfig?: Record<string, unknown>;
    contextConfig?: Record<string, unknown>;
    tools?: string[];
    subAgents?: string[];
    workflows?: string[];
    visibility?: "PRIVATE" | "ORGANIZATION" | "PUBLIC";
    requiresApproval?: boolean;
    maxSpendUsd?: number;
    autoVectorize?: boolean;
    deploymentMode?: string;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
}

/**
 * Validation error
 */
export interface ValidationError {
    row: number;
    field: string;
    message: string;
    severity: "error" | "warning";
    resolution?: string;
}

/**
 * Conflict detection result
 */
export interface ConflictResult {
    row: number;
    type: "slug_conflict" | "name_conflict";
    existingAgent: {
        id: string;
        name: string;
        slug: string;
    };
    suggestedSlug?: string;
}

/**
 * Import result per row
 */
export interface ImportRowResult {
    row: number;
    status: "created" | "renamed" | "skipped" | "failed";
    agent?: {
        id: string;
        name: string;
        slug: string;
    };
    originalSlug?: string;
    error?: string;
    reason?: string;
    originalData?: Partial<AgentImportRecord>;
}

/**
 * Overall import summary
 */
export interface ImportSummary {
    totalRows: number;
    created: number;
    renamed: number;
    skipped: number;
    failed: number;
    durationMs: number;
}
```

---

### 4.3 Core Module: `csv-serializer.ts`

```typescript
import { Agent, AgentTool } from "@repo/database";

/**
 * Serialize agents to CSV format
 */
export async function serializeAgentsToCSV(
    agents: Array<Agent & { tools: AgentTool[] }>,
    options: {
        includeHeaders?: boolean;
        fieldOrder?: string[];
    } = {}
): Promise<string> {
    const { includeHeaders = true, fieldOrder = DEFAULT_FIELD_ORDER } = options;
    
    const rows: string[] = [];
    
    // Add header row
    if (includeHeaders) {
        rows.push(fieldOrder.map(escapeCSV).join(","));
    }
    
    // Add data rows
    for (const agent of agents) {
        const row = fieldOrder.map(field => {
            const value = getFieldValue(agent, field);
            return escapeCSV(value);
        });
        rows.push(row.join(","));
    }
    
    return rows.join("\r\n") + "\r\n";
}

/**
 * Get field value from agent object
 */
function getFieldValue(
    agent: Agent & { tools: AgentTool[] },
    field: string
): string {
    switch (field) {
        case "name":
            return agent.name;
        case "slug":
            return agent.slug;
        case "description":
            return agent.description || "";
        case "instructions":
            return agent.instructions;
        case "instructionsTemplate":
            return agent.instructionsTemplate || "";
        case "modelProvider":
            return agent.modelProvider;
        case "modelName":
            return agent.modelName;
        case "temperature":
            return agent.temperature?.toString() || "";
        case "maxTokens":
            return agent.maxTokens?.toString() || "";
        case "maxSteps":
            return agent.maxSteps?.toString() || "";
        case "memoryEnabled":
            return agent.memoryEnabled ? "true" : "false";
        case "memoryConfig":
            return agent.memoryConfig ? JSON.stringify(agent.memoryConfig) : "";
        case "modelConfig":
            return agent.modelConfig ? JSON.stringify(agent.modelConfig) : "";
        case "routingConfig":
            return agent.routingConfig ? JSON.stringify(agent.routingConfig) : "";
        case "contextConfig":
            return agent.contextConfig ? JSON.stringify(agent.contextConfig) : "";
        case "tools":
            return agent.tools.map(t => t.toolId).join(";");
        case "subAgents":
            return agent.subAgents.join(";");
        case "workflows":
            return agent.workflows.join(";");
        case "visibility":
            return agent.visibility;
        case "requiresApproval":
            return agent.requiresApproval ? "true" : "false";
        case "maxSpendUsd":
            return agent.maxSpendUsd?.toString() || "";
        case "autoVectorize":
            return agent.autoVectorize ? "true" : "false";
        case "deploymentMode":
            return agent.deploymentMode || "";
        case "metadata":
            return agent.metadata ? JSON.stringify(agent.metadata) : "";
        case "isActive":
            return agent.isActive ? "true" : "false";
        default:
            return "";
    }
}

/**
 * Escape CSV value per RFC 4180
 */
function escapeCSV(value: string): string {
    if (!value) return "";
    
    // Check if escaping is needed
    if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
        // Escape double quotes by doubling them
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
    }
    
    return value;
}

const DEFAULT_FIELD_ORDER = [
    "name",
    "slug",
    "description",
    "instructions",
    "instructionsTemplate",
    "modelProvider",
    "modelName",
    "temperature",
    "maxTokens",
    "maxSteps",
    "memoryEnabled",
    "memoryConfig",
    "modelConfig",
    "routingConfig",
    "contextConfig",
    "tools",
    "subAgents",
    "workflows",
    "visibility",
    "requiresApproval",
    "maxSpendUsd",
    "autoVectorize",
    "deploymentMode",
    "metadata",
    "isActive"
];
```

---

### 4.4 Core Module: `csv-parser.ts`

```typescript
import { AgentImportRecord } from "./types";

/**
 * Parse CSV string into import records
 * 
 * Uses a robust CSV parser library (csv-parse/sync from 'csv-parse')
 */
export function parseCSV(csvContent: string): AgentImportRecord[] {
    const Papa = require("papaparse"); // Or use csv-parse
    
    const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => value.trim()
    });
    
    if (parsed.errors.length > 0) {
        throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
    }
    
    return parsed.data.map((row: any, index: number) => ({
        rowNumber: index + 2, // +2 for header row and 1-indexing
        name: row.name,
        slug: row.slug,
        description: row.description || undefined,
        instructions: row.instructions,
        instructionsTemplate: row.instructionsTemplate || undefined,
        modelProvider: row.modelProvider,
        modelName: row.modelName,
        temperature: parseFloat(row.temperature) || undefined,
        maxTokens: parseInt(row.maxTokens) || undefined,
        maxSteps: parseInt(row.maxSteps) || undefined,
        memoryEnabled: parseBoolean(row.memoryEnabled),
        memoryConfig: parseJSON(row.memoryConfig),
        modelConfig: parseJSON(row.modelConfig),
        routingConfig: parseJSON(row.routingConfig),
        contextConfig: parseJSON(row.contextConfig),
        tools: parseArray(row.tools),
        subAgents: parseArray(row.subAgents),
        workflows: parseArray(row.workflows),
        visibility: row.visibility as any,
        requiresApproval: parseBoolean(row.requiresApproval),
        maxSpendUsd: parseFloat(row.maxSpendUsd) || undefined,
        autoVectorize: parseBoolean(row.autoVectorize),
        deploymentMode: row.deploymentMode || undefined,
        metadata: parseJSON(row.metadata),
        isActive: parseBoolean(row.isActive) ?? true
    }));
}

function parseBoolean(value: string | undefined): boolean | undefined {
    if (!value) return undefined;
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
    return undefined;
}

function parseArray(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    return value.split(";").map(v => v.trim()).filter(v => v.length > 0);
}

function parseJSON(value: string | undefined): Record<string, unknown> | undefined {
    if (!value) return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}
```

---

### 4.5 Core Module: `validator.ts`

```typescript
import { AgentImportRecord, ValidationError } from "./types";
import { prisma } from "@repo/database";

/**
 * Validate a batch of import records
 */
export async function validateImportRecords(
    records: AgentImportRecord[],
    workspaceId: string,
    organizationId: string
): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    for (const record of records) {
        // Required field validation
        if (!record.name || record.name.trim() === "") {
            errors.push({
                row: record.rowNumber,
                field: "name",
                message: "Name is required",
                severity: "error"
            });
        }
        
        if (!record.slug || record.slug.trim() === "") {
            errors.push({
                row: record.rowNumber,
                field: "slug",
                message: "Slug is required",
                severity: "error"
            });
        } else if (!/^[a-z0-9-]+$/.test(record.slug)) {
            errors.push({
                row: record.rowNumber,
                field: "slug",
                message: "Slug must be lowercase alphanumeric with hyphens only",
                severity: "error"
            });
        }
        
        if (!record.instructions || record.instructions.trim() === "") {
            errors.push({
                row: record.rowNumber,
                field: "instructions",
                message: "Instructions are required",
                severity: "error"
            });
        }
        
        if (!record.modelProvider) {
            errors.push({
                row: record.rowNumber,
                field: "modelProvider",
                message: "Model provider is required",
                severity: "error"
            });
        } else if (!["openai", "anthropic", "google"].includes(record.modelProvider)) {
            errors.push({
                row: record.rowNumber,
                field: "modelProvider",
                message: `Invalid model provider '${record.modelProvider}'. Must be one of: openai, anthropic, google`,
                severity: "error"
            });
        }
        
        if (!record.modelName) {
            errors.push({
                row: record.rowNumber,
                field: "modelName",
                message: "Model name is required",
                severity: "error"
            });
        }
        
        // Validate model exists for provider
        if (record.modelProvider && record.modelName) {
            const modelValid = await validateModelExists(
                record.modelProvider,
                record.modelName,
                organizationId
            );
            if (!modelValid) {
                errors.push({
                    row: record.rowNumber,
                    field: "modelName",
                    message: `Model '${record.modelName}' not found for provider '${record.modelProvider}'`,
                    severity: "warning",
                    resolution: "Agent will be created but may fail at runtime"
                });
            }
        }
        
        // Validate tools exist
        if (record.tools) {
            for (const toolId of record.tools) {
                const toolExists = await validateToolExists(toolId, organizationId);
                if (!toolExists) {
                    errors.push({
                        row: record.rowNumber,
                        field: "tools",
                        message: `Tool '${toolId}' not found in registry`,
                        severity: "warning",
                        resolution: "Tool will be skipped"
                    });
                }
            }
        }
        
        // Validate range constraints
        if (record.temperature !== undefined) {
            if (record.temperature < 0 || record.temperature > 2) {
                errors.push({
                    row: record.rowNumber,
                    field: "temperature",
                    message: "Temperature must be between 0 and 2",
                    severity: "error"
                });
            }
        }
        
        if (record.maxTokens !== undefined && record.maxTokens <= 0) {
            errors.push({
                row: record.rowNumber,
                field: "maxTokens",
                message: "Max tokens must be positive",
                severity: "error"
            });
        }
        
        // Validate enum fields
        if (record.visibility && !["PRIVATE", "ORGANIZATION", "PUBLIC"].includes(record.visibility)) {
            errors.push({
                row: record.rowNumber,
                field: "visibility",
                message: `Invalid visibility '${record.visibility}'. Must be PRIVATE, ORGANIZATION, or PUBLIC`,
                severity: "error"
            });
        }
    }
    
    return errors;
}

async function validateModelExists(
    provider: string,
    modelName: string,
    organizationId: string
): Promise<boolean> {
    // Use existing model validation logic from API layer
    const { validateModelSelection } = await import("@/lib/model-validation");
    const result = await validateModelSelection(provider as any, modelName, organizationId);
    return result.valid;
}

async function validateToolExists(toolId: string, organizationId: string): Promise<boolean> {
    const { hasToolInRegistry, getAllMcpTools } = await import("@repo/agentc2");
    
    // Check static registry
    if (hasToolInRegistry(toolId)) return true;
    
    // Check MCP tools
    const mcpTools = await getAllMcpTools(organizationId);
    return toolId in mcpTools;
}
```

---

### 4.6 Core Module: `conflict-resolver.ts`

```typescript
import { AgentImportRecord, ConflictResult } from "./types";
import { prisma } from "@repo/database";

/**
 * Detect slug conflicts with existing agents
 */
export async function detectConflicts(
    records: AgentImportRecord[],
    workspaceId: string
): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];
    
    // Get all existing agent slugs in workspace
    const existingAgents = await prisma.agent.findMany({
        where: { workspaceId },
        select: { id: true, name: true, slug: true }
    });
    
    const existingSlugs = new Set(existingAgents.map(a => a.slug));
    const slugMap = new Map(existingAgents.map(a => [a.slug, a]));
    
    for (const record of records) {
        if (existingSlugs.has(record.slug)) {
            conflicts.push({
                row: record.rowNumber,
                type: "slug_conflict",
                existingAgent: slugMap.get(record.slug)!,
                suggestedSlug: await generateUniqueSlug(record.slug, workspaceId)
            });
        }
    }
    
    return conflicts;
}

/**
 * Resolve conflicts by auto-renaming
 */
export async function resolveConflicts(
    records: AgentImportRecord[],
    conflicts: ConflictResult[],
    strategy: "rename" | "skip" | "fail"
): Promise<AgentImportRecord[]> {
    if (strategy === "fail" && conflicts.length > 0) {
        throw new Error(`Import aborted: ${conflicts.length} slug conflict(s) detected`);
    }
    
    if (strategy === "skip") {
        const conflictRows = new Set(conflicts.map(c => c.row));
        return records.filter(r => !conflictRows.has(r.rowNumber));
    }
    
    // strategy === "rename"
    const conflictMap = new Map(conflicts.map(c => [c.row, c.suggestedSlug!]));
    
    return records.map(record => {
        if (conflictMap.has(record.rowNumber)) {
            return {
                ...record,
                slug: conflictMap.get(record.rowNumber)!
            };
        }
        return record;
    });
}

/**
 * Generate a unique slug by appending a number
 */
async function generateUniqueSlug(baseSlug: string, workspaceId: string): Promise<string> {
    let suffix = 2;
    let slug = `${baseSlug}-${suffix}`;
    
    while (await prisma.agent.findFirst({ where: { slug, workspaceId } })) {
        suffix++;
        slug = `${baseSlug}-${suffix}`;
    }
    
    return slug;
}
```

---

## 5. Frontend Implementation

### 5.1 Export Button Component

**Location**: `apps/agent/src/app/agents/components/export-agents-button.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { Download } from "@hugeicons/react";
import { useWorkspace } from "@/hooks/use-workspace";

export function ExportAgentsButton() {
    const [isExporting, setIsExporting] = useState(false);
    const { currentWorkspace } = useWorkspace();
    
    const handleExport = async () => {
        setIsExporting(true);
        
        try {
            const response = await fetch(
                `/api/agents/export?workspaceId=${currentWorkspace?.id}`,
                { method: "GET" }
            );
            
            if (!response.ok) {
                throw new Error("Export failed");
            }
            
            // Trigger download
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `agents-${currentWorkspace?.slug}-${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast.success("Agents exported successfully");
        } catch (error) {
            toast.error("Failed to export agents");
        } finally {
            setIsExporting(false);
        }
    };
    
    return (
        <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
        >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
    );
}
```

---

### 5.2 Import Dialog Component

**Location**: `apps/agent/src/app/agents/components/import-agents-dialog.tsx`

```tsx
"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Button,
    Select,
    Switch
} from "@repo/ui";
import { Upload } from "@hugeicons/react";
import { useWorkspace } from "@/hooks/use-workspace";

export function ImportAgentsDialog() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [conflictStrategy, setConflictStrategy] = useState<"rename" | "skip" | "fail">("rename");
    const [skipInvalid, setSkipInvalid] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const { currentWorkspace } = useWorkspace();
    
    const handleImport = async () => {
        if (!file) return;
        
        setIsImporting(true);
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("workspaceId", currentWorkspace!.id);
        formData.append("conflictStrategy", conflictStrategy);
        formData.append("skipInvalid", skipInvalid.toString());
        
        try {
            const response = await fetch("/api/agents/import", {
                method: "POST",
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast.success(
                    `Imported ${result.summary.created} agent(s) successfully` +
                    (result.summary.skipped > 0 ? `. ${result.summary.skipped} skipped.` : "")
                );
                setOpen(false);
                // Refresh agent list
                router.refresh();
            } else {
                toast.error(result.error || "Import failed");
            }
        } catch (error) {
            toast.error("Failed to import agents");
        } finally {
            setIsImporting(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Agents from CSV</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    {/* File upload */}
                    <div>
                        <label>CSV File</label>
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    
                    {/* Conflict strategy */}
                    <div>
                        <label>Conflict Strategy</label>
                        <Select
                            value={conflictStrategy}
                            onValueChange={setConflictStrategy}
                        >
                            <option value="rename">Auto-rename duplicates</option>
                            <option value="skip">Skip duplicates</option>
                            <option value="fail">Fail on conflict</option>
                        </Select>
                    </div>
                    
                    {/* Skip invalid */}
                    <div className="flex items-center justify-between">
                        <label>Skip invalid rows</label>
                        <Switch
                            checked={skipInvalid}
                            onCheckedChange={setSkipInvalid}
                        />
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isImporting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={!file || isImporting}
                        >
                            {isImporting ? "Importing..." : "Import"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

---

### 5.3 Integration into Agent List Page

**Location**: `apps/agent/src/app/agents/page.tsx`

```tsx
// Add to the header actions section (around line 500):

<div className="flex gap-2">
    <ExportAgentsButton />
    <ImportAgentsDialog />
    {/* Existing buttons... */}
</div>
```

---

## 6. Data Model Changes

**No Prisma schema changes required.** All functionality uses existing models:
- `Agent` model (read/write)
- `AgentTool` model (read/write for tool junction)
- `Workspace` model (read for validation)
- `Organization` model (read for validation)

---

## 7. Security Considerations

### 7.1 Authentication & Authorization

| Layer | Control | Implementation |
|-------|---------|----------------|
| **Authentication** | Session cookie or API key | `requireAuth()` helper |
| **Workspace Isolation** | `workspaceId` scoping | All queries filtered by `workspaceId` |
| **Organization Context** | `organizationId` validation | Enforced via workspace membership |
| **Role-Based Access** | RBAC for create/read operations | `requireEntityAccess()` helper |
| **Rate Limiting** | Org-scoped mutation limits | Redis-backed rate limiter |

### 7.2 Input Validation

| Risk | Mitigation |
|------|------------|
| **CSV Injection** | Escape all cell values, sanitize formulas |
| **File Size DoS** | 10MB max file size |
| **Malformed CSV** | Use robust parser (Papa Parse), catch errors |
| **SQL Injection** | Parameterized Prisma queries only |
| **XSS** | Sanitize instructions before storage |
| **JSON Injection** | Validate JSON schemas for config fields |

### 7.3 Data Leakage Prevention

- **Export**: Only include agents from authenticated user's workspace
- **Import**: Set `workspaceId`, `organizationId`, `ownerId` from session context
- **IDs**: Never export/import database IDs (use slugs instead)
- **Secrets**: Never export API keys or credentials
- **Audit**: Log all import/export operations to `AuditLog` table

---

## 8. Error Handling

### 8.1 Export Errors

| Error | Status | Response |
|-------|--------|----------|
| No agents in workspace | 200 | Empty CSV with headers only |
| Workspace not found | 404 | `{ success: false, error: "Workspace not found" }` |
| Database error | 500 | `{ success: false, error: "Failed to fetch agents" }` |

### 8.2 Import Errors

| Error | Status | Response | User Action |
|-------|--------|----------|-------------|
| Missing file | 400 | `{ success: false, error: "No file uploaded" }` | Upload file |
| Invalid CSV format | 400 | `{ success: false, error: "Invalid CSV format" }` | Check CSV structure |
| File too large (>10MB) | 413 | `{ success: false, error: "File size exceeds 10MB" }` | Split into multiple files |
| All rows invalid | 422 | `{ success: false, validation: {...} }` | Fix CSV and retry |
| Partial success | 200 | `{ success: true, summary: {...}, results: [...] }` | Review skipped rows |

---

## 9. Testing Strategy

### 9.1 Unit Tests

**CSV Serializer** (`csv-serializer.test.ts`):
- ✅ Export single agent
- ✅ Export multiple agents
- ✅ Escape special characters (commas, quotes, newlines)
- ✅ Handle empty fields
- ✅ Handle JSON fields
- ✅ Handle array fields (tools, subAgents)

**CSV Parser** (`csv-parser.test.ts`):
- ✅ Parse valid CSV
- ✅ Parse multi-line instructions
- ✅ Parse escaped quotes
- ✅ Parse boolean fields
- ✅ Parse JSON fields
- ✅ Parse array fields
- ✅ Handle malformed CSV
- ✅ Handle empty rows

**Validator** (`validator.test.ts`):
- ✅ Required field validation
- ✅ Model provider validation
- ✅ Model name validation
- ✅ Tool existence validation
- ✅ Range validation (temperature, maxTokens)
- ✅ Enum validation (visibility)

**Conflict Resolver** (`conflict-resolver.test.ts`):
- ✅ Detect slug conflicts
- ✅ Generate unique slugs
- ✅ Rename strategy
- ✅ Skip strategy
- ✅ Fail strategy

### 9.2 Integration Tests

**Export API** (`/api/agents/export`):
- ✅ Export with authentication
- ✅ Export filters (active only, include archived)
- ✅ Export from specific workspace
- ✅ Export with empty workspace
- ✅ Export without authentication (401)
- ✅ Export without workspace access (403)

**Import API** (`/api/agents/import`):
- ✅ Import valid CSV
- ✅ Import with conflicts (rename strategy)
- ✅ Import with invalid rows (skip strategy)
- ✅ Import with all invalid rows (422)
- ✅ Import without authentication (401)
- ✅ Import without create access (403)
- ✅ Import with missing required fields
- ✅ Import with tool validation warnings

### 9.3 E2E Tests

**Full Round-Trip**:
1. Create 5 agents via UI
2. Export to CSV
3. Delete all agents
4. Import from CSV
5. Verify all agents restored with correct data

**Migration Scenario**:
1. Export from Workspace A
2. Log in as different user
3. Import to Workspace B
4. Verify agents created with correct ownership

---

## 10. Performance Considerations

### 10.1 Scalability

| Scenario | Approach | Performance |
|----------|----------|-------------|
| **Export 1,000 agents** | Streaming response | ~2-3 seconds |
| **Import 1,000 agents** | Batch insert (100 per transaction) | ~15-20 seconds |
| **Large instructions (10KB each)** | CSV compression (gzip) | 70% size reduction |
| **Validation** | Parallel validation per row | O(n) with n = row count |

### 10.2 Optimizations

**Export**:
- Use Prisma `select` to fetch only needed fields
- Stream CSV rows incrementally (avoid loading all into memory)
- Add `Content-Encoding: gzip` for large exports

**Import**:
- Batch inserts: 100 agents per transaction
- Parallel validation: Use `Promise.all()` for independent checks
- Cache tool/model lookups during validation
- Use database transactions to ensure atomicity

### 10.3 Limits

| Resource | Limit | Reason |
|----------|-------|--------|
| **File Size** | 10MB | Prevent DoS, ~10,000 agents @ 1KB each |
| **Row Count** | 10,000 | Batch processing limit |
| **Field Length** | 100KB per field | Prevent excessively large instructions |
| **Concurrent Imports** | 1 per user | Prevent race conditions |

---

## 11. Impact Assessment

### 11.1 Affected Systems

| System | Impact | Changes Required |
|--------|--------|------------------|
| **Agent CRUD API** | None | No changes (uses existing endpoints) |
| **Agent List UI** | Low | Add export/import buttons |
| **Database** | None | No schema changes |
| **Auth System** | None | Uses existing auth flow |
| **Audit Log** | Low | Add import/export event types |

### 11.2 Backward Compatibility

✅ **Fully backward compatible**:
- New feature, no existing functionality affected
- Existing agents unaffected
- No breaking API changes
- Optional feature (can be disabled via feature flag)

### 11.3 Risks & Mitigation

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **CSV injection attack** | High | Low | Sanitize all cell values, disable formula execution |
| **Large file DoS** | Medium | Medium | 10MB file size limit, rate limiting |
| **Slug conflicts** | Medium | High | Auto-rename with conflict detection |
| **Invalid tool references** | Low | Medium | Warning-level validation, skip invalid tools |
| **Data loss on import** | High | Low | Dry-run validation, detailed error reporting |
| **Concurrent import conflicts** | Medium | Low | Workspace-level import lock |

---

## 12. Phased Implementation

### Phase 1: Core Export (Week 1) ✅
**Goal**: Basic export functionality

**Deliverables**:
- ✅ `csv-serializer.ts` module
- ✅ `GET /api/agents/export` endpoint
- ✅ Export button in agent list UI
- ✅ Unit tests for serializer
- ✅ Integration tests for export API

**Acceptance Criteria**:
- User can export all agents from workspace to CSV
- CSV opens correctly in Excel/Google Sheets
- Special characters are properly escaped

---

### Phase 2: Import with Validation (Week 2) ✅
**Goal**: Basic import with validation

**Deliverables**:
- ✅ `csv-parser.ts` module
- ✅ `validator.ts` module
- ✅ `POST /api/agents/import` endpoint (validation only)
- ✅ Import dialog UI component
- ✅ Unit tests for parser and validator
- ✅ Integration tests for validation

**Acceptance Criteria**:
- User can upload CSV and see validation errors
- All required fields validated
- Model/tool existence validated
- Clear error messages displayed

---

### Phase 3: Import Execution (Week 3) ✅
**Goal**: Full import with conflict resolution

**Deliverables**:
- ✅ `conflict-resolver.ts` module
- ✅ Import execution logic in API endpoint
- ✅ Conflict strategy UI controls
- ✅ Import results summary UI
- ✅ Unit tests for conflict resolver
- ✅ E2E tests for full round-trip

**Acceptance Criteria**:
- User can import agents and see summary
- Duplicate slugs auto-renamed
- Invalid rows skipped with warnings
- Agents created with correct ownership

---

### Phase 4: Polish & Documentation (Week 4) ✅
**Goal**: Production-ready feature

**Deliverables**:
- ✅ Audit logging for import/export
- ✅ User documentation (help tooltips, guide)
- ✅ Error message improvements
- ✅ Performance optimization (batch inserts)
- ✅ CSV template download
- ✅ Analytics tracking (feature usage)

**Acceptance Criteria**:
- All edge cases handled gracefully
- Performance acceptable for 1,000+ agents
- Documentation complete
- Feature flag ready for rollout

---

## 13. Monitoring & Analytics

### 13.1 Metrics to Track

| Metric | Purpose |
|--------|---------|
| **Export count** | Feature adoption |
| **Import count** | Feature adoption |
| **Import success rate** | Data quality indicator |
| **Average import duration** | Performance baseline |
| **Conflict rate** | User experience indicator |
| **Validation error rate** | CSV quality indicator |

### 13.2 Logging

**Audit Log Events**:
```typescript
// Export
{
    action: "agents.export",
    entityType: "workspace",
    entityId: workspaceId,
    metadata: {
        agentCount: 42,
        includeArchived: false,
        durationMs: 1234
    }
}

// Import
{
    action: "agents.import",
    entityType: "workspace",
    entityId: workspaceId,
    metadata: {
        totalRows: 10,
        created: 8,
        skipped: 2,
        conflictStrategy: "rename",
        durationMs: 5678
    }
}
```

---

## 14. Open Questions

1. **Should we support JSONL format in addition to CSV?**
   - Pros: Better for complex JSON fields, line-by-line processing
   - Cons: Less familiar to users, harder to edit manually

2. **Should we support importing skills and documents along with agents?**
   - Out of scope for v1
   - Consider for future enhancement

3. **Should we support incremental imports (update existing agents)?**
   - Out of scope for v1 (import is create-only)
   - Could add `id` column in v2 for update mode

4. **Should we add a "preview" step before import?**
   - Yes, show validation results before committing
   - Implement in UI as pre-import validation call

5. **Should we support exporting agent runs/analytics?**
   - Out of scope (separate feature request)
   - Export only agent definitions, not runtime data

---

## 15. Future Enhancements

### v2 Features (Post-MVP)
- **JSONL format support** for complex nested data
- **Excel (.xlsx) support** for richer formatting
- **Bulk update mode** via CSV (using agent IDs)
- **Partial exports** (filter by tag, type, visibility)
- **Import preview UI** with diff view
- **Scheduled exports** (daily backup to S3)
- **Template library** (pre-built agent CSV templates)
- **Cross-workspace import** (copy agents between workspaces)

### Related Features
- **Workspace templates** (export entire workspace config)
- **Playbook export/import** (related to agents)
- **Workflow/network import/export** (same pattern)

---

## 16. Documentation Plan

### 16.1 User Documentation

**In-app Help**:
- Tooltip on export button: "Download all agents as CSV"
- Tooltip on import button: "Upload agents from CSV file"
- Help link: "Learn about CSV format" → KB article

**Knowledge Base Article**:
- Title: "Bulk Agent Import/Export via CSV"
- Sections:
  - Overview and use cases
  - CSV format specification with examples
  - Step-by-step export guide
  - Step-by-step import guide
  - Troubleshooting common errors
  - FAQ

### 16.2 Developer Documentation

**API Documentation** (add to OpenAPI spec):
- `GET /api/agents/export` endpoint
- `POST /api/agents/import` endpoint
- Request/response schemas
- Error codes

**Code Documentation**:
- JSDoc comments on all public functions
- README in `import-export/` module
- Examples in Storybook (UI components)

---

## 17. Success Criteria

### Launch Metrics (30 days post-release)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Feature adoption** | 20% of workspaces | Unique workspaces using export or import |
| **Export usage** | 50+ exports/week | Total export API calls |
| **Import usage** | 30+ imports/week | Total successful imports |
| **Import success rate** | >85% | (created + renamed) / totalRows |
| **Error rate** | <5% | 5xx errors / total API calls |
| **Performance** | <3s for export, <30s for import | P95 latency |

### User Satisfaction
- 📊 Track via in-app feedback widget
- 🎯 Target: >4.0/5.0 average rating
- 💬 Collect qualitative feedback on UX

---

## 18. Conclusion

This design provides a comprehensive, production-ready approach to bulk agent import/export via CSV. Key strengths:

✅ **Minimal complexity**: Reuses existing API patterns and data models  
✅ **Security-first**: Multi-tenant isolation, input validation, audit logging  
✅ **User-friendly**: Clear error messages, conflict resolution, dry-run validation  
✅ **Scalable**: Handles 1,000+ agents efficiently  
✅ **Extensible**: Clean module structure for future enhancements  

The phased approach ensures incremental delivery with clear acceptance criteria at each stage. The feature is backward compatible and can be rolled out behind a feature flag for gradual adoption.

**Estimated Implementation**: 3-4 weeks (1 engineer)  
**Risk Level**: Low (no schema changes, isolated feature)  
**Business Value**: High (accelerates workspace setup, enables migrations)

---

## Appendices

### Appendix A: Example CSV Files

**Minimal CSV**:
```csv
name,slug,modelProvider,modelName,instructions
"Support Bot",support-bot,openai,gpt-4o,"You are a helpful customer support agent."
```

**Full-featured CSV**:
```csv
name,slug,description,instructions,modelProvider,modelName,temperature,maxTokens,tools,memoryEnabled,visibility,requiresApproval,isActive
"Advanced Bot",advanced-bot,"Multi-tool agent","You are an advanced agent...","openai","gpt-4o",0.8,8192,"web-search;calculator;memory-recall",true,ORGANIZATION,false,true
```

### Appendix B: Tool Availability Matrix

| Tool Category | Registry Tools | MCP Tools | OAuth Tools |
|--------------|----------------|-----------|-------------|
| **Utilities** | calculator, date-time, web-fetch | - | - |
| **Search** | exa-search, brave-search | - | - |
| **Email** | - | - | Gmail (OAuth) |
| **CRM** | - | HubSpot (MCP) | - |
| **Knowledge** | rag-query, document-search | - | - |

*Tools are validated at import time and invalid tools are skipped with warnings.*

---

**End of Technical Design Document**
