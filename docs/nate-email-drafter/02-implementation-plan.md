# Nate Email Drafter — Implementation Plan

Create a purpose-built, lightweight agent for Nate Friesen's email workflow: search unread Gmail, draft replies, and notify via Slack DM. Replaces the overloaded Email Triage Agent schedule that was failing due to context window overflow.

---

## Verified Platform Facts

| Item                          | Value                                                                   |
| ----------------------------- | ----------------------------------------------------------------------- |
| Nate's Gmail OAuth connection | `cmlqtighz002o8evfu5vj7yki` — `nathan@useappello.com` (default, active) |
| Nate's Slack User ID          | `U098WUC0UJF` (`appellosales@useappello.com`)                           |
| Organization ID               | `cml65bxnu0000v6u90w9bxovn` (Appello)                                   |
| Workspace ID                  | `cml65bxpw0002v6u9l6gf9bd5`                                             |
| Old schedule to deactivate    | `cmlsitv3s002c8egdde83824b` on Email Triage Agent                       |

---

## Agent Specification

| Property           | Value                |
| ------------------ | -------------------- |
| **Slug**           | `nate-email-drafter` |
| **Name**           | Nate Email Drafter   |
| **Model Provider** | `openai`             |
| **Model Name**     | `gpt-4o-mini`        |
| **Temperature**    | 0.4                  |
| **maxTokens**      | 4096                 |
| **maxSteps**       | 15                   |
| **Memory**         | disabled             |
| **Skills**         | none                 |
| **Scorers**        | none                 |
| **Visibility**     | `ORGANIZATION`       |

### Tools (4 total)

| Tool ID                    | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `gmail-search-emails`      | Search for unread emails in Nate's inbox |
| `gmail-read-email`         | Read each email's full content           |
| `gmail-draft-email`        | Create a draft reply (never send)        |
| `slack_slack_post_message` | DM Nate with sender and subject          |

### Instructions

Copy this exactly as the agent's instructions:

```
You are Nate Friesen's email drafting assistant. Your job is to process unread emails in Nate's Gmail inbox.

## Workflow
1. Use gmail-search-emails with query "is:unread" to find all unread emails.
2. If there are no unread emails, respond "No unread emails found" and stop. Do NOT send any Slack messages.
3. For each unread email:
   a. Use gmail-read-email to read the full content.
   b. Use gmail-draft-email to create a professional draft reply. Do NOT send the email — only create a draft.
   c. Use slack_slack_post_message to DM Nate (channel_id: U098WUC0UJF) with a brief notification:
      "New email from [sender] — Subject: [subject]"

## Rules
- NEVER send emails. Only create drafts via gmail-draft-email.
- Keep Slack DMs concise: one line per email, sender and subject only.
- Process emails one at a time: read, draft, notify, then move to the next.
- If a tool call fails, skip that email and continue to the next.
```

### Metadata

Set the agent's metadata JSON to:

```json
{
    "slack": {
        "displayName": "Nate's Email Drafter",
        "iconEmoji": ":email:"
    }
}
```

---

## Schedule Specification

| Property            | Value                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**            | Poll Nate's inbox and draft replies                                                                                                         |
| **Cron Expression** | `*/10 * * * *` (every 10 minutes)                                                                                                           |
| **Timezone**        | `America/Los_Angeles`                                                                                                                       |
| **Input**           | `Process all new unread emails in my Gmail inbox. For each unread email, draft a reply and send me a Slack DM with the sender and subject.` |

---

## Step-by-Step Implementation

### Step 1: Deactivate the old schedule

The Email Triage Agent's schedule `cmlsitv3s002c8egdde83824b` ("Poll inbox and draft replies") must be paused to stop it from continuing to fail and waste budget.

**How:** Go to the Email Triage Agent's configuration in the AgentC2 platform UI, find the schedule, and toggle it to inactive. Or via API:

```bash
curl -X PATCH "https://agentc2.ai/api/agents/cmlg4fkxe000z8ev3m68zo77t/schedules/cmlsitv3s002c8egdde83824b" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-organization-slug: appello" \
  -d '{"isActive": false}'
```

### Step 2: Create the new agent

**Via the AgentC2 platform UI:**

1. Navigate to **Agents** > **Create Agent**
2. Fill in the specification from the table above (slug, name, model, temperature, maxTokens, maxSteps)
3. Add the 4 tools: `gmail-search-emails`, `gmail-read-email`, `gmail-draft-email`, `slack_slack_post_message`
4. Paste the instructions block exactly as written above
5. Set metadata JSON
6. Set visibility to `ORGANIZATION`
7. Save

**Or via API:**

