---
name: Deal Agent System - End to End
overview: "End-to-end plan to build an autonomous deal-agent system on AgentC2. Starts by validating the instance infrastructure with real prospects (Vanos, Owens, Rival), then incrementally adds email, direct mail, phone, and adaptive multi-channel outreach -- all running inside the Appello org with Slack as the human interface."
todos:
    - id: inc0-master-agent
      content: "Inc 0: Create deal-agent master agent in Appello with multi-instance template and HubSpot tools"
      status: pending
    - id: inc0-instances
      content: "Inc 0: Create 3 instances (Vanos, Owens, Rival) with real company context"
      status: pending
    - id: inc0-slack
      content: "Inc 0: Create Slack channels, invite bot, bind instances"
      status: pending
    - id: inc0-validate
      content: "Inc 0: Run validation tests (identity, memory isolation, inheritance, overrides, threading)"
      status: pending
    - id: inc1-heartbeat
      content: "Inc 1: Build Inngest heartbeat cron that wakes each deal agent instance on a schedule"
      status: pending
    - id: inc1-hubspot-sync
      content: "Inc 1: Create HubSpot deals for Vanos/Owens/Rival, link to instances"
      status: pending
    - id: inc2-email
      content: "Inc 2: Add email outreach capability to deal agent (draft + send via Gmail OAuth)"
      status: pending
    - id: inc3-direct-mail
      content: "Inc 3: Build direct-mail sub-workflow (letter gen, label gen, human proof, print confirm)"
      status: pending
    - id: inc4-multi-channel
      content: "Inc 4: Add phone/SMS via JustCall, adaptive channel selection logic"
      status: pending
    - id: inc5-scale
      content: "Inc 5: List builder agent, batch approval UI, scale to 100+ deals"
      status: pending
isProject: true
---

# Deal Agent System - End to End

## Vision

An autonomous sales development system where every prospect gets a dedicated AI agent instance. Each instance owns the relationship end-to-end -- researching, deciding outreach channels, generating personalized content, sending emails, triggering direct mail, scheduling calls -- until a demo is booked. HubSpot is the source of truth. Slack is the human interface.

---

## Environment: Appello Organization

All work happens inside the **Appello** org/workspace (the only one with live Slack):

- **Slack Team ID:** `T053S06C1` (Appello workspace)
- **Slack Bot Token:** Configured via `SLACK_BOT_TOKEN` in `.env` + per-org `IntegrationConnection`
- **MCP Org Slug:** `appello`
- **HubSpot:** Connected via `HUBSPOT_ACCESS_TOKEN`
- **Gmail:** Connected via Google OAuth integration
- **JustCall:** Connected via `JUSTCALL_AUTH_TOKEN`

---

## Existing Infrastructure (Already Built)

The agent instance system is fully implemented but never battle-tested:

| Component                      | Status | Location                                                   |
| ------------------------------ | ------ | ---------------------------------------------------------- |
| `AgentInstance` Prisma model   | Built  | `packages/database/prisma/schema.prisma`                   |
| `InstanceChannelBinding` model | Built  | Same file                                                  |
| Instance CRUD API              | Built  | `apps/agent/src/app/api/instances/`                        |
| Instance MCP tools             | Built  | `packages/agentc2/src/tools/instance-tools.ts`             |
| Channel binding API            | Built  | `apps/agent/src/app/api/instances/[id]/bindings/route.ts`  |
| Settings UI (org-wide)         | Built  | `apps/agent/src/app/settings/instances/page.tsx`           |
| Agent-scoped instances UI      | Built  | `apps/agent/src/app/agents/[agentSlug]/instances/page.tsx` |
| Slack routing via bindings     | Built  | `apps/agent/src/app/api/slack/events/route.ts`             |
| Memory namespace isolation     | Built  | `apps/agent/src/lib/agent-instances.ts`                    |
| Instruction override injection | Built  | `packages/agentc2/src/agents/resolver.ts`                  |
| Template interpolation         | Built  | Same file -- `{{instance.name}}`, `{{instance.context.*}}` |

---

## Increment 0: Prove Instances Work (with Real Prospects)

**Goal:** Create the deal-agent master, spin up 3 instances for real insulation companies, bind to Slack, prove isolation and inheritance work.

### 0A. Create the Master Agent (in Appello)

- **Slug:** `deal-agent`
- **Model:** `gpt-4o`
- **deploymentMode:** `"multi-instance"`
- **Memory:** enabled
- **Tools:** HubSpot MCP tools (contacts, deals, companies, activities)
- **Instructions template:**

```
You are {{instance.name}}, a dedicated sales development agent for Appello.

You are responsible for managing the relationship with {{instance.context.companyName}}.

## Company Context
- **Company:** {{instance.context.companyName}}
- **Industry:** {{instance.context.industry}}
- **Key Contact:** {{instance.context.keyContact}}
- **Notes:** {{instance.context.notes}}

## Your Role
- You own this deal end-to-end
- Research the prospect and their company
- Track all interactions and outreach in HubSpot
- Recommend next actions based on engagement signals
- Communicate with the Appello team via this Slack channel

When asked about your identity, state your name and which company you manage.
When asked for a status update, check HubSpot for the latest deal state and activity.
```

