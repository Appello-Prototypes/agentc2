# Technical Design: CSV Export Feature

**Feature Request:** Add export to CSV feature  
**GitHub Issue:** #111  
**Priority:** Medium | **Complexity:** Medium  
**Affected Areas:** Dashboard, Reporting  
**Design Date:** 2026-03-08  

---

## Executive Summary

This design document outlines a comprehensive approach to implementing CSV export functionality across all report types in the AgentC2 platform. The feature will provide users with the ability to export data from various dashboards and reports for offline analysis, sharing, and integration with external tools.

### Key Design Decisions

1. **Unified Export Service**: Create a centralized CSV generation utility to ensure consistency
2. **Server-side Processing**: Implement exports via API routes to handle large datasets and maintain security
3. **Progressive Enhancement**: Add export buttons to existing pages following established UI patterns
4. **Format Standardization**: Use RFC 4180 CSV standard with consistent field escaping
5. **Tenant Isolation**: Enforce organization-scoped exports with proper authorization

---

## 1. Current State Analysis

### 1.1 Existing Export Implementations

The codebase currently has **three separate CSV export implementations** with inconsistent patterns:

| Location | Type | Scope | Pattern | Issues |
|----------|------|-------|---------|--------|
| `apps/agent/src/app/agents/[agentSlug]/analytics/page.tsx` (L275-358) | **Client-side** | Agent analytics | Inline function | ❌ Limited to summary data<br>❌ No data filtering<br>❌ Inconsistent CSV format |
| `apps/agent/src/app/settings/audit/page.tsx` (L243-264) | **Client-side** | Audit logs | Inline function | ❌ Only exports current page<br>❌ Simple escaping (wrapped in quotes) |
| `apps/agent/src/app/api/agents/[id]/test-cases/export/route.ts` | **Server-side** | Test cases | Dedicated API route | ✅ Proper CSV escaping<br>✅ Supports JSONL format<br>✅ Complete dataset export |

**Key Observations:**

- **No standardization**: Three different implementations with different approaches
- **Limited coverage**: Only 3 out of ~15 report types have export capability
- **Inconsistent UX**: Different button placements and export behaviors
- **Data limitations**: Client-side exports limited by browser memory and pagination state

### 1.2 Report Types Requiring CSV Export

Based on codebase exploration, here are the primary report types:

| Report Type | Location | Current Export | Data Source | Priority |
|-------------|----------|----------------|-------------|----------|
| **Agent Analytics** | `/agents/[slug]/analytics` | ✅ Client-side (limited) | `AgentRun`, aggregated | **P0** - Enhance existing |
| **Live Runs** | `/observe` (Runs tab) | ❌ None | `AgentRun`, `WorkflowRun`, `NetworkRun` | **P0** - Core functionality |
| **Agent Runs List** | `/agents/[slug]/runs` | ❌ None | `AgentRun` with relations | **P0** - Core functionality |
| **Audit Logs** | `/settings/audit` | ✅ Client-side (paginated) | `AuditLog` | **P1** - Enhance existing |
| **Financials Dashboard** | `/admin/financials` | ❌ None | `CostEvent`, `OrgSubscription` | **P1** - Business critical |
| **Test Cases** | `/agents/[slug]/testing` | ✅ Server-side | `AgentTestCase` | ✅ Already complete |
| **Conversations** | `/observe` (Conversations tab) | ❌ None | `AgentRun` (threads) | **P2** |
| **Tool Usage** | Embedded in analytics | ✅ Part of analytics export | `AgentToolCall` | **P2** |
| **Quality/Evaluations** | `/agents/[slug]/evaluations` | ❌ None | `AgentEvaluation` | **P2** |
| **Activity Feed** | `/triggers` (Activity tab) | ❌ None | `TriggerEvent`, `ActivityEvent` | **P3** |
| **Cost Reports** | Various pages | ❌ None | `CostEvent`, daily metrics | **P1** |
| **Health Scores** | `/agents/[slug]/health` | ❌ None | `AgentHealthScore` | **P3** |

---

## 2. Technical Design

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend UI Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Report Page  │  │ Export Button│  │ Progress UI  │      │
│  │ Components   │──▶│   Component  │──▶│  (optional)  │      │
│  └──────────────┘  └──────┬───────┘  └──────────────┘      │
└─────────────────────────────┼─────────────────────────────────┘
                              │ POST /api/reports/export
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Export API Routes                              │   │
│  │  /api/reports/export                                  │   │
│  │  /api/agents/[id]/analytics/export                   │   │
│  │  /api/agents/[id]/runs/export                        │   │
│  │  /api/live/runs/export                               │   │
│  │  /api/audit-logs/export                              │   │
│  │  /api/financials/export (admin)                      │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│  ┌────────────────▼──────────────────────────────────────┐  │
│  │        Shared Export Service Library                   │  │
│  │  - CSV Generator                                       │  │
│  │  - Field Formatters                                    │  │
│  │  - Streaming Support                                   │  │
│  │  - Authorization Helpers                               │  │
│  └────────────────┬─────────────────────────────────────┘   │
└───────────────────┼───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Prisma Client                                        │   │
│  │  - Query with filters                                 │   │
│  │  - Cursor pagination for large datasets               │   │
│  │  - Include related data (joins)                       │   │
│  └────────────────┬─────────────────────────────────────┘   │
└───────────────────┼───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                          │
│  AgentRun, AgentStatsDaily, AuditLog, CostEvent, etc.        │
└─────────────────────────────────────────────────────────────┘
```

**Design Principles:**

1. **Server-side processing**: Handle large datasets without browser memory constraints
2. **Streaming for large exports**: Use Node.js streams for datasets > 10,000 rows
3. **Shared utility library**: Centralized CSV generation logic
4. **Consistent authorization**: Reuse existing `requireAuth()` and `requireAgentAccess()` patterns
5. **Filter preservation**: Export respects all active filters (date range, status, search, etc.)
6. **Progressive enhancement**: Works without JavaScript (direct download links)

### 2.2 Core Components & Modules

#### 2.2.1 Shared Export Utility (`packages/agentc2/src/utils/csv-export.ts`)

**Purpose**: Centralized CSV generation with streaming support

```typescript
export interface CsvColumn {
    key: string;
    label: string;
    formatter?: (value: any) => string;
}

export interface CsvExportOptions {
    columns: CsvColumn[];
    filename: string;
    streaming?: boolean;
    includeMetadata?: boolean;
    metadata?: Record<string, string>;
}

export class CsvExporter {
    /**
     * Escapes value according to RFC 4180
     */
    static escape(value: unknown): string;
    
    /**
     * Generates CSV header row
     */
    static generateHeader(columns: CsvColumn[]): string;
    
    /**
     * Generates CSV row from data object
     */
    static generateRow(data: Record<string, any>, columns: CsvColumn[]): string;
    
    /**
     * Generates complete CSV string (for small datasets)
     */
    static generate(data: Record<string, any>[], options: CsvExportOptions): string;
    
    /**
     * Creates streaming CSV response (for large datasets)
     */
    static createStreamingResponse(
        dataIterator: AsyncGenerator<Record<string, any>>,
        options: CsvExportOptions
    ): NextResponse;
}
```

**Key Features:**

- **RFC 4180 compliant**: Proper escaping of commas, quotes, newlines
- **Type-safe**: TypeScript interfaces for column definitions
- **Formatter functions**: Custom formatting per column (dates, numbers, JSON, etc.)
- **Metadata support**: Optional header rows with export context (date range, filters)
- **Streaming API**: Handle exports up to millions of rows
- **Reusable across apps**: Shared package usable by agent, admin, and frontend apps

#### 2.2.2 Export Button Component (`packages/ui/src/components/export-button.tsx`)

**Purpose**: Consistent UI component for triggering exports

```typescript
interface ExportButtonProps {
    onExport: () => void | Promise<void>;
    loading?: boolean;
    disabled?: boolean;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
    label?: string;
    icon?: React.ReactNode;
}

export function ExportButton({ 
    onExport, 
    loading, 
    disabled,
    variant = "outline",
    size = "default",
    label = "Export CSV",
    icon
}: ExportButtonProps) {
    // Renders Button with loading state and download icon
}
```

**Features:**

- Consistent styling with shadcn/ui Button component
- Loading state with spinner
- Disabled state support
- Customizable label and icon
- Accessibility (ARIA labels, keyboard support)

#### 2.2.3 Export Status Hook (`apps/agent/src/hooks/useExport.ts`)

**Purpose**: Manages export state and error handling

```typescript
interface UseExportResult {
    isExporting: boolean;
    error: string | null;
    progress?: { current: number; total: number };
    exportData: (endpoint: string, params?: Record<string, string>) => Promise<void>;
    reset: () => void;
}

