# Implementation Guide: Complete Fix for Checkout 500 Error

**Issue**: #83  
**Analysis Documents**: 
- `BUG-ANALYSIS-CHECKOUT-500.md` (detailed analysis)
- `BUG-ANALYSIS-SUMMARY.md` (executive summary)
- `HOTFIX-PATCH.md` (emergency fix)

---

## Phase 1: Emergency Hotfix ⚡

### File 1: `packages/agentc2/src/playbooks/deployer.ts`

#### Change 1.1: Add null check for entryPoint access

**Location**: Line 552-555  
**Type**: Defensive null check  
**Risk**: Low

```diff
         const entryAgentSlug =
-            manifest.entryPoint.type === "agent"
+            manifest.entryPoint?.type === "agent"
                 ? (agentSlugMap.get(manifest.entryPoint.slug) ?? manifest.entryPoint.slug)
                 : undefined;
```

**Testing**: 
```bash
bun test tests/integration/playbooks/deployment.test.ts
```

---

## Phase 2: Validation Enforcement 🛡️

### File 2: `packages/agentc2/src/playbooks/packager.ts`

#### Change 2.1: Validate previousManifest in boot-only mode

**Location**: Lines 649-677  
**Type**: Add validation before spreading  
**Risk**: Medium (changes repackaging behavior)

```diff
+ import { validateManifest } from "./manifest";

  export async function repackagePlaybook(opts: RepackagePlaybookOptions) {
      const mode = opts.mode ?? "full";
      
      const latestVersion = await prisma.playbookVersion.findFirst({
          where: { playbookId: opts.playbookId },
          orderBy: { version: "desc" }
      });
      const previousManifest = latestVersion?.manifest
          ? (latestVersion.manifest as unknown as PlaybookManifest)
          : null;
      
      let manifest: PlaybookManifest;
      let warnings: string[] = [];
      let requiredIntegrations: string[] = [];
      let processedAgentIds = new Set<string>();
      let processedSkillIds = new Set<string>();
      
      if (mode === "boot-only" && previousManifest) {
+         // Validate previous manifest before using it
+         try {
+             validateManifest(previousManifest);
+         } catch (validationError) {
+             throw new Error(
+                 `Cannot perform boot-only repackage: previous manifest is invalid. ` +
+                 `Use mode="full" to rebuild the manifest. ` +
+                 `Error: ${validationError instanceof Error ? validationError.message : "Unknown"}`
+             );
+         }
+ 
          // Keep components from previous version, only update bootConfig + setupConfig
          const playbook = await prisma.playbook.findUnique({
              where: { id: opts.playbookId },
              select: { bootDocument: true, autoBootEnabled: true, setupConfig: true }
          });
          // ... rest of boot-only logic
      }
```

#### Change 2.2: Validate in components-only mode

**Location**: Lines 677-688  
**Type**: Add validation  
**Risk**: Low

```diff
      } else if (mode === "components-only" && previousManifest) {
+         // Validate previous manifest bootConfig/setupConfig before preserving them
+         try {
+             validateManifest(previousManifest);
+         } catch (validationError) {
+             console.warn(
+                 `[repackagePlaybook] Previous manifest invalid, falling back to full rebuild:`,
+                 validationError
+             );
+             // Fall through to full rebuild
+             const result = await buildManifest({ ...opts, playbookId: opts.playbookId });
+             manifest = result.manifest;
+             warnings = result.warnings;
+             requiredIntegrations = result.requiredIntegrations;
+             processedAgentIds = result.processedAgentIds;
+             processedSkillIds = result.processedSkillIds;
+             return; // Skip the normal components-only path
+         }
+ 
          // Re-snapshot components but preserve bootConfig + setupConfig
          const result = await buildManifest({ ...opts, playbookId: opts.playbookId });
          manifest = {
              ...result.manifest,
              bootConfig: previousManifest.bootConfig,
              setupConfig: previousManifest.setupConfig
          };
```

---

### File 3: `apps/agent/src/app/api/playbooks/[slug]/versions/[versionNumber]/revert/route.ts`

#### Change 3.1: Validate manifest before revert

**Location**: Lines 27-48  
**Type**: Add validation check  
**Risk**: Low

