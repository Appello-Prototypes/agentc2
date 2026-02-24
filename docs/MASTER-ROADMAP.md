# AgentC2 Master Roadmap

> Generated: February 23, 2026
> Source: Full analysis of today's Fathom meetings + past 60 days of meetings + deep codebase research

---

## How to Use This Document

Each item includes: what it is, why it matters, effort, dependencies, and a link back to the detailed plan. Work top to bottom. Do not skip tiers — later tiers have dependencies on earlier ones.

**Effort key:** XS = 1-2 days | S = 3-5 days | M = 1-2 weeks | L = 3-4 weeks | XL = 6-8 weeks

---

## Tier 1 — Do This Week

> Quick wins, sprint commitments, and deal-unblocking commercial tracks that can start immediately.

---

### 1. Release 1.31: "Appello Intelligence" Embed

**Effort:** XS (2 days) | **Dependencies:** None

**What:** Deploy the existing embed-v2 inside the Appello customer app for Thomas Kanata. The embed is already fully built. This is pure configuration and wiring.

**Why:** Committed deliverable for Release 1.31. Thomas Kanata specifically requested "Agent C2 chat" as part of the enterprise contract completion. Delays this sprint delay invoicing.

**Steps:**

1. Create `appello-intelligence` agent in the Appello workspace with appropriate tools and instructions for a construction field operations assistant
2. Set `visibility: "PUBLIC"`, generate a `publicToken`, configure `metadata.publicEmbed` (greeting, theme dark, disable signupCTA, disable poweredByBadge)
3. Embed via `<iframe src="https://agentc2.ai/embed-v2/appello-intelligence?token=...">` in the Appello app
4. Test with a Thomas Kanata team member

**Files:** `apps/agent/src/app/embed-v2/[slug]/page.tsx` (no changes), Appello frontend codebase

---

### 2. Sales Meeting Follow-up Agent

**Effort:** S (5 days) | **Dependencies:** None — all infrastructure exists

**What:** A DB agent (`sales-meeting-followup`) that fires automatically after every Fathom meeting with an external attendee. It parses the transcript, updates HubSpot, creates Jira tickets for commitments, and drafts the follow-up email — then posts everything to a Slack channel for review.

**Why:** Nathan is doing this manually with Cursor for every single external meeting. It's one of the most repeated manual tasks in the business. The Fathom webhook is already built, the `MeetingTranscript` model exists, the `agent/trigger.fire` Inngest event fires — the only missing piece is the agent itself.

**Steps:**

1. Create DB agent record `sales-meeting-followup` with full instructions, HubSpot/Jira/Slack tools, Opus model, $2.00 budget cap
2. Add filter logic in the Fathom webhook route: only fire trigger when `calendar_invitees_domains_type === "one_or_more_external"` and `summaryText` is non-null
3. Create `AgentTrigger` record linking the Fathom `IntegrationConnection` → this agent, `eventName: "fathom.transcript.received"`
4. Enrich the trigger payload with full `transcriptText` and `summaryText` from the `MeetingTranscript` record
5. Add deal-stage signal classifier in agent instructions (detects "proposal", "contract", "signed", "not a fit")
6. Test end-to-end with a real Fathom meeting

**Files:** `apps/agent/src/app/api/integrations/fathom/webhook/route.ts`, new agent DB record

---

### 3. n8n Instance-Level MCP Upgrade

**Effort:** XS (1 day) | **Dependencies:** n8n admin access to generate an MCP API key

**What:** Switch the Atlas connection from a single-workflow SSE endpoint (currently exposing only 1 tool: `atlas_Query_ATLAS`) to the n8n instance-level MCP server, which automatically exposes every workflow flagged as "Available in MCP" as a callable tool.

**Why:** The current connection is nearly useless — one tool, fire-and-forget. The instance-level MCP turns every n8n workflow into a proper agent tool with its own name, description, and input schema, with zero per-workflow configuration required. This is a 1-day change with massive capability unlock.

**Steps:**

1. In n8n: Settings → Instance-level MCP → Enable → Generate API key → copy `https://useappello.app.n8n.cloud/mcp-server/http`
2. For each existing n8n workflow that should be callable: open workflow → enable "Available in MCP"
3. Update `mcp/client.ts` `case "atlas"` to detect `N8N_INSTANCE_MCP_URL` and use HTTP transport with Bearer token instead of supergateway SSE
4. Add `N8N_INSTANCE_MCP_URL` and `N8N_MCP_API_KEY` to the `atlas` IntegrationProvider `configJson.requiredFields`
5. Test: list tools from the new endpoint, verify all enabled workflows appear