### 0B. Create 3 Instances (Real Companies)

| Instance         | Slug               | Context                                                                                                                            |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Vanos Deal Agent | `deal-agent-vanos` | `{ companyName: "Vanos Insulations", industry: "Insulation contractor", keyContact: "TBD", notes: "Target prospect for Appello" }` |
| Owens Deal Agent | `deal-agent-owens` | `{ companyName: "Owens Insulation", industry: "Insulation contractor", keyContact: "TBD", notes: "Target prospect for Appello" }`  |
| Rival Deal Agent | `deal-agent-rival` | `{ companyName: "Rival Insulation", industry: "Insulation contractor", keyContact: "TBD", notes: "Target prospect for Appello" }`  |

Each gets an auto-generated `memoryNamespace` for isolation.

### 0C. Slack Channels (in Appello Workspace)

Create 3 channels and invite the bot:

- `#deal-vanos` -- bound to `deal-agent-vanos` instance
- `#deal-owens` -- bound to `deal-agent-owens` instance
- `#deal-rival` -- bound to `deal-agent-rival` instance

All bindings set with `triggerOnAllMessages: true` so the agent responds to every message in its channel.

### 0D. Validation Tests

| Test                   | Action                                                 | Expected Result                                       |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| **Identity isolation** | Ask "Who are you?" in each channel                     | Each agent identifies itself with the correct company |
| **Memory isolation**   | Tell Vanos agent a fact, ask Owens agent for it        | Owens has no knowledge of Vanos's fact                |
| **Master inheritance** | Update master agent instructions, message all channels | All 3 instances reflect the change                    |
| **Instance overrides** | Add `instructionOverrides` to Vanos instance           | Only Vanos behavior changes                           |
| **Slack threading**    | Start and continue a thread in `#deal-vanos`           | Agent maintains context within the thread             |

**Success = all 5 tests pass.** This proves the foundation works.

---

## Increment 1: The Heartbeat (Agent Thinks Autonomously)

**Goal:** The deal agent wakes itself up on a schedule, reads HubSpot, and reports assessments in its Slack channel.

### What to Build

- **Inngest cron function** (`deal-agent/heartbeat`): runs every 4 hours
    - Queries HubSpot for all active deals linked to deal-agent instances
    - For each instance, invokes the deal agent with: "Check the current state of the deal with {{companyName}}. Review HubSpot for any new activity. Post your assessment and recommended next action."
    - Agent responds in its bound Slack channel
- **HubSpot deals:** Create actual deals in HubSpot for Vanos, Owens, Rival
    - Custom property `agentInstanceSlug` links deal to instance
    - Pipeline stages: Researching > ICP Qualified > Outreach Planning > Mail/Email/Phone Sent > Awaiting Response > Engaged > Demo Scheduled

### What to Test

- Let the heartbeat run overnight with 3 deals
- Check Slack the next morning: each channel should have a status update
- Agent should read real HubSpot data and reason about next steps
- Agent is advisory only at this point -- no real outreach actions

---

## Increment 2: Email Outreach

**Goal:** The deal agent can draft and send personalized outreach emails.

### What to Build

- **Email tool** for the deal agent (via Gmail OAuth integration or new SendGrid/Resend tool)
- **Human approval gate** (optional): agent drafts email, posts preview in Slack channel, waits for team to approve before sending
    - Could be as simple as: agent posts "I'd like to send this email to [contact]. React with :white_check_mark: to approve."
    - Approval reaction triggers send
- **HubSpot activity logging:** agent logs each email as an activity on the deal
- **Reply handling:** for now, manual -- team forwards replies into the Slack channel, agent incorporates context

### What to Test

- In `#deal-vanos`, tell the agent: "Draft an introductory email to the key contact"
- Agent researches Vanos, drafts a personalized email, posts preview in Slack
- Team approves, email sends, activity logged in HubSpot
- Deal stage moves to "Email Sent"

---

## Increment 3: Direct Mail Pipeline

**Goal:** The deal agent can trigger a direct-mail workflow that generates a personalized letter, gets human proofing, and confirms mailed.

### What to Build

- **`direct-mail` workflow** in AgentC2 with steps:
    1. `letter-gen` (agent step) -- generate personalized letter content using deal context
    2. `label-gen` (transform step) -- format mailing label from contact address
    3. `proof-review` (human step) -- review letter + label, approve or revise
    4. `print-confirm` (human step) -- confirm printed, packed, and mailed
- **Deal agent integration:** agent can trigger this workflow for its deal
- **Slack notifications:** human steps post to the deal's Slack channel for approval
- **HubSpot update:** after mail confirmed, deal stage moves to "Mail Sent"

### What to Test