export function useExport(): UseExportResult {
    // Handles fetch, blob creation, download triggering
    // Tracks progress for large exports
    // Error handling and retry logic
}
```

#### 2.2.4 API Route Pattern

**Pattern**: Each report type gets a dedicated export endpoint

```typescript
// apps/agent/src/app/api/agents/[id]/runs/export/route.ts
export async function GET(request: NextRequest, { params }: RouteParams) {
    // 1. Authentication
    const { context, response: authResponse } = await requireAuth(request);
    if (authResponse) return authResponse;
    
    // 2. Authorization
    const { agentId, response: accessResponse } = await requireAgentAccess(
        context.organizationId,
        params.id
    );
    if (accessResponse) return accessResponse;
    
    // 3. Parse filters from query params
    const filters = parseExportFilters(request);
    
    // 4. Query data with Prisma
    const runs = await prisma.agentRun.findMany({
        where: buildWhereClause(filters, context.organizationId),
        include: { /* relations */ },
        orderBy: { startedAt: "desc" }
    });
    
    // 5. Generate CSV using shared utility
    const csv = CsvExporter.generate(runs, {
        columns: AGENT_RUN_COLUMNS,
        filename: `agent-runs-${agentId}-${Date.now()}.csv`,
        includeMetadata: true,
        metadata: {
            "Agent ID": agentId,
            "Export Date": new Date().toISOString(),
            "Filters Applied": JSON.stringify(filters)
        }
    });
    
    // 6. Return CSV response
    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${options.filename}"`
        }
    });
}
```

---

## 3. Data Model Changes

### 3.1 New Database Models

**ExportJob** (optional, for async large exports)

```prisma
model ExportJob {
    id              String   @id @default(cuid())
    organizationId  String
    userId          String
    
    reportType      String   // "agent-runs", "analytics", "financials", etc.
    status          String   // "PENDING", "PROCESSING", "COMPLETED", "FAILED"
    
    filtersJson     Json?    // Filters applied
    totalRows       Int?
    processedRows   Int?
    
    fileUrl         String?  // S3 or local storage URL
    fileSize        Int?     // bytes
    expiresAt       DateTime?
    
    error           String?  @db.Text
    
    createdAt       DateTime @default(now())
    completedAt     DateTime?
    
    organization    Organization @relation(fields: [organizationId], references: [id])
    user            User         @relation(fields: [userId], references: [id])
    
    @@index([organizationId, userId, createdAt])
    @@index([status, createdAt])
}
```

**Purpose**: Track large export jobs that are processed asynchronously

**When to use:**
- Exports exceeding 10,000 rows
- Exports requiring heavy data aggregation
- Allow users to download later without blocking the UI

**Alternative**: For Phase 1, skip this model and use direct streaming responses

### 3.2 Schema Additions

**Option 1: No schema changes** (Recommended for Phase 1)
- Use existing models
- Stream responses directly
- Track usage via existing audit logs

**Option 2: Add export tracking** (Optional for Phase 2+)
- Add `ExportJob` model as shown above
- Add audit log action types: `EXPORT_INITIATED`, `EXPORT_COMPLETED`, `EXPORT_FAILED`

---

## 4. API Changes

### 4.1 New API Endpoints

All endpoints follow the pattern: `GET /api/{resource}/export`

#### Priority 0 (Core Functionality)

| Endpoint | Purpose | Data Source | Estimated Rows |
|----------|---------|-------------|----------------|
| `GET /api/agents/[id]/runs/export` | Export agent execution runs | `AgentRun` + relations | 100-100K |
| `GET /api/live/runs/export` | Export unified production runs | `AgentRun`, `WorkflowRun`, `NetworkRun` | 1K-1M |
| `GET /api/agents/[id]/analytics/export` | Enhanced analytics export | Aggregated from `AgentRun` | 1-1K |

#### Priority 1 (Business Critical)

| Endpoint | Purpose | Data Source | Estimated Rows |
|----------|---------|-------------|----------------|
| `GET /api/audit-logs/export` | Export audit trail (server-side) | `AuditLog` | 100-100K |
| `GET /api/financials/export` | Export financial reports | `CostEvent`, `OrgSubscription` | 100-10K |
| `GET /api/agents/[id]/costs/export` | Export cost breakdown | `CostEvent`, `AgentCostDaily` | 100-50K |

#### Priority 2 (Enhanced Features)

| Endpoint | Purpose | Data Source | Estimated Rows |
|----------|---------|-------------|----------------|
| `GET /api/conversations/export` | Export conversation threads | `AgentRun` grouped by thread | 10-10K |
| `GET /api/agents/[id]/evaluations/export` | Export quality evaluations | `AgentEvaluation` | 100-10K |
| `GET /api/agents/[id]/tools/export` | Export tool usage logs | `AgentToolCall` | 1K-100K |
| `GET /api/activity/export` | Export activity feed | `ActivityEvent` | 100-50K |

### 4.2 Query Parameters (Standardized)

All export endpoints accept these common parameters:

```typescript
interface StandardExportParams {
    // Date filters
    from?: string;           // ISO 8601 date
    to?: string;             // ISO 8601 date
    
    // Status filters
    status?: string;         // e.g., "COMPLETED", "FAILED"
    
    // Search
    search?: string;         // Text search in relevant fields
    
    // Format options
    format?: "csv" | "jsonl"; // Default: csv
    includeMetadata?: boolean; // Include metadata header rows (default: true)
    
    // Pagination (for very large exports)
    limit?: number;          // Max rows (default: 50000, max: 100000)
    offset?: number;         // Skip rows (default: 0)
    
    // Report-specific filters
    [key: string]: string | undefined;
}
```

**Example Request:**

```
GET /api/agents/agent-123/runs/export?from=2026-01-01&to=2026-03-08&status=COMPLETED&format=csv
```

### 4.3 Response Format

#### Standard CSV Response

```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agent-runs-agent-123-2026-03-08.csv"
Content-Length: 1234567

# Metadata (optional)
# Export Date: 2026-03-08T15:30:00Z
# Report Type: Agent Runs
# Agent ID: agent-123
# Date Range: 2026-01-01 to 2026-03-08
# Total Rows: 1234
# 
id,status,input_text,output_text,duration_ms,started_at,completed_at,model_provider,model_name,prompt_tokens,completion_tokens,total_tokens,cost_usd,source
run-001,COMPLETED,"What is AI?","AI stands for...",2345,2026-03-08T10:00:00Z,2026-03-08T10:00:02Z,openai,gpt-4o,50,200,250,0.0125,api
run-002,COMPLETED,"Explain RAG","RAG is...",1890,2026-03-08T11:00:00Z,2026-03-08T11:00:01Z,anthropic,claude-sonnet-4-20250514,40,180,220,0.0110,slack
```

#### Error Response

```json
{
    "success": false,
    "error": "Export failed: Dataset too large. Please narrow your date range or use filters."
}
```

### 4.4 Implementation Details

**Authorization:**
- Enforce organization-scoped access
- Verify user has permission to view the data being exported
- Admin-only endpoints for platform-wide exports (financials, multi-org reports)

**Performance Considerations:**
- **Small exports (<1000 rows)**: Direct array-to-CSV conversion
- **Medium exports (1K-10K rows)**: Batch processing with cursor pagination
- **Large exports (>10K rows)**: Streaming response with chunked transfer encoding
- **Rate limiting**: Max 10 concurrent exports per user, max 5 exports per minute

**Data Sanitization:**
- Strip PII if export is shared (configurable via permissions)
- Truncate large text fields (e.g., limit `outputText` to 1000 chars with ellipsis)
- Escape special characters properly
- Convert JSON fields to stringified format or flatten to multiple columns

---

## 5. Integration Points with Existing Code

### 5.1 Frontend Pages Requiring Updates

Each page needs:
1. Import `ExportButton` component
2. Add state management with `useExport()` hook
3. Place button in page header or toolbar
4. Call export API endpoint with current filters

**Example: Agent Runs Page (`apps/agent/src/app/agents/[agentSlug]/runs/page.tsx`)**

```typescript
// Add to existing page component
const { isExporting, error, exportData } = useExport();

const handleExport = async () => {
    const params = {
        status: statusFilter,
        source: sourceFilter,
        from: dateFrom,
        to: dateTo,
        search: searchQuery
    };
    
    await exportData(`/api/agents/${agentId}/runs/export`, params);
};

// Add to page header
<div className="flex items-center justify-between">
    <h1>Agent Runs</h1>
    <ExportButton 
        onExport={handleExport}
        loading={isExporting}
        disabled={isExporting || runs.length === 0}
    />
</div>
```

### 5.2 Backend API Routes Requiring Updates

**Existing `/api/agents/[id]/runs/route.ts`**: No changes required, but ensure filters are well-documented

**New Export Routes**: Follow existing authentication patterns:

```typescript
// Reuse existing helpers
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";
import { authenticateRequest } from "@/lib/api-auth";
```

### 5.3 Shared Utility Integration

**CSV Escaping**: Replace inline `csvEscape()` functions with centralized utility

**Before (3 different implementations):**
```typescript
// analytics/page.tsx - No escaping for simple format
rows.push(`${value1},${value2}`);

// audit/page.tsx - Wrap everything in quotes
const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));