**Files:** `packages/agentc2/src/mcp/client.ts` line ~3007, `.env`, n8n settings

---

### 4. Contact Trimble for Vista API Access (Commercial Track)

**Effort:** XS (1 hour) | **Dependencies:** None

**What:** Initiate the Trimble App Xchange API access purchase for the ProElectric Vista ERP integration. This is a commercial/procurement step, not a development step — but it gates Plan 9 (Vista MCP build) which gates the $95k ProElectric deal.

**Why:** The Vista API requires purchasing access through Trimble App Xchange. There is no free tier or sandbox. The sales cycle takes 1-2 weeks. Every day this isn't started is a day of delay on the ProElectric deal. Start the clock now while development happens on other plans.

**Steps:**

1. Contact Trimble sales at app.trimble.com to initiate App Xchange API access for ProElectric's Vista instance
2. Clarify required endpoint modules: Job Cost, AP, GL, PO, Employee, Payroll, Subcontract Ledger
3. Obtain consumer key + consumer secret once approved
4. Unblock Plan 9

---

## Tier 2 — This Sprint (Weeks 1-2)

> High-ROI work with short setup time. Some have hard deadlines.

---

### 5. NetSuite MCP — Install, Configure, Taurus Demo

**Effort:** M (1 week) | **Dependencies:** Taurus NetSuite credentials | **Hard deadline:** March 11 proposal review

**What:** Install the existing `manateeit/netsuite-mcp-v3` MCP server, register NetSuite as an `IntegrationProvider` in Agent C2, connect to Taurus's live NetSuite instance, and build a live demo for the March 11 proposal meeting showing Appello ↔ NetSuite data bridging.

**Why:** The Taurus Insulation deal has a hard deadline — their NetSuite FSM contract expires April 30. March 11 is the proposal review. Showing a live NetSuite integration demo before that meeting is the difference between winning and losing the deal. Unlike Vista, a NetSuite MCP server already exists and can be running in hours.

**Steps:**

1. `npm install manateeit/netsuite-mcp-v3` — test locally with Taurus credentials (OAuth 1.0a: Account ID, Consumer Key, Consumer Secret, Token ID, Token Secret from their NetSuite admin panel)
2. Register `netsuite` as `IntegrationProvider` in DB seed with all 5 credential fields
3. Build credential setup UI at `/apps/agent/src/app/mcp/netsuite/setup/`
4. Create "NetSuite Sync" agent with SuiteQL queries for: jobs by customer, cost actuals, GL accounts, open invoices
5. Build the March 11 demo: Taurus open jobs in NetSuite → mapped to Appello job records → cost variance report → workflow diagram (Appello work order → approved → syncs to NetSuite)
6. Post-deal: build the Zapier replacement workflow that eliminates CompanyCam → Zapier → NetSuite in favor of Appello → NetSuite direct

**Files:** New `scripts/mcp-servers/netsuite/`, new `packages/agentc2/src/mcp/api-clients/netsuite.ts`, DB seed

---

### 6. Sales Meeting Prep Agent

**Effort:** S (5 days) | **Dependencies:** Google Calendar push notification setup

**What:** A DB agent (`sales-meeting-prep`) that fires 30 minutes before every scheduled meeting with an external attendee. Pulls HubSpot CRM context, prior Fathom meeting summaries, and open Jira issues. Generates a one-page briefing and sends it as a Slack DM to the Appello team member who has the meeting.

**Why:** Nathan and Corey were both in the Sales GS&R agreeing that every external meeting should start with a one-page brief. Currently this is done manually with Cursor. This automates it. Works in tandem with the follow-up agent (Plan 2) to create a complete meeting intelligence loop.

**Steps:**

1. Create DB agent `sales-meeting-prep` with instructions, HubSpot + Fathom + Jira + Slack + Google Calendar tools, Sonnet model
2. Build `apps/agent/src/app/api/integrations/google-calendar/webhook/route.ts` — Google Calendar push notifications that fire when an event is starting in 30 min with external attendees (modeled on Fathom webhook)
3. Create `AgentTrigger` record linking Google Calendar connection → this agent
4. Add Slack DM delivery: look up Appello team member's Slack user ID via `slack_lookup_user_by_email`, send formatted brief as DM
5. Test: create a dummy calendar event with an external attendee 35 minutes out, verify brief arrives

