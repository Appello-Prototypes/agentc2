# API Specification: Bulk Agent Import/Export

OpenAPI 3.0 specification for the bulk agent import/export endpoints.

---

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: AgentC2 Bulk Agent Import/Export API
  description: |
    API endpoints for bulk importing and exporting agent configurations via CSV.
    
    ## Features
    - Export agents to CSV format
    - Import agents from CSV with validation
    - Three conflict resolution modes: skip, overwrite, version
    - Per-row validation reporting
    - Template download for easy onboarding
    
    ## Authorization
    All endpoints require authentication via session cookie or API key header.
    
    ## Rate Limiting
    Both endpoints are rate-limited to 30 requests per minute per organization.
  version: 1.0.0
  contact:
    name: AgentC2 Support
    url: https://agentc2.ai/support

servers:
  - url: https://agentc2.ai/agent
    description: Production
  - url: http://localhost:3001
    description: Local development

security:
  - sessionCookie: []
  - apiKey: []

paths:
  /api/agents/export:
    get:
      summary: Export agents to CSV
      description: |
        Export all agents in a workspace to CSV format. Only exports agents
        the authenticated user has access to (owned, organization-scoped, or public).
      operationId: exportAgents
      tags:
        - Agents
        - Bulk Operations
      security:
        - sessionCookie: []
        - apiKey: []
      parameters:
        - name: workspaceId
          in: query
          description: Workspace ID to export agents from (defaults to user's default workspace)
          schema:
            type: string
          example: "ws_clx123456789"
        
        - name: format
          in: query
          description: Export format
          schema:
            type: string
            enum: [csv, jsonl]
            default: csv
          example: "csv"
        
        - name: includeTools
          in: query
          description: Include tool IDs in export
          schema:
            type: boolean
            default: true
          example: true
        
        - name: includeSkills
          in: query
          description: Include skill references in export (Phase 2)
          schema:
            type: boolean
            default: false
          example: false
        
        - name: includeArchived
          in: query
          description: Include archived agents
          schema:
            type: boolean
            default: false
          example: false
        
        - name: agentIds
          in: query
          description: Comma-separated list of agent IDs to export (if omitted, exports all)
          schema:
            type: string
          example: "clx1,clx2,clx3"
      
      responses:
        '200':
          description: CSV file download
          content:
            text/csv:
              schema:
                type: string
                format: binary
              example: |
                name,description,instructions,modelProvider,modelName,temperature,tools
                "Support Agent","Handles tickets","You help customers","openai","gpt-4o",0.7,"web-search;gmail-send-email"
          headers:
            Content-Disposition:
              schema:
                type: string
              example: 'attachment; filename="agents-ws123-2026-03-11.csv"'
        
        '400':
          description: Invalid request parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '401':
          description: Unauthorized (not authenticated)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '403':
          description: Forbidden (insufficient permissions)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/agents/export/template:
    get:
      summary: Download CSV template
      description: |
        Download a CSV template with headers and example rows to help users
        understand the required format for bulk import.
      operationId: exportAgentsTemplate
      tags:
        - Agents
        - Bulk Operations
      security:
        - sessionCookie: []
        - apiKey: []
      
      responses:
        '200':
          description: CSV template file
          content:
            text/csv:
              schema:
                type: string
                format: binary
          headers:
            Content-Disposition:
              schema:
                type: string
              example: 'attachment; filename="agents-template.csv"'

  /api/agents/import:
    post:
      summary: Import agents from CSV
      description: |
        Import multiple agents from a CSV file. Validates each row and returns
        a detailed report of successes, failures, and warnings.
        
        ## Conflict Resolution Modes
        - **skip**: Skip agents with names that already exist (default, safest)
        - **overwrite**: Update existing agents, creating version history
        - **version**: Create new version of existing agents
        
        ## Dry Run
        Set `dryRun=true` to validate the CSV without creating/updating agents.
      operationId: importAgents
      tags:
        - Agents
        - Bulk Operations
      security:
        - sessionCookie: []
        - apiKey: []
      
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required:
                - file
              properties:
                file:
                  type: string
                  format: binary
                  description: CSV file to import (max 10MB, max 1000 rows)
                
                workspaceId:
                  type: string
                  description: Target workspace ID (defaults to user's default workspace)
                  example: "ws_clx123456789"
                
                mode:
                  type: string
                  enum: [skip, overwrite, version]
                  default: skip
                  description: |
                    Conflict resolution strategy:
                    - skip: Skip agents with existing names
                    - overwrite: Update existing agents (requires 'update' permission)
                    - version: Create new version of existing agents
                  example: "skip"
                
                dryRun:
                  type: boolean
                  default: false
                  description: Validate only, don't create/update agents
                  example: false
                
                createSkills:
                  type: boolean
                  default: false
                  description: Auto-create missing skills as empty skills (Phase 2)
                  example: false
      
      responses:
        '200':
          description: Import completed (may include partial failures)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ImportResponse'
        
        '400':
          description: Invalid CSV format or parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                missingColumns:
                  value:
                    success: false
                    error: "Missing required columns: instructions, modelProvider"
                invalidFormat:
                  value:
                    success: false
                    error: "Invalid CSV format: Unclosed quote at line 15"
                tooManyRows:
                  value:
                    success: false
                    error: "CSV exceeds maximum of 1000 rows"
        
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '403':
          description: Forbidden (insufficient permissions)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '413':
          description: File too large
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: "File exceeds size limit of 10MB"
        
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: better-auth.session_token
      description: Session cookie from Better Auth
    
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for programmatic access

  schemas:
    ImportResponse:
      type: object
      required:
        - success
        - summary
        - results
      properties:
        success:
          type: boolean
          description: Overall success status
          example: true
        
        dryRun:
          type: boolean
          description: Whether this was a dry run (validation only)
          example: false
        
        summary:
          type: object
          required:
            - totalRows
            - created
            - updated
            - skipped
            - failed
          properties:
            totalRows:
              type: integer
              description: Total number of rows processed (excluding header)
              example: 50
            created:
              type: integer
              description: Number of agents successfully created
              example: 42
            updated:
              type: integer
              description: Number of agents successfully updated
              example: 5
            skipped:
              type: integer
              description: Number of agents skipped due to conflicts
              example: 2
            failed:
              type: integer
              description: Number of agents that failed validation
              example: 1
        
        results:
          type: array
          description: Per-row results
          items:
            $ref: '#/components/schemas/RowResult'
        
        warnings:
          type: array
          description: Non-critical warnings that didn't prevent import
          items:
            type: string
          example:
            - "Row 5: Tool 'hubspot_get-contacts' not available (missing API key)"
            - "Row 12: Skill 'custom-research' not found in workspace"
    
    RowResult:
      type: object
      required:
        - row
        - status
      properties:
        row:
          type: integer
          description: 1-indexed row number (excluding header)
          example: 1
        
        status:
          type: string
          enum: [created, updated, skipped, failed]
          description: Status of this row's import
          example: "created"
        
        agentId:
          type: string
          description: CUID of created/updated agent (if successful)
          example: "clx_abc123xyz"
        
        agentSlug:
          type: string
          description: Slug of created/updated agent
          example: "customer-support"
        
        agentName:
          type: string
          description: Name of the agent from the CSV
          example: "Customer Support Agent"
        
        error:
          type: string
          description: Error message for failed rows
          example: "Model 'gpt-5o' not found for provider 'openai'"
        
        reason:
          type: string
          description: Reason for skipped rows
          example: "Agent with name 'Assistant' already exists (mode=skip)"
        
        suggestion:
          type: string
          description: Suggestion for fixing errors
          example: "Did you mean: gpt-4o?"
        
        warnings:
          type: array
          description: Row-specific warnings
          items:
            type: string
          example:
            - "Tool 'custom-tool' not found, skipped"
    
    ErrorResponse:
      type: object
      required:
        - success
        - error
      properties:
        success:
          type: boolean
          enum: [false]
          description: Always false for error responses
        
        error:
          type: string
          description: Human-readable error message
          example: "Missing required columns: instructions"
        
        suggestion:
          type: string
          description: Suggestion for fixing the error (if applicable)
          example: "Add an 'instructions' column to your CSV"

tags:
  - name: Agents
    description: Agent management operations
  - name: Bulk Operations
    description: Bulk import/export operations
```

---

## REST API Documentation

### Endpoint: Export Agents to CSV

**Method:** `GET`  
**Path:** `/api/agents/export`  
**Auth Required:** Yes (session or API key)  
**Rate Limit:** 30 requests/minute per organization

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workspaceId` | string | No | User's default | Workspace to export from |
| `format` | enum | No | `csv` | Output format: `csv` or `jsonl` |
| `includeTools` | boolean | No | `true` | Include tool associations |
| `includeSkills` | boolean | No | `false` | Include skill associations (Phase 2) |
| `includeArchived` | boolean | No | `false` | Include archived agents |
| `agentIds` | string | No | All agents | Comma-separated agent IDs to export |

**Success Response (200):**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agents-{workspaceId}-{date}.csv"

name,description,instructions,modelProvider,modelName,temperature,tools
"Support Agent","Handles tickets","You help customers","openai","gpt-4o",0.7,"web-search"
...
```

**Error Responses:**

| Code | Reason | Body |
|------|--------|------|
| 400 | Invalid parameters | `{ "success": false, "error": "Invalid format" }` |
| 401 | Not authenticated | `{ "success": false, "error": "Unauthorized" }` |
| 403 | Insufficient permissions | `{ "success": false, "error": "Not a member of this organization" }` |
| 429 | Rate limit exceeded | `{ "success": false, "error": "Rate limit exceeded" }` |
| 500 | Server error | `{ "success": false, "error": "Failed to export agents" }` |

**Example Request:**

```bash
curl -X GET "https://agentc2.ai/agent/api/agents/export?workspaceId=ws123&includeTools=true" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o agents.csv
```

---

### Endpoint: Import Agents from CSV

**Method:** `POST`  
**Path:** `/api/agents/import`  
**Auth Required:** Yes (session or API key)  
**Rate Limit:** 30 requests/minute per organization  
**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | Yes | - | CSV file (max 10MB, max 1000 rows) |
| `workspaceId` | string | No | User's default | Target workspace |
| `mode` | enum | No | `skip` | Conflict resolution: `skip`, `overwrite`, `version` |
| `dryRun` | boolean | No | `false` | Validate only, don't commit changes |
| `createSkills` | boolean | No | `false` | Auto-create missing skills (Phase 2) |

**Success Response (200):**

```json
{
  "success": true,
  "dryRun": false,
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
      "agentId": "clx_abc123",
      "agentSlug": "customer-support",
      "agentName": "Customer Support Agent"
    },
    {
      "row": 2,
      "status": "failed",
      "agentName": "Invalid Agent",
      "error": "Model 'gpt-5o' not found for provider 'openai'",
      "suggestion": "Did you mean: gpt-4o?"
    },
    {
      "row": 3,
      "status": "skipped",
      "agentName": "Assistant",
      "reason": "Agent with name 'Assistant' already exists (mode=skip)"
    }
  ],
  "warnings": [
    "Row 5: Tool 'custom-tool' not found. It will be skipped."
  ]
}
```

**Error Responses:**

| Code | Reason | Body |
|------|--------|------|
| 400 | Invalid CSV or parameters | `{ "success": false, "error": "Missing required columns: instructions" }` |
| 401 | Not authenticated | `{ "success": false, "error": "Unauthorized" }` |
| 403 | Insufficient permissions | `{ "success": false, "error": "Insufficient permissions: 'viewer' role cannot 'create'" }` |
| 413 | File too large | `{ "success": false, "error": "File exceeds size limit of 10MB" }` |
| 429 | Rate limit exceeded | `{ "success": false, "error": "Rate limit exceeded. Try again in 30 seconds." }` |
| 500 | Server error | `{ "success": false, "error": "Failed to import agents" }` |

**Example Request:**

```bash
curl -X POST "https://agentc2.ai/agent/api/agents/import" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@agents.csv" \
  -F "workspaceId=ws123" \
  -F "mode=skip" \
  -F "dryRun=false"
