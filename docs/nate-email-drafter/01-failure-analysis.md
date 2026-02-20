# Email Triage Agent Failure Analysis

**Run ID:** `cmltsqcep00808epi9bv213mz`
**Agent:** Email Triage Agent (`email-triage`)
**Triggered by:** Schedule "Poll inbox and draft replies" (every 10 min)
**Status:** FAILED — `EXECUTION_ERROR`
**Timestamp:** 2026-02-19T18:30:16Z
**Duration:** 112s (timeout waiting for model response)

---

## 1. The Error

```
input length and `max_tokens` exceed context limit: 143,631 + 64,000 > 200,000
```

The agent's total context payload (143K input tokens + 64K default output budget) exceeded Claude Sonnet 4's 200K context window before any steps could execute.

---

## 2. Root Cause: Wrong Agent for the Job

The schedule's prompt was:

> "Process all new unread emails in my Gmail inbox. For each: (1) draft a proposed reply and create a Gmail draft only — do not send; (2) send Nate Friesen a Slack DM with a brief notification that they have a new email, including sender and subject."

The **Email Triage Agent** was not designed for this task. It was purpose-built for **Corey Shelson's executive email triage workflow** — a complex, multi-classification system with 9 email categories, confidential investor handling, customer domain routing, Slack channel posting, and enrichment across 6 integration providers (HubSpot, Jira, Fathom, Google Calendar, Slack, Gmail).

The schedule was asking for a **simple, narrow task**: read Nate's unread emails, draft replies, send DMs. None of the triage agent's sophistication is needed.

---

## 3. What the Agent Carries vs. What the Task Needs

| Capability                 | Email Triage Agent                                                                                                          | Nate's Actual Need                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Instructions               | 9,749 chars — 9 classification categories, confidential handling, customer domains, enrichment strategies, response formats | ~500 chars — "Read unread emails, draft replies, DM Nate" |
| Pinned Skills              | 7 (HubSpot, Jira, Calendar, Fathom, Slack, Gmail History, Gmail Draft)                                                      | 0 (inline instructions are sufficient)                    |
| Tools loaded               | 25 MCP tools (~139K tokens of schemas)                                                                                      | 4 tools (~5-10K tokens)                                   |
| HubSpot tools              | 5 (search, batch-read, associations, user-details, list-objects)                                                            | 0                                                         |
| Jira tools                 | 4 (search, transitions, projects, issues)                                                                                   | 0                                                         |
| Fathom tools               | 3 (meetings, summaries, details)                                                                                            | 0                                                         |
| Google Calendar            | 1 (search-events)                                                                                                           | 0                                                         |
| Slack tools                | 7 (post, reply, react, thread, history, channels, users, profiles)                                                          | 1 (post_message only)                                     |
| Gmail tools                | 4 (search, read, draft, archive)                                                                                            | 3 (search, read, draft)                                   |
| **Estimated input tokens** | **~143,000**                                                                                                                | **~8,000-12,000**                                         |

The agent was hauling **131,000+ tokens of irrelevant context** — investor domain lists, customer routing rules, enrichment procedures, and 21 unused tool schemas — for a task that needs none of it.

---

## 4. Why It Blew the Context Window

MCP tool schemas are the dominant cost. Each HubSpot/Jira/Fathom tool carries a large JSON schema describing all its parameters, enums, and object types. With 25 tools loaded:

- ~97% of the 143K input tokens are tool schemas
- The actual instructions + user prompt account for only ~4K tokens
- The default `max_tokens: 64,000` (set by the AI SDK when the agent has `maxTokens: null`) reserves output budget that pushes the total over 200K

This was a fragile equilibrium — the previous run at 18:20 barely fit within context. Any slight variation in MCP schema size tips it over the edge.

---

## 5. Compounding Issue: Budget Exhaustion

Before this run, the agent logged **12 consecutive `BUDGET_EXCEEDED` failures** ($75.10 / $75 monthly limit). The triage agent's heavy tool usage and multi-step enrichment workflow makes it expensive to operate. Running it on a 10-minute cron for Nate's simple use case accelerated cost accumulation unnecessarily.

---

## 6. Recent Run History

| Time (UTC)    | Status       | Duration | Tokens    | Failure Reason                    |
| ------------- | ------------ | -------- | --------- | --------------------------------- |
| 18:30:16      | FAILED       | 112s     | 0         | Context limit exceeded (this run) |
| 18:20:11      | COMPLETED    | 127s     | 2,356,211 | --                                |
| 18:15:20      | FAILED       | 0.2s     | 0         | Budget exceeded ($75.10/$75)      |
| 18:13 - 17:30 | FAILED (x12) | <1s each | 0         | Budget exceeded ($75.10/$75)      |

---

## 7. Conclusion

The correct solution is **not to patch the Email Triage Agent** (reducing `maxTokens`, pruning tools, etc.). Those are band-aids that degrade its primary mission for Corey's inbox.

Instead, a **new purpose-built agent** should be created for Nate's specific workflow. See `02-implementation-plan.md` for the full specification and step-by-step implementation guide.
