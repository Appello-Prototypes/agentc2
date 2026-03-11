# Implementation Guide: Bulk Agent Import/Export

**Quick Reference for Developers**

This guide provides concrete implementation patterns and code snippets for building the bulk agent import/export feature.

---

## 1. Quick Start Checklist

### Phase 1 MVP Tasks

- [ ] **Export API** - `apps/agent/src/app/api/agents/export/route.ts`
  - [ ] GET handler with auth + authorization
  - [ ] Query agents from database with tools
  - [ ] Generate CSV with proper escaping
  - [ ] Return file download response

- [ ] **Import API** - `apps/agent/src/app/api/agents/import/route.ts`
  - [ ] POST handler with multipart/form-data
  - [ ] Parse CSV file
  - [ ] Validate each row
  - [ ] Create agents in database
  - [ ] Return validation report

- [ ] **CSV Utilities** - `packages/agentc2/src/agents/csv-utils.ts`
  - [ ] `parseCsv()` function
  - [ ] `generateCsv()` function
  - [ ] `csvEscape()` / `csvUnescape()` helpers

- [ ] **Import Validator** - `packages/agentc2/src/agents/import-validator.ts`
  - [ ] `validateImportRow()` function
  - [ ] `validateImportBatch()` function
  - [ ] Tool validation logic
  - [ ] Model validation logic

- [ ] **UI Component** - `apps/agent/src/components/AgentBulkActions.tsx`
  - [ ] Export button
  - [ ] Import dialog with file picker
  - [ ] Results display table
  - [ ] Mode selector (skip/overwrite/version)

- [ ] **Template Endpoint** - `apps/agent/src/app/api/agents/export/template/route.ts`
  - [ ] Return example CSV with headers + sample rows

- [ ] **Tests**
  - [ ] Unit tests for CSV parsing/generation
  - [ ] Unit tests for validation logic
  - [ ] Integration tests for API endpoints
  - [ ] E2E test for full workflow

---

## 2. Code Patterns & Examples

### 2.1 Export API Pattern

**File:** `apps/agent/src/app/api/agents/export/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireEntityAccess } from "@/lib/authz/require-entity-access";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";
import { generateCsv } from "@repo/agentc2/agents/csv-generator";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const { context, response: authResponse } = await requireAuth(request);
    if (authResponse) return authResponse;

    // 2. Check read permission
    const accessResult = await requireEntityAccess(
      context.userId,
      context.organizationId,
      "read"
    );
    if (!accessResult.allowed) return accessResult.response;

    // 3. Rate limiting
    const rateKey = `orgMutation:agentExport:${context.organizationId}`;
    const rate = await checkRateLimit(rateKey, RATE_LIMIT_POLICIES.orgMutation);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // 4. Parse query parameters
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || context.defaultWorkspaceId;
    const includeTools = searchParams.get("includeTools") !== "false";
    const includeArchived = searchParams.get("includeArchived") === "true";

    // 5. Query agents (with authorization filtering)
    const agents = await prisma.agent.findMany({
      where: {
        workspaceId,
        isArchived: includeArchived ? undefined : false,
        // Filter by agents user has access to
        OR: [
          { workspace: { organizationId: context.organizationId } },
          { ownerId: context.userId },
          { visibility: "PUBLIC" }
        ]
      },
      include: {
        tools: includeTools ? { select: { toolId: true } } : false
      },
      orderBy: { name: "asc" }
    });

    // 6. Generate CSV
    const csv = generateCsv(agents, { includeTools });

    // 7. Return file download
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `agents-${workspaceId}-${timestamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error("[Agent Export] Error:", error);
    return NextResponse.json(
      { error: "Failed to export agents" },
      { status: 500 }
    );
  }
}
```

### 2.2 Import API Pattern

**File:** `apps/agent/src/app/api/agents/import/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireEntityAccess } from "@/lib/authz/require-entity-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";
import { parseCsv } from "@repo/agentc2/agents/csv-parser";
import { validateImportBatch, importAgentBatch } from "@repo/agentc2/agents/import-validator";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 1000;

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const { context, response: authResponse } = await requireAuth(request);
    if (authResponse) return authResponse;

    // 2. Check create permission (will also check update for overwrite mode)
    const accessResult = await requireEntityAccess(
      context.userId,
      context.organizationId,
      "create"
    );
    if (!accessResult.allowed) return accessResult.response;

    // 3. Rate limiting
    const rateKey = `orgMutation:agentImport:${context.organizationId}`;
    const rate = await checkRateLimit(rateKey, RATE_LIMIT_POLICIES.orgMutation);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // 4. Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const workspaceId = formData.get("workspaceId") as string || context.defaultWorkspaceId;
    const mode = (formData.get("mode") as string) || "skip";
    const dryRun = formData.get("dryRun") === "true";

    // 5. Validate file
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A file is required in the 'file' field" },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File exceeds size limit of ${MAX_UPLOAD_BYTES} bytes` },
        { status: 413 }
      );
    }

    // 6. Parse CSV
    const csvContent = await file.text();
    const rows = parseCsv(csvContent);

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV exceeds maximum of ${MAX_ROWS} rows` },
        { status: 400 }
      );
    }

    // 7. Validate batch
    const validationResult = await validateImportBatch(rows, {
      workspaceId,
      organizationId: context.organizationId,
      userId: context.userId,
      mode
    });

    // 8. If dry run, return validation only
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        ...validationResult
      });
    }

    // 9. Check update permission if overwrite mode
    if (mode === "overwrite" || mode === "version") {
      const updateAccess = await requireEntityAccess(
        context.userId,
        context.organizationId,
        "update"
      );
      if (!updateAccess.allowed) return updateAccess.response;
    }

    // 10. Import agents
    const importResult = await importAgentBatch(rows, {
      workspaceId,
      organizationId: context.organizationId,
      userId: context.userId,
      mode
    });

    // 11. Return results
    return NextResponse.json({
      success: true,
      ...importResult
    });
  } catch (error) {
    console.error("[Agent Import] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import agents" },
      { status: 500 }
    );
  }
}
```