// test-cases/export/route.ts - Conditional escaping
function csvEscape(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
```

**After (unified):**
```typescript
import { CsvExporter } from "@repo/agentc2/utils/csv-export";

const csv = CsvExporter.generate(data, { columns, filename });
```

---

## 6. Detailed Feature Specifications

### 6.1 Column Definitions by Report Type

#### Agent Runs Export

**Columns:**
- `id`: Run identifier
- `status`: QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
- `input_text`: User input (truncate to 500 chars)
- `output_text`: Agent response (truncate to 1000 chars)
- `duration_ms`: Execution duration
- `started_at`: ISO 8601 timestamp
- `completed_at`: ISO 8601 timestamp
- `model_provider`: openai, anthropic, etc.
- `model_name`: gpt-4o, claude-sonnet-4, etc.
- `prompt_tokens`: Input tokens
- `completion_tokens`: Output tokens
- `total_tokens`: Sum of tokens
- `cost_usd`: Cost in USD (formatted to 4 decimals)
- `source`: slack, voice, api, ui, etc.
- `session_id`: Conversation session ID
- `thread_id`: Thread ID
- `user_id`: User who triggered the run
- `version_number`: Agent version used
- `tool_calls_count`: Number of tools called
- `eval_score`: Overall evaluation score (if evaluated)
- `eval_grade`: Letter grade (if evaluated)
- `feedback`: User feedback (positive/negative/none)

#### Analytics Export (Enhanced)

**Sections (multi-table format):**

1. **Summary Section** (key-value pairs)
2. **Daily Trends** (time series)
3. **Tool Usage** (aggregated)
4. **Quality Scores** (by scorer)
5. **Model Comparison** (by model)
6. **Cost Breakdown** (by date/model)

**Format:** Multi-table CSV with section headers

#### Audit Logs Export

**Columns:**
- `timestamp`: ISO 8601
- `action`: CREATE, UPDATE, DELETE, etc.
- `entity_type`: Agent, Workflow, Integration, etc.
- `entity_id`: ID of affected entity
- `actor_id`: User or system ID
- `actor_type`: USER, SYSTEM, AGENT
- `metadata`: JSON string (flattened)
- `integrity_hash`: SHA-256 hash
- `ip_address`: Source IP (if available)
- `user_agent`: Browser/client info

#### Financials Export

**Columns:**
- `month`: YYYY-MM format
- `total_revenue_usd`: Monthly revenue
- `total_cost_usd`: AI model costs
- `gross_margin_usd`: Revenue - cost
- `margin_percent`: Percentage
- `mrr_usd`: Monthly recurring revenue
- `arr_usd`: Annual recurring revenue
- `active_organizations`: Count
- `active_subscriptions`: Count
- `total_runs`: Execution count
- `total_tokens`: Token consumption

**Additional Tables:**
- Revenue by plan
- Cost by model
- Top customers by spend
- Active subscription details

### 6.2 CSV Format Standards

**Encoding:** UTF-8 with BOM (`\uFEFF`) for Excel compatibility

**Line Endings:** CRLF (`\r\n`) for Windows compatibility

**Date Format:** ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)

**Number Format:**
- Integers: No formatting (e.g., `1234`)
- Decimals: Fixed precision (e.g., `123.4567` for costs, `95.5` for percentages)
- Currency: Include unit in column name (e.g., `cost_usd`)

**Boolean Format:** `true` / `false` (lowercase)

**Null Values:** Empty string (`""`)

**JSON Fields:** Stringified and escaped (e.g., `"{""key"":""value""}"`)

**Text Truncation:**
- `inputText`, `outputText`: 1000 characters max, append `...` if truncated
- Add `_truncated` column indicating if truncation occurred

**Metadata Header (optional):**
```csv
# Export Type: Agent Runs
# Agent ID: agent-123
# Date Range: 2026-01-01 to 2026-03-08
# Exported At: 2026-03-08T15:30:00Z
# Total Rows: 1234
# 
id,status,input_text,...
```

### 6.3 Performance Targets

| Dataset Size | Response Time | Memory Usage | Approach |
|--------------|---------------|--------------|----------|
| < 1K rows | < 1 second | < 10 MB | Direct generation |
| 1K-10K rows | < 5 seconds | < 50 MB | Batched generation |
| 10K-50K rows | < 30 seconds | < 100 MB | Streaming |
| 50K-100K rows | < 2 minutes | < 200 MB | Streaming + async job (Phase 2) |
| > 100K rows | < 10 minutes | N/A | Async job with email notification (Phase 2) |

---

## 7. Impact Assessment

### 7.1 Affected Systems

| System | Impact | Risk Level | Mitigation |
|--------|--------|------------|------------|
| **API Layer** | New export endpoints | **Low** | Follow existing patterns, comprehensive testing |
| **Database** | Increased read queries | **Medium** | Add indexes, implement query timeouts, connection pooling |
| **Frontend Pages** | Add export buttons | **Low** | Non-breaking UI enhancement |
| **Authorization** | Reuse existing auth | **Low** | No changes to auth logic |
| **Performance** | Additional server load | **Medium** | Rate limiting, streaming, caching |
| **Storage** | CSV files (if async) | **Low** | Implement expiration, use temp storage |

### 7.2 Breaking Changes

**None.** This is a purely additive feature.

### 7.3 Security Considerations

| Risk | Mitigation |
|------|------------|
| **Data exfiltration** | Enforce org-scoped queries, audit all exports |
| **Large exports DoS** | Rate limiting, row limits, streaming with timeout |
| **CSV injection attacks** | Escape formulas (`=`, `+`, `-`, `@` prefixes) |
| **PII leakage** | Add PII masking for sensitive fields (email, phone) |
| **Unauthorized access** | Reuse existing `requireAuth()` and `requireAgentAccess()` |

**CSV Injection Prevention:**

```typescript
function escapeFormulaInjection(value: string): string {
    // Excel formula injection: =cmd|'/c calc'!A1
    if (/^[=+\-@]/.test(value)) {
        return `'${value}`; // Prefix with single quote to treat as text
    }
    return value;
}
```

### 7.4 Database Performance Impact

**New Indexes Required:**

```prisma
// agentc2/packages/database/prisma/schema.prisma

model AgentRun {
    // Existing indexes...
    
    // New composite indexes for export queries
    @@index([organizationId, agentId, startedAt(sort: Desc)])
    @@index([organizationId, status, startedAt(sort: Desc)])
    @@index([organizationId, source, startedAt(sort: Desc)])
}

model AuditLog {
    // Existing indexes...
    
    // Export query optimization
    @@index([tenantId, createdAt(sort: Desc)])
    @@index([tenantId, action, createdAt(sort: Desc)])
}
```

**Query Optimization:**
- Use `cursor` pagination instead of `offset` for large datasets
- Select only required fields (no `SELECT *`)
- Stream results instead of loading all into memory
- Set query timeouts (30s for exports)

---

## 8. Technology & Dependencies

### 8.1 Existing Technologies (No New Dependencies)

| Technology | Current Usage | Export Usage |
|------------|---------------|--------------|
| **Next.js API Routes** | All backend APIs | Export endpoints |
| **Prisma** | Database ORM | Data querying |
| **React** | Frontend framework | Export button components |
| **TypeScript** | Type safety | Type-safe CSV column definitions |

### 8.2 No External Libraries Required

The design intentionally **avoids** adding new dependencies:

- ❌ **csv-writer**, **papaparse**, **json2csv**: Unnecessary overhead
- ✅ **Native string manipulation**: Sufficient for RFC 4180 CSV
- ✅ **Node.js Streams**: Built-in streaming support
- ✅ **Blob API**: Already used in existing export code

**Rationale:** CSV format is simple enough that a lightweight custom implementation is more maintainable and performant than adding dependencies.

---

## 9. User Experience (UX) Flow

### 9.1 Export Button Placement

**Consistent Pattern Across All Report Pages:**

```
┌─────────────────────────────────────────────────────────┐
│  📊 Report Title                    [Filter] [Export]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Table or Chart Content]                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Placement:** Top-right of page header, next to existing filter controls

### 9.2 Export Interaction Flow

**Small Exports (<1000 rows):**
1. User clicks "Export CSV" button
2. Button shows loading spinner
3. File downloads immediately (< 2 seconds)
4. Button returns to normal state

**Medium Exports (1K-10K rows):**
1. User clicks "Export CSV" button
2. Button shows loading spinner with text "Preparing export..."
3. Progress indicator (optional): "Processed 2,500 / 5,000 rows"
4. File downloads when complete
5. Success toast: "Exported 5,000 rows successfully"

**Large Exports (>10K rows) - Phase 2:**
1. User clicks "Export CSV" button
2. Modal appears: "This export will take a few minutes. We'll send you an email when it's ready."
3. Job queued with Inngest
4. User can navigate away
5. Background job processes export
6. File stored temporarily (expires in 24h)
7. Email sent with download link
8. User downloads from email or `/settings/exports` page

### 9.3 Error Handling

| Error Condition | User Message | Recovery Action |
|----------------|--------------|-----------------|
| No data to export | "No data available for export with the selected filters." | Adjust filters |
| Export too large | "Dataset is too large. Please narrow your date range or use filters." | Add filters |
| Authorization failure | "You don't have permission to export this data." | Contact admin |
| Server error | "Export failed. Please try again or contact support." | Retry or support |
| Network timeout | "Export is taking longer than expected. Try narrowing your date range." | Reduce scope |

---

## 10. Testing Strategy

### 10.1 Unit Tests

**CSV Utility Tests** (`packages/agentc2/src/utils/__tests__/csv-export.test.ts`):
- CSV escaping with edge cases (commas, quotes, newlines, unicode)
- Formula injection prevention
- Column formatting (dates, numbers, booleans, nulls)
- Metadata header generation
- Empty dataset handling

**API Route Tests** (`apps/agent/src/app/api/agents/[id]/runs/export/__tests__/route.test.ts`):
- Authorization checks (authenticated, tenant-scoped)
- Query parameter parsing
- Filter application (date, status, search)
- Response headers (Content-Type, Content-Disposition)
- Error handling (invalid params, missing data)