**Files:** New `apps/agent/src/app/api/integrations/google-calendar/webhook/route.ts`, new agent DB record

---

### 7. n8n REST API Client

**Effort:** M (1 week) | **Dependencies:** n8n API key (from Plan 3)

**What:** Replace the current `AtlasApiClient` (which has 2 stub tools) with a full n8n REST API client exposing 6 real tools: `n8n_list_workflows`, `n8n_get_workflow`, `n8n_trigger_workflow`, `n8n_get_executions`, `n8n_get_execution`, `n8n_activate_workflow`.

**Why:** With these tools, agents can discover what n8n automations exist, trigger them intelligently, check if they succeeded, and respond accordingly. This is what makes Agent C2 the orchestrator of n8n — not just a blind webhook caller.

**Steps:**

1. Rewrite `packages/agentc2/src/mcp/api-clients/atlas.ts` with full REST API implementation against `https://useappello.app.n8n.cloud/api/v1/`
2. Auth: `X-N8N-API-KEY` header, stored encrypted alongside `ATLAS_N8N_SSE_URL`
3. Add `N8N_API_KEY` to the `atlas` IntegrationProvider `configJson.requiredFields`
4. Implement all 6 tools with proper pagination (GET /api/v1/workflows, /api/v1/executions, etc.)
5. Register tools in the tool registry so they appear in agent tool assignment

**Files:** `packages/agentc2/src/mcp/api-clients/atlas.ts`

---

### 8. n8n → Agent C2 Callback Route

**Effort:** M (1 week) | **Dependencies:** Plan 7

**What:** A new webhook endpoint `POST /api/integrations/n8n/callback` that n8n workflows call when they complete. Closes the request-response loop: Agent C2 fires n8n → n8n does work → n8n calls back with the result → Agent C2 updates the run with the output.

**Why:** Currently Agent C2 fires n8n and has no idea what happened. The agent cannot check results, cannot react to failures, cannot use n8n output as input to the next step. The callback route fixes this and makes n8n workflows first-class participants in agent reasoning chains.

**Steps:**

1. Create `apps/agent/src/app/api/integrations/n8n/callback/route.ts` — validates request, looks up `triggerEventId` in TriggerEvent, updates status to COMPLETED, fires `n8n.workflow.completed` Inngest event
2. Document the callback payload format: `{ workflowId, executionId, triggerEventId, status, output }`
3. Create a reusable n8n "Agent C2 Callback" node template (HTTP Request node) that any workflow can add at the end
4. Update ATLAS agent instructions to use the callback pattern when triggering workflows
5. Test: trigger a simple n8n workflow from an agent, verify callback arrives and updates the run

**Files:** New `apps/agent/src/app/api/integrations/n8n/callback/route.ts`, `apps/agent/src/lib/inngest-functions.ts`

---

## Tier 3 — Next 30 Days

> Medium-effort items that compound on Tier 1 and 2 work. High strategic value.

---

### 9. Fathom → Sales Intelligence Playbook (First Marketplace Playbook)

**Effort:** S (5 days) | **Dependencies:** Plans 2 and 6 deployed

**What:** Package the Sales Meeting Prep agent (Plan 6) and Sales Meeting Follow-up agent (Plan 2) together into a Playbook — the platform's first published Marketplace listing. Includes the Fathom trigger, Google Calendar trigger, and all four integrations (HubSpot, Jira, Slack, Fathom) as required integrations.

**Why:** This is the proof-of-concept for the entire Playbook marketplace vision. It validates the packaging, deployment, and trust scoring systems. It becomes the flagship demo for Wellness Living, Brice, and investor conversations. Every external meeting at Appello that is already running Plans 2 and 6 generates real execution data that populates the trust score on this listing.

**Steps:**

1. Create Playbook DB record: `fathom-sales-intelligence`, SUBSCRIPTION $49/mo, category "Sales", required integrations: fathom, hubspot, jira, slack, google-calendar
2. Create 4 PlaybookComponent records: AGENT (prep), AGENT (follow-up), TRIGGER (Fathom webhook), TRIGGER (Google Calendar)
3. Verify deploy flow creates AgentTrigger records for trigger-type components (likely needs to be added to `apps/agent/src/app/api/playbooks/[slug]/deploy/route.ts`)
4. Write marketplace listing with real screenshots of the Slack brief and HubSpot note
5. Seed 3 test cases bundled with the playbook
6. Set `pricingModel: FREE` until Plan 17 (Stripe checkout) is live — then upgrade to SUBSCRIPTION $49/mo

