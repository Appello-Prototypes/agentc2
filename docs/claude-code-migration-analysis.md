# AI Tooling Cost Architecture: Cursor → Claude Code Migration

**Date:** March 3, 2026
**Author:** Corey Shelson
**Status:** Urgent — Action Required Before Next Billing Cycle

---

## Executive Summary

We have 7 people on the team using AI coding tools. Some use Cursor, others have started using Claude Code. Cursor's on-demand billing is creating runaway costs — **3 team members alone are on pace to exceed $8,700 this month.** Emma's successful switch to Claude Code proved there is no productivity loss. We need a comprehensive plan to migrate the full team to Claude Code before costs accelerate further, especially as we launch the SDLC flywheel (which, if run on Cursor Cloud agents, will make the problem dramatically worse).

---

## 1. The Problem: Actual Numbers

### Current Billing Data (March 2026 Cycle — 11 Days In, 19 Days Remaining)

**Corey Shelson — Cursor Ultra ($200/mo)**

| Category                  | Amount                  |
| ------------------------- | ----------------------- |
| Plan cost                 | $200.00                 |
| Included usage consumed   | 37% (100% API, 6% Auto) |
| On-demand usage (11 days) | $910.92                 |
| On-demand limit           | $10,000                 |
| **Current total**         | **$1,110.92**           |
| **Projected month-end**   | **~$2,684**             |

**Travis McKenna — Cursor Pro ($20/mo)**

| Category                  | Amount        |
| ------------------------- | ------------- |
| Plan cost                 | $20.00        |
| On-demand usage (11 days) | $1,470.93     |
| On-demand limit           | $1,500        |
| **Current total**         | **$1,490.93** |
| **Projected month-end**   | **~$4,032**   |

**Filip Altankov — Cursor Pro ($20/mo)**

| Category                  | Amount      |
| ------------------------- | ----------- |
| Plan cost                 | $20.00      |
| On-demand usage (11 days) | $751.95     |
| On-demand limit           | $800        |
| **Current total**         | **$771.95** |
| **Projected month-end**   | **~$2,071** |

### Projected Monthly Spend (Cursor)

| Team Member              | Role | Tool                       | Projected Monthly      |
| ------------------------ | ---- | -------------------------- | ---------------------- |
| Corey Shelson            | Lead | Cursor Ultra               | ~$2,684                |
| Travis McKenna           | Dev  | Cursor Pro                 | ~$4,032                |
| Filip Altankov           | Dev  | Cursor Pro                 | ~$2,071                |
| Emma                     | Dev  | **Claude Code** (switched) | ~$100–200              |
| Christopher              | Dev  | Cursor                     | TBD                    |
| Ian Haase                | Dev  | Cursor                     | TBD                    |
| Member 7                 | Dev  | Cursor                     | TBD                    |
| **Total (conservative)** |      |                            | **$10,000–$15,000/mo** |

### The Trend Line

- These are **11-day numbers.** At this burn rate, Corey alone will spend ~$2,500 in on-demand charges this month.
- Travis is about to hit his $1,500 on-demand cap. If the cap is raised or he finds workarounds, his projected spend is $4K+.
- Filip is tracking to $2K+.
- **Emma's Cursor usage flatlined** since switching to Claude Code ~3 weeks ago. Her total Claude Code cost: ~$100–200/mo (Max subscription). That is a 90%+ reduction.

### Annual Projection at Current Rate

| Scenario                                            | Monthly        | Annual                |
| --------------------------------------------------- | -------------- | --------------------- |
| Current trajectory (7 people)                       | $10,000–15,000 | **$120,000–$180,000** |
| Post-SDLC flywheel launch (heavier automated usage) | $15,000–25,000 | **$180,000–$300,000** |

**The SDLC flywheel will make this worse, not better.** If the autonomous coding pipeline dispatches tickets to Cursor Cloud agents (`cursor_launch_agent`), every automated coding run burns Cursor on-demand credits. The more successful the flywheel, the higher the bill.

---

## 2. Why This Is Happening

Cursor switched to credit-based billing in June 2025. Under the old model, Pro users got ~500 fast requests/month. Under the new model, the equivalent is ~225 premium requests — and then on-demand charges kick in at API rates **plus Cursor's margin.**

The cost structure:

```
What you pay Cursor = Base subscription
                    + On-demand tokens × (API cost + Cursor margin)
                    + Cloud compute markup
```

```
What you pay Claude Code = Max subscription (flat rate)
                         + Nothing else
```

Cursor is a **SaaS reseller model** — you're paying Anthropic's API costs plus Cursor's platform margin plus cloud compute markup. Claude Code Max is a **flat-rate subscription** with generous usage limits and no overages.

---

## 3. Emma's Proof Point

Emma switched to Claude Code approximately 3 weeks ago. Results:

| Metric                  | Before (Cursor)         | After (Claude Code)              |
| ----------------------- | ----------------------- | -------------------------------- |
| Monthly cost            | $500–1,500+ (estimated) | ~$100–200 (Max subscription)     |
| Productivity            | Baseline                | **No change**                    |
| Preference              | Neutral                 | **Strongly prefers Claude Code** |
| Cursor billing activity | Active                  | **Flatlined for 1+ week**        |