### 10.2 Integration Tests

- Export with various filter combinations
- Large dataset handling (10K, 50K rows)
- Concurrent export requests
- Cross-app consistency (agent app, admin app)

### 10.3 Manual Testing Checklist

**Functional:**
- [ ] Export button appears on all report pages
- [ ] Downloaded file has correct filename
- [ ] CSV opens correctly in Excel, Google Sheets, LibreOffice
- [ ] All columns present and properly formatted
- [ ] Metadata header is readable
- [ ] Filters are applied correctly
- [ ] Date ranges work as expected
- [ ] Search filters are respected

**Performance:**
- [ ] Export <1000 rows completes in <2s
- [ ] Export 10K rows completes in <30s
- [ ] Multiple concurrent exports don't crash server
- [ ] Memory usage stays within limits

**Security:**
- [ ] Cannot export other organization's data
- [ ] Guest users cannot export (if restricted)
- [ ] CSV injection prevented
- [ ] Audit log entry created for each export

**Compatibility:**
- [ ] Excel (Windows & Mac)
- [ ] Google Sheets
- [ ] LibreOffice Calc
- [ ] Numbers (macOS)

---

## 11. Phased Implementation Approach

### Phase 1: Foundation & Core Reports (Week 1-2)

**Goal**: Establish infrastructure and export core reports

**Deliverables:**

1. **Shared CSV Export Utility** (`packages/agentc2/src/utils/csv-export.ts`)
   - `CsvExporter` class with static methods
   - Field formatters (dates, numbers, JSON)
   - Unit tests with >95% coverage
   - Documentation with usage examples

2. **Export Button Component** (`packages/ui/src/components/export-button.tsx`)
   - Reusable UI component
   - Loading and disabled states
   - Storybook story with examples

3. **useExport Hook** (`apps/agent/src/hooks/useExport.ts`)
   - State management for export operations
   - Error handling and retry logic
   - Progress tracking (for Phase 2)

4. **Core Export Endpoints (P0):**
   - `GET /api/agents/[id]/runs/export` - Agent runs with full filtering
   - `GET /api/live/runs/export` - Unified production runs
   - `GET /api/agents/[id]/analytics/export` - Enhanced analytics (replace client-side)

5. **UI Integration (P0 Pages):**
   - Agent Runs page (`/agents/[slug]/runs`)
   - Live Runs page (`/observe?tab=runs`)
   - Analytics page (`/agents/[slug]/analytics`) - Replace existing export

**Success Criteria:**
- ✅ Users can export agent runs from 3 key pages
- ✅ CSV files open correctly in Excel and Google Sheets
- ✅ All filters are preserved in exports
- ✅ Performance: <5s for 5K rows
- ✅ Unit tests pass
- ✅ Type checks pass
- ✅ No linting errors

**Estimated Effort:** 12-16 hours
- CSV utility: 3h
- Export button + hook: 2h
- API routes (3x): 4h
- UI integration (3x): 3h
- Testing: 3h
- Documentation: 1h

---

### Phase 2: Business & Audit Reports (Week 3)

**Goal**: Add export to business-critical reports

**Deliverables:**

1. **Business Reports Export Endpoints (P1):**
   - `GET /api/audit-logs/export` - Replace client-side audit export
   - `GET /api/financials/export` - Financial dashboard (admin app)
   - `GET /api/agents/[id]/costs/export` - Cost breakdown reports

2. **UI Integration (P1 Pages):**
   - Audit Logs page (`/settings/audit`) - Replace existing export
   - Financials page (`/admin/financials`)
   - Cost reports (various agent pages)

3. **Enhanced Features:**
   - Multi-table CSV support (for complex reports like financials)
   - Excel-optimized formatting (number formats, currency symbols)
   - Export history tracking (add to audit logs)

**Success Criteria:**
- ✅ All P0 and P1 reports have export capability
- ✅ Financials export includes all sub-reports
- ✅ Audit logs export is server-side (no pagination limits)
- ✅ Export actions are logged in audit trail

**Estimated Effort:** 8-12 hours

---

### Phase 3: Advanced Features (Week 4)

**Goal**: Add streaming, async jobs, and remaining reports

**Deliverables:**

1. **Streaming Export Support:**
   - Implement `CsvExporter.createStreamingResponse()`
   - Refactor large exports to use streaming
   - Add progress tracking for UI

2. **Async Export Jobs (Optional):**
   - Add `ExportJob` model to schema
   - Inngest function for background processing
   - Email notification when export ready
   - `/settings/exports` page for job management

3. **Remaining Export Endpoints (P2):**
   - `GET /api/conversations/export`
   - `GET /api/agents/[id]/evaluations/export`
   - `GET /api/agents/[id]/tools/export`

4. **Export Configuration:**
   - User preferences for default format (CSV vs JSONL)
   - Column selection (choose which fields to export)
   - Export templates (saved filter + column presets)

**Success Criteria:**
- ✅ All report types have export capability
- ✅ Exports >10K rows use streaming
- ✅ Large exports don't timeout
- ✅ Users can track export jobs

**Estimated Effort:** 12-16 hours

---

### Phase 4: Polish & Advanced Features (Week 5)

**Goal**: Enhanced UX and power user features

**Deliverables:**

1. **Scheduled Exports:**
   - Recurring export jobs (daily, weekly, monthly)
   - Email delivery or webhook notification
   - Stored in S3 or local storage

2. **Export API for External Integration:**
   - API key-based authentication
   - Programmatic export access
   - Webhook callback support

3. **Advanced Formatting:**
   - Excel XLSX format (using `exceljs` library)
   - Custom column ordering
   - Pivot table support (for analytics)

4. **Export Analytics:**
   - Track export usage per org
   - Popular report types
   - Average export size
   - Cost attribution (if processing is expensive)

**Success Criteria:**
- ✅ Power users can schedule automated exports
- ✅ API integration available for external tools
- ✅ XLSX format available for complex reports

**Estimated Effort:** 16-20 hours

---

## 12. Implementation Guidelines

### 12.1 Code Structure

```
packages/agentc2/src/utils/
├── csv-export.ts              # Core CSV utility
├── csv-formatters.ts          # Field formatters (dates, currency, etc.)
└── __tests__/
    └── csv-export.test.ts     # Unit tests

packages/ui/src/components/
├── export-button.tsx          # Reusable export button
└── export-progress.tsx        # Progress indicator (Phase 3)

apps/agent/src/hooks/
└── useExport.ts               # Export state management hook

apps/agent/src/app/api/
├── agents/[id]/runs/export/route.ts
├── agents/[id]/analytics/export/route.ts
├── agents/[id]/costs/export/route.ts
├── agents/[id]/evaluations/export/route.ts
├── agents/[id]/tools/export/route.ts
├── live/runs/export/route.ts
├── audit-logs/export/route.ts
└── conversations/export/route.ts

apps/admin/src/app/api/
└── financials/export/route.ts

apps/agent/src/lib/
└── export-columns.ts          # Column definitions for each report type
```

### 12.2 CSV Utility Implementation Pattern

**Core Escaper:**