- In `#deal-owens`, tell the agent: "Initiate a direct mail campaign to Owens Insulation"
- Agent triggers the workflow, letter + label generated
- Team reviews in the AgentC2 UI or Slack, approves
- Team prints, packs, mails, confirms in UI
- HubSpot deal updated

---

## Increment 4: Multi-Channel Sequencing

**Goal:** The deal agent adaptively chooses and sequences across email, direct mail, and phone based on prospect signals.

### What to Build

- **Phone/SMS capability** via JustCall MCP (call logging, SMS sending)
- **Adaptive strategy logic** in agent instructions:
    - Has physical address + high deal value? Start with mail, then email follow-up
    - Email opened but no reply? Escalate to phone
    - No engagement after 2 weeks? Try a different channel
    - Already engaged via one channel? Don't interrupt with another
- **Event-driven triggers:** email open/click webhooks wake the agent outside the heartbeat
- **Outreach history tracking:** agent memory stores full outreach timeline per deal

### What to Test

- Create deals with different prospect profiles
- Let agents decide their own strategies
- Verify agents escalate channels when there's no response
- Verify agents don't double-up channels when engagement is working

---

## Increment 5: Scale + Batch Operations

**Goal:** Handle hundreds of deals with efficient human operations.

### What to Build

- **List Builder Agent:** separate agent that researches prospects matching ICP criteria, creates deals in HubSpot, spawns deal-agent instances automatically
- **Batch approval UI:** dashboard grouping pending human tasks across all deals:
    - "12 letters awaiting proof review" (approve all or individually)
    - "8 deals ready for phone outreach" (show scripts, mark completed)
- **Auto-instance creation:** when a new HubSpot deal is created with a specific label/stage, automatically create a deal-agent instance + Slack channel + binding
- **Scale testing:** run with 100+ concurrent deals, tune heartbeat frequency, measure costs

### What to Test

- List Builder creates 20 new prospects
- Each automatically gets an instance, Slack channel, and HubSpot deal
- Agents start working autonomously
- Human batches approvals efficiently
- System runs for a week without intervention

---

## Architecture Summary

```
                    ┌─────────────────────────────┐
                    │    List Builder Agent        │
                    │  (batch prospect creation)   │
                    └──────────┬──────────────────┘
                               │ creates deals in HubSpot
                               │ spawns instances
                               v
┌──────────────────────────────────────────────────────────┐
│                  Deal Agent (Master)                      │
│                                                          │
│  One definition. Thousands of instances.                 │
│  Each instance = HubSpot deal + memory thread + Slack ch │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ Vanos        │ │ Owens        │ │ Rival        │     │
│  │ Instance     │ │ Instance     │ │ Instance     │     │
│  │ #deal-vanos  │ │ #deal-owens  │ │ #deal-rival  │     │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘     │
│         │                │                │              │
│         v                v                v              │
│  ┌────────────────────────────────────────────────┐      │
│  │            Workflow Library                     │      │
│  │  - Direct Mail Pipeline                        │      │
│  │  - Email Sequence                              │      │
│  │  - Phone Outreach                              │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  Inngest heartbeat wakes all instances periodically      │
│  Event triggers wake instances on engagement signals     │
└──────────────────────────────────────────────────────────┘
                               │
                               v
                    ┌──────────────────────┐
                    │   HubSpot CRM        │
                    │   Source of truth     │
                    │   Pipeline stages     │
                    │   Activity log        │
                    └──────────────────────┘
```

---

## Sprint Estimates

| Increment               | Effort    | Deliverable                                                 |
| ----------------------- | --------- | ----------------------------------------------------------- |
| 0: Prove instances work | 1-2 days  | 3 deal agents in Slack, isolated and inheriting from master |
| 1: Heartbeat + HubSpot  | 2-3 days  | Agents wake up autonomously, post status to Slack           |
| 2: Email outreach       | 3-5 days  | Agents draft + send emails with human approval              |
| 3: Direct mail pipeline | 3-5 days  | End-to-end letter workflow with human proofing              |
| 4: Multi-channel        | 5-7 days  | Adaptive channel sequencing with phone/SMS                  |
| 5: Scale + batch        | 5-10 days | Auto-provisioning, batch approvals, 100+ deals              |

**Total: ~3-5 weeks to full system**, with a working demo after every increment.

---

## Known Gaps to Watch For

1. **`instance-get` by slug is not org-scoped** -- could leak instances across orgs (fix before prod)
2. **Instance Slack identity** -- instances inherit master agent's display name/icon. Each deal agent should ideally show as "Vanos Deal Agent" etc. in Slack. May need to extend instance metadata with Slack identity overrides.
3. **Binding cache TTL is 1 minute** -- first message after binding creation may not route correctly; wait 60s or call `invalidateBindingCache()`
4. **Email provider** -- Gmail OAuth exists but may need SendGrid/Resend for bulk sending + tracking
5. **Auto-channel creation** -- Slack API can create channels programmatically (`conversations.create`), but need to build this into the instance provisioning flow for Inc 5