**Files:** New DB seed, `apps/agent/src/app/api/playbooks/[slug]/deploy/route.ts`

---

### 10. n8n Workflow Library UI

**Effort:** M (1 week) | **Dependencies:** Plans 7 and 8

**What:** Replace the current generic "ATLAS" setup page (just an SSE URL field) with a full workflow management interface inside Agent C2: browse all workflows, quick-trigger with input params, view execution history, toggle MCP availability, and assign workflows to agents.

**Why:** Right now n8n is a black box from the Agent C2 perspective. This UI makes the n8n workflow library discoverable and manageable from the same interface as everything else. Critical for adoption — users need to see what automations exist before they can use them.

**Steps:**

1. Build `/apps/agent/src/app/mcp/n8n/page.tsx` — fetches workflow list via REST API
2. Workflow cards: name, active/inactive status badge, last execution date, last execution status (✓/✗), tag chips
3. "Run" button → modal with JSON input editor → calls `n8n_trigger_workflow` → shows execution result inline
4. Execution history drawer: click workflow → see last 10 executions with duration and status
5. "Available as Tool" toggle per workflow → calls n8n API to set MCP flag
6. "Assign to Agent" → multi-select agent picker

**Files:** New `apps/agent/src/app/mcp/n8n/page.tsx`

---

### 11. ATLAS Agent Upgrade

**Effort:** XS (2 days) | **Dependencies:** Plans 7 and 8

**What:** Update the `atlas-agent` blueprint in `automation.ts` to use all 6 real REST API tools. Update the agent's instructions to leverage workflow listing, execution status checking, failure diagnosis, and structured output.

**Why:** The current atlas-agent is essentially non-functional. With Plans 7 and 8 complete, upgrading the agent takes 2 days and turns it into a genuinely useful automation orchestrator that any agent in the system can delegate to.

**Steps:**

1. Update `packages/agentc2/src/integrations/blueprints/automation.ts` atlas entry with full instructions
2. Add all 6 REST API tools to the agent's `toolIds`
3. Add execution monitoring pattern: after triggering, poll `n8n_get_execution` until complete, report results
4. Deploy updated agent to the Appello workspace

**Files:** `packages/agentc2/src/integrations/blueprints/automation.ts`

---

### 12. n8n Workflows as Playbook Components

**Effort:** S (3 days) | **Dependencies:** Plans 7 and 9

**What:** Add `N8N_WORKFLOW` as a new `PlaybookComponent` type. When a Playbook containing n8n workflows is deployed to a new org, the deploy route exports the workflow JSON from the source n8n instance and imports it into the target org's n8n instance via the REST API.

**Why:** Makes n8n workflows first-class citizens in the Playbook marketplace. A "Sales Intelligence Suite" Playbook can bundle not just the Agent C2 agents but also the n8n automation workflows they depend on — the buyer gets everything in one click.

**Steps:**

1. Add `N8N_WORKFLOW = "N8N_WORKFLOW"` to PlaybookComponent type enum in schema
2. In deploy route: for N8N_WORKFLOW components, `GET /api/v1/workflows/:id` from source, `POST /api/v1/workflows` to target
3. Validate target org has n8n connected during deploy preflight check
4. Update packaging route to include n8n workflow JSON export in the package manifest

**Files:** `packages/database/prisma/schema.prisma`, `apps/agent/src/app/api/playbooks/[slug]/deploy/route.ts`

---

### 13. B2B White-label — Branding Config

**Effort:** M (1 week) | **Dependencies:** Plan 1 shipped

**What:** Extend the embed config to include white-label branding: `brandName`, `logoUrl`, `primaryColor`, `accentColor`, `hidePoweredBy`, `allowedDomains`, `customCss`. Applied via CSS custom properties in the embed page — no rebuild required per customer.

**Why:** Required for the Wellness Living partnership. Their 7,500 users cannot see "Powered by AgentC2" — they need to see "Wellness Living AI" with Wellness Living's logo and colors. Also needed for any other B2B embed deal (Appello is already doing this for their own customers with Plan 1).

**Steps:**

1. Extend `EmbedConfig` interface in `apps/agent/src/app/embed-v2/[slug]/page.tsx`
2. Apply CSS custom properties based on `whiteLabel` config: `--brand-primary`, `--brand-name`, `--logo-url`
3. Replace all hardcoded "AgentC2" text with the brand name (or hide if `hidePoweredBy: true`)
4. Add `allowedDomains` check in the embed config API route: validate request origin against allowlist
5. Add white-label fields to the agent metadata editor in the Agent C2 UI