### 2.3 CSV Generator Pattern

**File:** `packages/agentc2/src/agents/csv-generator.ts`

```typescript
import type { Agent, AgentTool } from "@repo/database";

interface CsvGeneratorOptions {
  includeTools?: boolean;
  includeSkills?: boolean;
}

export function generateCsv(
  agents: Array<Agent & { tools?: AgentTool[] }>,
  options: CsvGeneratorOptions = {}
): string {
  const { includeTools = true, includeSkills = false } = options;

  // Define columns
  const columns = [
    "name",
    "description",
    "instructions",
    "instructionsTemplate",
    "modelProvider",
    "modelName",
    "temperature",
    "maxTokens",
    "maxSteps",
    "memoryEnabled",
  ];

  if (includeTools) columns.push("tools");
  if (includeSkills) columns.push("skills");
  
  columns.push("subAgents", "workflows", "visibility", "isActive");

  // Generate header row
  const rows: string[] = [columns.join(",")];

  // Generate data rows
  for (const agent of agents) {
    const values = [
      csvEscape(agent.name),
      csvEscape(agent.description || ""),
      csvEscape(agent.instructions),
      csvEscape(agent.instructionsTemplate || ""),
      agent.modelProvider,
      agent.modelName,
      agent.temperature?.toString() || "0.7",
      agent.maxTokens?.toString() || "",
      agent.maxSteps?.toString() || "5",
      agent.memoryEnabled.toString(),
    ];

    if (includeTools) {
      const toolIds = agent.tools?.map(t => t.toolId).join(";") || "";
      values.push(csvEscape(toolIds));
    }

    if (includeSkills) {
      // Phase 2 implementation
      values.push("");
    }

    values.push(
      csvEscape((agent.subAgents || []).join(";")),
      csvEscape((agent.workflows || []).join(";")),
      agent.visibility,
      agent.isActive.toString()
    );

    rows.push(values.join(","));
  }

  return rows.join("\n") + "\n";
}

function csvEscape(value: string): string {
  // Check for formula injection patterns
  const dangerousPattern = /^[=+\-@\t\r]/;
  if (dangerousPattern.test(value)) {
    value = "'" + value; // Prepend single quote to neutralize
  }

  // Check if quoting is needed
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
```

### 2.4 CSV Parser Pattern

**File:** `packages/agentc2/src/agents/csv-parser.ts`

```typescript
export interface ParsedCsvRow {
  name: string;
  description?: string;
  instructions: string;
  instructionsTemplate?: string;
  modelProvider: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
  memoryEnabled?: boolean;
  tools?: string[];
  subAgents?: string[];
  workflows?: string[];
  visibility?: "PRIVATE" | "ORGANIZATION" | "PUBLIC";
  isActive?: boolean;
}

export function parseCsv(csvContent: string): ParsedCsvRow[] {
  // Strip BOM if present (Excel compatibility)
  const content = csvContent.replace(/^\uFEFF/, "");

  // Parse CSV (using papaparse or custom parser)
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  // Parse header
  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());

  // Validate required columns
  const requiredColumns = ["name", "instructions", "modelProvider", "modelName"];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  // Parse rows
  const rows: ParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    rows.push(rowToAgent(row));
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map(v => v.trim());
}

function rowToAgent(row: Record<string, string>): ParsedCsvRow {
  return {
    name: row.name,
    description: row.description || undefined,
    instructions: row.instructions,
    instructionsTemplate: row.instructionstemplate || undefined,
    modelProvider: row.modelprovider,
    modelName: row.modelname,
    temperature: row.temperature ? parseFloat(row.temperature) : undefined,
    maxTokens: row.maxtokens ? parseInt(row.maxtokens, 10) : undefined,
    maxSteps: row.maxsteps ? parseInt(row.maxsteps, 10) : undefined,
    memoryEnabled: row.memoryenabled === "true",
    tools: row.tools ? row.tools.split(";").map(t => t.trim()).filter(Boolean) : undefined,
    subAgents: row.subagents ? row.subagents.split(";").map(s => s.trim()).filter(Boolean) : undefined,
    workflows: row.workflows ? row.workflows.split(";").map(w => w.trim()).filter(Boolean) : undefined,
    visibility: (row.visibility?.toUpperCase() as "PRIVATE" | "ORGANIZATION" | "PUBLIC") || "PRIVATE",
    isActive: row.isactive !== "false"
  };
}
```