```

---

### Endpoint: Download CSV Template

**Method:** `GET`  
**Path:** `/api/agents/export/template`  
**Auth Required:** Yes  
**Rate Limit:** 30 requests/minute per organization

**Success Response (200):**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agents-template.csv"

name,description,instructions,instructionsTemplate,modelProvider,modelName,temperature,maxTokens,maxSteps,memoryEnabled,tools,subAgents,workflows,visibility,isActive
"Customer Support","Handles customer inquiries","You are a helpful customer support agent. Always be polite.","Hello {{userName}}, how can I help?","openai","gpt-4o",0.7,2048,5,true,"web-search;gmail-send-email","","","ORGANIZATION",true
"Research Assistant","Conducts research","You are a research specialist.","","anthropic","claude-sonnet-4-5-20250929",0.8,4096,10,false,"exa-research;web-scrape","","","PRIVATE",true
```

**Example Request:**

```bash
curl -X GET "https://agentc2.ai/agent/api/agents/export/template" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o agents-template.csv
```

---

## CSV Format Specification

### Required Columns

| Column | Type | Validation | Example |
|--------|------|------------|---------|
| `name` | string | Required, max 255 chars, unique within org | `"Customer Support Agent"` |
| `instructions` | text | Required, max 50,000 chars | `"You are a helpful agent..."` |
| `modelProvider` | string | Required, must be valid provider | `"openai"` |
| `modelName` | string | Required, must exist for provider | `"gpt-4o"` |