**Files:** `apps/agent/src/app/embed-v2/[slug]/page.tsx`, `apps/agent/src/app/api/agents/[id]/embed/route.ts`

---

### 14. B2B White-label — Per-Customer-Org Token API

**Effort:** M (1 week) | **Dependencies:** Plan 13

**What:** New API endpoint `POST /api/embed/tokens` that B2B partners (e.g., Wellness Living's backend) call to generate short-lived signed JWTs for each of their end-customers. Each JWT encodes: agent slug, external user ID, external org ID, scopes, TTL, and passthrough metadata.

**Why:** Wellness Living has 7,500 customers. Each needs their own isolated agent session. Wellness Living's server generates a token per customer, per session — Agent C2 validates the token and provides complete data isolation between Wellness Living's customers. Without this, there is no multi-tenant B2B embed model.

**Steps:**

1. Create `POST /api/embed/tokens` route — validates B2B partner API key, generates signed JWT (using `CREDENTIAL_ENCRYPTION_KEY` as signing secret)
2. Update embed token validation in public chat route to accept both `publicToken` (old) and short-lived JWT (new)
3. JWT payload: `{ agentSlug, externalUserId, externalOrgId, scopes, exp, metadata }`
4. Store `externalUserId` + `externalOrgId` on the conversation thread for isolation
5. Document the API with code samples for Wellness Living's engineering team

**Files:** New `apps/agent/src/app/api/embed/tokens/route.ts`, `apps/agent/src/app/api/agents/[id]/chat/public/route.ts`

---

## Tier 4 — Next 60 Days

> Larger builds, mostly revenue-generating or deal-completing work.

---

### 15. Vista ERP MCP Server Build

**Effort:** L (2-3 weeks) | **Dependencies:** Trimble API credentials (Plan 4 commercial track)

**What:** Build a new Node.js MCP server for Vista by Viewpoint (Trimble Construction One). Priority endpoints: Job Cost, AP Invoices, Purchase Orders, GL Transactions, Subcontract Ledger, Employee Records, Time Entries. Register as an `IntegrationProvider` in Agent C2 with setup UI.

**Why:** Directly unlocks the ProElectric deal: $40k integration fee + $55k/yr SaaS = $95k/yr contract. Vista is the dominant ERP for mid-to-large construction companies — every Vista customer is a potential enterprise deal with the same $40k integration component. This is repeatable revenue.

**Steps:**

1. Once Trimble credentials arrive (from Plan 4): build `scripts/mcp-servers/vista/index.js` with 9 priority tools
2. Auth: `Basic ${Buffer.from(consumerKey:consumerSecret).toString("base64")}`
3. Register `vista` as IntegrationProvider, build setup UI
4. Create "Vista Job Intelligence" agent: actuals vs budget, weekly summaries, natural language job profitability queries
5. Build Appello ↔ Vista sync workflow: timesheets → Vista payroll (daily), Vista jobs → Appello (on-demand), Vista AP invoices → Appello costs (daily)
6. Deliver to ProElectric as the $40k integration deliverable

**Files:** New `scripts/mcp-servers/vista/`, new setup UI, new DB seed entry

---

### 16. NetSuite — Taurus Sync Workflow (Zapier Replacement)

**Effort:** M (2 weeks) | **Dependencies:** Plan 5 live and Taurus deal signed

**What:** Build the Appello-native sync that replaces Taurus's Zapier → NetSuite pipeline. Appello work orders → NetSuite job cost transactions directly, eliminating CompanyCam + Zapier from their stack.

**Why:** This is the core value proposition of the Taurus deal — consolidate from NetSuite ($138k/yr) + CompanyCam + Zapier to Appello + NetSuite (accounting only, ~$50-60k/yr). The Zapier replacement workflow is what makes Appello the FSM layer and reduces Taurus's bill significantly.

**Steps:**

1. Build Mastra workflow: Appello work order approved → `netsuite_create_transaction` with job cost details
2. Build sync: Appello field photos / inspection data → NetSuite document attachment (replaces CompanyCam for basic use cases)
3. Build daily reconciliation: Appello hours → NetSuite `PRTimesheets`
4. Build GL account code sync: NetSuite GL accounts → Appello work order cost categories
5. Test with real Taurus data, document the migration from Zapier

**Files:** New workflow in `packages/agentc2/src/workflows/`

---

### 17. Playbook Monetization — Stripe Connect + ONE_TIME Checkout

**Effort:** M (2 weeks) | **Dependencies:** None (Stripe client already configured in `/apps/admin/src/lib/stripe.ts`)

**What:** Implement Phase 1 and Phase 2 of the Playbook monetization plan:

- Stripe Connect Express onboarding for sellers (org → Stripe Connect account → can receive payouts)
- Stripe Checkout Session for ONE_TIME priced playbooks (15% platform fee, 85% to seller via Connect)

**Why:** The entire Playbook marketplace is scaffolded but cannot process a single payment. The purchase route creates a `PENDING` record and stops. This is the foundational payment layer that everything else builds on. Once live, the first playbook (Plan 9) can be charged at $49/mo.

**Steps:**

1. Build `POST /api/organizations/stripe-connect/onboard` — creates Express account, returns onboarding URL
2. Build `GET /api/organizations/stripe-connect/status` + `POST /api/organizations/stripe-connect/dashboard`
3. Add "Become a Publisher" UI in Settings → Stripe Connect onboarding flow
4. Replace stub in `/api/playbooks/[slug]/purchase/route.ts` with real `stripe.checkout.sessions.create` for ONE_TIME playbooks
5. Set `application_fee_amount` (15%) + `transfer_data.destination` (seller's Connect account ID) on PaymentIntent

**Files:** New `apps/agent/src/app/api/organizations/stripe-connect/`, `apps/agent/src/app/api/playbooks/[slug]/purchase/route.ts`

---

### 18. Playbook Monetization — Subscriptions + Stripe Webhook Handler

**Effort:** M (2 weeks) | **Dependencies:** Plan 17

**What:** Implement Stripe Subscriptions for monthly-priced playbooks, plus the Stripe webhook handler that completes the purchase flow: payment confirmed → `PlaybookPurchase.status = COMPLETED` → deployment auto-triggered.

**Why:** The flagship Fathom Sales Intelligence Playbook (Plan 9) is priced at $49/mo SUBSCRIPTION. Without this, it can only be given away for free. The webhook handler is also the critical piece that makes the purchase → deployment flow automatic (buyer pays → running agent in <60 seconds).

**Steps:**

1. Create Stripe Customer for each buyer org on first purchase
2. Implement `stripe.subscriptions.create` with `application_fee_percent: 15` and `transfer_data`
3. Pre-create `Stripe.Price` objects during the playbook publish flow
4. Build `POST /api/webhooks/stripe` — handle: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `account.updated`
5. On `checkout.session.completed`: auto-trigger playbook deployment (same flow as manual deploy)
6. On `invoice.payment_failed`: suspend `PlaybookInstallation`, notify buyer via Slack/email

**Files:** New `apps/agent/src/app/api/webhooks/stripe/route.ts`, `apps/agent/src/app/api/playbooks/[slug]/purchase/route.ts`

---

## Tier 5 — Next 90 Days

> Platform-building, strategic partnerships, and revenue compounding.

---

### 19. Playbook Monetization — PER_USE Metering + Seller Revenue Dashboard

**Effort:** M (2 weeks) | **Dependencies:** Plans 17 and 18

**What:** Implement per-use billing via Stripe Meters (emit a meter event on each agent run for a PER_USE playbook; Stripe bills monthly based on usage). Build the seller revenue dashboard in Agent C2 settings showing: earnings by playbook, active subscriptions, payout history, Stripe Express dashboard link.

**Why:** The `PER_USE` pricing model maps directly to the "internal agent marketplace" vision from the Sales GS&R meeting — pay per run, not a flat subscription. The seller dashboard is necessary for creator economy adoption — builders need to see their earnings to be motivated to publish more playbooks.

**Steps:**

1. Create Stripe Meter for "agent_runs" events
2. On each agent run for a PER_USE playbook: emit `stripe.billing.meterEvents.create`
3. Build "Publisher" tab in Settings with: monthly earnings chart, playbook-level breakdown, payout schedule, Stripe Express dashboard link
4. Data sourced from `PlaybookPurchase` records + Stripe Balance API

**Files:** `apps/agent/src/lib/inngest-functions.ts` (run completion hook), new Settings tab

---

### 20. Playbook Reviews + Trust Score Wiring

**Effort:** S (1 week) | **Dependencies:** Plans 17 and 18 (reviews only meaningful after real purchases)

**What:** Wire the existing `PlaybookReview` model (rating 1-5, title, body) into the marketplace: prompt buyers for reviews after 30 days, display aggregate ratings on listings, calculate trust score as a weighted formula from rating + success rate + recency.

**Why:** Trust scores are the core differentiation of the AgentC2 marketplace vs. every competitor ("real execution data, not marketing copy"). The model exists but isn't surfaced. Without this, the marketplace listings show no social proof and the trust score is just a placeholder.

**Steps:**

1. 30-day post-install: send Slack/email prompt to buyer asking for rating (1-5) + optional review
2. Review submission: `POST /api/playbooks/[slug]/reviews` → creates `PlaybookReview` record
3. Trust score formula: `(avg_rating × 0.4) + (success_rate × 0.4) + (recency × 0.2)` — recalculate on each new review or execution
4. Display on marketplace listing: star rating, review count, "Verified from real runs" badge
5. Show full review list with reviewer org name (anonymized to industry level) and review text

**Files:** New `apps/agent/src/app/api/playbooks/[slug]/reviews/route.ts`, `apps/agent/src/app/marketplace/[slug]/page.tsx`

---

### 21. B2B White-label — EmbedLicense Model + Usage Metering

**Effort:** L (3 weeks) | **Dependencies:** Plans 13 and 14

**What:** Add the `EmbedLicense` DB model to govern B2B licensing agreements (per-seat, usage-based, flat-fee). Implement quota enforcement in the embed token validation route. Build monthly billing via Stripe that invoices the B2B partner (e.g., Wellness Living) based on their metered usage.

**Why:** Wellness Living has 7,500 users. Plans 13 and 14 let them technically embed Agent C2. This plan is what makes the business relationship viable — quota limits so Wellness Living can't over-consume, billing so AgentC2 gets paid for the usage, and a clean SLA model.

**Steps:**

1. Add `EmbedLicense` model to schema: `licenseeOrgId`, `planType` (per_seat/usage_based/flat_fee), `monthlyFeeUsd`, `seatCount`, `usageLimitCalls`, `allowedDomains`, `stripeSubscriptionId`
2. Add `EmbedUsageEvent` table: record every API call with `externalOrgId`, `externalUserId`, `timestamp`, `agentSlug`
3. Quota enforcement: in embed token validation, check `usageLimitCalls` against this month's `EmbedUsageEvent` count
4. Monthly billing: Stripe Subscription with usage metering per B2B partner
5. Admin dashboard showing per-partner usage, quota utilization, and billing status

**Files:** `packages/database/prisma/schema.prisma`, new admin routes

---

### 22. B2B White-label — JavaScript SDK

**Effort:** M (1 week) | **Dependencies:** Plans 13 and 14

**What:** A drop-in JavaScript SDK (`https://agentc2.ai/sdk/embed.js`) that renders the Agent C2 chat widget using Shadow DOM for style isolation. Partners like Wellness Living add 2 lines of code to their app instead of managing an iframe.

**Why:** The iframe embed works but is technically cumbersome for sophisticated SaaS partners. A proper SDK with a documented API is the standard for B2B widget products (Intercom, Zendesk, Drift all use this pattern). Required for Wellness Living's engineering team to get comfortable with the integration.

**Steps:**

1. Build `apps/agent/src/app/sdk/embed.js` — Shadow DOM component, PostMessage API, configurable via `AgentC2.init({ agent, token, container, theme })`
2. Serve as static asset with long-cache headers
3. Implement PostMessage events: `agentc2:ready`, `agentc2:message`, `agentc2:error`, `agentc2:session-start`
4. Document the SDK API with code samples
5. Test with a sample Wellness Living integration prototype

**Files:** New `apps/agent/src/app/sdk/embed.js`, `apps/agent/src/app/sdk/page.tsx` (docs)

---

### 23. WellnessLiving MCP Integration

**Effort:** L (3-4 weeks) | **Dependencies:** Plans 13, 14, 21, and 22 (white-label framework must be in place first)

**What:** Build a WellnessLiving MCP server that enables Agent C2 to read and write WellnessLiving data: classes, appointments, clients, memberships, staff, locations, and sales. Port the PHP auth logic (HMAC signature + session cookies) to TypeScript.

**Why:** Brice Scheschuk (Globalive) directly connected Corey with WellnessLiving during the Feb 23 meeting. WellnessLiving serves 7,500 users and wants to integrate Agent C2 as their AI layer. This MCP server is what makes Agent C2 genuinely useful _inside_ WellnessLiving's platform — agents can query and modify WellnessLiving data, not just chat abstractly.

**Steps:**

1. Port WellnessLiving PHP SDK auth to TypeScript (Authorization ID, Authorization Code, WL username/password → HMAC signature → session cookies)
2. Build MCP tools: `wl_list_classes`, `wl_list_locations`, `wl_list_clients`, `wl_book_appointment`, `wl_list_appointments`, `wl_get_membership`, `wl_list_staff`
3. Register `wellnessliving` as IntegrationProvider with API key fields
4. Create "WellnessLiving AI" agent blueprint: answers client questions, books classes, looks up memberships, handles schedule queries
5. Package as a Playbook in the marketplace (leverages Plans 9, 13, 14, 22)

**Files:** New `scripts/mcp-servers/wellnessliving/`, new IntegrationProvider, new agent blueprint

---

## Effort + Impact Summary

| #   | Item                                | Tier | Effort    | Revenue/Deal Impact                       |
| --- | ----------------------------------- | ---- | --------- | ----------------------------------------- |
| 1   | Release 1.31 Appello Intelligence   | 1    | XS (2d)   | Thomas Kanata contract completion         |
| 2   | Sales Meeting Follow-up Agent       | 1    | S (5d)    | Immediate Nathan ops win                  |
| 3   | n8n Instance-Level MCP              | 1    | XS (1d)   | 1 tool → all workflows as tools           |
| 4   | Contact Trimble (commercial)        | 1    | XS (1h)   | Starts clock on $95k ProElectric deal     |
| 5   | NetSuite MCP + Taurus Demo          | 2    | M (1wk)   | March 11 deadline, ~$60k deal             |
| 6   | Sales Meeting Prep Agent            | 2    | S (5d)    | Nathan ops win, completes meeting loop    |
| 7   | n8n REST API Client                 | 2    | M (1wk)   | Full n8n orchestration capability         |
| 8   | n8n Callback Route                  | 2    | M (1wk)   | Closes agent ↔ n8n loop                   |
| 9   | Fathom Sales Intelligence Playbook  | 3    | S (5d)    | First marketplace Playbook, investor demo |
| 10  | n8n Workflow Library UI             | 3    | M (1wk)   | n8n discoverability + adoption            |
| 11  | ATLAS Agent Upgrade                 | 3    | XS (2d)   | ATLAS agent actually works                |
| 12  | n8n Workflow as Playbook Component  | 3    | S (3d)    | n8n in marketplace bundles                |
| 13  | White-label Branding Config         | 3    | M (1wk)   | Wellness Living prerequisite              |
| 14  | Per-Customer-Org Token API          | 3    | M (1wk)   | Wellness Living prerequisite              |
| 15  | Vista ERP MCP Build                 | 4    | L (3wk)   | $95k/yr ProElectric deal                  |
| 16  | NetSuite Taurus Sync Workflow       | 4    | M (2wk)   | Taurus deal deliverable                   |
| 17  | Stripe Connect + ONE_TIME Checkout  | 4    | M (2wk)   | Marketplace revenue, Plan 9 charges       |
| 18  | Stripe Subscriptions + Webhook      | 4    | M (2wk)   | Subscription revenue on all playbooks     |
| 19  | PER_USE Metering + Seller Dashboard | 5    | M (2wk)   | Creator economy monetization              |
| 20  | Playbook Reviews + Trust Scores     | 5    | S (1wk)   | Marketplace differentiation               |
| 21  | EmbedLicense + Usage Metering       | 5    | L (3wk)   | Wellness Living billing model             |
| 22  | JavaScript SDK                      | 5    | M (1wk)   | Wellness Living engineering adoption      |
| 23  | WellnessLiving MCP                  | 5    | L (3-4wk) | Wellness Living partnership               |

---

## Bonus Item: Atlas n8n Connection Mode Note

The current Atlas SSE URL (`/mcp/dfbad0dd.../sse`) connects to a **single n8n workflow** that exposes only the `atlas_Query_ATLAS` tool. Item 3 (instance-level MCP) and Item 7 (REST API client) together replace this with full n8n integration. The SSE mode can be kept as a legacy fallback.

---

_This document was generated from analysis of the Feb 23, 2026 Fathom meeting summaries (6 meetings), past 60 days of Fathom meeting history, deep codebase research across all relevant packages, and external API research for Vista, NetSuite, WellnessLiving, and n8n._