```typescript
export class CsvExporter {
    /**
     * Escapes a value for CSV according to RFC 4180
     * - Wraps in quotes if contains comma, quote, or newline
     * - Doubles internal quotes
     * - Prevents formula injection
     */
    static escape(value: unknown): string {
        if (value == null) return "";
        
        let str = String(value);
        
        // Prevent CSV injection (formula injection)
        if (/^[=+\-@\t\r]/.test(str)) {
            str = `'${str}`;
        }
        
        // RFC 4180: wrap in quotes if contains special chars
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        
        return str;
    }
    
    static generateRow(data: Record<string, any>, columns: CsvColumn[]): string {
        return columns
            .map((col) => {
                const value = data[col.key];
                const formatted = col.formatter ? col.formatter(value) : value;
                return CsvExporter.escape(formatted);
            })
            .join(",");
    }
}
```

**Formatters:**

```typescript
// csv-formatters.ts
export const CsvFormatters = {
    isoDate: (value: Date | string | null) => {
        if (!value) return "";
        return new Date(value).toISOString();
    },
    
    humanDate: (value: Date | string | null) => {
        if (!value) return "";
        return new Date(value).toLocaleString("en-US");
    },
    
    currency: (value: number | null, decimals = 2) => {
        if (value == null) return "";
        return value.toFixed(decimals);
    },
    
    percentage: (value: number | null, decimals = 1) => {
        if (value == null) return "";
        return value.toFixed(decimals);
    },
    
    truncate: (value: string | null, maxLength: number) => {
        if (!value) return "";
        if (value.length <= maxLength) return value;
        return value.slice(0, maxLength - 3) + "...";
    },
    
    json: (value: any) => {
        if (value == null) return "";
        return JSON.stringify(value);
    },
    
    boolean: (value: boolean | null) => {
        if (value == null) return "";
        return value ? "true" : "false";
    },
    
    arrayJoin: (value: any[], separator = "; ") => {
        if (!Array.isArray(value)) return "";
        return value.join(separator);
    }
};
```

### 12.3 API Route Template

```typescript
// apps/agent/src/app/api/agents/[id]/runs/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";
import { CsvExporter, CsvColumn } from "@repo/agentc2/utils/csv-export";
import { CsvFormatters } from "@repo/agentc2/utils/csv-formatters";
import { AGENT_RUNS_COLUMNS } from "@/lib/export-columns";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Authentication
        const { id: agentId } = await params;
        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        
        // 2. Authorization
        const { response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            agentId
        );
        if (accessResponse) return accessResponse;
        
        // 3. Parse query parameters
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const source = searchParams.get("source");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const search = searchParams.get("search");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50000", 10), 100000);
        
        // 4. Build Prisma where clause
        const where: any = {
            agentId,
            organizationId: context.organizationId
        };
        
        if (status && status !== "all") {
            where.status = status.toUpperCase();
        }
        
        if (source && source !== "all") {
            where.source = source;
        }
        
        if (from || to) {
            where.startedAt = {};
            if (from) where.startedAt.gte = new Date(from);
            if (to) where.startedAt.lte = new Date(to);
        }
        
        if (search) {
            where.OR = [
                { inputText: { contains: search, mode: "insensitive" } },
                { outputText: { contains: search, mode: "insensitive" } }
            ];
        }
        
        // 5. Query data
        const runs = await prisma.agentRun.findMany({
            where,
            take: limit,
            orderBy: { startedAt: "desc" },
            include: {
                toolCalls: { select: { id: true } }, // Just count
                evaluation: { select: { overallGrade: true, confidenceScore: true } },
                feedback: { select: { thumbs: true } }
            }
        });
        
        // 6. Transform to flat structure
        const flatData = runs.map((run) => ({
            id: run.id,
            status: run.status,
            input_text: run.inputText,
            output_text: run.outputText,
            duration_ms: run.durationMs,
            started_at: run.startedAt,
            completed_at: run.completedAt,
            model_provider: run.modelProvider,
            model_name: run.modelName,
            prompt_tokens: run.promptTokens,
            completion_tokens: run.completionTokens,
            total_tokens: run.totalTokens,
            cost_usd: run.costUsd,
            source: run.source,
            session_id: run.sessionId,
            thread_id: run.threadId,
            user_id: run.userId,
            version_number: run.versionNumber,
            tool_calls_count: run.toolCalls.length,
            eval_grade: run.evaluation?.overallGrade,
            eval_score: run.evaluation?.confidenceScore,
            feedback: run.feedback?.thumbs
        }));
        
        // 7. Generate CSV
        const csv = CsvExporter.generate(flatData, {
            columns: AGENT_RUNS_COLUMNS,
            filename: `agent-runs-${agentId}-${new Date().toISOString().split("T")[0]}.csv`,
            includeMetadata: true,
            metadata: {
                "Agent ID": agentId,
                "Export Date": new Date().toISOString(),
                "Total Rows": flatData.length.toString(),
                "Filters": JSON.stringify({ status, source, from, to, search })
            }
        });
        
        // 8. Return response
        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="agent-runs-${agentId}.csv"`
            }
        });
        
    } catch (error) {
        console.error("[Agent Runs Export] Error:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : "Export failed" 
            },
            { status: 500 }
        );
    }
}
```

**Testing Checklist:**
- [ ] CSV utility tests pass
- [ ] Export button renders in Storybook
- [ ] All 3 P0 endpoints functional
- [ ] Authorization enforced
- [ ] Filters work correctly
- [ ] Files download with correct names
- [ ] Excel/Sheets compatibility verified
- [ ] Type checks pass: `bun run type-check`
- [ ] Lint passes: `bun run lint`
- [ ] Build succeeds: `bun run build`

---

### Phase 2: Business Reports & Enhancements (Week 3)

**Goal**: Add export to business-critical pages and improve existing exports

**Deliverables:**

1. **Business Export Endpoints (P1):**
   - `GET /api/audit-logs/export` (server-side, unlimited)
   - `GET /api/financials/export` (multi-table format)
   - `GET /api/agents/[id]/costs/export`

2. **UI Integration (P1 Pages):**
   - Replace client-side audit log export with server-side
   - Add export to Financials dashboard
   - Add export to agent cost pages

3. **Multi-Table CSV Support:**
   - Allow multiple data tables in one CSV file
   - Section headers for each table
   - Used for complex reports (financials, analytics)

4. **Export Audit Trail:**
   - Log all export actions to `AuditLog`
   - Track: who exported, what data, when, how many rows
   - Action type: `EXPORT_REPORT`

**Success Criteria:**
- ✅ All P0 + P1 reports exportable
- ✅ Audit logs export works without pagination limits
- ✅ Financials export includes all sub-reports
- ✅ All exports are audited

**Estimated Effort:** 8-10 hours

---

### Phase 3: Streaming & Remaining Reports (Week 4)

**Goal**: Handle large datasets efficiently and cover remaining reports

**Deliverables:**

1. **Streaming CSV Generation:**
   - Implement `createStreamingResponse()` method
   - Cursor-based pagination with Prisma
   - Chunked transfer encoding
   - Timeout handling (max 5 minutes)

2. **Large Export Optimization:**
   - Refactor runs export to use streaming for >10K rows
   - Add progress indicator to UI
   - Query optimization with new indexes

3. **Remaining Export Endpoints (P2):**
   - `GET /api/conversations/export`
   - `GET /api/agents/[id]/evaluations/export`
   - `GET /api/agents/[id]/tools/export`
   - `GET /api/activity/export`

4. **Database Indexes:**
   - Add composite indexes for export queries
   - Analyze slow query log
   - Optimize common filter combinations

**Success Criteria:**
- ✅ All report types covered
- ✅ Exports up to 100K rows complete successfully
- ✅ Performance: <30s for 50K rows
- ✅ No server memory issues

**Estimated Effort:** 12-15 hours

---

### Phase 4: Advanced Features (Future Enhancement)

**Goal**: Power user features and automation

**Deliverables:**

1. **Async Export Jobs:**
   - `ExportJob` database model
   - Inngest background processing
   - Email notifications with download links
   - `/settings/exports` job management page
   - Job expiration (24-48h)

2. **Scheduled Exports:**
   - Recurring export configuration
   - Cron-like scheduling UI
   - Automated delivery (email, webhook, S3)

3. **Export Templates:**
   - Save filter + column presets
   - Quick export with one click
   - Share templates across team

4. **XLSX Format Support:**
   - Add `exceljs` dependency
   - Support multiple sheets per export
   - Formatted numbers, dates, currency
   - Frozen header rows

5. **API Key-Based Export:**
   - External integration support
   - Rate limiting per API key
   - Usage tracking

**Success Criteria:**
- ✅ Users can schedule automated exports
- ✅ Large exports don't block UI
- ✅ XLSX format available
- ✅ External tools can integrate

**Estimated Effort:** 20-24 hours

---

## 13. Risks & Mitigations

### 13.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Database overload from large exports** | Medium | High | - Add query timeouts (30s)<br>- Implement row limits<br>- Use cursor pagination<br>- Add read replica for exports (future) |
| **Memory exhaustion with large datasets** | Medium | High | - Streaming responses (Phase 3)<br>- Set max export size (100K rows)<br>- Monitor memory usage |
| **CSV format incompatibility** | Low | Medium | - Follow RFC 4180 strictly<br>- Test with Excel, Sheets, LibreOffice<br>- Use UTF-8 BOM for Excel |
| **Formula injection vulnerability** | Low | High | - Escape formula prefixes (`=`, `+`, `-`, `@`)<br>- Security testing<br>- Document vulnerability |
| **Inconsistent data across reports** | Low | Medium | - Use shared utility for all exports<br>- Comprehensive integration tests |
| **Performance degradation** | Medium | Medium | - Add database indexes<br>- Implement rate limiting<br>- Cache aggregated data |

### 13.2 User Experience Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Export times out on large datasets** | High | High | - Show progress indicator<br>- Suggest filters to reduce size<br>- Implement async jobs (Phase 4) |
| **Users export wrong data** | Medium | Low | - Confirm dialog for large exports<br>- Include metadata header showing filters<br>- Preview first 10 rows (optional) |
| **Excel doesn't open file correctly** | Low | Medium | - UTF-8 BOM for encoding detection<br>- Test with multiple Excel versions<br>- Provide troubleshooting docs |
| **Users unclear which button exports what** | Low | Low | - Consistent button placement<br>- Clear labels ("Export Runs to CSV")<br>- Tooltip with details |

### 13.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Data exfiltration** | Low | Critical | - Audit all exports<br>- Rate limiting per user<br>- Org-scoped enforcement<br>- Alert on bulk exports |
| **Compliance issues (GDPR, SOC2)** | Low | High | - PII masking option<br>- Audit trail for all exports<br>- Retention policy for export files<br>- User consent for data export |
| **Cost increase from compute** | Medium | Low | - Monitor export volume<br>- Set quotas per org tier<br>- Consider export fees for high usage |

---

## 14. Testing Plan

### 14.1 Unit Tests

**CSV Utility Tests** (`packages/agentc2/src/utils/__tests__/csv-export.test.ts`):