### Optional Columns

| Column | Type | Default | Validation | Example |
|--------|------|---------|------------|---------|
| `description` | string | `null` | Max 1000 chars | `"Handles support tickets"` |
| `instructionsTemplate` | text | `null` | Max 50,000 chars | `"Hello {{userName}}"` |
| `temperature` | float | `0.7` | Range: 0-2 | `0.8` |
| `maxTokens` | integer | `null` | Positive integer | `4096` |
| `maxSteps` | integer | `5` | Positive integer | `10` |
| `memoryEnabled` | boolean | `false` | `true` or `false` | `true` |
| `tools` | string | `[]` | Semicolon-separated tool IDs | `"calculator;web-fetch"` |
| `subAgents` | string | `[]` | Semicolon-separated slugs | `"researcher;analyst"` |
| `workflows` | string | `[]` | Semicolon-separated IDs | `"approval-flow"` |
| `visibility` | enum | `PRIVATE` | `PRIVATE`, `ORGANIZATION`, or `PUBLIC` | `"ORGANIZATION"` |
| `isActive` | boolean | `true` | `true` or `false` | `true` |

### Encoding Rules

**Character Encoding:** UTF-8 with BOM (for Excel compatibility)

**Delimiter:** Comma (`,`)

**Quote Character:** Double quote (`"`)