### 2.5 Import Validator Pattern

**File:** `packages/agentc2/src/agents/import-validator.ts`

```typescript
import { prisma } from "@repo/database";
import { validateModelSelection } from "./model-registry";
import { hasToolInRegistry, getAllMcpTools } from "../tools/registry";
import type { ParsedCsvRow } from "./csv-parser";

export interface ValidationContext {
  workspaceId: string;
  organizationId: string;
  userId: string;
  mode: "skip" | "overwrite" | "version";
}

export interface RowValidationResult {
  row: number;
  status: "valid" | "invalid";
  errors: string[];
  warnings: string[];
  data?: ParsedCsvRow;
}

export interface BatchValidationResult {
  valid: boolean;
  results: RowValidationResult[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

export async function validateImportRow(
  row: ParsedCsvRow,
  rowNumber: number,
  context: ValidationContext
): Promise<RowValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Required field validation
  if (!row.name || row.name.trim().length === 0) {
    errors.push("Name is required");
  }
  if (!row.instructions || row.instructions.trim().length === 0) {
    errors.push("Instructions are required");
  }
  if (!row.modelProvider) {
    errors.push("Model provider is required");
  }
  if (!row.modelName) {
    errors.push("Model name is required");
  }

  // 2. Field length validation
  if (row.name && row.name.length > 255) {
    errors.push("Name exceeds maximum length of 255 characters");
  }
  if (row.instructions && row.instructions.length > 50000) {
    errors.push("Instructions exceed maximum length of 50,000 characters");
  }

  // 3. CSV injection detection
  const dangerousPattern = /^[=+\-@\t\r]/;
  if (row.name && dangerousPattern.test(row.name)) {
    errors.push("Name contains potential formula injection. Remove = + - @ from start.");
  }

  // 4. Model validation
  if (row.modelProvider && row.modelName) {
    const modelValidation = await validateModelSelection(
      row.modelProvider as any,
      row.modelName,
      context.organizationId
    );
    if (!modelValidation.valid) {
      errors.push(modelValidation.message || "Invalid model selection");
      if (modelValidation.suggestion) {
        warnings.push(`Suggestion: ${modelValidation.suggestion}`);
      }
    }
  }

  // 5. Tool validation
  if (row.tools && row.tools.length > 0) {
    const mcpTools = await getAllMcpTools(context.organizationId);
    const allTools = { ...toolRegistry, ...mcpTools };

    const invalidTools = row.tools.filter(toolId => !allTools[toolId]);
    if (invalidTools.length > 0) {
      warnings.push(`Tools not found: ${invalidTools.join(", ")}. They will be skipped.`);
    }
  }

  // 6. Name uniqueness check
  const existingAgent = await prisma.agent.findFirst({
    where: {
      name: row.name,
      workspace: { organizationId: context.organizationId }
    }
  });

  if (existingAgent && context.mode === "skip") {
    warnings.push(`Agent with name "${row.name}" already exists. This row will be skipped.`);
  }

  return {
    row: rowNumber,
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
    warnings,
    data: row
  };
}

export async function validateImportBatch(
  rows: ParsedCsvRow[],
  context: ValidationContext
): Promise<BatchValidationResult> {
  const results: RowValidationResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = await validateImportRow(rows[i], i + 1, context);
    results.push(result);
  }

  const validRows = results.filter(r => r.status === "valid").length;

  return {
    valid: validRows === rows.length,
    results,
    summary: {
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows
    }
  };
}
```

### 2.6 Import Agent Creation Pattern

**File:** `packages/agentc2/src/agents/import-validator.ts` (continued)

