---
name: Onboarding Optimization Plan
overview: Deep audit of the current 8-step onboarding flow, comparison against best-in-class SaaS patterns, and a redesign plan to get users to their "aha moment" in under 60 seconds across all user scenarios (first-in-org, invite join, domain match, separate org).
todos:
    - id: intent-step
      content: Build IntentStep component (use case selection + optional tool checklist) to replace Welcome, Template, Configure, and Tools steps
      status: pending
    - id: team-welcome
      content: Build TeamWelcomeStep component for users joining existing orgs (shows existing agents, skip to chat)
      status: pending
    - id: auto-create-api
      content: Build POST /api/onboarding/auto-create-agent API route that maps use case to agent with smart defaults
      status: pending
    - id: rewrite-onboarding-page
      content: Rewrite onboarding/page.tsx to use 2-step flow (IntentStep -> redirect to CoWork chat) with scenario branching
      status: pending
    - id: setup-guide
      content: Build persistent SetupGuide checklist component (connect integration, invite teammate, create workflow, etc.)
      status: pending
    - id: contextual-integration-prompts
      content: Add contextual integration suggestion UI when agent encounters tasks needing unconnected tools
      status: pending
    - id: db-schema-updates
      content: Add onboardingIntent and setupGuideState fields to Membership model
      status: pending
    - id: cleanup-old-steps
      content: Remove or archive deprecated onboarding step components (IntegrationsStep, ToolStep, ConfigureStep, TemplateStep, TestStep, SuccessStep)
      status: pending
isProject: false
---

# Onboarding Optimization: Audit and Redesign

## Current Flow: Step-by-Step Documentation

The onboarding lives in `[apps/agent/src/app/onboarding/page.tsx](apps/agent/src/app/onboarding/page.tsx)` with 8 step components in `[apps/agent/src/components/onboarding/](apps/agent/src/components/onboarding/)`.

### Current Step Sequence (8 steps)

```
Sign Up --> Bootstrap Org --> /onboarding
                                  |
                          1. Join Org (conditional)
                          2. Welcome
                          3. Template
                          4. Configure
                          5. Integrations
                          6. Tools
                          7. Test
                          8. Success
```

- **Step 1 - Join Org** (conditional): Only shown if user's email domain matches an existing `OrganizationDomain`. User chooses: join existing org or create own. If no match, org is silently auto-created.
- **Step 2 - Welcome**: Feature overview (Agents, Workflows, Networks, Integrations). Has "Skip to dashboard" escape hatch.
- **Step 3 - Template**: Choose from 5 templates (General Assistant, Customer Support, Research Assistant, Data Analyst, Start from Scratch).
- **Step 4 - Configure**: Set agent name, description, model provider/name, edit instructions. Requires decisions the user is not yet equipped to make.
- **Step 5 - Integrations**: Shows 10 MCP servers with connected/not-connected status. For first-in-org users, ALL show "Not connected" -- this step is pure friction.
- **Step 6 - Tools**: Select tools from system tools + MCP tools. System tools (6 basic ones) are the only options for users without integrations.
- **Step 7 - Test**: Creates the agent, provides a mini chat interface with suggested messages. This is the first "aha moment."
- **Step 8 - Success**: Confirmation screen with "What's next?" links.

### Backend Flow

- **Bootstrap** (`[packages/auth/src/bootstrap.ts](packages/auth/src/bootstrap.ts)`): Invite code -> domain match -> create new org
- **Confirm Org** (`POST /api/auth/confirm-org`): Handles join vs create decision
- **Onboarding Status** (`GET /api/onboarding/status`): Checks `membership.onboardingCompletedAt`
- **Complete** (`POST /api/onboarding/complete`): Sets `onboardingCompletedAt` timestamp
- **State Persistence**: `localStorage` key `agentc2_onboarding_state` survives refreshes

### User Scenarios