```diff
+ import { validateManifest } from "@repo/agentc2";

  export async function POST(request: NextRequest, { params }: Params) {
      try {
          // ... auth and lookup code ...
          
          const sourceVersion = await prisma.playbookVersion.findFirst({
              where: { playbookId: playbook.id, version: targetVersion }
          });
          if (!sourceVersion) {
              return NextResponse.json({ error: "Version not found" }, { status: 404 });
          }
+ 
+         // Validate that the source version has a valid manifest
+         try {
+             validateManifest(sourceVersion.manifest);
+         } catch (validationError) {
+             return NextResponse.json(
+                 { 
+                     error: `Cannot revert to version ${targetVersion}: manifest is invalid or incompatible with current schema. ` +
+                            `Error: ${validationError instanceof Error ? validationError.message : "Unknown"}`
+                 },
+                 { status: 400 }
+             );
+         }
          
          const latestVersion = await prisma.playbookVersion.findFirst({
              where: { playbookId: playbook.id },
              orderBy: { version: "desc" }
          });
          const nextVersion = (latestVersion?.version ?? 0) + 1;
          
          await prisma.$transaction(async (tx) => {
              await tx.playbookVersion.create({
                  data: {
                      playbookId: playbook.id,
                      version: nextVersion,
                      manifest: sourceVersion.manifest as Record<string, unknown>,
                      changelog: `Reverted to v${targetVersion}`,
                      createdBy: authResult.context.userId
                  }
              });
```

---

### File 4: `packages/agentc2/src/playbooks/deployer.ts`

#### Change 4.1: Add defense-in-depth validation

**Location**: Lines 73-74  
**Type**: Explicit validation after schema parse  
**Risk**: Low

```diff
      const manifest = validateManifest(version.manifest);
+ 
+     // Defense-in-depth: explicit null check even after validation
+     if (!manifest.entryPoint) {
+         throw new Error(
+             `Playbook version ${opts.versionNumber} has no entry point defined. ` +
+             `The manifest may be corrupted. Please repackage the playbook using mode="full".`
+         );
+     }
      
      const installation = await prisma.playbookInstallation.create({
```

---

## Phase 3: Data Repair Script 🔧

### File 5: `scripts/repair-playbook-manifests.ts` (NEW)

**Purpose**: Scan and repair invalid manifests in production database

**Template**:

```typescript
#!/usr/bin/env bun
import { prisma } from "../packages/database/src/index";
import { validateManifest, isValidManifest } from "../packages/agentc2/src/playbooks/manifest";
import type { PlaybookManifest } from "../packages/agentc2/src/playbooks/types";

const dryRun = !process.argv.includes("--apply");

interface RepairResult {
    versionId: string;
    playbookSlug: string;
    version: number;
    action: "inferred" | "failed" | "skipped";
    inferredEntryPoint?: { type: string; slug: string };
    error?: string;
}

async function main() {
    console.log(`\n🔧 Playbook Manifest Repair ${dryRun ? "(DRY RUN)" : "(APPLYING)"}\n`);

    const versions = await prisma.playbookVersion.findMany({
        include: { playbook: { select: { slug: true, name: true } } }
    });

    const results: RepairResult[] = [];
    let repairedCount = 0;
    let failedCount = 0;

    for (const v of versions) {
        const manifest = v.manifest as any;

        // Skip if already valid
        if (isValidManifest(manifest)) {
            continue;
        }

        const result: RepairResult = {
            versionId: v.id,
            playbookSlug: v.playbook.slug,
            version: v.version,
            action: "failed"
        };

        // Attempt to infer entryPoint
        const agents = manifest.agents ?? [];
        const networks = manifest.networks ?? [];
        const workflows = manifest.workflows ?? [];

        let inferredEntryPoint: { type: string; slug: string } | null = null;

        if (agents.length === 1 && networks.length === 0 && workflows.length === 0) {
            inferredEntryPoint = { type: "agent", slug: agents[0].slug };
        } else if (networks.length === 1 && agents.length === 0 && workflows.length === 0) {
            inferredEntryPoint = { type: "network", slug: networks[0].slug };
        } else if (workflows.length === 1 && agents.length === 0 && networks.length === 0) {
            inferredEntryPoint = { type: "workflow", slug: workflows[0].slug };
        } else if (agents.length > 0) {
            // Multiple components - use first agent as default
            inferredEntryPoint = { type: "agent", slug: agents[0].slug };
        } else if (networks.length > 0) {
            inferredEntryPoint = { type: "network", slug: networks[0].slug };
        } else if (workflows.length > 0) {
            inferredEntryPoint = { type: "workflow", slug: workflows[0].slug };
        }

        if (inferredEntryPoint) {
            const repairedManifest = { ...manifest, entryPoint: inferredEntryPoint };

            // Validate repaired manifest
            try {
                validateManifest(repairedManifest);
                result.action = "inferred";
                result.inferredEntryPoint = inferredEntryPoint;

                if (!dryRun) {
                    await prisma.playbookVersion.update({
                        where: { id: v.id },
                        data: { manifest: repairedManifest as any }
                    });
                    repairedCount++;
                }
            } catch (error) {
                result.action = "failed";
                result.error = error instanceof Error ? error.message : "Validation failed";
                failedCount++;
            }
        } else {
            result.action = "failed";
            result.error = "Cannot infer entryPoint - no components found";
            failedCount++;
        }

        results.push(result);
    }

    // Report results
    console.log(`Total versions scanned: ${versions.length}`);
    console.log(`Valid manifests: ${versions.length - results.length}`);
    console.log(`Invalid manifests found: ${results.length}`);
    console.log(`Repaired: ${repairedCount}`);
    console.log(`Failed to repair: ${failedCount}\n`);

    if (results.length > 0) {
        console.log("Results:\n");
        for (const r of results) {
            const icon = r.action === "inferred" ? "✅" : "❌";
            console.log(`${icon} ${r.playbookSlug} v${r.version}`);
            if (r.inferredEntryPoint) {
                console.log(`   Inferred: ${r.inferredEntryPoint.type}/${r.inferredEntryPoint.slug}`);
            }
            if (r.error) {
                console.log(`   Error: ${r.error}`);
            }
        }
    }

    if (dryRun && results.length > 0) {
        console.log("\n📋 DRY RUN - No changes applied.");
        console.log("   Run with --apply to execute repairs.\n");
    } else if (!dryRun && repairedCount > 0) {
        console.log(`\n✅ Repaired ${repairedCount} manifests.\n`);
    }

    if (failedCount > 0) {
        console.log(`\n⚠️  ${failedCount} manifests could not be auto-repaired.`);
        console.log("   Manual review required.\n");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Repair failed:", err);
    process.exit(1);
});
```

