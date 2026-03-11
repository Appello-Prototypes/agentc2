# Executive Summary: Bulk Agent Import/Export via CSV

**Feature:** Bulk agent configuration import/export via CSV  
**GitHub Issue:** [#101](https://github.com/Appello-Prototypes/agentc2/issues/101)  
**Target Users:** Organizations managing 50+ agents  
**Priority:** Medium | **Scope:** High  

---

## Problem Statement

Users managing large agent fleets (50+ agents) need efficient ways to:
- **Backup** agent configurations for disaster recovery
- **Migrate** agents between workspaces or environments
- **Bulk create** agents from spreadsheets or external systems
- **Audit** agent configurations in spreadsheet format
- **Share** agent templates with team members

Currently, users must use the UI or API to create/update agents one at a time, which is time-consuming and error-prone for bulk operations.

---

## Proposed Solution

Add CSV-based bulk import/export functionality with three key features:

### 1. Export Agents to CSV
- **Endpoint:** `GET /api/agents/export`
- **Output:** CSV file with columns for slug, name, description, instructions, modelProvider, modelName, temperature, tools, etc.
- **Features:** Workspace filtering, optional tool/skill inclusion, archived agent inclusion
- **Format:** RFC 4180 compliant CSV with UTF-8 encoding

### 2. Import Agents from CSV
- **Endpoint:** `POST /api/agents/import`
- **Input:** CSV file via multipart/form-data
- **Features:** 
  - Three conflict resolution modes: skip, overwrite (with versioning), version
  - Dry run mode for validation without committing
  - Per-row validation with detailed error reporting
  - Automatic slug generation with collision handling
  - Tool and skill validation with warnings

### 3. Validation Report
- **Structured feedback** showing which rows succeeded/failed
- **Error details** with suggestions for fixing issues
- **Warnings** for non-critical issues (e.g., missing tools)
- **Summary statistics** (created/updated/skipped/failed counts)

---

## Technical Approach

### Architecture
- **API Layer:** New routes under `/api/agents/export` and `/api/agents/import`
- **Validation:** Reuse existing model/tool validation from agent CRUD APIs
- **CSV Handling:** Leverage patterns from test-case export, with proper escaping
- **Authorization:** Standard RBAC checks (read for export, create/update for import)
- **Multi-Tenancy:** All agents scoped to authenticated user's workspace

### Key Design Decisions

1. **CSV over JSON/Excel**
   - More universal and accessible
   - Works in any spreadsheet application
   - Easy to script/automate
   - Can add JSONL format in Phase 2

2. **Per-row error handling**
   - Continue on row-level errors (don't fail entire import)
   - Return detailed status for each row
   - User can fix errors and re-import

3. **No schema changes required**
   - Leverages existing Agent, AgentTool, AgentSkill tables
   - All validation reuses existing services
   - Additive feature (zero migration risk)

4. **Slug auto-generation**
   - Generate slugs from names to avoid conflicts
   - Append numeric suffix for duplicates ("assistant-2")
   - Report final slug in validation report

5. **Tool/skill validation**
   - Validate against tool registry and MCP tools
   - Warn on unavailable tools (missing credentials)
   - Skip missing skills with warnings

---

## Implementation Phases

### Phase 1: Core Export/Import (MVP) - 4-5 days
**Scope:** Basic CSV export/import with core fields only

**Deliverables:**
- Export API with core agent fields (name, instructions, model, tools)
- Import API with create-only mode (skip conflicts)
- CSV parsing/generation utilities
- Validation framework with structured error reporting
- UI component for export/import buttons
- CSV template download endpoint

**MVP Columns:**
- name, description, instructions, instructionsTemplate
- modelProvider, modelName, temperature, maxTokens, maxSteps
- memoryEnabled, tools, subAgents, workflows, visibility, isActive

**Acceptance Criteria:**
- Export 100 agents in <2 seconds
- Import 50 agents with validation report in <5 seconds
- All validation errors include suggestions
- Authorization enforced on both endpoints

---

### Phase 2: Advanced Features - 4-5 days
**Scope:** Skills, complex JSON fields, overwrite modes

**Deliverables:**
- Skill import/export with pinning syntax
- JSON-serialized columns for modelConfig, routingConfig, etc.
- Overwrite mode with version history creation
- Version mode for incremental updates
- Batch optimizations (cached validation, chunked transactions)
- Export filtering (by type, visibility, specific agent IDs)

**Advanced Columns:**
- skills (with pinning), modelConfig_json, routingConfig_json
- memoryConfig_json, metadata_json

**Acceptance Criteria:**
- Import agents with skills and complex config
- Overwrite mode creates version snapshots
- Large imports (200+ agents) complete without timeout
- Export filtering works correctly

---

### Phase 3: Enterprise Features - 6-8 days
**Scope:** Background jobs, history tracking, advanced UI

**Deliverables:**
- Background import processing via Inngest
- Import history tracking (new `AgentImportJob` table)
- Import preview UI (show parsed data before committing)
- Scheduled exports (recurring backups)
- Export presets (saved configurations)
- Streaming import progress (WebSocket/SSE)

**Acceptance Criteria:**
- Import 1000+ agents via background job
- View import history with downloadable reports
- Schedule weekly agent exports to S3
- Real-time progress updates for imports

---

## Impact Assessment

### Affected Systems
| System | Impact | Changes |
|--------|--------|---------|
| **Agent API** | Medium | New export/import routes |
| **UI (Agent List)** | Medium | New bulk actions component |
| **Authorization** | Low | Reuse existing helpers |
| **Tool Registry** | Low | Add validation helpers |
| **Database** | None | No schema changes (Phase 1-2) |
| **Activity Feed** | Low | Record bulk operations |

### Risks & Mitigation
| Risk | Mitigation |
|------|------------|
| CSV injection attacks | Sanitize formulas, user education |
| Large file DoS | 10MB file limit, 1000 row limit |
| Tool/skill references break | Validation warnings, skip missing |
| Model validation API rate limits | Cache results per unique model |
| Transaction timeouts | Per-agent transactions, chunking |

### Backward Compatibility
✅ **Fully backward compatible**
- No breaking changes to existing APIs
- No database migrations required (Phase 1-2)
- Existing agent operations unaffected
- New endpoints are additive

---

## Dependencies & Prerequisites

### Technical Dependencies
- CSV parsing: `papaparse` library or custom parser
- Existing systems: Agent CRUD APIs, model registry, tool registry
- Authorization: Reuse `requireAuth`, `requireEntityAccess`, `requireAgentAccess`
- No new database tables (Phase 1-2)

### External Dependencies
- None (self-contained feature)

### Environment Requirements
- No new environment variables
- No new API keys
- Works with existing authentication

---

## Success Criteria (Phase 1 MVP)

**Must Have:**
- ✅ Export all agents in a workspace to CSV
- ✅ Import agents from CSV with validation
- ✅ Skip existing agents (conflict resolution)
- ✅ Validation report showing success/failure per row
- ✅ Authorization enforced on both operations
- ✅ Rate limiting applied
- ✅ CSV template download available

**Should Have:**
- ✅ Tool validation with warnings
- ✅ Slug auto-generation with collision handling
- ✅ Dry run mode for import
- ✅ UI component for export/import

**Could Have (Phase 2+):**
- Skill import/export
- Overwrite mode with versioning
- JSON field serialization
- Background job processing

**Won't Have (Phase 1):**
- Excel format support
- Import from URL
- Scheduled exports
- Import preview UI

---

## Code Review Checklist (For Implementation)

Before merging implementation:
- [ ] All TypeScript errors resolved (`bun run type-check`)
- [ ] All linting errors fixed (`bun run lint`)
- [ ] Code formatted (`bun run format`)
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests cover happy path and error cases
- [ ] E2E test for full user workflow
- [ ] Authorization checks verified (no data leakage)
- [ ] Rate limiting tested (returns 429 on breach)
- [ ] CSV injection mitigation verified
- [ ] Error messages are user-friendly (no stack traces)
- [ ] Activity feed entries created
- [ ] Documentation updated (API docs, user guide)
- [ ] Performance benchmarks met (export <2s, import <5s)

---

## Estimated Timeline

**Phase 1 (MVP):**
- Design Review: 0.5 days
- Implementation: 3.5 days
- Testing: 1 day
- Code Review & Fixes: 0.5 days
- **Total:** ~5 days

**Phase 2 (Advanced):**
- Implementation: 3.5 days
- Testing: 1 day
- Code Review: 0.5 days
- **Total:** ~5 days

**Phase 3 (Enterprise):**
- Implementation: 5 days
- Testing: 2 days
- Code Review: 1 day
- **Total:** ~8 days

**Grand Total:** 18 days (3.5 sprints assuming 5-day sprints)

---

## Open Questions for Review

1. **JSON fields in CSV:** Should Phase 1 include modelConfig_json columns, or defer to Phase 2?
   - **Recommendation:** Defer to Phase 2 (keeps MVP simpler)

2. **Background jobs:** At what row count should we switch to background processing?
   - **Recommendation:** 1000+ rows → Inngest job (Phase 3)

3. **Skill handling:** What if skill doesn't exist in target workspace?
   - **Recommendation:** Skip with warning (Phase 2)

4. **Conflict resolution default:** Skip or overwrite?
   - **Recommendation:** Skip (safer default)

5. **Export format:** CSV only, or also offer JSONL?
   - **Recommendation:** CSV only for Phase 1

---

**Design Status:** ✅ Ready for Review  
**Next Step:** Engineering review and approval  
**Document Owner:** AI Agent Team  
**Stakeholders:** Product, Engineering, DevOps