```typescript
describe("CsvExporter.escape", () => {
    it("should escape commas", () => {
        expect(CsvExporter.escape("hello, world")).toBe('"hello, world"');
    });
    
    it("should escape quotes by doubling them", () => {
        expect(CsvExporter.escape('say "hello"')).toBe('"say ""hello"""');
    });
    
    it("should escape newlines", () => {
        expect(CsvExporter.escape("line1\nline2")).toBe('"line1\nline2"');
    });
    
    it("should prevent formula injection", () => {
        expect(CsvExporter.escape("=1+1")).toBe("'=1+1");
        expect(CsvExporter.escape("+A1")).toBe("'+A1");
        expect(CsvExporter.escape("-2+3")).toBe("'-2+3");
        expect(CsvExporter.escape("@SUM(A1)")).toBe("'@SUM(A1)");
    });
    
    it("should handle null and undefined", () => {
        expect(CsvExporter.escape(null)).toBe("");
        expect(CsvExporter.escape(undefined)).toBe("");
    });
    
    it("should convert numbers to strings", () => {
        expect(CsvExporter.escape(123)).toBe("123");
        expect(CsvExporter.escape(123.456)).toBe("123.456");
    });
});

describe("CsvExporter.generate", () => {
    it("should generate valid CSV from array of objects", () => {
        const data = [
            { id: "1", name: "Alice", score: 95 },
            { id: "2", name: "Bob", score: 87 }
        ];
        const columns = [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "score", label: "Score" }
        ];
        
        const csv = CsvExporter.generate(data, { columns, filename: "test.csv" });
        
        expect(csv).toContain("ID,Name,Score");
        expect(csv).toContain("1,Alice,95");
        expect(csv).toContain("2,Bob,87");
    });
    
    it("should apply formatters", () => {
        const data = [{ date: new Date("2026-03-08T12:00:00Z"), amount: 123.456 }];
        const columns = [
            { key: "date", label: "Date", formatter: CsvFormatters.isoDate },
            { key: "amount", label: "Amount", formatter: (v) => CsvFormatters.currency(v, 2) }
        ];
        
        const csv = CsvExporter.generate(data, { columns, filename: "test.csv" });
        
        expect(csv).toContain("2026-03-08T12:00:00.000Z");
        expect(csv).toContain("123.46");
    });
});
```

### 14.2 Integration Tests

**API Route Tests:**

```typescript
// apps/agent/src/app/api/agents/[id]/runs/export/__tests__/route.test.ts
describe("GET /api/agents/[id]/runs/export", () => {
    it("should require authentication", async () => {
        const response = await GET(new NextRequest("http://localhost/api/agents/123/runs/export"), {
            params: Promise.resolve({ id: "123" })
        });
        expect(response.status).toBe(401);
    });
    
    it("should enforce agent access", async () => {
        // Mock user without access
        const response = await GET(requestWithAuth("other-org-user"), {
            params: Promise.resolve({ id: "agent-123" })
        });
        expect(response.status).toBe(403);
    });
    
    it("should export runs with filters", async () => {
        const response = await GET(
            new NextRequest("http://localhost/api/agents/123/runs/export?status=COMPLETED"),
            { params: Promise.resolve({ id: "123" }) }
        );
        
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
        
        const csv = await response.text();
        expect(csv).toContain("id,status,input_text");
    });
});
```

### 14.3 E2E Tests (Optional)

**Playwright Tests:**
- Navigate to reports page
- Apply filters
- Click export button
- Verify file downloads
- Parse CSV and verify content

---

## 15. Documentation Requirements

### 15.1 User Documentation

**Location:** `docs/user-guide/exporting-reports.md`

**Contents:**
- How to export reports from each page
- Understanding the CSV format
- Filtering data before export
- Opening CSV files in Excel, Google Sheets
- Troubleshooting common issues (encoding, formula warnings)

### 15.2 API Documentation

**Location:** `docs/api/export-endpoints.md`

**Contents:**
- List of all export endpoints
- Query parameter reference
- Response format specification
- Example requests with curl
- Error codes and troubleshooting

### 15.3 Developer Documentation

**Location:** `docs/development/csv-export.md`

**Contents:**
- How to add export to a new report
- CSV utility usage guide
- Column definition patterns
- Streaming implementation guide
- Testing guidelines

---

## 16. Metrics & Monitoring

### 16.1 Key Metrics to Track

**Usage Metrics:**
- Export requests per day/week/month
- Export requests by report type
- Average export size (rows)
- Export completion rate
- Failed exports by error type

**Performance Metrics:**
- Export duration by size bucket
- Database query duration
- Memory usage during export
- Concurrent export count

**Business Metrics:**
- Exports per organization
- Power users (>10 exports/week)
- Popular report types
- Peak export times

### 16.2 Monitoring & Alerts

**CloudWatch/Datadog Metrics:**
- `export.requests.count` (by report_type, status)
- `export.duration.ms` (by report_type, row_count_bucket)
- `export.errors.count` (by error_type)
- `export.size.bytes` (by report_type)

**Alerts:**
- Export error rate >5%
- Average export duration >30s
- Concurrent exports >50
- Memory usage >80%

**Logging:**
```typescript
logger.info("Export completed", {
    reportType: "agent-runs",
    agentId,
    userId: context.userId,
    organizationId: context.organizationId,
    rowCount: runs.length,
    durationMs: Date.now() - startTime,
    filters: { status, source, from, to }
});
```

---

## 17. Future Enhancements (Beyond Phase 4)

### 17.1 Advanced Export Formats

- **Excel XLSX**: Multi-sheet workbooks with formatting
- **Google Sheets**: Direct export to user's Google Drive
- **PDF**: Formatted reports with charts
- **Parquet**: For data science workflows
- **JSON**: Structured export for API consumers

### 17.2 Export Customization

- **Column Picker**: Users select which columns to export
- **Custom Ordering**: Drag-and-drop column order
- **Calculated Columns**: Add derived fields
- **Conditional Formatting**: Color-code cells in XLSX

### 17.3 Collaboration Features

- **Share Export Links**: Time-limited public links
- **Export Templates**: Save and share configurations
- **Team Dashboards**: Scheduled exports for team reports
- **Slack/Email Integration**: Deliver exports automatically

### 17.4 Data Warehouse Integration

- **S3 Export**: Bulk export to AWS S3 for data lakes
- **BigQuery/Snowflake**: Direct export to data warehouses
- **Reverse ETL**: Sync data to external tools (Salesforce, HubSpot)

---

## 18. Success Metrics

### 18.1 Launch Success Criteria (Phase 1)

**Functional:**
- ✅ 3 core report types have working CSV export
- ✅ Exports complete in <5s for typical datasets (<5K rows)
- ✅ CSV files open correctly in Excel and Google Sheets
- ✅ All active filters are preserved in exports
- ✅ Authorization works correctly (tenant isolation)

**Technical:**
- ✅ Zero critical bugs in first week
- ✅ <5% error rate
- ✅ Type checks, lint, and build pass
- ✅ Unit test coverage >90% for CSV utility

**Usage:**
- ✅ >10% of active users try export feature in first month
- ✅ >80% of export attempts succeed
- ✅ <3% support tickets related to exports

### 18.2 Long-term Success Metrics (3 months post-launch)

**Adoption:**
- 50% of weekly active users have exported at least once
- 20% of users export regularly (>2x per week)
- All report types see export usage

**Performance:**
- 95th percentile export time <10s
- 99th percentile export time <30s
- Error rate <2%

**Business:**
- Reduced support requests for "how do I get my data out"
- Increased user retention (users who export have higher retention)
- Export feature mentioned in customer feedback/reviews

---

## 19. Open Questions & Decisions Required

### 19.1 Design Decisions Needed

**1. Async Export Jobs: When to trigger?**
- **Option A:** Always use async for exports >10K rows
- **Option B:** Let user choose (quick vs. complete export)
- **Option C:** Phase 1-3 use streaming, Phase 4 adds optional async
- **Recommendation:** Option C (defer until proven necessary)

**2. Export File Storage: Where to store?**
- **Option A:** Local filesystem on server (simple, no new dependencies)
- **Option B:** AWS S3 / DigitalOcean Spaces (scalable, persistence)
- **Option C:** No storage, always stream (no persistence)
- **Recommendation:** Option C for Phase 1-3, Option B for Phase 4 if async jobs added

**3. Row Limits: Hard cap or soft guidance?**
- **Option A:** Hard limit at 100K rows, error if exceeded
- **Option B:** Soft limit with warning, allow up to 500K with confirmation
- **Option C:** No limit, auto-switch to async job if large
- **Recommendation:** Option A for Phase 1-2, Option C for Phase 3+

**4. Multi-tenant Considerations:**
- **Question:** Should admins be able to export cross-org data?
- **Recommendation:** Yes, but only via dedicated admin endpoints with explicit admin role check

**5. PII Handling:**
- **Question:** Should exports mask PII by default (email, phone, names)?
- **Recommendation:** No masking by default, but add optional `maskPii=true` parameter for shared exports

### 19.2 Product Decisions Needed

**1. Export History:**
- Should users see a history of their past exports?
- If yes, how long to retain?
- **Recommendation:** Track in audit logs, dedicated UI in Phase 4

**2. Export Quotas:**
- Should there be limits per organization tier?
- Free: 10 exports/day, Pro: 100/day, Enterprise: unlimited?
- **Recommendation:** No quotas for Phase 1, evaluate based on usage data

**3. Scheduled Exports:**
- Core feature or premium add-on?
- **Recommendation:** Premium feature (Enterprise tier) in Phase 4

---

## 20. Implementation Checklist

### Phase 1: Foundation (P0 Reports)