- **Scenario A - First in org**: Sign up -> auto-create org -> 7 steps (no Join Org) -> dashboard
- **Scenario B - Invited via code**: Sign up with `?invite=CODE` -> join org via code -> 7 steps -> dashboard
- **Scenario C - Domain match, joins**: Sign up -> domain match found -> Join Org step -> join -> 7 steps -> dashboard
- **Scenario D - Domain match, creates own**: Sign up -> domain match found -> Join Org step -> create own -> 7 steps -> dashboard

---

## Audit: What is Wrong

### Critical Issues

**1. Too many steps (8 steps, best-in-class is 3-4)**
Every additional step increases drop-off by 20-30%. The current flow requires 7 clicks minimum to reach the first "aha moment" (testing the agent).

**2. Integrations step is dead weight for new users**
For Scenario A (first in org -- the most common new-user path), every integration shows "Not connected." The user sees a wall of disconnected services with no ability to connect them from this screen. This is demoralizing, not motivating.

**3. Configure step demands expertise the user doesn't have**
Asking a new user to pick between "GPT-4o" and "Claude Sonnet 4", name their agent, and edit system instructions is premature. They haven't even used the product yet. This is like asking someone to configure their car's engine before they've taken a test drive.

**4. Tools step is confusing without context**
New users see 6 system tools (calculator, web-fetch, memory-recall, json-parser, date-time, generate-id) and must decide which to enable. These mean nothing to someone who hasn't used an AI agent before.

**5. No personalization of the experience**
We never ask: "What's your role?" "What are you trying to accomplish?" "What tools does your team use?" This means everyone gets the same generic flow regardless of whether they're a sales rep wanting CRM automation or an engineer wanting code review.

**6. The "aha moment" is delayed to Step 7**
Users must click through 6 screens before they can actually interact with an agent. Best-in-class SaaS gets users to value in under 60 seconds.

**7. Welcome step is mostly filler**
The 4-feature overview (Agents, Workflows, Networks, Integrations) is marketing copy, not onboarding. It doesn't help the user accomplish anything.

**8. Template names are generic and don't connect to outcomes**
"General Assistant" and "Research Assistant" don't tell users what they'll actually be able to DO. Outcome-oriented framing ("Automate my CRM updates", "Summarize my meetings") would be far more compelling.

**9. Skipping lands you in an empty dashboard**
The "Skip to dashboard" button on the Welcome step completes onboarding without creating an agent, leaving the user on an empty chat page with no agents to talk to (only SYSTEM/DEMO agents).

**10. No different path for users joining existing orgs**
Users joining via invite or domain match go through the exact same 7-step agent creation flow. But they already have access to their team's agents! They should be shown existing resources, not forced to create a new agent.

### Minor Issues

- No progress indicator on Welcome or Test steps
- No ability to go back and change template selection without losing configure data
- Test step uses a separate mini-chat instead of the full CoWork chat interface
- Success step CTA "Go to Workspace" is the same as "Chat with your agent" -- redundant
- localStorage persistence means stale state can linger across sessions

---

## Best-in-Class SaaS Onboarding Patterns

| Product     | Steps to Value | Key Pattern                                             |
| ----------- | -------------- | ------------------------------------------------------- |
| **Slack**   | 3              | Name workspace -> invite -> pick channels -> chatting   |
| **Linear**  | 3-4            | Workspace name -> import/create project -> start using  |
| **Notion**  | 2-3            | Pick use case -> template auto-applied -> start editing |
| **Vercel**  | 2              | Connect git repo -> deploy -> live site                 |
| **Retool**  | 2-3            | Connect data source -> auto-generate app -> customize   |
| **Figma**   | 1-2            | Quick interactive tutorial -> start designing           |
| **ChatGPT** | 0              | Sign up -> immediately chatting                         |

### Common Principles

1. **Value first, customization later** -- Let users experience the product before asking them to configure it
2. **Smart defaults over choices** -- Auto-select the best option; let users change later
3. **Contextual setup** -- Don't front-load integration setup; prompt when the user hits a moment where they need it
4. **Different paths for different users** -- Solo founders vs team members vs admins need different flows
5. **Progressive disclosure** -- Start simple, reveal complexity as users grow