**Escape Rule:** Double quotes within values are escaped as `""`

**Line Endings:** CRLF (`\r\n`) or LF (`\n`)

**Example Escaping:**

| Original Value | CSV Representation |
|----------------|-------------------|
| `Hello, world` | `"Hello, world"` |
| `Say "hello"` | `"Say ""hello"""` |
| `Line 1\nLine 2` | `"Line 1\nLine 2"` |
| `=1+1` | `"'=1+1"` (formula injection mitigation) |

---

## Response Schema Details

### ImportResponse Schema

```typescript
interface ImportResponse {
  success: boolean;
  dryRun?: boolean;
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  results: RowResult[];
  warnings: string[];
}

interface RowResult {
  row: number; // 1-indexed
  status: "created" | "updated" | "skipped" | "failed";
  agentId?: string; // Present for created/updated
  agentSlug?: string;
  agentName?: string;
  error?: string; // Present for failed
  reason?: string; // Present for skipped
  suggestion?: string; // Present when error has fix suggestion
  warnings?: string[]; // Row-specific warnings
}
```

### ErrorResponse Schema

```typescript
interface ErrorResponse {
  success: false;
  error: string; // Human-readable error message
  suggestion?: string; // Optional fix suggestion
}
```

---

## Error Codes Reference

### File-Level Errors (Abort Import)

| Error Message | HTTP Code | Fix |
|---------------|-----------|-----|
| Missing required columns: X | 400 | Add missing columns to CSV |
| Invalid CSV format: Unclosed quote at line X | 400 | Fix CSV syntax errors |
| CSV must have at least one data row | 400 | Add data rows after header |
| File exceeds size limit of 10MB | 413 | Split into smaller files |
| CSV exceeds maximum of 1000 rows | 400 | Split into multiple imports |
| Unauthorized | 401 | Provide valid session or API key |
| Insufficient permissions: 'viewer' role cannot 'create' | 403 | Request 'member' role or higher |
| Rate limit exceeded | 429 | Wait before retrying |

### Row-Level Errors (Continue Processing)