```bash
curl -X POST "https://agentc2.ai/api/agents" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-organization-slug: appello" \
  -d '{
    "name": "Nate Email Drafter",
    "slug": "nate-email-drafter",
    "description": "Processes unread emails in Nate Friesen Gmail inbox. Drafts professional replies and sends Slack DM notifications with sender and subject.",
    "instructions": "You are Nate Friesen'\''s email drafting assistant. Your job is to process unread emails in Nate'\''s Gmail inbox.\n\n## Workflow\n1. Use gmail-search-emails with query \"is:unread\" to find all unread emails.\n2. If there are no unread emails, respond \"No unread emails found\" and stop. Do NOT send any Slack messages.\n3. For each unread email:\n   a. Use gmail-read-email to read the full content.\n   b. Use gmail-draft-email to create a professional draft reply. Do NOT send the email — only create a draft.\n   c. Use slack_slack_post_message to DM Nate (channel_id: U098WUC0UJF) with a brief notification:\n      \"New email from [sender] — Subject: [subject]\"\n\n## Rules\n- NEVER send emails. Only create drafts via gmail-draft-email.\n- Keep Slack DMs concise: one line per email, sender and subject only.\n- Process emails one at a time: read, draft, notify, then move to the next.\n- If a tool call fails, skip that email and continue to the next.",
    "modelProvider": "openai",
    "modelName": "gpt-4o-mini",
    "temperature": 0.4,
    "maxTokens": 4096,
    "maxSteps": 15,
    "memoryEnabled": false,
    "tools": ["gmail-search-emails", "gmail-read-email", "gmail-draft-email", "slack_slack_post_message"],
    "metadata": {
      "slack": {
        "displayName": "Nate'\''s Email Drafter",
        "iconEmoji": ":email:"
      }
    },
    "visibility": "ORGANIZATION"
  }'
```

### Step 3: Create the schedule on the new agent

After the agent is created, note its ID from the response. Then create the schedule:

**Via the AgentC2 platform UI:**

1. Go to the new agent's page > **Schedules** tab > **Add Schedule**
2. Name: `Poll Nate's inbox and draft replies`
3. Cron: `*/10 * * * *`
4. Timezone: `America/Los_Angeles`
5. Input: `Process all new unread emails in my Gmail inbox. For each unread email, draft a reply and send me a Slack DM with the sender and subject.`
6. Enable and save

**Or via API:**

```bash
curl -X POST "https://agentc2.ai/api/agents/AGENT_ID/schedules" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-organization-slug: appello" \
  -d '{
    "name": "Poll Nate'\''s inbox and draft replies",
    "cronExpr": "*/10 * * * *",
    "timezone": "America/Los_Angeles",
    "inputJson": {
      "input": "Process all new unread emails in my Gmail inbox. For each unread email, draft a reply and send me a Slack DM with the sender and subject."
    },
    "isActive": true
  }'
```

### Step 4: Test with a manual invoke

Before the cron takes over, run the agent once manually to verify everything works:

```bash
curl -X POST "https://agentc2.ai/api/agents/nate-email-drafter/invoke" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-organization-slug: appello" \
  -d '{
    "input": "Process all new unread emails in my Gmail inbox. For each unread email, draft a reply and send me a Slack DM with the sender and subject.",
    "mode": "sync",
    "maxSteps": 15,
    "timeout": 60000
  }'
```

**What to verify:**

- Agent finds unread emails (or correctly reports none)
- Draft replies appear in Nate's Gmail Drafts folder
- Slack DMs arrive with correct sender/subject info
- Run completes in under 30 seconds
- Check the run in the platform UI for token usage (should be ~5-10K, not 143K)

---

## Expected Impact

| Metric                          | Email Triage Agent (old) | Nate Email Drafter (new) |
| ------------------------------- | ------------------------ | ------------------------ |
| Input tokens                    | ~143,000                 | ~8,000                   |
| Tools loaded                    | 25                       | 4                        |
| Cost per run                    | ~$0.50+                  | ~$0.01                   |
| Duration                        | 2+ minutes               | 10-20 seconds            |
| Context window risk             | Critical (97% used)      | None (~4% used)          |
| Monthly cost at 10-min interval | ~$2,160                  | ~$43                     |

---

## Checklist

- [ ] Deactivate old schedule on Email Triage Agent
- [ ] Create `nate-email-drafter` agent with 4 tools
- [ ] Set agent instructions (copy exactly from above)
- [ ] Set metadata for Slack display identity
- [ ] Create `*/10 * * * *` schedule on the new agent
- [ ] Run manual test invoke
- [ ] Verify Gmail drafts are created
- [ ] Verify Slack DMs arrive
- [ ] Confirm token usage is ~8-10K (not 143K)
- [ ] Monitor first few scheduled runs for stability