---

## Proposed Redesign

### Design Principles

1. **0 to value in under 60 seconds** -- Users should be chatting with an agent before they've made a single configuration decision
2. **Auto-create, don't ask** -- Pick sensible defaults; let users customize later
3. **Contextual integration setup** -- Show integration prompts when the agent needs them, not upfront
4. **Different paths for different scenarios** -- First-in-org vs joining existing org are fundamentally different experiences
5. **The product IS the onboarding** -- Instead of a separate wizard, drop users into the real product with guided prompts

### New Flow: Scenario A (First in Org -- No Integrations)

```
Sign Up
  |
  v
Step 1: "What brings you here?" (single screen)
  - Pick a use case: "Automate sales workflows" / "Research and summarize" /
    "Support my team" / "I'll figure it out"
  - Optional: "What tools does your team use?" (checkboxes: Slack, HubSpot, Jira, Gmail, etc.)
  |
  v
Step 2: Instant Agent + Chat (aha moment)
  - Auto-create an agent based on use case selection (smart defaults, no config needed)
  - Drop directly into CoWork chat with the agent
  - Agent greets user with a contextual prompt based on their use case
  - Floating "Setup Guide" checklist in corner (non-blocking)
  |
  v
[Post-onboarding, contextual]
  - When user asks agent something that needs an integration:
    Agent says "I can do that if you connect HubSpot. [Connect now]"
  - Setup Guide checklist: "Connect your first integration" / "Invite a teammate" / "Create a workflow"
```

**Total clicks to value: 2 (sign up + pick use case)**

### New Flow: Scenario B (Joining via Invite)

```
Sign Up with ?invite=CODE
  |
  v
Step 1: "Welcome to [Org Name]!"
  - Show team's existing agents and what they do
  - "Your team has 3 agents ready to use"
  - CTA: "Start chatting" (drops into CoWork with team's agents available)
  - Secondary: "Or create your own agent"
  |
  v
[In product]
  - Full access to team agents immediately
  - Setup Guide: "Create your first agent" / "Explore integrations"
```

**Total clicks to value: 1 (start chatting)**

### New Flow: Scenario C (Domain Match -- Joins Existing Org)

```
Sign Up
  |
  v
Step 1: "Your team is already on AgentC2"
  - Show org name, member count, agent count
  - CTA: "Join [Org Name]" / "Create my own workspace"
  |
  v
[If joins] -> Same as Scenario B
[If creates own] -> Same as Scenario A
```

### New Flow: Scenario D (Domain Match -- Creates Own Org)

Same as Scenario A after the org decision.

### Implementation Architecture

#### Step 1: Intent Capture (replaces Welcome + Template + Configure)

Single screen with:

- Use case selector (3-4 large cards with outcomes, not roles)
- Optional tool checklist (what do you already use?)
- "Get Started" button

This replaces 4 current steps (Welcome, Template, Configure, Tools) with a single intent signal that feeds smart defaults.

#### Step 2: Instant Agent (replaces Test + Success)

- Auto-create agent with smart defaults based on intent:
    - Use case maps to instructions template, model selection, and default tools
    - Agent name auto-generated (e.g., "Sales Autopilot", "Research Hub")
    - Model: GPT-4o (safe default)
    - Tools: Core tools always included + use-case-specific tools
- Redirect to the REAL CoWork chat (not a mini chat)
- Agent sends a contextual first message based on use case
- Onboarding marked complete on first successful agent response

This eliminates the artificial "test in a box" step and the redundant success screen.

#### Contextual Integration Prompts (replaces Integrations step entirely)

Instead of showing all integrations upfront:

- When a user asks the agent something that could benefit from an integration, the agent (or UI) suggests connecting it
- Example: "Summarize my latest deals" -> "Connect HubSpot to access your CRM data. [Set up HubSpot]"
- A persistent but non-blocking "Setup Guide" checklist tracks integration progress

#### Post-Onboarding Setup Guide