Key observations from the team:

- _"She hasn't slowed down at all with the switch"_ — Christopher
- _"She greatly prefers the Claude Code workflow over Cursor"_ — Christopher
- No blockers or missing capabilities identified

This is a single-person pilot with 3 weeks of data. It validates the hypothesis.

---

## 4. What We Need to Prove

Before migrating the full team, we need to answer:

1. **Can every role on the team maintain velocity on Claude Code?** Emma proved it for her workflow. Travis and Filip have "Cursor-preferred" workflows — is the gap real or just familiarity?

2. **Can non-developers use Claude Code?** Cursor's visual interface is preferred by non-devs. Claude Code on the Web (browser-based, launched Feb 24, 2026) may solve this — needs testing.

3. **Can the SDLC flywheel run on Claude Code instead of Cursor Cloud?** The autonomous coding pipeline currently calls `cursor_launch_agent`. Claude's Agent SDK provides a direct replacement — needs to be built and validated.

4. **What is the actual Claude Code cost per developer per month?** Emma's data point is one person. We need 2–3 more data points to model confidently.

---

## 5. The SDLC Flywheel Dependency

Our SDLC platform has 222 MCP tools. Only **5 are Cursor-specific:**

| Current Tool              | What It Does                   | Claude Agent SDK Replacement            |
| ------------------------- | ------------------------------ | --------------------------------------- |
| `cursor_launch_agent`     | Launch autonomous coding agent | `claude -p "task" --output-format json` |
| `cursor_get_status`       | Check agent run status         | Session ID + process monitoring         |
| `cursor_poll_until_done`  | Wait for completion            | `--output-format stream-json`           |
| `cursor_add_followup`     | Send follow-up instruction     | `--continue --session-id`               |
| `cursor_get_conversation` | Get full conversation          | JSON output with history                |

Everything else — ticket dispatch, backlog management, branch verification, CI/CD, GitHub Actions — is **tool-agnostic** and works regardless of whether the coding agent is Cursor or Claude Code.

**Migration effort:** Build 5 replacement MCP tools using Claude Agent SDK (TypeScript). Estimated 2–3 days.

**Critical point:** If we launch the flywheel on Cursor Cloud agents without migrating, every automated ticket dispatch burns on-demand Cursor credits. The flywheel's success would directly drive costs up. Migrating the pipeline to Claude Agent SDK before launch avoids this entirely.

---

## 6. Claude Code Cost Model

### Per-Developer Pricing

| Tier    | Monthly | Usage Limits             | Best For            |
| ------- | ------- | ------------------------ | ------------------- |
| Pro     | $20     | ~44K tokens/5-hr window  | Light usage         |
| Max 5x  | $100    | ~88K tokens/5-hr window  | Regular development |
| Max 20x | $200    | ~220K tokens/5-hr window | Heavy daily usage   |

No on-demand charges. No overages. Flat rate.

### Projected Team Cost on Claude Code

| Team Member                 | Recommended Tier      | Monthly Cost       |
| --------------------------- | --------------------- | ------------------ |
| Corey Shelson               | Max 20x (heavy usage) | $200               |
| Travis McKenna              | Max 20x (heavy usage) | $200               |
| Filip Altankov              | Max 5x or 20x         | $100–200           |
| Emma                        | Max 5x (current)      | $100               |
| Christopher                 | Max 5x                | $100               |
| Ian Haase                   | Max 5x                | $100               |
| Member 7                    | Max 5x                | $100               |
| Pipeline droplet (headless) | DO Droplet            | $48                |
| **Total**                   |                       | **$948–$1,048/mo** |

### Cost Comparison

|                       | Cursor (Current) | Claude Code (Proposed) | Savings                  |
| --------------------- | ---------------- | ---------------------- | ------------------------ |
| Monthly               | $10,000–15,000   | ~$1,000                | **$9,000–$14,000/mo**    |
| Annual                | $120,000–180,000 | ~$12,000               | **$108,000–$168,000/yr** |
| Post-flywheel monthly | $15,000–25,000   | ~$1,000                | **$14,000–$24,000/mo**   |

Even if we're conservative and assume Cursor costs settle at $8,000/mo, the savings are still **$84,000/yr.**

---

## 7. Addressing the Concerns

### "Claude Code needs a local machine"

**No longer true.** As of February 24, 2026, Claude Code on the Web (`--remote` flag) runs on Anthropic's cloud infrastructure. No local machine or droplet needed for individual dev work. Browser-based interface at claude.ai/code.

For the autonomous pipeline, one small DO droplet ($48/mo) running Claude Code headless handles all automated coding tasks.

### "Non-devs prefer Cursor's visual interface"

Claude Code now has three non-terminal interfaces:

- **Claude Code on the Web** — browser-based, accessible to anyone
- **Claude Mobile App** — iOS/Android, monitor and interact with sessions
- **Remote Control** — start a session anywhere, continue from any device

These need to be tested by the team, but the browser interface is purpose-built for non-terminal users.