**Infrastructure:**
- [ ] Create `packages/agentc2/src/utils/csv-export.ts` utility
- [ ] Create `packages/agentc2/src/utils/csv-formatters.ts` formatters
- [ ] Create `packages/ui/src/components/export-button.tsx` component
- [ ] Create `apps/agent/src/hooks/useExport.ts` hook
- [ ] Create `apps/agent/src/lib/export-columns.ts` column definitions
- [ ] Write unit tests for CSV utility (>90% coverage)
- [ ] Create Storybook story for ExportButton

**API Routes (P0):**
- [ ] Implement `GET /api/agents/[id]/runs/export`
- [ ] Implement `GET /api/live/runs/export`
- [ ] Implement `GET /api/agents/[id]/analytics/export`
- [ ] Write integration tests for each endpoint

**UI Integration (P0):**
- [ ] Add export button to Agent Runs page
- [ ] Add export button to Live Runs page (Observe)
- [ ] Replace client-side analytics export with server-side
- [ ] Add loading states and error handling

**Quality Assurance:**
- [ ] Run `bun run type-check` (must pass)
- [ ] Run `bun run lint` (must pass)
- [ ] Run `bun run format`
- [ ] Run `bun run build` (must succeed)
- [ ] Manual testing: Excel, Google Sheets, LibreOffice
- [ ] Manual testing: Various filters and date ranges
- [ ] Manual testing: Large datasets (10K rows)
- [ ] Security review: Authorization, CSV injection

**Documentation:**
- [ ] Add JSDoc comments to CSV utility
- [ ] Update `CLAUDE.md` with export utility reference
- [ ] Create PR description with testing instructions

**Git Operations:**
- [ ] Create feature branch: `feature/csv-export-phase1`
- [ ] Commit with descriptive message
- [ ] Push to GitHub
- [ ] System will auto-create PR

---

### Phase 2: Business Reports (P1)

**API Routes (P1):**
- [ ] Implement `GET /api/audit-logs/export` (server-side)
- [ ] Implement `GET /api/financials/export` (admin app)
- [ ] Implement `GET /api/agents/[id]/costs/export`

**UI Integration (P1):**
- [ ] Replace client-side audit log export
- [ ] Add export to Financials dashboard
- [ ] Add export to cost breakdown pages

**Enhancements:**
- [ ] Multi-table CSV support
- [ ] Export audit trail (log to `AuditLog`)
- [ ] Enhanced metadata headers

**Quality Assurance:** (Same as Phase 1)

---

### Phase 3: Streaming & Remaining Reports (P2)

**Infrastructure:**
- [ ] Implement streaming CSV generation
- [ ] Add database indexes for export queries
- [ ] Performance testing with 50K+ row datasets

**API Routes (P2):**
- [ ] Implement `GET /api/conversations/export`
- [ ] Implement `GET /api/agents/[id]/evaluations/export`
- [ ] Implement `GET /api/agents/[id]/tools/export`
- [ ] Implement `GET /api/activity/export`

**UI Integration (P2):**
- [ ] Add export to Conversations tab
- [ ] Add export to Evaluations page
- [ ] Add export to Activity feed

**Enhancements:**
- [ ] Progress tracking for large exports
- [ ] Query optimization and timeout handling

**Quality Assurance:** (Same as Phase 1 + performance benchmarks)

---

### Phase 4: Advanced Features (Optional)

**Infrastructure:**
- [ ] Add `ExportJob` model to schema
- [ ] Implement Inngest export job processor
- [ ] Add file storage (S3 or local)
- [ ] Create `/settings/exports` management page

**Features:**
- [ ] Async export jobs for large datasets
- [ ] Email notifications with download links
- [ ] Scheduled exports (recurring)
- [ ] Export templates (saved configs)
- [ ] XLSX format support (add `exceljs` dependency)
- [ ] API key-based programmatic export

**Quality Assurance:**
- [ ] Load testing with 100+ concurrent exports
- [ ] Email delivery testing
- [ ] Storage cleanup (expired files)

---

## 21. Rollout Plan

### 21.1 Feature Flags

**Recommended Feature Flag Strategy:**

```typescript
// Environment variable approach (simple)
FEATURE_CSV_EXPORT_ENABLED="true"           // Master toggle
FEATURE_CSV_EXPORT_STREAMING="false"        // Phase 3
FEATURE_CSV_EXPORT_ASYNC_JOBS="false"       // Phase 4
FEATURE_CSV_EXPORT_XLSX="false"             // Phase 4
```

**OR** use database-driven feature flags (more granular):

```prisma
model FeatureFlag {
    id      String  @id
    name    String  @unique
    enabled Boolean @default(false)
    
    // Org-specific overrides
    enabledForOrgs String[] // Array of org IDs
}
```

### 21.2 Deployment Strategy

**Phase 1: Beta Release**
1. Deploy to staging
2. Internal team testing (1 week)
3. Beta flag for selected customers (2 weeks)
4. Collect feedback and iterate
5. General availability

**Phase 2-3: Progressive Rollout**
1. Deploy to 10% of users
2. Monitor metrics (error rate, performance)
3. Increase to 50%
4. Full rollout

**Phase 4: Opt-in for Advanced Features**
- Async jobs and scheduled exports available on request
- Monitor adoption and costs
- Iterate based on feedback

### 21.3 Rollback Plan

**If critical issues arise:**
1. Disable via feature flag (`FEATURE_CSV_EXPORT_ENABLED="false"`)
2. Investigate root cause
3. Deploy fix to staging
4. Re-enable for beta users
5. Progressive re-rollout

**Trigger Conditions for Rollback:**
- Error rate >10%
- Database performance degradation >30%
- Security vulnerability discovered
- Critical bug affecting data accuracy

---

## 22. Cost Estimation

### 22.1 Development Effort

| Phase | Tasks | Estimated Hours | Engineers |
|-------|-------|-----------------|-----------|
| **Phase 1** | Foundation + P0 reports | 12-16h | 1 engineer |
| **Phase 2** | Business reports (P1) | 8-10h | 1 engineer |
| **Phase 3** | Streaming + remaining (P2) | 12-15h | 1 engineer |
| **Phase 4** | Advanced features | 20-24h | 1-2 engineers |
| **Total** | All phases | **52-65 hours** | - |

**Single engineer timeline:**
- Phase 1: 2 weeks (with testing and review)
- Phase 2: 1 week
- Phase 3: 2 weeks
- Phase 4: 3 weeks
- **Total: 8 weeks (2 months)**

### 22.2 Operational Costs

**Compute:**
- Negligible for small exports (<1K rows)
- Medium exports (1K-10K): ~100-500ms CPU time
- Large exports (>10K): ~5-30s CPU time
- **Estimated monthly cost:** $10-50 based on usage

**Storage (Phase 4 only):**
- Assume 1GB average storage for async exports
- 7-day retention
- **Estimated monthly cost:** $1-5 (S3/Spaces)

**Database:**
- Increased read load (5-10% more queries)
- New indexes (~10MB disk space)
- **Estimated monthly cost:** Negligible

**Total Estimated Monthly Cost:** <$100 at scale

---

## 23. Alternatives Considered

### 23.1 Client-Side Export (Current Approach)

**Pros:**
- Simple implementation
- No server load
- Instant download

**Cons:**
- Limited by browser memory (max ~10K rows)
- Only exports current page (if paginated)
- Inconsistent implementations
- No access to full dataset with filters

**Decision:** ❌ Not scalable, inconsistent

---

### 23.2 Third-Party Export Library (csv-writer, papaparse)

**Pros:**
- Battle-tested
- Feature-rich (streaming, encoding options)
- Less code to maintain

**Cons:**
- Additional dependency
- Larger bundle size
- Overkill for simple CSV generation
- Less control over format

**Decision:** ❌ Not necessary, custom utility is simpler

---

### 23.3 Background Job for All Exports

**Pros:**
- Never blocks UI
- Can handle unlimited dataset sizes
- Better server resource management

**Cons:**
- Slower user experience (wait for email)
- More complex infrastructure (job queue, storage)
- Overhead for small exports

**Decision:** ⚠️ Only for Phase 4, only for very large exports (>50K rows)

---

### 23.4 GraphQL with Streaming (Instead of REST)

**Pros:**
- More flexible field selection
- Streaming subscriptions
- Strongly typed schema

**Cons:**
- Requires GraphQL server setup
- More complex client implementation
- Overkill for simple export feature

**Decision:** ❌ Not aligned with current REST API architecture

---

## 24. Dependencies & Prerequisites

### 24.1 No New Dependencies (Phase 1-3)

The design uses only existing technologies:
- Node.js built-in modules (Buffer, Stream)
- Next.js API routes
- Prisma ORM
- React hooks
- shadcn/ui components

### 24.2 Optional Dependencies (Phase 4)

If implementing advanced features:
- `exceljs` (^4.4.0): XLSX generation
- `archiver` (^7.0.0): ZIP multiple exports
- `@aws-sdk/client-s3` (^3.x): S3 storage for async exports

### 24.3 Infrastructure Requirements

**Current Infrastructure (Sufficient for Phase 1-3):**
- ✅ Next.js server with Node.js runtime
- ✅ PostgreSQL database (Supabase)
- ✅ Prisma ORM configured
- ✅ Authentication system (Better Auth)
- ✅ Authorization helpers

**Additional for Phase 4:**
- S3-compatible storage (DigitalOcean Spaces or AWS S3)
- Inngest for async job processing (already available)
- Email service for notifications (already available via Better Auth)

