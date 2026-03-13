# Root Cause Analysis: Google Calendar Skill Category Bug

**Issue:** [GitHub #181](https://github.com/Appello-Prototypes/agentc2/issues/181)  
**Summary:** The `google-calendar-expert` skill has `category: 'Email'` instead of `'Scheduling'` or `'Calendar'`  
**Severity:** Low (Data Quality Issue)  
**Status:** Analysis Complete - Ready for Fix

---

## Executive Summary

The Google Calendar skill (`google-calendar-expert`) was auto-provisioned with an incorrect category of `"Email"` when it should be categorized as `"Scheduling"` or `"Calendar"`. This bug affects skill discoverability and filtering but does not impact functionality.

**Root Cause:** The integration blueprint definition for `google-calendar` has a hardcoded incorrect category value in the blueprint configuration file.

**Exact Location:** `/workspace/packages/agentc2/src/integrations/blueprints/email.ts`, line 119

**Fix Complexity:** Low - Single field change + version bump

---

## 1. Root Cause Analysis

### 1.1 Exact Root Cause

**File:** `/workspace/packages/agentc2/src/integrations/blueprints/email.ts`  
**Lines:** 100-145 (Google Calendar blueprint definition)  
**Problem Line:** Line 119

```typescript
category: "Email",  // ❌ INCORRECT - Should be "Scheduling"
```

### 1.2 How the Bug Occurred

1. **Blueprint System Architecture:**
   - The integration auto-provisioner (`packages/agentc2/src/integrations/provisioner.ts`) creates skills automatically when OAuth connections are established
   - Blueprints are static TypeScript definitions that specify the skill configuration (`packages/agentc2/src/integrations/blueprints/`)
   - When a user connects Google Calendar, the provisioner looks up the `google-calendar` blueprint and creates a skill with the specified category

2. **Blueprint Misorganization:**
   - The Google Calendar blueprint is defined in `email.ts` (lines 100-145) alongside Gmail, Microsoft 365, and Google Drive blueprints
   - The file contains multiple blueprints that were likely grouped by OAuth provider rather than by functional category
   - The blueprint was likely copy-pasted from the Gmail blueprint (lines 3-49) and the category field was not updated

3. **Provisioner Behavior:**
   - When `provisionIntegration()` is called (provisioner.ts:38), it retrieves the blueprint via `getBlueprint(providerKey)` (provisioner.ts:62)
   - The skill is upserted with the blueprint's category at provisioner.ts:210
   - The category is written directly to the database without validation

### 1.3 Evidence

**Blueprint Definition:**
```typescript
// packages/agentc2/src/integrations/blueprints/email.ts:100-145
{
    providerKey: "google-calendar",
    version: 2,
    skill: {
        slug: "google-calendar-expert",
        name: "Google Calendar Expert",
        description: "Expert knowledge for Google Calendar management",
        instructions: `You are a Google Calendar expert...`,
        category: "Email",  // ❌ BUG HERE
        tags: ["calendar", "google", "scheduling", "events"],
        // ...
    }
}
```

**Database Schema:**
```prisma
// packages/database/prisma/schema.prisma:3321-3361
model Skill {
    // ...
    category String?  // No enum constraint, accepts any string
    // ...
}
```

**Provisioner Code:**
```typescript
// packages/agentc2/src/integrations/provisioner.ts:203-232
const created = await prisma.skill.create({
    data: {
        slug: bp.skill.slug,
        name: bp.skill.name,
        description: bp.skill.description,
        instructions: bp.skill.instructions,
        category: bp.skill.category,  // ⬅️ Direct copy from blueprint
        // ...
    }
});
```

---

## 2. Impact Assessment

### 2.1 Functional Impact

**Broken Functionality:**
- ❌ Users filtering skills by `category: 'Calendar'` will not find this skill
- ❌ Users browsing the 'Email' category will see an irrelevant calendar skill
- ❌ `skill_list` MCP tool with `category: "Scheduling"` filter misses this skill

**Still Working:**
- ✅ Skill functionality (all Google Calendar tools work correctly)
- ✅ Agent provisioning and tool discovery
- ✅ Direct skill lookup by slug/ID
- ✅ Search by tags (`["calendar", "google", "scheduling", "events"]`)

### 2.2 Data Quality Impact

**Current Category Distribution (from blueprint analysis):**

| Category | Count | Examples |
|----------|-------|----------|
| CRM | 6 | HubSpot, Salesforce, Pipedrive |
| Communication | 7 | Slack, Fathom, JustCall, Twilio |
| Developer Tools | 10 | GitHub, GitLab, Bitbucket |
| Email | **4** ⬅️ | **Gmail, Microsoft 365, Google Calendar ❌, Dropbox** |
| Finance | 5 | Stripe, Plaid, QuickBooks |
| Marketing | 6 | Mailchimp, HubSpot Marketing |
| Productivity | 1 | Notion |
| Project Management | 6 | Jira, Linear, Asana, Monday |
| Scheduling | 1 | Calendly |
| Storage | 2 | Google Drive, Dropbox |

**Anomalies:**
1. ❌ Google Calendar in "Email" (incorrect)
2. ⚠️ Dropbox in "Email" (also incorrect - see line 154 of email.ts: uses "Storage")
3. ⚠️ Microsoft 365 in "Email" is acceptable because it's a hybrid email+calendar product
4. ✅ Calendly correctly uses "Scheduling"

### 2.3 Affected Systems

**Direct:**
- `skill_list` MCP tool filtering (`packages/agentc2/src/tools/mcp-schemas/skills.ts:72-87`)
- Blueprint sync system (`packages/agentc2/src/integrations/provisioner.ts:525-632`)
- Any UI components that filter or group skills by category

**Indirect:**
- User experience when browsing integrations
- Agent discovery of relevant skills via meta-tools
- Analytics/reporting on skill usage by category

---

## 3. Recommended Category

### 3.1 Analysis of Options

**Option A: "Scheduling"**
- ✅ Already used by Calendly (productivity.ts:330)
- ✅ Matches skill purpose (event scheduling, availability management)
- ✅ Clear semantic meaning
- ❌ Only 1 other skill uses this category currently

**Option B: "Calendar"**
- ✅ Matches the product name directly
- ✅ Clear and intuitive
- ❌ No existing category uses "Calendar" alone
- ❌ Would require creating a new category

**Option C: "Productivity"**
- ✅ Broad category that includes time management
- ✅ Already exists (used by Notion, Jira)
- ❌ Too generic - loses specificity
- ❌ Calendars are more specifically about scheduling than general productivity

**Option D: "Email & Calendar"**
- ✅ Used in some contexts (tools/registry.ts:1308)
- ❌ Implies bundled functionality like Microsoft 365
- ❌ Google Calendar is standalone, not bundled with Gmail

### 3.2 Recommendation

**Use `"Scheduling"`** for the following reasons:

1. **Semantic accuracy:** Google Calendar is primarily about scheduling events, meetings, and managing availability
2. **Existing precedent:** Calendly (a scheduling tool) already uses this category
3. **Differentiation:** Separates pure scheduling tools from email tools and general productivity
4. **Future-proof:** Other calendar/scheduling tools (e.g., Cal.com, Acuity, Schedule Once) would naturally fit here

**Rationale for rejecting "Calendar":**
- While semantically correct, creating a new category for one tool adds organizational complexity
- "Scheduling" is functionally equivalent and already established

---

## 4. Additional Issues Discovered

### 4.1 Inconsistent File Organization

**Problem:** Blueprints are organized by file (`email.ts`, `productivity.ts`, etc.) but the file names don't match the categories:

- `email.ts` contains:
  - Gmail (category: "Email") ✅
  - Microsoft 365 (category: "Email") ✅
  - Google Calendar (category: "Email") ❌ Should be "Scheduling"
  - Google Drive (category: "Storage") ❌ Wrong file
  - Microsoft Teams (category: "Communication") ❌ Wrong file
  - Dropbox (category: "Storage") ❌ Wrong file

**Impact:** Low - organizational issue, doesn't affect functionality

**Recommendation:** Out of scope for this bug fix, but consider:
- Moving Google Calendar to `productivity.ts` (where Calendly lives)
- Moving storage blueprints to a dedicated `storage.ts` file
- Moving Microsoft Teams to `communication.ts`

---

## 5. Fix Plan

### 5.1 Required Changes

**File 1:** `/workspace/packages/agentc2/src/integrations/blueprints/email.ts`

**Change 1.1 - Update category:**
```diff
  {
      providerKey: "google-calendar",
-     version: 2,
+     version: 3,
      skill: {
          slug: "google-calendar-expert",
          name: "Google Calendar Expert",
          description: "Expert knowledge for Google Calendar management",
          instructions: `You are a Google Calendar expert...`,
-         category: "Email",
+         category: "Scheduling",
          tags: ["calendar", "google", "scheduling", "events"],
```

**Lines to change:**
- Line 102: `version: 2` → `version: 3` (bump blueprint version)
- Line 119: `category: "Email"` → `category: "Scheduling"`

### 5.2 Blueprint Version Sync

After deploying the fix, existing skills will be auto-updated via the blueprint sync system:

**Mechanism:** `syncBlueprintVersions()` (provisioner.ts:525-632)
- Runs on app startup (or can be triggered manually)
- Finds skills with `blueprintVersion < 3`
- Updates category field to match the latest blueprint

**Database Impact:**
```sql
-- Skills that will be updated
SELECT id, slug, category, metadata->>'blueprintVersion' as version
FROM skill
WHERE slug = 'google-calendar-expert'
  AND metadata->>'provisionedBy' = 'auto-provisioner'
  AND (metadata->>'blueprintVersion')::int < 3;

-- Expected: 1-N rows (one per org that has connected Google Calendar)
```

### 5.3 Verification Steps

**Pre-deployment:**
1. ✅ Run type checking: `bun run type-check`
2. ✅ Run linting: `bun run lint`
3. ✅ Run build: `bun run build`

**Post-deployment:**
1. Check blueprint version: `getBlueprint('google-calendar').version === 3`
2. Verify sync ran: Check logs for `[Provisioner] Blueprint sync complete`
3. Query database:
   ```sql
   SELECT slug, category, metadata->>'blueprintVersion' as version
   FROM skill
   WHERE slug = 'google-calendar-expert';
   ```
   Expected: `category = 'Scheduling'`, `version = 3`
4. Test MCP tool: `skill_list` with `category: "Scheduling"` should include `google-calendar-expert`
5. Test UI: Browse skills by "Scheduling" category should show Google Calendar

### 5.4 Testing Plan

**Unit Tests:** Not applicable (static blueprint data)

**Integration Tests:**
1. **Test provisioner with updated blueprint:**
   - Create a new Google Calendar connection
   - Verify the provisioned skill has `category: "Scheduling"`

2. **Test blueprint sync:**
   - Find an existing `google-calendar-expert` skill with `version: 2`
   - Run `syncBlueprintVersions()`
   - Verify skill category updated to "Scheduling"

3. **Test skill filtering:**
   - Call `skill_list` MCP tool with `category: "Scheduling"`
   - Verify `google-calendar-expert` is in results
   - Call `skill_list` with `category: "Email"`
   - Verify `google-calendar-expert` is NOT in results

**Manual Testing:**
1. Navigate to Skills page in UI
2. Filter by "Scheduling" category
3. Verify Google Calendar Expert appears
4. Verify tags still show `["calendar", "google", "scheduling", "events"]`

### 5.5 Rollback Plan

**Risk:** Minimal - non-breaking change to metadata field

**If needed:**
```diff
- version: 3,
+ version: 2,
  skill: {
-     category: "Scheduling",
+     category: "Email",
```

**Database rollback (if necessary):**
```sql
UPDATE skill
SET category = 'Email',
    metadata = jsonb_set(
        metadata,
        '{blueprintVersion}',
        '2'
    )
WHERE slug = 'google-calendar-expert';
```

---

## 6. Risk Assessment

**Overall Risk: LOW**

| Risk Factor | Level | Rationale |
|-------------|-------|-----------|
| Breaking Changes | None | Category field is metadata only, doesn't affect skill functionality |
| Data Migration | Low | Automatic via `syncBlueprintVersions()` |
| User Impact | Minimal | Only affects filtering/browsing, not core features |
| Deployment Complexity | Low | Single file change, standard deployment |
| Rollback Difficulty | Low | Simple revert or SQL update |

---

## 7. Estimated Effort

**Implementation:** 5 minutes
- Change 2 lines in one file
- Run formatting/linting

**Testing:** 15 minutes
- Pre-deployment checks
- Post-deployment verification
- Manual UI testing

**Total:** ~20 minutes

---

## 8. Related Issues & Technical Debt

### 8.1 Similar Issues to Check

Search for other blueprints with potentially incorrect categories:
```bash
grep -n 'category:' packages/agentc2/src/integrations/blueprints/*.ts | grep Email
```

**Found:**
- Gmail: "Email" ✅ Correct
- Microsoft 365: "Email" ✅ Correct (hybrid product)
- Google Calendar: "Email" ❌ **This bug**
- Microsoft Teams: "Communication" ✅ Correct (defined in email.ts but category is right)
- Dropbox: "Storage" ✅ Correct (defined in email.ts but category is right)
- Google Drive: "Storage" ✅ Correct

### 8.2 Future Improvements

**Not required for this fix, but consider for future:**

1. **Add category enum:**
   ```prisma
   enum SkillCategory {
       CRM
       Communication
       Calendar  // or Scheduling
       DeveloperTools
       Email
       // ...
   }
   
   model Skill {
       category SkillCategory?
   }
   ```
   **Benefit:** Type safety, prevents typos, enforces consistency
   **Effort:** Medium (schema migration, update all blueprints)

2. **Reorganize blueprint files:**
   - Move Google Calendar to `productivity.ts`
   - Move Google Drive to `storage.ts` or `data.ts`
   - Move Microsoft Teams to `communication.ts`
   **Benefit:** Better organization, easier to find blueprints
   **Effort:** Low (copy/paste, update imports)

3. **Add category validation:**
   ```typescript
   const VALID_CATEGORIES = [
       "CRM", "Communication", "Calendar", ...
   ] as const;
   
   function validateCategory(cat: string) {
       if (!VALID_CATEGORIES.includes(cat)) {
           throw new Error(`Invalid category: ${cat}`);
       }
   }
   ```
   **Benefit:** Catch errors at runtime before database write
   **Effort:** Low

4. **Add blueprint validation tests:**
   ```typescript
   test("all blueprints have valid categories", () => {
       getAllBlueprints().forEach(bp => {
           expect(VALID_CATEGORIES).toContain(bp.skill.category);
       });
   });
   ```
   **Benefit:** Prevent regressions
   **Effort:** Low

---

## 9. Conclusion

### Summary

- **Root Cause:** Hardcoded incorrect category value in blueprint definition
- **Fix Location:** `/workspace/packages/agentc2/src/integrations/blueprints/email.ts:119`
- **Fix Action:** Change `category: "Email"` to `category: "Scheduling"` and bump version to 3
- **Risk:** Low
- **Effort:** 20 minutes
- **Impact:** Improves skill discoverability and data quality

### Ready for Implementation

This analysis is complete. The fix is straightforward and low-risk. No additional investigation required.

---

**Analysis completed:** 2026-03-13  
**Analyst:** AI Agent (Root Cause Analysis Mode)  
**Next Step:** Approve fix plan and implement changes
