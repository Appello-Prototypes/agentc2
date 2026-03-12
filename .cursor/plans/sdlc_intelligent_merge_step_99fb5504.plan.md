---
name: SDLC Intelligent Merge Step
overview: Replace the human merge-review gate with a self-healing validation pipeline -- verify-branch for static CI, AgentC2 QA agent with Playwright MCP for E2E, and a dowhile repair loop that launches Cursor agents to fix failures automatically (max 3 attempts).
todos:
    - id: revert
      content: Revert the previous merge-review changes in both seed scripts (undo human->agent swap)
      status: completed
    - id: implement-merge-steps
      content: Replace merge-review + merge in all 5 pipeline locations with the self-healing merge sequence
      status: completed
    - id: reseed
      content: Run seed script to push updated workflows to Flywheel platform
      status: completed
isProject: false
---

# Intelligent Self-Healing Merge Step for SDLC Pipeline

## Architecture

Replace `merge-review` (human) + `merge` (tool) with a **self-healing validation loop**:

```mermaid
flowchart TD
    ImplementWait["implement-wait"] --> HealCycle["heal-cycle (dowhile, max 3)"]
    subgraph HealInner["heal-cycle internals"]
        Verify["verify-branch<br/>type-check + lint + unit + integration + build"] --> SG{"static-gate<br/>passed?"}
        SG -->|"PASS"| E2E["e2e-validate<br/>AgentC2 agent + Playwright MCP"]
        SG -->|"FAIL"| Fix["fix-launch<br/>Cursor Agent with failure details"]
        E2E --> EG{"e2e-gate<br/>E2E passed?"}
        EG -->|"PASS"| LoopDone["set healed=true, break"]
        EG -->|"FAIL"| Fix
        Fix --> FixWait["fix-wait<br/>Poll Cursor Agent"]
        FixWait --> FixNotes["post-fix-notes<br/>Comment on issue"]
    end
    HealCycle --> FinalGate{"healed?"}
    FinalGate -->|"YES"| Merge["merge PR (squash)"]
    FinalGate -->|"NO (3 failures)"| MergeFail["merge-fail<br/>Post failure report"]
```

### Steps inside heal-cycle (dowhile, maxIterations: 3)

1. **verify-branch** (tool) -- Run type-check, lint, test:unit, test:integration, build in sandbox
2. **static-gate** (branch) -- If passed, continue. If failed, jump to fix.
3. **e2e-validate** (agent) -- SDLC Auditor + Playwright MCP navigates live app, validates key flows
4. **e2e-gate** (branch) -- If passed, set healed flag. If failed, jump to fix.
5. **fix-launch** (tool) -- Launch Cursor agent with full failure context to fix the code
6. **fix-wait** (tool) -- Poll until Cursor agent pushes fixes
7. **post-fix-notes** (tool) -- Post repair attempt details to GitHub issue

### After heal-cycle

- **merge** (tool) -- Squash merge if healed
- **merge-fail** (tool) -- Post detailed failure report if 3 attempts exhausted

## Files to Modify

- [scripts/seed-sdlc-playbook.ts](scripts/seed-sdlc-playbook.ts) -- 3 locations (bugfix, feature, standard)
- [scripts/seed-sdlc-claude-playbook.ts](scripts/seed-sdlc-claude-playbook.ts) -- 2 locations (bugfix, feature)
- Revert the simple agent swap already made