| Error Message | Cause | Fix |
|---------------|-------|-----|
| Name is required | Empty name field | Provide agent name |
| Instructions are required | Empty instructions | Provide instructions text |
| Model provider and model name are required | Missing model fields | Add modelProvider and modelName |
| Model 'X' not found for provider 'Y' | Invalid model | Use valid model (see suggestion) |
| Instructions exceed maximum length of 50,000 characters | Too long | Shorten instructions |
| Potential CSV injection detected | Formula in name/instructions | Remove = + - @ from field start |
| Agent with name 'X' already exists | Name conflict | Rename or use overwrite mode |

### Warnings (Non-Blocking)

| Warning Message | Cause | Impact |
|-----------------|-------|--------|
| Tool 'X' not found. It will be skipped. | Invalid tool ID | Agent created without that tool |
| Tool 'X' not available (missing API key) | MCP tool unavailable | Agent created without that tool |
| Skill 'X' not found in workspace | Skill doesn't exist | Agent created without that skill |
| Duplicate names detected in CSV: X (appears N times) | Duplicate names | Only first creates, rest fail/skip |

---

## Request/Response Examples

### Example 1: Successful Import (All Created)

**Request:**
```http
POST /api/agents/import HTTP/1.1
Host: agentc2.ai
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
X-API-Key: YOUR_API_KEY

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="agents.csv"
Content-Type: text/csv

name,instructions,modelProvider,modelName
"Agent 1","You help","openai","gpt-4o"
"Agent 2","You assist","anthropic","claude-sonnet-4-5-20250929"
------WebKitFormBoundary
Content-Disposition: form-data; name="mode"

skip
------WebKitFormBoundary--
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "summary": {
    "totalRows": 2,
    "created": 2,
    "updated": 0,
    "skipped": 0,
    "failed": 0
  },
  "results": [
    {
      "row": 1,
      "status": "created",
      "agentId": "clx_abc",
      "agentSlug": "agent-1",
      "agentName": "Agent 1"
    },
    {
      "row": 2,
      "status": "created",
      "agentId": "clx_def",
      "agentSlug": "agent-2",
      "agentName": "Agent 2"
    }
  ],
  "warnings": []
}
```

---

### Example 2: Import with Validation Errors

**Request:**
```http
POST /api/agents/import HTTP/1.1
Content-Type: multipart/form-data

[CSV with 3 rows: 1 valid, 1 invalid model, 1 missing field]
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "summary": {
    "totalRows": 3,
    "created": 1,
    "updated": 0,
    "skipped": 0,
    "failed": 2
  },
  "results": [
    {
      "row": 1,
      "status": "created",
      "agentId": "clx_abc",
      "agentSlug": "valid-agent",
      "agentName": "Valid Agent"
    },
    {
      "row": 2,
      "status": "failed",
      "agentName": "Invalid Model Agent",
      "error": "Model 'gpt-5o' not found for provider 'openai'",
      "suggestion": "Did you mean: gpt-4o, gpt-4o-mini?"
    },
    {
      "row": 3,
      "status": "failed",
      "agentName": "Incomplete Agent",
      "error": "Instructions are required"
    }
  ],
  "warnings": []
}
```

---

### Example 3: Dry Run Validation

**Request:**
```http
POST /api/agents/import HTTP/1.1
Content-Type: multipart/form-data

[Form data with dryRun=true]
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "dryRun": true,
  "summary": {
    "totalRows": 10,
    "created": 8,
    "updated": 0,
    "skipped": 1,
    "failed": 1
  },
  "results": [
    {
      "row": 1,
      "status": "created",
      "agentName": "Agent 1"
    },
    ...
  ],
  "warnings": [
    "Row 5: Tool 'hubspot_get-contacts' not available"
  ]
}
```

**Note:** No agents are created/updated when `dryRun=true`. The response shows what *would* happen.

---

### Example 4: File-Level Error (Missing Columns)

**Request:**
```http
POST /api/agents/import HTTP/1.1
Content-Type: multipart/form-data

[CSV with missing "instructions" column]
```

**Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": "Missing required columns: instructions"
}
```

---

### Example 5: Export with Authorization Filtering

**Request:**
```http
GET /api/agents/export?workspaceId=ws123&includeArchived=false HTTP/1.1
Host: agentc2.ai
X-API-Key: YOUR_API_KEY
```

**Response (Success):**
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agents-ws123-2026-03-11.csv"

name,description,instructions,modelProvider,modelName,temperature,tools
"Agent 1","Description","Instructions","openai","gpt-4o",0.7,"calculator"
"Agent 2","Description","Instructions","anthropic","claude-sonnet-4-5-20250929",0.8,"web-search"
```