```typescript
export interface ImportResult {
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  results: Array<{
    row: number;
    status: "created" | "updated" | "skipped" | "failed";
    agentId?: string;
    agentSlug?: string;
    agentName?: string;
    error?: string;
    reason?: string;
  }>;
  warnings: string[];
}

export async function importAgentBatch(
  rows: ParsedCsvRow[],
  context: ValidationContext
): Promise<ImportResult> {
  const summary = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };
  const results: ImportResult["results"] = [];
  const warnings: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    try {
      // Validate row (fast checks only, skip slow API validations already done)
      if (!row.name || !row.instructions || !row.modelProvider || !row.modelName) {
        summary.failed++;
        results.push({
          row: rowNumber,
          status: "failed",
          error: "Missing required fields"
        });
        continue;
      }

      // Check for existing agent by name
      const existingByName = await prisma.agent.findFirst({
        where: {
          name: row.name,
          workspace: { organizationId: context.organizationId }
        }
      });

      // Handle conflict based on mode
      if (existingByName) {
        if (context.mode === "skip") {
          summary.skipped++;
          results.push({
            row: rowNumber,
            status: "skipped",
            agentName: row.name,
            reason: `Agent "${row.name}" already exists`
          });
          continue;
        } else if (context.mode === "overwrite") {
          // Update existing agent
          const updated = await updateAgentFromRow(existingByName.id, row, context);
          summary.updated++;
          results.push({
            row: rowNumber,
            status: "updated",
            agentId: updated.id,
            agentSlug: updated.slug,
            agentName: updated.name
          });
          continue;
        }
      }

      // Create new agent
      const agent = await createAgentFromRow(row, context);
      summary.created++;
      results.push({
        row: rowNumber,
        status: "created",
        agentId: agent.id,
        agentSlug: agent.slug,
        agentName: agent.name
      });
    } catch (error) {
      summary.failed++;
      results.push({
        row: rowNumber,
        status: "failed",
        agentName: row.name,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  return { summary, results, warnings };
}

async function createAgentFromRow(
  row: ParsedCsvRow,
  context: ValidationContext
) {
  // Generate unique slug
  const baseSlug = generateSlug(row.name);
  const slug = await generateUniqueAgentSlug(baseSlug, context.workspaceId);

  // Filter valid tools
  const validToolIds = await filterValidTools(row.tools || [], context.organizationId);

  // Create agent
  const agent = await prisma.agent.create({
    data: {
      slug,
      name: row.name,
      description: row.description || null,
      instructions: row.instructions,
      instructionsTemplate: row.instructionsTemplate || null,
      modelProvider: row.modelProvider,
      modelName: row.modelName,
      temperature: row.temperature ?? 0.7,
      maxTokens: row.maxTokens || null,
      maxSteps: row.maxSteps ?? 5,
      memoryEnabled: row.memoryEnabled ?? false,
      subAgents: row.subAgents || [],
      workflows: row.workflows || [],
      visibility: row.visibility || "PRIVATE",
      isActive: row.isActive ?? true,
      type: "USER",
      workspaceId: context.workspaceId,
      ownerId: context.userId,
      version: 1
    }
  });

  // Create tool associations
  if (validToolIds.length > 0) {
    await prisma.agentTool.createMany({
      data: validToolIds.map(toolId => ({
        agentId: agent.id,
        toolId
      }))
    });
  }

  return agent;
}

async function updateAgentFromRow(
  agentId: string,
  row: ParsedCsvRow,
  context: ValidationContext
) {
  // Similar to createAgentFromRow, but uses prisma.agent.update()
  // Also creates AgentVersion snapshot before update
  // See apps/agent/src/app/api/agents/[id]/route.ts for full pattern
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueAgentSlug(
  baseSlug: string,
  workspaceId: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.agent.findFirst({ where: { slug, workspaceId } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}

async function filterValidTools(
  toolIds: string[],
  organizationId: string
): Promise<string[]> {
  const mcpTools = await getAllMcpTools(organizationId);
  const allTools = { ...toolRegistry, ...mcpTools };

  return toolIds.filter(toolId => allTools[toolId]);
}
```

### 2.7 UI Component Pattern

**File:** `apps/agent/src/components/AgentBulkActions.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Select } from "@repo/ui";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { getApiBase } from "@/lib/utils";

export function AgentBulkActions({ workspaceId }: { workspaceId: string }) {
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"skip" | "overwrite" | "version">("skip");
  const [importResult, setImportResult] = useState<any>(null);

  const handleExport = async () => {
    const url = `${getApiBase()}/api/agents/export?workspaceId=${workspaceId}&includeTools=true`;
    window.location.href = url; // Trigger download
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", workspaceId);
      formData.append("mode", mode);

      const response = await fetch(`${getApiBase()}/api/agents/import`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        // Refresh agent list
        window.location.reload();
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={handleExport} variant="outline">
        <DownloadIcon className="mr-2 h-4 w-4" />
        Export to CSV
      </Button>
      
      <Button onClick={() => setImportDialogOpen(true)} variant="outline">
        <UploadIcon className="mr-2 h-4 w-4" />
        Import from CSV
      </Button>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Agents from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                CSV File
              </label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                <a href={`${getApiBase()}/api/agents/export/template`} className="underline">
                  Download CSV template
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Conflict Resolution
              </label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip existing agents</SelectItem>
                  <SelectItem value="overwrite">Overwrite existing agents</SelectItem>
                  <SelectItem value="version">Create new version</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>

          {importResult && (
            <div className="mt-4 border-t pt-4">
              <h3 className="font-semibold mb-2">Import Results</h3>
              <p>
                {importResult.summary.created} created, 
                {importResult.summary.updated} updated, 
                {importResult.summary.skipped} skipped, 
                {importResult.summary.failed} failed
              </p>
              {/* Show detailed results table */}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## 3. Database Queries Reference

### 3.1 Export Query with Authorization Filtering

```typescript
// Get agents user has access to
const agents = await prisma.agent.findMany({
  where: {
    workspaceId,
    isArchived: includeArchived ? undefined : false,
    // Authorization filter: agents in user's org OR owned by user OR public
    OR: [
      { workspace: { organizationId: context.organizationId } },
      { ownerId: context.userId },
      { visibility: "PUBLIC" }
    ]
  },
  include: {
    tools: {
      select: { toolId: true, config: true }
    }
  },
  orderBy: { name: "asc" }
});
```

### 3.2 Import Query - Create Agent with Tools

```typescript
// Use transaction for atomicity
const agent = await prisma.$transaction(async (tx) => {
  // Create agent
  const newAgent = await tx.agent.create({
    data: {
      slug,
      name: row.name,
      description: row.description || null,
      instructions: row.instructions,
      modelProvider: row.modelProvider,
      modelName: row.modelName,
      temperature: row.temperature ?? 0.7,
      workspaceId,
      type: "USER",
      version: 1
    }
  });

  // Create tool associations
  if (validToolIds.length > 0) {
    await tx.agentTool.createMany({
      data: validToolIds.map(toolId => ({
        agentId: newAgent.id,
        toolId
      }))
    });
  }

  // Create activity record
  await tx.activityFeed.create({
    data: {
      type: "AGENT_CREATED",
      agentId: newAgent.id,
      summary: `Agent "${newAgent.name}" created via bulk import`,
      workspaceId
    }
  });

  return newAgent;
});
```

### 3.3 Batch Name/Slug Validation (Optimization)

```typescript
// Instead of querying for each row, batch check all names
const allNames = rows.map(r => r.name);
const existingAgents = await prisma.agent.findMany({
  where: {
    name: { in: allNames },
    workspace: { organizationId }
  },
  select: { name: true, slug: true }
});