---

## 25. Appendix

### 25.1 RFC 4180 CSV Standard Summary

1. Each record is on a separate line, delimited by CRLF
2. The last record may or may not have a line break
3. Optional header line with field names
4. Fields may be enclosed in double quotes
5. Fields containing line breaks, double quotes, or commas MUST be enclosed
6. A double quote appearing inside a field must be escaped by preceding it with another double quote

### 25.2 Column Definition Examples

```typescript
// apps/agent/src/lib/export-columns.ts
import { CsvColumn } from "@repo/agentc2/utils/csv-export";
import { CsvFormatters } from "@repo/agentc2/utils/csv-formatters";

export const AGENT_RUNS_COLUMNS: CsvColumn[] = [
    { key: "id", label: "Run ID" },
    { key: "status", label: "Status" },
    { 
        key: "input_text", 
        label: "Input", 
        formatter: (v) => CsvFormatters.truncate(v, 500) 
    },
    { 
        key: "output_text", 
        label: "Output", 
        formatter: (v) => CsvFormatters.truncate(v, 1000) 
    },
    { key: "duration_ms", label: "Duration (ms)" },
    { 
        key: "started_at", 
        label: "Started At", 
        formatter: CsvFormatters.isoDate 
    },
    { 
        key: "completed_at", 
        label: "Completed At", 
        formatter: CsvFormatters.isoDate 
    },
    { key: "model_provider", label: "Provider" },
    { key: "model_name", label: "Model" },
    { key: "prompt_tokens", label: "Prompt Tokens" },
    { key: "completion_tokens", label: "Completion Tokens" },
    { key: "total_tokens", label: "Total Tokens" },
    { 
        key: "cost_usd", 
        label: "Cost (USD)", 
        formatter: (v) => CsvFormatters.currency(v, 4) 
    },
    { key: "source", label: "Source" },
    { key: "tool_calls_count", label: "Tool Calls" },
    { 
        key: "eval_score", 
        label: "Eval Score", 
        formatter: (v) => CsvFormatters.percentage(v, 1) 
    },
    { key: "feedback", label: "Feedback" }
];

export const AUDIT_LOG_COLUMNS: CsvColumn[] = [
    { key: "createdAt", label: "Timestamp", formatter: CsvFormatters.isoDate },
    { key: "action", label: "Action" },
    { key: "entityType", label: "Entity Type" },
    { key: "entityId", label: "Entity ID" },
    { key: "actorId", label: "Actor ID" },
    { key: "metadata", label: "Metadata", formatter: CsvFormatters.json },
    { key: "integrityHash", label: "Integrity Hash" }
];

export const FINANCIALS_COLUMNS: CsvColumn[] = [
    { key: "month", label: "Month" },
    { key: "revenue", label: "Revenue (USD)", formatter: (v) => CsvFormatters.currency(v, 2) },
    { key: "cost", label: "Cost (USD)", formatter: (v) => CsvFormatters.currency(v, 2) },
    { key: "margin", label: "Margin (USD)", formatter: (v) => CsvFormatters.currency(v, 2) },
    { key: "marginPercent", label: "Margin (%)", formatter: (v) => CsvFormatters.percentage(v, 1) },
    { key: "mrr", label: "MRR (USD)", formatter: (v) => CsvFormatters.currency(v, 2) },
    { key: "arr", label: "ARR (USD)", formatter: (v) => CsvFormatters.currency(v, 2) },
    { key: "activeOrgs", label: "Active Orgs" },
    { key: "activeSubscriptions", label: "Active Subscriptions" },
    { key: "totalRuns", label: "Total Runs" },
    { key: "totalTokens", label: "Total Tokens" }
];
```

### 25.3 Reference Implementation (Streaming)

```typescript
// packages/agentc2/src/utils/csv-export.ts
import { ReadableStream } from "node:stream/web";

export class CsvExporter {
    /**
     * Creates a streaming CSV response for large datasets
     */
    static createStreamingResponse(
        dataIterator: AsyncGenerator<Record<string, any>>,
        options: CsvExportOptions
    ): Response {
        const encoder = new TextEncoder();
        const { columns, filename, includeMetadata, metadata } = options;
        
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // 1. Send UTF-8 BOM for Excel compatibility
                    controller.enqueue(encoder.encode("\uFEFF"));
                    
                    // 2. Send metadata header (if requested)
                    if (includeMetadata && metadata) {
                        for (const [key, value] of Object.entries(metadata)) {
                            controller.enqueue(encoder.encode(`# ${key}: ${value}\n`));
                        }
                        controller.enqueue(encoder.encode("# \n"));
                    }
                    
                    // 3. Send CSV header row
                    const header = CsvExporter.generateHeader(columns);
                    controller.enqueue(encoder.encode(header + "\n"));
                    
                    // 4. Stream data rows
                    for await (const record of dataIterator) {
                        const row = CsvExporter.generateRow(record, columns);
                        controller.enqueue(encoder.encode(row + "\n"));
                    }
                    
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
        
        return new Response(stream, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Transfer-Encoding": "chunked"
            }
        });
    }
}

// Usage in API route:
async function* fetchRunsGenerator(where: any, limit: number) {
    let cursor: string | undefined = undefined;
    let remaining = limit;
    const batchSize = 1000;
    
    while (remaining > 0) {
        const take = Math.min(batchSize, remaining);
        const runs = await prisma.agentRun.findMany({
            where,
            take,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { startedAt: "desc" }
        });
        
        if (runs.length === 0) break;
        
        for (const run of runs) {
            yield transformRunToFlatObject(run);
        }
        
        remaining -= runs.length;
        cursor = runs[runs.length - 1].id;
        
        if (runs.length < take) break;
    }
}

// In route handler:
if (rowCount > 10000) {
    // Use streaming for large exports
    const generator = fetchRunsGenerator(where, limit);
    return CsvExporter.createStreamingResponse(generator, options);
} else {
    // Direct generation for small exports
    const runs = await prisma.agentRun.findMany({ where, take: limit });
    const csv = CsvExporter.generate(runs, options);
    return new Response(csv, { headers });
}
```

---

## 26. Summary & Recommendations

### 26.1 Key Recommendations

**1. Start with Phase 1** (Foundation + P0 Reports)
- Focus on the most used reports first
- Establish patterns that scale to all report types
- Validate approach with real users before expanding

**2. Prioritize Server-Side Processing**
- Better performance and scalability
- Consistent behavior across reports
- Proper authorization enforcement

**3. Use Shared Utilities**
- Prevent implementation divergence
- Easier to maintain and enhance
- Consistent CSV format across platform

**4. Defer Async Jobs Until Proven Necessary**
- Streaming handles most cases efficiently
- Avoid premature complexity
- Add only if users hit limits frequently

**5. Maintain Backward Compatibility**
- Don't break existing client-side exports immediately
- Deprecate gradually with migration guide
- Ensure test suite coverage

### 26.2 Risk Mitigation Priorities

**High Priority:**
1. Database performance (add indexes, query optimization)
2. CSV injection prevention (escape formulas)
3. Authorization enforcement (tenant isolation)
4. Rate limiting (prevent abuse)

**Medium Priority:**
5. Memory management (streaming for large exports)
6. Error handling and user feedback
7. Cross-app consistency (agent app, admin app)

**Low Priority:**
8. Export history tracking
9. Advanced formatting options
10. Scheduled exports

### 26.3 Go/No-Go Criteria for Production

**Must Have (Blockers):**
- ✅ All Phase 1 deliverables complete
- ✅ Unit tests pass with >90% coverage
- ✅ Integration tests pass
- ✅ Manual testing complete (Excel, Sheets, LibreOffice)
- ✅ Security review passed (authorization, CSV injection)
- ✅ Performance benchmarks met (<5s for 5K rows)
- ✅ Type checks, lint, and build pass
- ✅ Documentation complete

**Should Have (Warnings):**
- ⚠️ Streaming implementation ready (for Phase 3)
- ⚠️ Monitoring/alerting configured
- ⚠️ Load testing completed
- ⚠️ Rollback plan documented

**Nice to Have (Post-Launch):**
- Phase 2+ deliverables
- XLSX format
- Async jobs
- Scheduled exports

---

## 27. Conclusion

This design provides a comprehensive, phased approach to implementing CSV export across the AgentC2 platform. The design:

- ✅ **Builds on existing patterns** - Reuses authentication, API conventions, UI components
- ✅ **Scales progressively** - Starts simple, adds complexity only when needed
- ✅ **Maintains quality** - Comprehensive testing, monitoring, and documentation
- ✅ **Minimizes risk** - No breaking changes, feature flags, rollback plan
- ✅ **Delivers value quickly** - Phase 1 provides immediate value to users

**Next Steps:**
1. Review and approve this design
2. Create implementation tickets for Phase 1
3. Assign engineer(s)
4. Begin development with CSV utility foundation
5. Iterate based on feedback

**Questions or Concerns?**
- Clarify any ambiguous requirements before starting implementation
- Validate assumptions about export use cases with product team
- Confirm row limits and performance targets are acceptable

---

**Design Approved By:** _[Pending Review]_  
**Implementation Start Date:** _[TBD]_  
**Target Launch Date (Phase 1):** _[TBD]_  

---

_This design document is a living document. It should be updated as requirements change or new information becomes available during implementation._