A collapsible checklist that persists across sessions:

- Connect your first integration
- Invite a teammate
- Create a custom agent
- Build your first workflow
- Set up a Slack channel

Progress bar fills as items complete. Dismissible after all done or manually.

### Use Case -> Agent Mapping

| Use Case                   | Agent Name        | Instructions Focus                          | Default Tools                         | Suggested Integrations                |
| -------------------------- | ----------------- | ------------------------------------------- | ------------------------------------- | ------------------------------------- |
| "Automate sales workflows" | Sales Autopilot   | CRM management, deal tracking, lead scoring | calculator, web-fetch, memory-recall  | HubSpot, Gmail, Slack                 |
| "Research and summarize"   | Research Hub      | Deep research, synthesis, citation          | web-fetch, json-parser, memory-recall | Firecrawl, Fathom, Google Drive       |
| "Support my team"          | Team Assistant    | Task management, communication, scheduling  | date-time, memory-recall, web-fetch   | Jira, Slack, GitHub                   |
| "I'll figure it out"       | General Assistant | Versatile helper                            | calculator, web-fetch, date-time      | (suggest based on first interactions) |

---

## File Changes Required

### Modified Files

- `[apps/agent/src/app/onboarding/page.tsx](apps/agent/src/app/onboarding/page.tsx)` -- Rewrite step flow to 2 steps
- `[apps/agent/src/app/onboarding/layout.tsx](apps/agent/src/app/onboarding/layout.tsx)` -- Simplify layout
- `[apps/agent/src/components/onboarding/WelcomeStep.tsx](apps/agent/src/components/onboarding/WelcomeStep.tsx)` -- Replace with IntentStep
- `[packages/auth/src/bootstrap.ts](packages/auth/src/bootstrap.ts)` -- Add auto-agent creation on org bootstrap

### New Files

- `apps/agent/src/components/onboarding/IntentStep.tsx` -- Use case selection + optional tool checklist
- `apps/agent/src/components/onboarding/TeamWelcomeStep.tsx` -- For users joining existing orgs (shows existing agents)
- `apps/agent/src/components/SetupGuide.tsx` -- Persistent post-onboarding checklist
- `apps/agent/src/app/api/onboarding/auto-create-agent/route.ts` -- Smart agent auto-creation from use case

### Removed/Deprecated Steps

- `IntegrationsStep.tsx` -- Removed from onboarding (integrations are contextual now)
- `ToolStep.tsx` -- Removed from onboarding (tools auto-selected from use case)
- `ConfigureStep.tsx` -- Removed from onboarding (configuration happens post-creation)
- `TemplateStep.tsx` -- Replaced by IntentStep (use cases, not templates)
- `TestStep.tsx` -- Replaced by dropping into real CoWork chat
- `SuccessStep.tsx` -- Replaced by in-product Setup Guide

### Database Changes

- Add `onboardingIntent` field to `Membership` model (stores selected use case for analytics)
- Add `setupGuideState` JSON field to `Membership` (tracks checklist progress)
- Consider adding `isFirstAgent` flag to `Agent` model (to identify onboarding-created agents)

---

## Migration Strategy

1. **Phase 1**: Build the new IntentStep and auto-agent-creation API alongside existing steps (feature flagged)
2. **Phase 2**: Build the SetupGuide component and contextual integration prompts
3. **Phase 3**: Wire up the new flow end-to-end behind a feature flag
4. **Phase 4**: A/B test new vs old flow (measure completion rate, time-to-value, 7-day retention)
5. **Phase 5**: Roll out to all users, deprecate old steps

---

## Success Metrics

- **Time to first agent interaction**: Target under 60 seconds (currently 3-5 minutes)
- **Onboarding completion rate**: Target 90%+ (measure against current baseline)
- **Integration connection rate within 7 days**: Target 40%+ (currently likely low given the dead-weight Integrations step)
- **Agent creation rate**: Target 95%+ (auto-creation ensures this)
- **7-day retention**: Measure improvement from faster time-to-value