const existingNameSet = new Set(existingAgents.map(a => a.name));

// Now check each row against cached set
for (const row of rows) {
  if (existingNameSet.has(row.name)) {
    // Handle conflict
  }
}
```

---

## 4. Testing Patterns

### 4.1 Unit Test Structure

```typescript
// tests/unit/agents/csv-import-export.test.ts

import { describe, it, expect, beforeEach } from "bun:test";
import { generateCsv } from "@repo/agentc2/agents/csv-generator";
import { parseCsv } from "@repo/agentc2/agents/csv-parser";
import { validateImportRow } from "@repo/agentc2/agents/import-validator";

describe("CSV Generator", () => {
  it("generates valid CSV with headers", () => {
    const agents = [
      {
        id: "1",
        name: "Test Agent",
        instructions: "You are helpful",
        modelProvider: "openai",
        modelName: "gpt-4o",
        // ... other fields
      }
    ];

    const csv = generateCsv(agents);
    expect(csv).toContain("name,description,instructions");
    expect(csv).toContain("Test Agent");
  });

  it("escapes special characters", () => {
    const agents = [{ name: 'Agent with "quotes"', /* ... */ }];
    const csv = generateCsv(agents);
    expect(csv).toContain('"Agent with ""quotes"""');
  });
});

describe("CSV Parser", () => {
  it("parses valid CSV", () => {
    const csv = `name,instructions,modelProvider,modelName
"Test","Be helpful","openai","gpt-4o"`;
    
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Test");
  });

  it("throws on missing required columns", () => {
    const csv = `name,instructions\n"Test","Help"`;
    expect(() => parseCsv(csv)).toThrow("Missing required columns");
  });
});
```

### 4.2 Integration Test Structure

```typescript
// tests/integration/api/agents-bulk.test.ts

import { describe, it, expect, beforeEach } from "bun:test";
import { prisma } from "@repo/database";

describe("Agent Export API", () => {
  beforeEach(async () => {
    // Setup test data
    await prisma.agent.create({
      data: {
        slug: "test-agent",
        name: "Test Agent",
        instructions: "Help users",
        modelProvider: "openai",
        modelName: "gpt-4o",
        workspaceId: testWorkspaceId
      }
    });
  });

  it("exports agents to CSV", async () => {
    const response = await fetch(
      `/api/agents/export?workspaceId=${testWorkspaceId}`,
      { headers: { Authorization: `Bearer ${testApiKey}` } }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    
    const csv = await response.text();
    expect(csv).toContain("Test Agent");
  });

  it("requires authentication", async () => {
    const response = await fetch(`/api/agents/export`);
    expect(response.status).toBe(401);
  });
});

describe("Agent Import API", () => {
  it("imports valid agents", async () => {
    const csv = `name,instructions,modelProvider,modelName
"New Agent","Be helpful","openai","gpt-4o"`;

    const formData = new FormData();
    formData.append("file", new Blob([csv], { type: "text/csv" }), "agents.csv");
    formData.append("workspaceId", testWorkspaceId);

    const response = await fetch(`/api/agents/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${testApiKey}` },
      body: formData
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.summary.created).toBe(1);
  });

  it("validates model names", async () => {
    const csv = `name,instructions,modelProvider,modelName
"Agent","Help","openai","gpt-invalid"`;

    const formData = new FormData();
    formData.append("file", new Blob([csv]), "agents.csv");

    const response = await fetch(`/api/agents/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${testApiKey}` },
      body: formData
    });

    const result = await response.json();
    expect(result.summary.failed).toBe(1);
    expect(result.results[0].error).toContain("not found");
  });
});
```

---

## 5. Key Learnings from Existing Code

### 5.1 Patterns to Reuse

**From Test Case Export (`/api/agents/[id]/test-cases/export/route.ts`):**
- ✅ `csvEscape()` function for proper quoting
- ✅ Response format with `Content-Disposition: attachment`
- ✅ Filename with entity ID and extension

**From Agent Create API (`/api/agents/route.ts`):**
- ✅ `generateSlug()` from name
- ✅ `generateUniqueAgentSlug()` with collision handling
- ✅ Name uniqueness check within organization
- ✅ Model validation via `validateModelSelection()`
- ✅ Tool association via `AgentTool.createMany()`
- ✅ Activity feed recording

**From Document Upload (`/api/documents/upload/route.ts`):**
- ✅ File size limit (10MB)
- ✅ Multipart form data parsing
- ✅ File extension validation
- ✅ Rate limiting pattern

**From Playbook Deployer (`packages/agentc2/src/playbooks/deployer.ts`):**
- ✅ Slug deduplication with suffix generation
- ✅ Bulk entity creation in loop (not single transaction)
- ✅ Cross-reference resolution (agent slugs, workflow IDs)
- ✅ Graceful handling of missing references

### 5.2 Patterns to Avoid

**❌ Single transaction for all agents**
- Playbook deployer uses separate creates, not `$transaction` wrapping all
- Allows partial success (some agents created even if others fail)

**❌ Synchronous long-running operations**
- For 1000+ rows, consider background jobs (Phase 3)
- For Phase 1, limit to 1000 rows max

**❌ Exposing internal errors to users**
- Sanitize error messages
- Don't expose database query errors or file paths

---

## 6. Error Handling Patterns

### 6.1 File-Level Errors (Abort Entire Import)

```typescript
// Invalid CSV syntax
if (rows.length < 2) {
  return NextResponse.json(
    { error: "CSV must have a header row and at least one data row" },
    { status: 400 }
  );
}