**Note:** Only includes agents the user has access to (owned, organization-visible, or public).

---

## Postman Collection

### Collection Structure

```json
{
  "info": {
    "name": "AgentC2 Bulk Import/Export",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Export Agents",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/agents/export?workspaceId={{workspaceId}}&includeTools=true",
          "host": ["{{baseUrl}}"],
          "path": ["api", "agents", "export"],
          "query": [
            {"key": "workspaceId", "value": "{{workspaceId}}"},
            {"key": "includeTools", "value": "true"}
          ]
        }
      }
    },
    {
      "name": "Import Agents",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": "/path/to/agents.csv"
            },
            {
              "key": "workspaceId",
              "value": "{{workspaceId}}",
              "type": "text"
            },
            {
              "key": "mode",
              "value": "skip",
              "type": "text"
            },
            {
              "key": "dryRun",
              "value": "false",
              "type": "text"
            }
          ]
        },
        "url": {
          "raw": "{{baseUrl}}/api/agents/import",
          "host": ["{{baseUrl}}"],
          "path": ["api", "agents", "import"]
        }
      }
    },
    {
      "name": "Download Template",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/agents/export/template",
          "host": ["{{baseUrl}}"],
          "path": ["api", "agents", "export", "template"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001"
    },
    {
      "key": "apiKey",
      "value": "YOUR_API_KEY"
    },
    {
      "key": "workspaceId",
      "value": "ws_clx123"
    }
  ]
}
```

---

## cURL Examples

### Export All Agents
```bash
curl -X GET "http://localhost:3001/api/agents/export" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o agents.csv
```

### Export Specific Workspace
```bash
curl -X GET "http://localhost:3001/api/agents/export?workspaceId=ws123&includeTools=true" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o agents-ws123.csv
```

### Import Agents (Skip Mode)
```bash
curl -X POST "http://localhost:3001/api/agents/import" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@agents.csv" \
  -F "workspaceId=ws123" \
  -F "mode=skip"
```

### Import with Dry Run
```bash
curl -X POST "http://localhost:3001/api/agents/import" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@agents.csv" \
  -F "dryRun=true"
```

### Import with Overwrite
```bash
curl -X POST "http://localhost:3001/api/agents/import" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@agents.csv" \
  -F "mode=overwrite"
```

### Download Template
```bash
curl -X GET "http://localhost:3001/api/agents/export/template" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o agents-template.csv
```

---

## Python Client Example

```python
import requests

BASE_URL = "https://agentc2.ai/agent"
API_KEY = "YOUR_API_KEY"
WORKSPACE_ID = "ws_clx123"

# Export agents
def export_agents(workspace_id):
    response = requests.get(
        f"{BASE_URL}/api/agents/export",
        params={"workspaceId": workspace_id, "includeTools": True},
        headers={"X-API-Key": API_KEY}
    )
    
    if response.status_code == 200:
        with open(f"agents-{workspace_id}.csv", "wb") as f:
            f.write(response.content)
        print(f"Exported agents to agents-{workspace_id}.csv")
    else:
        print(f"Export failed: {response.json()}")

# Import agents
def import_agents(csv_path, workspace_id, mode="skip", dry_run=False):
    with open(csv_path, "rb") as f:
        files = {"file": f}
        data = {
            "workspaceId": workspace_id,
            "mode": mode,
            "dryRun": str(dry_run).lower()
        }
        
        response = requests.post(
            f"{BASE_URL}/api/agents/import",
            headers={"X-API-Key": API_KEY},
            files=files,
            data=data
        )
    
    if response.status_code == 200:
        result = response.json()
        print(f"Import complete:")
        print(f"  Created: {result['summary']['created']}")
        print(f"  Updated: {result['summary']['updated']}")
        print(f"  Skipped: {result['summary']['skipped']}")
        print(f"  Failed: {result['summary']['failed']}")
        
        # Show failed rows
        failed = [r for r in result['results'] if r['status'] == 'failed']
        if failed:
            print("\nFailed rows:")
            for row in failed:
                print(f"  Row {row['row']}: {row['error']}")
    else:
        print(f"Import failed: {response.json()}")

# Usage
export_agents(WORKSPACE_ID)
import_agents("agents.csv", WORKSPACE_ID, mode="skip", dry_run=False)
```

---