**Usage**:
```bash
# Check what would be repaired
bun run scripts/repair-playbook-manifests.ts

# Actually apply repairs
bun run scripts/repair-playbook-manifests.ts --apply
```

---

## Phase 4: Testing 🧪

### File 6: `tests/unit/playbooks/deployer-edge-cases.test.ts` (NEW)

**Purpose**: Test deployer handles malformed manifests gracefully

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { deployPlaybook } from "../../../packages/agentc2/src/playbooks/deployer";
import { prismaMock } from "../../helpers/prisma-mock";

describe("Deployer Edge Cases", () => {
    beforeEach(() => {
        // Reset mocks
    });

    it("should handle manifest with undefined entryPoint", async () => {
        // Setup mock data
        const invalidManifest = {
            version: "1.0",
            agents: [{ slug: "test-agent", name: "Test" /* ... */ }],
            skills: [],
            documents: [],
            workflows: [],
            networks: [],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: [],
            entryPoint: undefined  // ❌ Invalid
        };

        prismaMock.playbook.findUniqueOrThrow.mockResolvedValue({
            id: "pb1",
            slug: "test-playbook"
            // ...
        });

        prismaMock.playbookVersion.findFirstOrThrow.mockResolvedValue({
            id: "v1",
            playbookId: "pb1",
            version: 1,
            manifest: invalidManifest as any
        });

        // After Phase 1 hotfix: should not crash, entryAgentSlug becomes undefined
        // After Phase 2: should throw clear validation error
        await expect(
            deployPlaybook({
                playbookId: "pb1",
                versionNumber: 1,
                targetOrgId: "org1",
                targetWorkspaceId: "ws1",
                userId: "user1"
            })
        ).rejects.toThrow(/entry point/i);
    });

    it("should handle manifest with null entryPoint", async () => {
        const invalidManifest = {
            // ... same as above
            entryPoint: null  // ❌ Invalid
        };

        // Similar test as above
    });

    it("should successfully deploy manifest with valid entryPoint", async () => {
        const validManifest = {
            version: "1.0",
            agents: [{ slug: "test-agent", name: "Test" /* ... */ }],
            skills: [],
            documents: [],
            workflows: [],
            networks: [],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: [],
            entryPoint: { type: "agent", slug: "test-agent" }  // ✅ Valid
        };

        // Setup mocks with valid data
        // ...

        const result = await deployPlaybook({
            playbookId: "pb1",
            versionNumber: 1,
            targetOrgId: "org1",
            targetWorkspaceId: "ws1",
            userId: "user1"
        });

        expect(result).toBeDefined();
        expect(result.status).toBe("ACTIVE");
    });
});
```

---

### File 7: Add to `tests/integration/playbooks/packaging.test.ts`

**Purpose**: Test repackaging with invalid previous manifests

```typescript
describe("Repackage with Invalid Previous Manifest", () => {
    it("should reject boot-only repackage when previous manifest is invalid", async () => {
        // Create playbook with invalid manifest
        const playbook = await prisma.playbook.create({
            data: {
                slug: "test-invalid",
                name: "Test Invalid",
                description: "Test",
                category: "test",
                publisherOrgId: org1.id,
                publishedByUserId: user1.id
            }
        });

        await prisma.playbookVersion.create({
            data: {
                playbookId: playbook.id,
                version: 1,
                manifest: {
                    version: "1.0",
                    agents: [],
                    // ... other fields
                    // entryPoint missing! ❌
                } as any,
                createdBy: user1.id
            }
        });

        // Attempt boot-only repackage
        await expect(
            repackagePlaybook({
                playbookId: playbook.id,
                mode: "boot-only",
                organizationId: org1.id,
                userId: user1.id
            })
        ).rejects.toThrow(/previous manifest is invalid/i);
    });

    it("should successfully repackage when previous manifest is valid", async () => {
        // Create playbook with valid manifest
        // ...
        
        const result = await repackagePlaybook({
            playbookId: playbook.id,
            mode: "boot-only",
            organizationId: org1.id,
            userId: user1.id
        });

        expect(result.manifest.entryPoint).toBeDefined();
        expect(result.manifest.entryPoint.type).toBeDefined();
    });
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All changes implemented
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run format` executed
- [ ] `bun run build` succeeds
- [ ] All tests pass: `bun test`
- [ ] Integration tests pass: `bun test tests/integration/playbooks/`
- [ ] Manual testing completed (see below)

### Manual Testing Steps

#### Test 1: Deploy Existing Valid Playbook
```bash
# Should succeed
curl -X POST http://localhost:3001/api/playbooks/starter-kit/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"workspaceId": "your-workspace-id"}'
```

#### Test 2: Check Manifest Health
```bash
bun run scripts/check-manifest-health.ts
# Should report all manifests as valid (or identify specific issues)
```

#### Test 3: Boot-Only Repackage
```bash
# Should succeed or fail gracefully (not crash)
curl -X POST http://localhost:3001/api/playbooks/starter-kit/package \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"mode": "boot-only"}'
```

#### Test 4: Version Revert
```bash
# Should validate before reverting
curl -X POST http://localhost:3001/api/playbooks/starter-kit/versions/1/revert \
  -H "Content-Type: application/json" \
  -H "Cookie: ..."
```

### Deployment

```bash
# 1. Stage all changes
git add -A

# 2. Commit with reference to issue
git commit -m "fix: prevent null reference in playbook deployment (#83)

- Add optional chaining to manifest.entryPoint access in deployer
- Validate previousManifest before spreading in boot-only repackage
- Validate source manifest before version revert
- Add explicit entryPoint null check after validation
- Create manifest health check script
- Add comprehensive test coverage for edge cases

Fixes #83"

# 3. Push to trigger CI/CD
git push origin main

# 4. Monitor deployment
# Watch GitHub Actions
# Check production logs
```

### Post-Deployment Verification

- [ ] Check production error logs - 500 errors on deploy endpoint should stop
- [ ] Monitor Sentry/error tracking for related issues
- [ ] Test deployment in production with a known playbook
- [ ] Run health check script: `bun run scripts/check-manifest-health.ts`
- [ ] If invalid manifests found, schedule Phase 3 data repair

---

## Rollback Procedure

If issues arise after deployment:

```bash
# 1. Revert the commit
git revert HEAD

# 2. Push immediately
git push origin main

# 3. Investigate root cause
# Check error logs for unexpected failures

# 4. Fix and redeploy
```

**Rollback Risk**: Low - changes are defensive and additive

---

## Success Metrics

### Immediate (Within 1 hour of hotfix deployment)

- [ ] Zero 500 errors on `/api/playbooks/*/deploy` endpoint
- [ ] Error logs show graceful handling of invalid manifests
- [ ] Users can successfully deploy valid playbooks

### Short-term (Within 1 week of full fix)

- [ ] All invalid manifests identified and catalogued
- [ ] Auto-repairable manifests fixed via script
- [ ] Manual review completed for complex cases
- [ ] Zero invalid manifests remain in database
- [ ] All integration tests passing

### Long-term (Within 1 month)

- [ ] No new reports of manifest-related deployment failures
- [ ] Monitoring dashboard shows 100% manifest health
- [ ] Prevention measures implemented (TypeScript strict mode, Prisma middleware)
- [ ] Documentation updated with manifest handling best practices

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 (Hotfix) | 30 minutes | None - Deploy immediately |
| Phase 2 (Validation) | 4 hours | Phase 1 deployed |
| Phase 3 (Data Repair) | 2 hours + maintenance window | Phase 1 & 2 deployed |
| Phase 4 (Testing) | 2 hours | Can be parallel with Phase 2 |
| **Total** | **1 day (with maintenance window)** | Sequential deployment recommended |

---

## Notes for Implementer

1. **Phase 1 is critical** - deploy as soon as possible to unblock users
2. **Phase 2 prevents recurrence** - schedule for next sprint
3. **Phase 3 requires care** - backup database before applying repairs
4. **Test thoroughly** - this touches revenue-critical code path
5. **Monitor closely** - watch error logs for 24 hours after deployment

---

**Document Version**: 1.0  
**Last Updated**: March 8, 2026  
**Related Issue**: #83