// Missing required columns
const requiredColumns = ["name", "instructions", "modelProvider", "modelName"];
const missingColumns = requiredColumns.filter(col => !headers.includes(col));
if (missingColumns.length > 0) {
  return NextResponse.json(
    { error: `Missing required columns: ${missingColumns.join(", ")}` },
    { status: 400 }
  );
}

// File too large
if (file.size > MAX_UPLOAD_BYTES) {
  return NextResponse.json(
    { error: `File exceeds size limit of ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` },
    { status: 413 }
  );
}
```

### 6.2 Row-Level Errors (Continue Processing)

```typescript
// Wrap each row in try-catch
for (let i = 0; i < rows.length; i++) {
  try {
    const agent = await createAgentFromRow(rows[i], context);
    results.push({ row: i + 1, status: "created", agentId: agent.id });
  } catch (error) {
    results.push({
      row: i + 1,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
```

### 6.3 Warning Messages (Non-Blocking)

```typescript
// Tool not available
const unavailableTools = toolIds.filter(id => {
  const tool = allTools[id];
  const credCheck = toolCredentialChecks[id];
  return tool && credCheck && !credCheck();
});

if (unavailableTools.length > 0) {
  warnings.push(
    `Row ${rowNumber}: Tool(s) not available: ${unavailableTools.join(", ")}. ` +
    `Check API keys in Settings > Integrations.`
  );
}
```

---

## 7. Performance Optimization Strategies

### 7.1 Batch Model Validation

```typescript
// Instead of validating each row individually, batch unique models
const uniqueModels = new Map<string, { provider: string; model: string }>();

for (const row of rows) {
  const key = `${row.modelProvider}:${row.modelName}`;
  if (!uniqueModels.has(key)) {
    uniqueModels.set(key, { provider: row.modelProvider, model: row.modelName });
  }
}

// Validate all unique models upfront
const modelValidationCache = new Map<string, boolean>();
for (const [key, { provider, model }] of uniqueModels) {
  const validation = await validateModelSelection(provider as any, model, orgId);
  modelValidationCache.set(key, validation.valid);
}

// Reuse cached results per row
for (const row of rows) {
  const key = `${row.modelProvider}:${row.modelName}`;
  const isValid = modelValidationCache.get(key);
  if (!isValid) {
    errors.push({ row, error: "Invalid model" });
  }
}
```

### 7.2 Batch Name/Slug Queries

```typescript
// Query all existing names in one go
const existingNames = await prisma.agent.findMany({
  where: {
    name: { in: rows.map(r => r.name) },
    workspace: { organizationId }
  },
  select: { name: true }
});

const nameSet = new Set(existingNames.map(a => a.name));

// Check against cached set
for (const row of rows) {
  if (nameSet.has(row.name)) {
    // Handle conflict
  }
}
```

### 7.3 Chunked Transactions

```typescript
// For very large imports, chunk into batches of 50
const CHUNK_SIZE = 50;

for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const chunk = rows.slice(i, i + CHUNK_SIZE);
  
  // Process chunk in parallel
  await Promise.all(
    chunk.map(row => createAgentFromRow(row, context))
  );
}
```

---

## 8. Activity Feed Integration

```typescript
import { recordActivity } from "@repo/agentc2/activity/service";

// Record bulk export
recordActivity({
  type: "AGENT_EXPORTED",
  summary: `Exported ${agents.length} agents to CSV`,
  status: "info",
  source: "api",
  workspaceId,
  metadata: {
    agentCount: agents.length,
    includeTools,
    includeArchived
  }
});

// Record bulk import
recordActivity({
  type: "AGENT_IMPORTED",
  summary: `Imported ${summary.created} agents from CSV (${summary.failed} failed)`,
  status: summary.failed > 0 ? "warning" : "success",
  source: "api",
  workspaceId,
  metadata: {
    totalRows: summary.totalRows,
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    failed: summary.failed
  }
});
```

---

## 9. Common Pitfalls & Solutions

### Pitfall 1: Excel Opening CSV Strips Leading Zeros
**Problem:** Agent names like "001-Agent" become "1-Agent"  
**Solution:** Not a concern for this feature (names are text, not numeric IDs)

### Pitfall 2: Unicode Characters Break CSV
**Problem:** Emoji in agent names/instructions cause encoding issues  
**Solution:** Use UTF-8 with BOM, test with emoji in unit tests

### Pitfall 3: Circular References in subAgents
**Problem:** Agent A references Agent B, Agent B references Agent A  
**Solution:** Don't validate subAgent references (same as current API behavior)

### Pitfall 4: Large Text Fields Timeout Database
**Problem:** 1000 agents × 50KB instructions = 50MB of text  
**Solution:** Use streaming or chunked processing for large imports

### Pitfall 5: Rate Limiting Blocks Legitimate Large Imports
**Problem:** 30 req/min policy blocks user importing 100 agents  
**Solution:** Import is single API call processing many rows (not limited by agent count)

---

## 10. Security Review Checklist

- [ ] CSV injection mitigated (prepend `'` to formulas on export, reject on import)
- [ ] File size limit enforced (10MB)
- [ ] Row count limit enforced (1000 rows)
- [ ] Authorization checked per agent on export
- [ ] Authorization checked per operation on import
- [ ] Rate limiting applied to both endpoints
- [ ] No SQL injection (parameterized queries only)
- [ ] No XSS (plain text fields, no HTML rendering)
- [ ] No sensitive data in exports (publicToken, API keys excluded)
- [ ] Error messages don't expose internal paths or queries
- [ ] Multi-tenancy enforced (workspaceId scoping)
- [ ] Input validation on all fields (Zod schemas)

---

## 11. Pre-Deployment Checklist

- [ ] All TypeScript errors resolved (`bun run type-check`)
- [ ] All linting errors fixed (`bun run lint`)
- [ ] Code formatted (`bun run format`)
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests pass
- [ ] E2E test passes
- [ ] Manual testing completed:
  - [ ] Export 100 agents
  - [ ] Import CSV with all valid rows
  - [ ] Import CSV with errors (verify error reporting)
  - [ ] Import with skip mode (verify skipping)
  - [ ] Import with overwrite mode (verify versioning)
  - [ ] Test with tools/skills
  - [ ] Test with multiline instructions
  - [ ] Test with special characters (quotes, commas)
  - [ ] Test with non-English characters (Unicode)
  - [ ] Test rate limiting (trigger 429)
  - [ ] Test authorization (trigger 403)
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Feature flag added to `.env` (if needed)
- [ ] Code reviewed and approved

---

## 12. Post-Deployment Monitoring

**Week 1:**
- Monitor error rates (target: <5%)
- Monitor export/import latencies (target: p95 <5s for 50 agents)
- Check for security incidents (CSV injection attempts)
- Review user feedback/support tickets

**Week 2-4:**
- Analyze adoption metrics (% of users with 20+ agents using feature)
- Identify common validation errors
- Gather feature requests for Phase 2

**Ongoing:**
- Alert on error rate spikes (>10% for 1 hour)
- Alert on rate limiting breaches (indication of misconfiguration)
- Monthly review of import success rates

---

## 13. Reference: Existing Code Locations

### Authorization Helpers
- `apps/agent/src/lib/authz/require-auth.ts` - Session/API key authentication
- `apps/agent/src/lib/authz/require-entity-access.ts` - RBAC permission checks
- `apps/agent/src/lib/authz/require-agent-access.ts` - Agent-specific access checks

### Validation Helpers
- `packages/agentc2/src/agents/model-registry.ts` - Model validation
- `packages/agentc2/src/tools/registry.ts` - Tool registry and validation
- `apps/agent/src/app/api/agents/route.ts` - Agent creation validation pattern

### CSV Patterns
- `apps/agent/src/app/api/agents/[id]/test-cases/export/route.ts` - CSV export reference
- `packages/agentc2/src/bim/adapters/csv-adapter.ts` - CSV parsing reference

### Activity Feed
- `packages/agentc2/src/activity/service.ts` - Activity recording

### Rate Limiting
- `apps/agent/src/lib/rate-limit.ts` - Rate limit checker
- `apps/agent/src/lib/security/rate-limit-policy.ts` - Policy definitions

---

## 14. Dependencies to Add

### Phase 1
```bash
# CSV parsing library (choose one)
bun add papaparse
bun add -D @types/papaparse

# Or use custom parser (no dependency)
```

### Phase 2
```bash
# No additional dependencies (uses existing)
```

### Phase 3
```bash
# Background job processing (already installed)
# inngest@^3.50.0 (already in package.json)
```

---

## 15. File Creation Order (Implementation)

**Step 1: Create utilities (no external dependencies)**
```
packages/agentc2/src/agents/csv-utils.ts
packages/agentc2/src/agents/csv-generator.ts
packages/agentc2/src/agents/csv-parser.ts
```

**Step 2: Create validation logic**
```
packages/agentc2/src/agents/import-validator.ts
```

**Step 3: Create API endpoints**
```
apps/agent/src/app/api/agents/export/route.ts
apps/agent/src/app/api/agents/export/template/route.ts
apps/agent/src/app/api/agents/import/route.ts
```

**Step 4: Create UI component**
```
apps/agent/src/components/AgentBulkActions.tsx
```

**Step 5: Integrate into agent list page**
```
apps/agent/src/app/agents/page.tsx (add <AgentBulkActions />)
```

**Step 6: Write tests**
```
tests/unit/agents/csv-import-export.test.ts
tests/integration/api/agents-bulk.test.ts
tests/e2e/agents-bulk-import-export.spec.ts
```

---

## 16. Quick Reference: CSV Format

### Minimal Valid CSV
```csv
name,instructions,modelProvider,modelName
"Assistant","You are helpful","openai","gpt-4o"
```

### Full CSV (All Columns)
```csv
name,description,instructions,instructionsTemplate,modelProvider,modelName,temperature,maxTokens,maxSteps,memoryEnabled,tools,subAgents,workflows,visibility,isActive
"Support Agent","Handles tickets","You help customers","Hello {{userName}}","openai","gpt-4o",0.7,2048,5,true,"web-search;gmail-send-email","","","ORGANIZATION",true
```

### With Multiline Instructions
```csv
name,instructions,modelProvider,modelName
"Agent","You are a helpful assistant.
You always respond politely.
You follow user instructions.","openai","gpt-4o"
```

### With Special Characters
```csv
name,instructions,modelProvider,modelName
"Agent with ""quotes""","Instructions with, commas","openai","gpt-4o"
```

---

## 17. API Response Examples

### Export Success
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agents-ws123-2026-03-11.csv"

name,description,instructions,modelProvider,modelName,temperature,tools
"Support Agent","Handles support","You help users","openai","gpt-4o",0.7,"web-search"
...
```

### Import Success (Partial)
```json
{
  "success": true,
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
      "agentId": "clx...",
      "agentSlug": "support-agent",
      "agentName": "Support Agent"
    },
    {
      "row": 5,
      "status": "failed",
      "agentName": "Invalid Agent",
      "error": "Model 'gpt-5' not found for provider 'openai'",
      "suggestion": "Did you mean: gpt-4o?"
    },
    {
      "row": 8,
      "status": "skipped",
      "agentName": "Assistant",
      "reason": "Agent name already exists (mode=skip)"
    }
  ],
  "warnings": [
    "Row 3: Tool 'custom-tool' not found. It will be skipped.",
    "Row 7: Skill 'research' not found in workspace. It will be skipped."
  ]
}
```

### Import Validation Error
```json
{
  "success": false,
  "error": "Missing required columns: instructions, modelProvider"
}
```

---

## 18. Debugging Tips

### Enable Verbose Logging
```typescript
const DEBUG = process.env.DEBUG_AGENT_IMPORT === "true";

if (DEBUG) {
  console.log("[Agent Import] Processing row:", rowNumber, row);
  console.log("[Agent Import] Validation result:", validationResult);
}
```

### Test CSV Parsing Locally
```typescript
// scripts/test-csv-parse.ts
const csvContent = `name,instructions,modelProvider,modelName
"Test","Help","openai","gpt-4o"`;

const rows = parseCsv(csvContent);
console.log(JSON.stringify(rows, null, 2));
```

### Test with Curl
```bash
# Export
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3001/api/agents/export?workspaceId=ws-123" \
  -o agents.csv

# Import
curl -H "Authorization: Bearer $API_KEY" \
  -F "file=@agents.csv" \
  -F "workspaceId=ws-123" \
  -F "mode=skip" \
  "http://localhost:3001/api/agents/import"
```

---

## 19. Timeline Estimate (Developer Days)

### Phase 1 MVP Breakdown
| Task | Estimate | Dependencies |
|------|----------|--------------|
| CSV utilities (parser, generator) | 0.5 days | None |
| Import validator logic | 1 day | CSV utilities |
| Export API endpoint | 0.5 days | CSV generator |
| Import API endpoint | 1 day | Parser, validator |
| Template endpoint | 0.25 days | None |
| UI component | 0.75 days | APIs |
| Unit tests | 0.5 days | All utilities |
| Integration tests | 0.5 days | APIs |
| E2E tests | 0.25 days | Full stack |
| Code review fixes | 0.25 days | Tests passing |
| **Total** | **5 days** | |

---

## 20. Success Metrics (Implementation KPIs)

### Code Quality
- ✅ TypeScript strict mode compliance
- ✅ Zero ESLint errors
- ✅ Test coverage >80%
- ✅ All tests passing

### Performance
- ✅ Export 100 agents: <2s (p95)
- ✅ Import 50 agents: <5s (p95)
- ✅ CSV generation: <500ms per 100 agents
- ✅ CSV parsing: <100ms per 100 rows

### Reliability
- ✅ Zero data corruption bugs
- ✅ Zero security vulnerabilities
- ✅ Error rate <5% (user errors, not system errors)
- ✅ Authorization correctly enforced (no test failures)

---

**Implementation Guide Version:** 1.0  
**Last Updated:** 2026-03-11  
**Status:** Ready for Development