## JavaScript/TypeScript Client Example

```typescript
// Export agents
async function exportAgents(workspaceId: string): Promise<void> {
  const response = await fetch(
    `/api/agents/export?workspaceId=${workspaceId}&includeTools=true`
  );

  if (response.ok) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agents-${workspaceId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } else {
    const error = await response.json();
    console.error("Export failed:", error);
  }
}

// Import agents
async function importAgents(
  file: File,
  workspaceId: string,
  mode: "skip" | "overwrite" | "version" = "skip"
): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("workspaceId", workspaceId);
  formData.append("mode", mode);

  const response = await fetch("/api/agents/import", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Usage
const fileInput = document.querySelector<HTMLInputElement>("#csvFile");
const file = fileInput?.files?.[0];

if (file) {
  const result = await importAgents(file, "ws123", "skip");
  console.log(`Created: ${result.summary.created}`);
  console.log(`Failed: ${result.summary.failed}`);
  
  // Show errors
  const errors = result.results.filter(r => r.status === "failed");
  errors.forEach(err => {
    console.error(`Row ${err.row}: ${err.error}`);
  });
}
```

---

## Validation Examples

### Valid CSV (Minimal)
```csv
name,instructions,modelProvider,modelName
"Agent","Help users","openai","gpt-4o"
```
**Result:** ✅ Created

---

### Invalid CSV (Missing Required Column)
```csv
name,modelProvider,modelName
"Agent","openai","gpt-4o"
```
**Result:** ❌ 400 Error - Missing required columns: instructions

---

### Invalid CSV (Bad Model)
```csv
name,instructions,modelProvider,modelName
"Agent","Help","openai","gpt-invalid"
```
**Result:** ⚠️ Row 1 failed - Model not found (suggestion provided)

---

### Valid CSV (With Tools)
```csv
name,instructions,modelProvider,modelName,tools
"Agent","Help","openai","gpt-4o","calculator;web-search"
```
**Result:** ✅ Created with 2 tools

---

### CSV with Warning (Invalid Tool)
```csv
name,instructions,modelProvider,modelName,tools
"Agent","Help","openai","gpt-4o","calculator;invalid-tool"
```
**Result:** ✅ Created with 1 tool, warning: "invalid-tool not found"

---

## Rate Limiting Details

**Policy:** `RATE_LIMIT_POLICIES.orgMutation`
- **Window:** 60 seconds
- **Max Requests:** 30 per organization
- **Key:** `orgMutation:agentExport:{organizationId}` or `orgMutation:agentImport:{organizationId}`

**Rate Limit Response:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": "Rate limit exceeded. Try again in 45 seconds."
}
```

**Note:** Import/export count as single request regardless of agent count (importing 100 agents = 1 request).

---

## Security Headers

**All Responses Include:**
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**CSV Export Includes:**
```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agents-{id}-{date}.csv"
Cache-Control: no-store, no-cache, must-revalidate
```

---

## Webhook Support (Phase 3)

**Planned:** Webhook notification on import completion

**Event:** `agents.import.completed`

**Payload:**
```json
{
  "event": "agents.import.completed",
  "timestamp": "2026-03-11T12:00:00Z",
  "organizationId": "org_abc",
  "workspaceId": "ws_123",
  "userId": "user_xyz",
  "data": {
    "jobId": "import_job_789",
    "summary": {
      "totalRows": 100,
      "created": 95,
      "failed": 5
    },
    "reportUrl": "https://agentc2.ai/agent/api/import-jobs/789/report"
  }
}
```

---

## API Changelog

### Version 1.0.0 (2026-03-15) - Phase 1 MVP
- ➕ Added `GET /api/agents/export`
- ➕ Added `POST /api/agents/import`
- ➕ Added `GET /api/agents/export/template`
- ✨ Features: Core CSV export/import with validation

### Version 1.1.0 (TBD) - Phase 2
- ➕ Added skill support in CSV
- ➕ Added JSON field serialization
- ➕ Added overwrite and version modes

### Version 2.0.0 (TBD) - Phase 3
- ➕ Added background job processing
- ➕ Added import history endpoint
- ➕ Added scheduled export support
- ➕ Added webhook notifications

---

**API Specification Version:** 1.0.0  
**Last Updated:** 2026-03-11  
**Format:** OpenAPI 3.0 + REST Documentation  
**Status:** Draft for Review
