# One-Pager: Bulk Agent Import/Export via CSV

**GitHub Issue:** [#101](https://github.com/Appello-Prototypes/agentc2/issues/101) | **Date:** 2026-03-11  
**Priority:** Medium | **Scope:** High | **Status:** ✅ Design Complete - Awaiting Approval

---

## Problem

Users managing 50+ agents cannot efficiently backup, migrate, or bulk-create agent configurations. They must create/update agents one-by-one through the UI or API, which is time-consuming and error-prone.

---

## Solution

Add CSV-based bulk import/export with three core capabilities:

1. **Export all agents** in a workspace to CSV
2. **Import agents** from CSV with validation
3. **Validation report** showing success/failure per row

---

## User Workflow

### Export
1. Navigate to `/agents` page
2. Click "Export to CSV" button
3. Download `agents-{workspace}-{date}.csv`

### Import
1. Click "Import from CSV" button
2. Select CSV file, choose conflict mode (skip/overwrite)
3. View validation report with per-row status

---

## Key Features

### Export
- ✅ All core agent fields (name, instructions, model, tools)
- ✅ RFC 4180 compliant CSV (Excel compatible)
- ✅ Optional: Include tools, skills, archived agents
- ✅ Authorization: Only exports agents user can access

### Import
- ✅ Create new agents from CSV rows
- ✅ Three conflict modes: skip, overwrite (with versioning), version
- ✅ Per-row validation with detailed errors/suggestions
- ✅ Tool & model validation
- ✅ Automatic slug generation (handles collisions)
- ✅ Dry run mode (validate without committing)

### Validation Report
- ✅ Summary: X created, Y updated, Z skipped, W failed
- ✅ Per-row status with error messages
- ✅ Suggestions for fixing errors (e.g., "Did you mean: gpt-4o?")
- ✅ Warnings for non-critical issues (missing tools)

---

## Technical Approach

**Architecture:** New API endpoints + CSV utilities + UI component  
**Database Changes:** None (uses existing Agent, AgentTool tables)  
**Authorization:** Reuses existing RBAC system  
**Performance:** Export <2s, Import <5s for typical workloads  

---

## CSV Format Example

```csv
name,description,instructions,modelProvider,modelName,temperature,tools
"Support Agent","Handles tickets","You help customers","openai","gpt-4o",0.7,"web-search;gmail-send-email"
"Research Agent","Finds info","You research topics","anthropic","claude-sonnet-4-5-20250929",0.8,"exa-research"
```

---

## Implementation Phases

### Phase 1: MVP (5 days)
**Scope:** Core export/import with basic fields

**Deliverables:**
- Export API with core fields
- Import API with create-only (skip conflicts)
- CSV template download
- UI buttons + import dialog
- Validation framework

**User Value:** Bulk create 50+ agents, backup configurations

---

### Phase 2: Advanced (5 days)
**Scope:** Skills, JSON fields, overwrite modes

**Deliverables:**
- Skill import/export
- Complex JSON fields (modelConfig, routingConfig)
- Overwrite mode with version history
- Batch optimizations

**User Value:** Full agent configuration portability, safe updates

---

### Phase 3: Enterprise (8 days)
**Scope:** Background jobs, history, advanced UI

**Deliverables:**
- Background import for 1000+ agents
- Import history tracking
- Scheduled exports (recurring backups)
- Import preview UI

**User Value:** Large-scale operations, audit trail

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSV injection attacks | High | Sanitize formulas, user education |
| Large file DoS | Medium | 10MB limit, 1000 row limit, rate limiting |
| Tool/skill references break on import | Medium | Validation warnings, skip missing references |
| Transaction timeouts | Low | Per-agent transactions, chunking |

---

## Success Metrics (30 days post-launch)

- 10% of users with 20+ agents use export
- 5% of users with 20+ agents use import
- >95% of import rows succeed
- <5 support tickets related to feature
- Zero security incidents

---

## Backward Compatibility

✅ **Fully backward compatible**
- No breaking changes to existing APIs
- No database migrations (Phase 1-2)
- Feature is additive (existing agent operations unaffected)

---

## Approval Checklist

**Technical:**
- [x] Design reviewed by engineering
- [x] Security reviewed (CSV injection, authorization)
- [x] Performance estimates validated
- [x] Database impact assessed (none)
- [x] Testing strategy defined

**Product:**
- [ ] User workflow approved
- [ ] CSV format approved
- [ ] Phasing approach approved
- [ ] Success metrics agreed

**Business:**
- [ ] Effort estimate accepted (5 days MVP)
- [ ] Priority confirmed (medium)
- [ ] Resource allocation approved

---

## Decision Required

**Approve Phase 1 implementation?**
- Yes → Proceed with 5-day MVP development
- No → Clarify concerns, iterate on design
- Defer → Re-prioritize based on other initiatives

---

## Next Steps (If Approved)

1. Create GitHub issue for Phase 1 with task breakdown
2. Assign developer and set sprint target
3. Create feature branch: `feature/bulk-agent-csv-import-export`
4. Begin implementation with export API (lowest risk)
5. Daily standups to track progress
6. Code review after tests passing
7. Deploy to staging for QA testing
8. Deploy to production with feature flag
9. Monitor metrics for 2 weeks
10. Plan Phase 2 based on feedback

---

**Design Documents:**
- 📄 [Full Technical Design](./bulk-agent-import-export-design.md) - 23 sections, comprehensive analysis
- 📄 [Executive Summary](./bulk-agent-import-export-summary.md) - High-level overview
- 📄 [Implementation Guide](./bulk-agent-import-export-implementation-guide.md) - Code patterns and examples

**Contact:** Development team for questions or concerns

---

**Estimated Effort:** 5 days (Phase 1) | 10 days (Phase 1+2) | 18 days (All phases)  
**Risk Level:** Low (additive feature, no schema changes, reuses existing patterns)  
**User Impact:** High (unlocks bulk operations for power users)  
**ROI:** High (reduces manual effort by 90% for bulk operations)
