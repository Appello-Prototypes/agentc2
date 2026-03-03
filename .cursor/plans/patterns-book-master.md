# Patterns for Building AI Agents — Master Implementation Plan

## Source

Gap analysis of AgentC2 against all 22 patterns from _Patterns for Building AI Agents_ (Bhagwat & Gienow, October 2025). This master plan organizes 5 implementation plans ordered by priority and dependency.

## Plans Overview

| #   | Plan                               | Priority     | Risk                   | Effort | Dependencies                |
| --- | ---------------------------------- | ------------ | ---------------------- | ------ | --------------------------- |
| 1   | Security Hardening                 | **Critical** | Active vulnerabilities | Medium | None                        |
| 2   | Agent Resilience & Context Quality | **High**     | Core quality gaps      | Medium | None                        |
| 3   | Eval Pipeline Maturation           | **High**     | Platform maturity      | Large  | Partial overlap with Plan 2 |
| 4   | SME Review & Dataset Platform      | **Medium**   | Competitive gap        | Large  | Plan 3 foundations          |
| 5   | Strategic Agent Capabilities       | **Medium**   | Feature completeness   | Medium | Independent                 |

## Dependency Graph

```
Plan 1 (Security) ──────────────────────────> Can start immediately
Plan 2 (Resilience) ────────────────────────> Can start immediately
Plan 3 (Eval Pipeline) ─────────────────────> Can start immediately; Phase 3.2 benefits from Plan 2.3
Plan 4 (SME/Dataset) ───────────────────────> Plan 3 Phase 3.1 should complete first
Plan 5 (Strategic) ──────────────────────────> Independent; Phase 5.3 benefits from Plan 3

Plans 1 and 2 can execute in parallel.
Plans 3 and 5 can execute in parallel (after 1 and 2 start).
Plan 4 should start after Plan 3 Phase 3.1 completes.
```

## Execution Order

### Sprint 1: Security + Resilience (parallel)

- **Plan 1 Phases 1–3**: Wire dead code, expand guardrail coverage, lethal trifecta
- **Plan 2 Phases 1–2**: Error-to-context loop, memory processors

### Sprint 2: Security finish + Resilience finish + Eval start

- **Plan 1 Phases 4–5**: Toxicity, output retry
- **Plan 2 Phases 3–4**: Context failure detection, token counting
- **Plan 3 Phases 1–2**: Failure taxonomy, CI/CD eval gates

### Sprint 3: Eval finish + SME start + Strategic start

- **Plan 3 Phases 3–4**: Cross-reference visualization, judge calibration
- **Plan 4 Phases 1–2**: Labeling UI, annotation workflow
- **Plan 5 Phases 1–2**: Business KPIs, capability matrix

### Sprint 4: SME finish + Strategic finish

- **Plan 4 Phases 3–4**: Dataset management, observability integrations
- **Plan 5 Phases 3–5**: User tiers, intent router, trace sharing

## Pattern Coverage Map

| Pattern                            | Plan   | Phase         | Notes                                                                                    |
| ---------------------------------- | ------ | ------------- | ---------------------------------------------------------------------------------------- |
| 1. Whiteboard Capabilities         | Plan 5 | 5.2           | New capability taxonomy                                                                  |
| 2. Evolve Architecture             | Plan 5 | 5.4           | Refine existing network routing                                                          |
| 3. Dynamic Agents                  | Plan 5 | 5.3           | Tier-based differentiation                                                               |
| 4. Human-in-the-Loop               | Plan 5 | 5.5           | Upgrade existing 403 block to approval queue                                             |
| 5. Parallelize Carefully           | Plan 2 | 2.5           | Conflict detection for parallel workflows                                                |
| 6. Share Context Between Subagents | Plan 5 | 5.6           | Structured trace sharing                                                                 |
| 7. Avoid Context Failure Modes     | Plan 2 | 2.3           | Rot/clash/distraction detection                                                          |
| 8. Compress Context                | Plan 2 | 2.2           | Wire Mastra processors (already exist, unused)                                           |
| 9. Feed Errors Into Context        | Plan 2 | 2.1           | **Narrowed**: managed-generate already does basic feeding; enhance with analysis prompts |
| 10. List Failure Modes             | Plan 3 | 3.1           | New diagnostic taxonomy                                                                  |
| 11. List Critical Business Metrics | Plan 5 | 5.1           | KPI layer on top of existing analytics                                                   |
| 12. Cross-Ref Failures & Metrics   | Plan 3 | 3.3           | New visualization                                                                        |
| 13. Iterate Against Evals          | Plan 3 | 3.2           | CI/CD gates (Vitest only today, no evals)                                                |
| 14. Create Eval Test Suite         | Plan 3 | 3.2           | Extend existing AgentTestCase system                                                     |
| 15. Have SMEs Label Data           | Plan 4 | 4.1, 4.2      | New annotation model (distinct from AgentFeedback)                                       |
| 16. Datasets from Production       | Plan 4 | 4.3           | **Consolidated**: extend AgentTestCase + new TestSuite grouping                          |
| 17. Evaluate Production Data       | Plan 3 | 3.4           | Categorical scoring + judge calibration                                                  |
| 18. Prevent Lethal Trifecta        | Plan 1 | 1.3           | Extend existing toolBehaviorMap                                                          |
| 19. Sandbox Code Execution         | —      | —             | Already STRONG                                                                           |
| 20. Granular Access Control        | Plan 1 | 1.1           | Wire existing dead code                                                                  |
| 21. Agent Guardrails               | Plan 1 | 1.2, 1.4, 1.5 | Use Mastra native inputProcessors/outputProcessors                                       |
| 22. What's Next                    | Plan 3 | 3.5           | Simulation framework                                                                     |

## Audit Corrections Applied

| Correction                                                   | Impact                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| managed-generate already feeds tool errors back into context | Plan 2.1 narrowed from "build the loop" to "add analysis prompts" |
| requiresApproval already returns 403 in invoke route         | Plan 5.5 changed from "wire it in" to "upgrade to approval queue" |
| Mastra supports inputProcessors/outputProcessors natively    | Plan 1.2 changed from custom wrapper to Mastra processors         |
| js-tiktoken already in dep tree via Mastra                   | Plan 2.4 no new dependency needed                                 |
| TokenLimiter/ToolCallFilter in @mastra/core/processors       | Plan 2.2 import path corrected                                    |
| toolBehaviorMap already classifies query/mutation            | Plan 1.3 extends existing taxonomy                                |
| createToxicityScorer already in eval pipeline                | Plan 1.4 reuses existing component                                |
| EvalDataset would be third dataset concept                   | Plan 4.3 consolidated into AgentTestCase + TestSuite              |
| Network routing already LLM-based                            | Plan 5.4 narrowed from "new pattern" to "enhance existing"        |

## Individual Plan Files

| Plan                                       | File                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| Plan 1: Security Hardening                 | `.cursor/plans/patterns-01-security-hardening.md`     |
| Plan 2: Agent Resilience & Context Quality | `.cursor/plans/patterns-02-agent-resilience.md`       |
| Plan 3: Eval Pipeline Maturation           | `.cursor/plans/patterns-03-eval-pipeline.md`          |
| Plan 4: SME Review & Dataset Platform      | `.cursor/plans/patterns-04-sme-dataset.md`            |
| Plan 5: Strategic Agent Capabilities       | `.cursor/plans/patterns-05-strategic-capabilities.md` |