### "Travis and Filip prefer Cursor workflows"

The preference is real, but the cost difference is 10–20x. At $4,000/mo vs $200/mo for the same person, the question becomes: is Cursor's interface worth $3,800/mo per developer? The answer should be informed by a structured pilot, not assumption.

### "This is a paradigm shift — I know all the Cursor nuances"

Correct. There is a 1–2 week learning curve. But Emma cleared it in days, not weeks, and came out the other side preferring Claude Code. The nuances of Claude Code are learnable. The cost differential is not optional.

### "What about Cursor tab completion?"

Cursor's tab completion uses a specialized model and is a genuine differentiator. Claude Code doesn't have an exact equivalent. For developers who rely heavily on tab completion, this is the biggest workflow gap. It needs to be evaluated during the pilot — is it a $3,800/mo feature?

---

## 8. Proposed Plan: 4-Week Migration Pilot

### Week 1 (Mar 3–7): Set Up + Quick Wins

- [ ] Buy Filip a Claude Max 5x seat ($100)
- [ ] Emma presents 5 minutes at standup: experience, blockers, what improved, token usage
- [ ] Corey and Filip both test Claude Code on the Web (`--remote`) for 2 days
- [ ] Document: What works? What's missing? What's different?
- [ ] Capture baseline: screenshot everyone's Cursor billing at end of week

### Week 2 (Mar 10–14): Build the Pipeline Bridge

- [ ] Develop 5 Claude Agent SDK MCP tools to replace `cursor_*` tools
- [ ] Run one test ticket through both pipelines (Cursor + Claude) in parallel
- [ ] Filip and Corey continue daily-driving Claude Code
- [ ] Christopher tests Claude Code on the Web (non-terminal interface evaluation)
- [ ] Track: hours productive, tasks completed, blockers hit

### Week 3 (Mar 17–21): Full Pilot

- [ ] All willing team members on Claude Code for the full week
- [ ] Run 5 tickets through the Claude-based coding pipeline
- [ ] Measure: velocity, cost, friction, sentiment
- [ ] Identify any hard blockers (tasks that genuinely cannot be done in Claude Code)
- [ ] Non-dev team member tests Claude Code on the Web for monitoring/interaction

### Week 4 (Mar 24–28): Decision

- [ ] Compile all cost data: Cursor final bill vs Claude Code burn
- [ ] Team retrospective: go/no-go for each team member
- [ ] Final architecture decision (see options below)
- [ ] If go: cancel Cursor seats at next billing cycle renewal
- [ ] If no-go for specific people: hybrid model with documented justification

---

## 9. Architecture Options

### Option A: Full Claude Code Migration (Recommended)

All 7 developers on Claude Max. One DO droplet for the headless coding pipeline. Zero Cursor seats.

**Cost: ~$1,000/mo | Savings: $9,000–$14,000/mo**

### Option B: Hybrid (Fallback)

Developers who can't switch stay on Cursor Pro ($20/mo base) with strict on-demand caps. Everyone else on Claude Max. Pipeline migrated to Claude Agent SDK regardless.

**Cost: ~$1,500–3,000/mo | Savings: $7,000–$12,000/mo**

### Option C: Status Quo (Not Recommended)

Keep current setup. Accept $10,000–15,000/mo and growing. SDLC flywheel launch will increase costs further.

**Cost: $10,000–25,000/mo | Savings: $0**

---

## 10. Risk Register

| Risk                                                      | Likelihood | Impact | Mitigation                                                         |
| --------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| Developer velocity dip during 1–2 week transition         | Medium     | Medium | Run parallel for 2 weeks; don't hard-cut                           |
| Claude Code on the Web leaves research preview or changes | Low        | Medium | Fallback to DO droplet (Option C from original analysis)           |
| Claude Max rate limits hit for heavy users                | Medium     | Low    | Upgrade to Max 20x ($200/mo) — still 95% cheaper than current      |
| Tab completion gap affects productivity                   | Medium     | Low    | Evaluate during pilot; quantify actual impact vs perceived         |
| Pipeline migration introduces bugs                        | Low        | Medium | Run both pipelines in parallel for 1 week before cutover           |
| SDLC flywheel launch delayed by migration work            | Low        | High   | Pipeline migration is 2–3 days; schedule it before flywheel launch |

---

## 11. Decisions Needed Now

1. **Approve Filip's Claude Max seat** — $100/mo, starting this week
2. **Set Cursor on-demand caps** — Travis is about to hit $1,500; Corey is at $910 with 19 days left. Consider lowering caps immediately to force the transition.
3. **Authorize 2–3 days of dev time** to build the Claude Agent SDK pipeline bridge (Week 2)
4. **Confirm the 4-week pilot timeline** — or accelerate if the March billing is motivation enough

### The Bottom Line

We are spending **$10,000–$15,000/month** on AI coding tools. We have a proven alternative that costs **~$1,000/month** with no productivity loss. Every month we delay costs us $9,000+. The SDLC flywheel will make it worse. The plan above proves it in 4 weeks with minimal risk.

---

_This document will be updated weekly with pilot data as it becomes available._
