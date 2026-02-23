# Playbook Marketplace — Exhaustive User Stories for Full-Stack Validation

> Generated: February 21, 2026
> Purpose: Prove that every primitive from top to bottom and bottom to top works across the entire AgentC2 platform to support the Playbook Marketplace implementation.

---

## How to Read This Document

Each user story follows the format:

> **US-XXX:** As a [role], I want to [action] so that [outcome].
> **Validates:** [subsystem(s) exercised]
> **Preconditions:** [what must be true before this story can run]
> **Acceptance Criteria:** [measurable pass/fail conditions]

Stories are organized in dependency order: bottom-up primitives first, then vertical integration stories, then top-down end-to-end journeys. A system that passes all stories has proven every layer of the stack.

---

## Section 1: Foundation Layer (Bottom-Up Primitives)

These stories validate the lowest-level building blocks that everything else depends on.

### 1.1 Database & Schema

**US-001:** As a platform operator, I want the Prisma schema to generate a valid client so that all 170+ models are accessible at runtime.
**Validates:** Database, Prisma ORM
**Preconditions:** PostgreSQL running, `DATABASE_URL` configured
**Acceptance Criteria:**

- `bun run db:generate` completes without errors
- `bun run db:push` applies schema without data loss warnings on clean DB
- All 6 Playbook models exist: `Playbook`, `PlaybookVersion`, `PlaybookComponent`, `PlaybookPurchase`, `PlaybookInstallation`, `PlaybookReview`
- All 5 Playbook enums exist: `PlaybookStatus`, `PlaybookPricingModel`, `PlaybookComponentType`, `PurchaseStatus`, `InstallationStatus`
- `Organization` model has `stripeConnectAccountId` and `stripeConnectStatus` fields
- `Agent` model has `playbookSourceId` and `playbookInstallationId` fields
- All `@@index`, `@@unique`, and `@@map` annotations are present and functional

**US-002:** As a platform operator, I want referential integrity enforced across all Playbook relations so that orphaned records cannot exist.
**Validates:** Database integrity, Prisma relations
**Preconditions:** Schema applied
**Acceptance Criteria:**

- Deleting a `Playbook` cascades to `PlaybookVersion`, `PlaybookComponent`, `PlaybookReview`
- Deleting an `Organization` cascades to its `Playbook` records (via `publisherOrgId`)
- `PlaybookInstallation.purchaseId` has `@unique` constraint — one installation per purchase
- `@@unique([playbookId, targetOrgId])` on `PlaybookInstallation` prevents duplicate installs per org
- `@@unique([playbookId, reviewerOrgId])` on `PlaybookReview` prevents duplicate reviews per org
- `@@unique([playbookId, version])` on `PlaybookVersion` prevents duplicate versions

---

### 1.2 Authentication & Authorization

**US-003:** As an unauthenticated user, I want to browse the marketplace without logging in so that I can evaluate playbooks before creating an account.
**Validates:** Authentication, public routes, proxy middleware
**Preconditions:** Agent app running
**Acceptance Criteria:**

- `GET /api/playbooks` returns 200 with published playbooks (no session required)
- `GET /api/playbooks/[slug]` returns 200 with playbook details (no session required)
- `GET /api/playbooks/[slug]/reviews` returns 200 with reviews (no session required)
- `/marketplace` page renders without auth redirect
- `/marketplace/[slug]` page renders without auth redirect
- All other playbook API routes return 401 without a session

**US-004:** As an authenticated user, I want my session to persist across playbook operations so that I don't get logged out mid-purchase.
**Validates:** Session management, Better Auth, CSRF
**Preconditions:** User logged in with valid session
**Acceptance Criteria:**

- Session cookie is set and valid across sequential API calls (create playbook, package, publish, browse, purchase, deploy)
- CSRF token is validated on all mutating playbook endpoints (POST, PUT, PATCH, DELETE)
- Session timeout (30-min idle) is enforced — expired session returns 401 on protected endpoints
- API key authentication works as an alternative to session auth on playbook endpoints

**US-005:** As an admin user, I want admin-only routes to reject non-admin users so that moderation actions are restricted.
**Validates:** RBAC, admin authorization
**Preconditions:** Admin and non-admin users exist
**Acceptance Criteria:**

- `GET /api/admin/playbooks` returns 200 for admin, 403 for non-admin
- `PATCH /api/admin/playbooks/[id]/status` returns 200 for admin, 403 for non-admin
- `GET /api/admin/playbooks/[id]/manifest` returns 200 for admin, 403 for non-admin
- Admin status transitions create `AuditLog` entries with correct `actorId`, `action`, `entityType`, `entityId`

---

### 1.3 Multi-Tenancy & Organization

**US-006:** As an organization owner, I want to create a workspace where deployed playbooks will live so that my agents are isolated from other orgs.
**Validates:** Multi-tenancy, workspace isolation
**Preconditions:** Organization exists with at least one member
**Acceptance Criteria:**

- Workspace created with `organizationId` set
- Workspace has `isDefault` flag for primary workspace
- Workspace can be selected as a deployment target in the deploy wizard

**US-007:** As a member of Org A, I want to be unable to see Org B's deployed agents so that data isolation is enforced at the tenant level.
**Validates:** Multi-tenancy, data isolation
**Preconditions:** Both orgs have deployed playbooks
**Acceptance Criteria:**

- `GET /api/agents` scoped to Org A returns only Org A's agents
- Agent queries with Org A's session never return Org B's agent records
- Documents created during Org B's playbook deployment are invisible to Org A
- RAG queries from Org A's agents never retrieve Org B's document chunks
- `PlaybookInstallation` records for Org B are invisible to Org A's API calls

---

### 1.4 Agent Runtime

**US-008:** As a builder, I want to create a database-driven agent with instructions, model config, and tools so that it can be packaged into a playbook.
**Validates:** Agent runtime, AgentResolver, database-driven agents
**Preconditions:** Workspace exists, `FEATURE_DB_AGENTS=true`
**Acceptance Criteria:**

- Agent created via API with `slug`, `name`, `instructions`, `modelProvider`, `modelName`, `temperature`
- `AgentResolver.resolve(slug)` returns a functional Mastra agent
- Agent responds to a test message with coherent output
- Agent has `workspaceId` set correctly

**US-009:** As a builder, I want my agent to use tools during execution so that it can perform real actions.
**Validates:** Tool registry, tool execution, MCP client
**Preconditions:** Agent created with tools assigned
**Acceptance Criteria:**

- Agent with `calculatorTool` correctly computes arithmetic in response to "What is 42 \* 17?"
- Agent with `webFetchTool` retrieves and summarizes a URL
- Agent with `ragQueryTool` searches the knowledge base and returns results
- Tool calls are logged in `AgentToolCall` records
- Tool metrics increment in `AgentToolMetricDaily`

**US-010:** As a builder, I want my agent to maintain conversation memory so that multi-turn interactions work correctly.
**Validates:** Memory system, @mastra/memory, @mastra/pg
**Preconditions:** Agent created with `memoryEnabled: true`
**Acceptance Criteria:**

- First message to agent establishes a thread
- Second message in same thread receives context-aware response referencing the first message
- Working memory (user preferences, facts) persists across thread turns
- Semantic recall retrieves relevant older messages when context window is insufficient
- Memory data is scoped to the agent's `organizationId` — no cross-org leakage

**US-011:** As a builder, I want to configure my agent's model routing so that simple queries use cheaper models and complex queries use more capable ones.
**Validates:** Model registry, model routing, complexity classification
**Preconditions:** Agent with model routing enabled
**Acceptance Criteria:**

- Simple query ("What time is it?") routes to faster/cheaper model
- Complex query ("Analyze these financial metrics and recommend a strategy") routes to more capable model
- Model selection is logged in `CostEvent` with correct model name and pricing

---

### 1.5 Skills System

**US-012:** As a builder, I want to create a skill with instructions, tools, and documents so that I can compose modular agent capabilities.
**Validates:** Skill CRUD, SkillDocument, SkillTool, AgentSkill
**Preconditions:** Workspace exists, at least one document exists
**Acceptance Criteria:**

- Skill created with `slug`, `name`, `instructions`, `category`, `tags`
- Skill-Document junction created via `SkillDocument`
- Skill-Tool junction created via `SkillTool` with a valid `toolId`
- Skill attached to agent via `AgentSkill` with `pinned: true`

**US-013:** As a builder, I want skills to augment my agent's behavior when activated so that the agent gains domain-specific competencies.
**Validates:** Skill loading, progressive disclosure, agent resolution
**Preconditions:** Agent with attached skills
**Acceptance Criteria:**

- Agent resolver loads pinned skills and injects their instructions
- Agent with "FAQ Lookup" skill uses RAG to search knowledge base before answering
- Thread-activated skills persist via `ThreadSkillState` and reload on subsequent turns
- Skill version is respected when `pinnedVersion` is set on `AgentSkill`

---

### 1.6 Document & RAG System

**US-014:** As a builder, I want to create and ingest documents into the knowledge base so that my agent can answer questions using this content.
**Validates:** Document CRUD, RAG pipeline, vector embeddings, tenant isolation
**Preconditions:** Workspace exists, OpenAI API key configured
**Acceptance Criteria:**

- Document created with `content`, `contentType: "markdown"`, `category`, `tags`
- Document ingested: chunked, embedded (OpenAI text-embedding-3-small), stored in vector store
- `RagChunk` records created with correct `organizationId`
- `Document.chunkCount` and `Document.embeddedAt` updated
- RAG query with a question related to the document content returns relevant chunks
- RAG query from a different org returns zero results for this document

**US-015:** As a builder, I want documents to be re-embeddable so that content updates propagate to the knowledge base.
**Validates:** RAG re-embedding, vector store updates
**Preconditions:** Document already ingested
**Acceptance Criteria:**

- Document content updated via API
- Re-embed triggered: old chunks deleted, new chunks created
- RAG query returns results from updated content, not stale content

---

### 1.7 Workflow System

**US-016:** As a builder, I want to create a workflow with branching logic and human-in-the-loop steps so that it can be included in a playbook.
**Validates:** Workflow CRUD, workflow builder runtime, suspend/resume
**Preconditions:** Workspace exists
**Acceptance Criteria:**

- Workflow created with steps, conditions, and a human approval step
- Workflow executes: reaches approval step, suspends
- Workflow resumes after approval, continues to completion
- `WorkflowRun` record created with status progression (RUNNING -> WAITING -> COMPLETED)
- `WorkflowRunStep` records created for each step execution

**US-017:** As a builder, I want workflow versions to be tracked so that I can rollback if a new version breaks.
**Validates:** WorkflowVersion, version control
**Preconditions:** Workflow exists
**Acceptance Criteria:**

- `WorkflowVersion` snapshot created on each update
- Previous versions are retrievable
- Workflow can be rolled back to a previous version

---

### 1.8 Network System (Multi-Agent)

**US-018:** As a builder, I want to create a multi-agent network with routing logic so that messages are dispatched to the correct specialist agent.
**Validates:** Network CRUD, network topology, network runtime, routing
**Preconditions:** 3+ agents exist in the same workspace
**Acceptance Criteria:**

- Network created with `topologyJson` defining nodes (agents) and edges (routing conditions)
- Network execution: input message enters at the entry node (Router Agent)
- Router Agent classifies the input and routes to the correct downstream agent (FAQ or Escalation)
- `NetworkRun` record created with correct status
- `NetworkRunStep` records created for each agent's contribution
- Cross-agent handoff (Escalation -> FAQ) functions correctly

**US-019:** As a builder, I want network versions to be tracked so that topology changes are recoverable.
**Validates:** NetworkVersion, version control
**Preconditions:** Network exists
**Acceptance Criteria:**

- `NetworkVersion` snapshot created when topology is modified
- Previous versions are retrievable

---

### 1.9 Evaluation & Quality System

**US-020:** As a builder, I want to create test cases for my agent so that I can validate behavior before and after deployment.
**Validates:** AgentTestCase, test execution, scorers
**Preconditions:** Agent exists
**Acceptance Criteria:**

- Test case created with `inputText`, `expectedOutput`, `tags`
- Test case executed: agent processes `inputText`, response compared to `expectedOutput`
- `AgentTestRun` record created with pass/fail result and scores
- Multiple test cases execute as a batch, returning aggregate results

**US-021:** As a builder, I want evaluation scores recorded per agent run so that I can track quality over time.
**Validates:** AgentEvaluation, scorers, run lifecycle
**Preconditions:** Agent with scorers configured
**Acceptance Criteria:**

- Agent run completes
- `AgentEvaluation` record created with `scoresJson` containing scorer results
- Scores are aggregated into daily metrics (`AgentMetricDaily`, `AgentQualityMetricDaily`)

**US-022:** As a builder, I want to run simulated conversations against my agent so that I can generate trust score data.
**Validates:** SimulationSession, batch simulation, trust scoring
**Preconditions:** Agent with test cases
**Acceptance Criteria:**

- Simulation session started with target count and concurrency
- Simulated conversations execute (Inngest `simulation/session.start`, `simulation/batch.run`)
- `SimulationSession` updated with results (conversationsCompleted, conversationsPassed)
- Agent reputation data feeds into trust score calculation

---

### 1.10 Guardrail System

**US-023:** As a builder, I want guardrail policies to block, filter, and flag agent responses so that safety is enforced.
**Validates:** GuardrailPolicy, guardrail enforcement, GuardrailEvent
**Preconditions:** Agent with guardrail policy configured
**Acceptance Criteria:**

- PII filter: agent response containing an email address has the email redacted
- Tone policy: agent response detected as unprofessional is modified
- No-hallucination policy: agent response that invents facts is blocked
- Each guardrail action creates a `GuardrailEvent` record with type (BLOCKED/MODIFIED/FLAGGED)
- Inngest `guardrail/event` fires for blocked content

**US-024:** As a builder, I want org-level guardrail baselines to apply to all agents so that organizational safety standards are enforced.
**Validates:** OrgGuardrailPolicy, baseline enforcement
**Preconditions:** Org guardrail policy exists
**Acceptance Criteria:**

- New agents inherit org-level guardrail baselines
- Per-agent policies extend (not replace) org-level policies

---

### 1.11 Budget & Cost System

**US-025:** As a builder, I want agent runs to track cost per execution so that I can set accurate pricing for my playbook.
**Validates:** CostEvent, token counting, model pricing
**Preconditions:** Agent exists, model registry has pricing data
**Acceptance Criteria:**

- Agent run completes and creates `CostEvent` with `inputTokens`, `outputTokens`, `costUsd`, `modelId`
- Daily rollup aggregates into `AgentCostDaily` and `AgentModelCostDaily`
- Cost per run is accurate to ±5% when compared to provider billing

**US-026:** As an org admin, I want budget policies to enforce spending limits so that deployed playbooks don't exceed budget.
**Validates:** BudgetPolicy, budget enforcement, BudgetExceededError
**Preconditions:** Budget policy set for agent
**Acceptance Criteria:**

- Agent run proceeds normally when under budget
- Agent run raises `BudgetExceededError` when budget limit is reached
- `budget/check` Inngest event fires for threshold crossing
- Budget status is retrievable via `agentBudgetGetTool`

---

### 1.12 Trust & Reputation

**US-027:** As a buyer, I want to see a trust score on playbook listings so that I can evaluate quality with real data, not just reviews.
**Validates:** AgentReputation, trust score aggregation, trustScore display
**Preconditions:** Agent has run history with evaluations
**Acceptance Criteria:**

- `AgentReputation` record exists with `trustScore`, `totalRuns`, `autonomyTier`
- Playbook listing displays `trustScore` sourced from aggregated reputation data
- Trust score recalculation cron (`playbook/trust-score.recalculate`) updates `Playbook.trustScore` from active installation agent reputations

---

### 1.13 Integration System

**US-028:** As a builder, I want to connect MCP integrations to my workspace so that agents can use external tools.
**Validates:** IntegrationProvider, IntegrationConnection, MCP client, credential encryption
**Preconditions:** Integration provider registered, API key available
**Acceptance Criteria:**

- `IntegrationConnection` created with `isActive: true`
- Credentials encrypted at rest (AES-256-GCM via `CREDENTIAL_ENCRYPTION_KEY`)
- MCP client lists tools for the connected provider
- Agent with the provider's tools can execute them successfully

**US-029:** As a builder, I want OAuth integrations to handle token refresh automatically so that long-running agents don't lose access.
**Validates:** OAuth flows, PKCE, token refresh, credential lifecycle
**Preconditions:** OAuth integration connected (Gmail, Outlook, etc.)
**Acceptance Criteria:**

- OAuth flow completes with PKCE
- Access token stored encrypted
- Token refresh occurs automatically before expiry
- Agent tools continue functioning after token refresh

---

### 1.14 Background Jobs (Inngest)

**US-030:** As a platform operator, I want Inngest to process background events reliably so that long-running operations complete.
**Validates:** Inngest client, event publishing, function execution
**Preconditions:** Inngest dev server running (port 8288)
**Acceptance Criteria:**

- `inngest.send({ name: "playbook/deploy", data: {...} })` publishes event successfully
- `playbookDeployFunction` receives event and begins execution
- Function status is visible in Inngest dashboard
- Failed functions retry (up to configured retry count)
- `playbookTrustScoreRecalculationFunction` fires on cron schedule (`0 3 * * *`)

---

## Section 2: Packaging Engine (Vertical Integration)

These stories validate the snapshot-and-package pipeline that turns a running agent system into a portable manifest.

### 2.1 Manifest Creation

**US-031:** As a builder, I want to snapshot my agent system into a manifest so that it can be deployed in another organization.
**Validates:** Packager, AgentSnapshot, SkillSnapshot, DocumentSnapshot
**Preconditions:** Agent exists with skills, documents, and guardrails
**Acceptance Criteria:**

- `packagePlaybook()` creates a `PlaybookManifest` JSON blob
- Manifest contains `agents[]` with instructions, model config, tools, guardrails
- Manifest contains `skills[]` with instructions, tool references, document references
- Manifest contains `documents[]` with content and metadata (NOT vectors — those are re-embedded)
- Manifest contains `requiredIntegrations[]` extracted from tool references
- Manifest contains `entryPoint` specifying the main agent/workflow/network

**US-032:** As a builder, I want to package a multi-agent network so that the entire topology, routing, and all member agents are captured.
**Validates:** Packager (network path), NetworkSnapshot, recursive dependency collection
**Preconditions:** Network exists with 3+ agents, each with skills and documents
**Acceptance Criteria:**

- Manifest `networks[]` contains the topology JSON (nodes, edges, routing rules)
- All agents referenced by the network are included in `agents[]`
- All skills attached to those agents are included in `skills[]`
- All documents attached to those skills are included in `documents[]`
- Entry point is set to `{ type: "network", slug: "..." }`

**US-033:** As a builder, I want workflow definitions included in the manifest so that multi-step orchestration is portable.
**Validates:** Packager (workflow path), WorkflowSnapshot
**Preconditions:** Workflow exists with steps and conditions
**Acceptance Criteria:**

- Manifest `workflows[]` contains step configs, connections, and conditions
- Workflow references to agents use slugs (not IDs) for portability

**US-034:** As a builder, I want guardrail policies and test cases captured in the manifest so that safety and quality travel with the playbook.
**Validates:** GuardrailSnapshot, TestCaseSnapshot
**Preconditions:** Agent has guardrail policy and test cases
**Acceptance Criteria:**

- Manifest `guardrails[]` contains per-agent policy configurations
- Manifest `testCases[]` contains input text, expected output, and tags
- Manifest `scorecards[]` contains evaluation criteria

### 2.2 Manifest Sanitization

**US-035:** As a builder, I want my secrets stripped from the manifest so that API keys never appear in the published playbook.
**Validates:** Sanitizer, secret pattern detection
**Preconditions:** Agent instructions contain text patterns matching API key formats
**Acceptance Criteria:**

- After sanitization, no values matching `sk-*`, `pat-*`, `xoxb-*`, `ghp_*`, `fc-*`, or other secret patterns exist in the manifest
- Placeholder tokens replace stripped secrets
- Sanitization report lists what was stripped

**US-036:** As a builder, I want PII removed from the manifest so that customer data from my testing doesn't leak.
**Validates:** Sanitizer, PII detection
**Preconditions:** Agent instructions or document content contain email addresses or phone numbers
**Acceptance Criteria:**

- Email addresses are removed or replaced with placeholders
- Phone numbers are removed or replaced
- Organization-specific IDs (`organizationId`, `workspaceId`, `userId`) are replaced with tokens

**US-037:** As a builder, I want connection IDs replaced with integration provider keys so that the buyer's connections are used instead of mine.
**Validates:** Sanitizer, connection ID stripping
**Preconditions:** Agent config references `IntegrationConnection` IDs
**Acceptance Criteria:**

- Builder's `IntegrationConnection` IDs are replaced with provider keys (e.g., `conn_abc123` -> `hubspot`)
- Tool references (e.g., `hubspot.hubspot-get-contacts`) are preserved as-is (resolved at runtime)

**US-038:** As a builder, I want the sanitizer to warn me about hardcoded URLs so that builder-specific endpoints don't ship to buyers.
**Validates:** Sanitizer, URL detection
**Preconditions:** Agent instructions reference `my-company.hubspot.com` or similar
**Acceptance Criteria:**

- `detectHardcodedUrls()` returns a list of suspicious URLs found in the manifest
- Packaging fails or warns if builder-specific URLs are detected

### 2.3 Manifest Validation

**US-039:** As a builder, I want the manifest validated before storage so that corrupted packages can't be published.
**Validates:** Manifest schema (Zod), validation function
**Preconditions:** Manifest created
**Acceptance Criteria:**

- `validateManifest()` passes for a correctly formed manifest
- `validateManifest()` throws a Zod error for a manifest missing required fields (e.g., no `agents`, no `entryPoint`)
- `isValidManifest()` returns `false` for invalid manifests without throwing

### 2.4 Playbook Record Creation

**US-040:** As a builder, I want the packager to create database records so that my playbook appears in the catalog.
**Validates:** Packager DB writes, Playbook/PlaybookVersion/PlaybookComponent models
**Preconditions:** Manifest validated
**Acceptance Criteria:**

- `Playbook` record created with slug, name, description, category, tags, status `DRAFT`
- `PlaybookVersion` record created with `version: 1`, `manifest` JSON stored
- `PlaybookComponent` records created for each component (agents, skills, documents, workflows, networks)
- Each component has correct `componentType` enum value and `sourceEntityId`
- `isEntryPoint: true` set on the entry component

---

## Section 3: Marketplace API (Vertical Integration)

### 3.1 Builder API

**US-041:** As a builder, I want to create a playbook draft via API so that I can start the publishing process.
**Validates:** `POST /api/playbooks`, authentication, validation
**Preconditions:** Authenticated user with org membership
**Acceptance Criteria:**

- `POST /api/playbooks` with `{ name, slug, description, category }` returns 201
- Playbook created with status `DRAFT`
- `publisherOrgId` set to user's organization
- `publishedByUserId` set to current user
- Duplicate slug returns 409

**US-042:** As a builder, I want to update my playbook's metadata so that I can refine the listing before publishing.
**Validates:** `PUT /api/playbooks/[slug]`, ownership check
**Preconditions:** Playbook exists, owned by authenticated user's org
**Acceptance Criteria:**

- `PUT /api/playbooks/[slug]` with `{ tagline, longDescription, tags, coverImageUrl }` returns 200
- Non-owner org attempting update receives 403
- Update only modifies specified fields

**US-043:** As a builder, I want to package my agent system into the playbook so that a new version is created with the latest snapshot.
**Validates:** `POST /api/playbooks/[slug]/package`, packaging pipeline
**Preconditions:** Playbook exists in DRAFT state, entry agent exists
**Acceptance Criteria:**

- `POST /api/playbooks/[slug]/package` triggers `packagePlaybook()` and returns 200
- New `PlaybookVersion` created with incremented version number
- `PlaybookComponent` records updated
- Manifest sanitized and validated before storage

**US-044:** As a builder, I want to submit my playbook for review so that it can be approved and listed on the marketplace.
**Validates:** `POST /api/playbooks/[slug]/publish`, status transitions
**Preconditions:** Playbook in DRAFT status with at least one version
**Acceptance Criteria:**

- `POST /api/playbooks/[slug]/publish` changes status to `PENDING_REVIEW` (or `PUBLISHED` if auto-approve)
- Publishing without a version returns 400
- Already-published playbook returns 400

**US-045:** As a builder, I want to see my published playbooks so that I can manage my catalog.
**Validates:** `GET /api/playbooks/my/published`, scoping
**Preconditions:** Builder has published playbooks
**Acceptance Criteria:**

- Returns only playbooks where `publisherOrgId` matches current org
- Includes install count, revenue, review count per playbook
- Does not include playbooks from other orgs

### 3.2 Marketplace Browse API

**US-046:** As a buyer, I want to browse published playbooks so that I can discover solutions.
**Validates:** `GET /api/playbooks`, public access, filtering
**Preconditions:** Published playbooks exist
**Acceptance Criteria:**

- Returns only playbooks with status `PUBLISHED`
- Supports `?category=` filter
- Supports `?search=` text search
- Does not return DRAFT, PENDING_REVIEW, SUSPENDED, or ARCHIVED playbooks
- No authentication required

**US-047:** As a buyer, I want to see playbook details so that I can evaluate before purchasing.
**Validates:** `GET /api/playbooks/[slug]`, public access, detail response
**Preconditions:** Published playbook exists
**Acceptance Criteria:**

- Returns full playbook record with: name, description, longDescription, category, tags
- Includes `publisherOrg` info (name, not internal IDs)
- Includes metrics: `installCount`, `averageRating`, `reviewCount`, `trustScore`
- Includes `requiredIntegrations`
- Includes component breakdown (count of agents, skills, documents, workflows, networks)
- Includes version history (version number, changelog, createdAt)
- No authentication required

**US-048:** As a buyer, I want to read reviews for a playbook so that I can see other buyers' experiences.
**Validates:** `GET /api/playbooks/[slug]/reviews`, public access
**Preconditions:** Playbook has reviews
**Acceptance Criteria:**

- Returns reviews with rating, title, body, reviewer org name, createdAt
- Sorted by most recent first
- No authentication required

### 3.3 Purchase API

**US-049:** As a buyer, I want to purchase a free playbook so that I can deploy it immediately without payment.
**Validates:** `POST /api/playbooks/[slug]/purchase`, free path
**Preconditions:** Published FREE playbook, authenticated buyer
**Acceptance Criteria:**

- `POST /api/playbooks/[slug]/purchase` returns 200 with purchase record
- `PlaybookPurchase` created with `status: COMPLETED`, `amountUsd: 0`, `platformFeeUsd: 0`, `sellerPayoutUsd: 0`
- No Stripe interaction occurs
- Deploy is immediately available

**US-050:** As a buyer, I want to purchase a paid playbook so that the seller receives payment and I get deploy access.
**Validates:** `POST /api/playbooks/[slug]/purchase`, paid path, Stripe Connect
**Preconditions:** Published ONE_TIME playbook ($1), seller has Stripe Connect account, buyer authenticated
**Acceptance Criteria:**

- `POST /api/playbooks/[slug]/purchase` creates Stripe PaymentIntent with `application_fee_amount` (15%)
- `PlaybookPurchase` created with `status: PENDING`, `amountUsd: 1.00`, `platformFeeUsd: 0.15`, `sellerPayoutUsd: 0.85`
- After successful payment (webhook), status updates to `COMPLETED`
- Deploy is available only after status is `COMPLETED`

**US-051:** As a buyer, I want to be prevented from purchasing a playbook I already own so that I don't get double-charged.
**Validates:** Purchase deduplication
**Preconditions:** Buyer already has a COMPLETED purchase for this playbook
**Acceptance Criteria:**

- Second purchase attempt returns 409 with message indicating existing purchase

### 3.4 Deployment API

**US-052:** As a buyer, I want to deploy a purchased playbook to my workspace so that the agents and components are created in my environment.
**Validates:** `POST /api/playbooks/[slug]/deploy`, deployment engine, Inngest background job
**Preconditions:** Purchase completed, buyer has workspace
**Acceptance Criteria:**

- `POST /api/playbooks/[slug]/deploy` with `{ workspaceId }` returns 202 (accepted)
- `PlaybookInstallation` created with status `INSTALLING`
- Inngest `playbook/deploy` event published
- Background job creates all entities (agents, skills, documents, workflows, networks)
- Installation status progresses: `INSTALLING` -> `CONFIGURING` -> `TESTING` -> `ACTIVE`

**US-053:** As a buyer, I want to poll deployment status so that I know when my playbook is ready to use.
**Validates:** `GET /api/playbooks/[slug]/deploy` (status endpoint)
**Preconditions:** Deployment in progress
**Acceptance Criteria:**

- Returns current `PlaybookInstallation.status`
- Returns `testResults` when status reaches `TESTING` or `ACTIVE`
- Returns `integrationStatus` showing which required integrations the buyer has connected

**US-054:** As a buyer, I want to be prevented from deploying the same playbook twice to the same org so that duplicate installations don't occur.
**Validates:** `@@unique([playbookId, targetOrgId])` constraint
**Preconditions:** Playbook already installed in buyer's org
**Acceptance Criteria:**

- Second deploy attempt returns 409 with message indicating existing installation

### 3.5 Review API

**US-055:** As a buyer, I want to submit a review after deploying a playbook so that other buyers benefit from my experience.
**Validates:** `POST /api/playbooks/[slug]/reviews`, review creation, rating aggregation
**Preconditions:** Buyer has ACTIVE installation, authenticated
**Acceptance Criteria:**

- `POST /api/playbooks/[slug]/reviews` with `{ rating: 5, title, body }` returns 201
- `PlaybookReview` created with `reviewerOrgId` from session
- `Playbook.averageRating` and `Playbook.reviewCount` updated
- Duplicate review from same org returns 409

### 3.6 Uninstall API

**US-056:** As a buyer, I want to uninstall a playbook so that all created entities are cleaned up.
**Validates:** `DELETE /api/playbooks/my/installed/[id]`, uninstall logic
**Preconditions:** ACTIVE installation exists
**Acceptance Criteria:**

- All agents tracked in `createdAgentIds` are deleted
- All skills tracked in `createdSkillIds` are deleted
- All documents tracked in `createdDocumentIds` are deleted
- All workflows tracked in `createdWorkflowIds` are deleted
- All networks tracked in `createdNetworkIds` are deleted
- `PlaybookInstallation.status` set to `UNINSTALLED`
- `Playbook.installCount` decremented

### 3.7 Admin Moderation API

**US-057:** As an admin, I want to approve a playbook pending review so that it becomes visible in the marketplace.
**Validates:** `PATCH /api/admin/playbooks/[id]/status`, status transitions, audit logging
**Preconditions:** Playbook in `PENDING_REVIEW` status
**Acceptance Criteria:**

- `PATCH` with `{ status: "PUBLISHED" }` returns 200
- Playbook status changes to `PUBLISHED`
- `AuditLog` entry created with `action: "PLAYBOOK_STATUS_PUBLISHED"`, `actorId`, `entityId`
- Playbook now appears in public marketplace listings

**US-058:** As an admin, I want to suspend a published playbook so that it is removed from the marketplace.
**Validates:** Admin status transitions, enforcement
**Preconditions:** Playbook in `PUBLISHED` status
**Acceptance Criteria:**

- `PATCH` with `{ status: "SUSPENDED", reason: "Policy violation" }` returns 200
- Playbook status changes to `SUSPENDED`
- Playbook no longer appears in `GET /api/playbooks` results
- Existing installations continue to function (not forcibly removed)
- `AuditLog` entry created with reason in metadata

**US-059:** As an admin, I want to view a playbook's full manifest for security review so that I can inspect what will be deployed.
**Validates:** `GET /api/admin/playbooks/[id]/manifest`
**Preconditions:** Playbook with at least one version
**Acceptance Criteria:**

- Returns the full `PlaybookManifest` JSON from the latest `PlaybookVersion`
- Includes agent instructions, tools, documents, workflows — everything a buyer will receive

---

## Section 4: Deployment Engine (Vertical Integration)

### 4.1 Entity Creation

**US-060:** As a buyer, I want all agents from a playbook manifest to be created in my workspace so that I have functioning agents.
**Validates:** Deployer (agent creation), slug conflict resolution, playbookSourceId
**Preconditions:** Deployment started via Inngest
**Acceptance Criteria:**

- Each `AgentSnapshot` in the manifest creates an `Agent` record in the buyer's workspace
- `playbookSourceId` and `playbookInstallationId` set on each created agent
- If slug conflicts exist (e.g., buyer already has an agent with that slug), slug is suffixed (e.g., `support-agent-2`)
- Created agent IDs stored in `PlaybookInstallation.createdAgentIds`

**US-061:** As a buyer, I want all skills from a playbook manifest to be created and attached to the correct agents so that agent capabilities are preserved.
**Validates:** Deployer (skill creation, attachment)
**Preconditions:** Deployment started
**Acceptance Criteria:**

- Each `SkillSnapshot` creates a `Skill` record
- `SkillTool` junctions created for tool references
- `SkillDocument` junctions created for document references
- `AgentSkill` junctions created to attach skills to the correct agent
- Created skill IDs stored in `PlaybookInstallation.createdSkillIds`

**US-062:** As a buyer, I want documents from a playbook manifest to be created and re-embedded under my organization's tenant ID so that RAG queries are tenant-isolated.
**Validates:** Deployer (document creation), RAG re-embedding, tenant isolation
**Preconditions:** Deployment started
**Acceptance Criteria:**

- Each `DocumentSnapshot` creates a `Document` record with buyer's `organizationId` and `workspaceId`
- Document content is chunked and embedded with buyer's `organizationId`
- `RagChunk` records have buyer's `organizationId`
- RAG query from buyer's agent returns results from these documents
- RAG query from builder's (or any other) org does NOT return these documents
- Created document IDs stored in `PlaybookInstallation.createdDocumentIds`

**US-063:** As a buyer, I want workflows from the manifest to be created in my workspace so that multi-step orchestration works.
**Validates:** Deployer (workflow creation)
**Preconditions:** Manifest contains workflows
**Acceptance Criteria:**

- Each `WorkflowSnapshot` creates a `Workflow` record with new IDs but preserved step references
- Internal references (agent slugs) map to the newly created agent slugs
- Created workflow IDs stored in `PlaybookInstallation.createdWorkflowIds`

**US-064:** As a buyer, I want networks from the manifest to be created in my workspace so that multi-agent routing works.
**Validates:** Deployer (network creation), topology preservation
**Preconditions:** Manifest contains a network
**Acceptance Criteria:**

- Network created with correct `topologyJson`
- `NetworkPrimitive` records link the network to the newly created agents (using new agent IDs)
- Network execution routes messages correctly between the deployed agents
- Created network IDs stored in `PlaybookInstallation.createdNetworkIds`

**US-065:** As a buyer, I want guardrail policies from the manifest applied to the deployed agents so that safety rules are preserved.
**Validates:** Deployer (guardrail creation)
**Preconditions:** Manifest contains guardrail snapshots
**Acceptance Criteria:**

- `GuardrailPolicy` records created for each deployed agent
- Policy configurations match the manifest
- Guardrails enforce at runtime (PII filter, tone policy, no-hallucination policy all function)

### 4.2 Integration Mapping

**US-066:** As a buyer, I want to see which integrations a playbook requires and whether I have them connected so that I can plan before deploying.
**Validates:** Integration mapper, IntegrationConnection lookup
**Preconditions:** Manifest declares `requiredIntegrations: ["hubspot", "gmail"]`
**Acceptance Criteria:**

- `mapIntegrations()` returns a mapping for each required integration
- For connected integrations: `{ provider: "hubspot", connected: true }`
- For missing integrations: `{ provider: "gmail", connected: false }`
- Mapping stored in `PlaybookInstallation.integrationStatus`
- Deploy wizard displays integration status with connect/missing indicators
- Missing integrations warn but do not block deployment

### 4.3 Post-Deploy Testing

**US-067:** As a buyer, I want test cases to run automatically after deployment so that I know the playbook works in my environment.
**Validates:** Post-deploy test execution, test result storage
**Preconditions:** Manifest contains test cases, deployment complete
**Acceptance Criteria:**

- Test cases execute against the newly deployed agents
- Results stored in `PlaybookInstallation.testResults` JSON
- If all tests pass: installation status set to `ACTIVE`
- If tests fail: installation status set to `FAILED` with diagnostic data
- Test results visible in the deployment status poll response

---

## Section 5: Commerce (Stripe Connect)

**US-068:** As a builder, I want to onboard to Stripe Connect so that I can receive payouts from playbook sales.
**Validates:** `POST /api/stripe/connect/onboard`, Stripe Express account creation
**Preconditions:** Builder org exists, `STRIPE_SECRET_KEY` configured
**Acceptance Criteria:**

- Express account created in Stripe
- `Organization.stripeConnectAccountId` populated
- `Organization.stripeConnectStatus` set to `pending`
- Onboarding link returned (opens Stripe Express onboarding flow)

**US-069:** As a builder, I want to check my Stripe Connect status so that I know when I can start selling.
**Validates:** `GET /api/stripe/connect/status`, account status retrieval
**Preconditions:** Connect account created
**Acceptance Criteria:**

- Returns current Connect account details from Stripe
- Updates `Organization.stripeConnectStatus` (pending -> active)
- `active` status means the builder can list paid playbooks

**US-070:** As a builder, I want to access my Stripe Express dashboard so that I can view payouts and manage my account.
**Validates:** `POST /api/stripe/connect/dashboard`, login link generation
**Preconditions:** Active Connect account
**Acceptance Criteria:**

- Returns a time-limited Stripe Express dashboard login link
- Link opens the seller's Stripe dashboard

**US-071:** As a platform, I want revenue split to be enforced so that the platform receives its 15% fee on every transaction.
**Validates:** Payment processing, application fee, transfer
**Preconditions:** Paid playbook purchased
**Acceptance Criteria:**

- PaymentIntent created with `application_fee_amount` = 15% of purchase price
- `transfer_data.destination` set to seller's Connect account
- After payment: seller receives 85%, platform retains 15%
- `PlaybookPurchase` records correct `amountUsd`, `platformFeeUsd`, `sellerPayoutUsd`

---

## Section 6: UI (Top-Down User Journeys)

### 6.1 Builder UI

**US-072:** As a builder, I want a dashboard showing my playbooks so that I can manage my catalog.
**Validates:** `/playbooks` page, data fetching, session auth
**Preconditions:** Builder has published playbooks
**Acceptance Criteria:**

- Page loads with list of builder's playbooks
- Each card shows: name, status, install count, review count, average rating
- "New Playbook" button navigates to creation wizard
- Click on a playbook navigates to management page

**US-073:** As a builder, I want a creation wizard so that I can define a new playbook with metadata.
**Validates:** `/playbooks/new` page, form submission, API call
**Preconditions:** Authenticated builder
**Acceptance Criteria:**

- Form collects: name, slug, description, category, tags, pricing model
- Submit calls `POST /api/playbooks` and redirects to management page
- Validation: slug format (lowercase, hyphens), required fields
- Error display: duplicate slug shows 409 error message

**US-074:** As a builder, I want a management page for my playbook so that I can view components, submit for review, and see stats.
**Validates:** `/playbooks/[slug]` page, detail fetching
**Preconditions:** Playbook exists
**Acceptance Criteria:**

- Shows playbook details, component list, version history
- "Submit for Review" button visible when status is DRAFT
- Button calls `POST /api/playbooks/[slug]/publish` and updates status display
- Stats section shows install count, review count, average rating

### 6.2 Marketplace UI

**US-075:** As a visitor, I want to browse the marketplace so that I can discover playbooks.
**Validates:** `/marketplace` page, public access, search/filter
**Preconditions:** Published playbooks exist
**Acceptance Criteria:**

- Page loads without authentication
- Category tabs filter by category
- Search input filters by name/description
- Each playbook card shows: name, tagline, category, install count, rating, trust score, price
- Click on card navigates to detail page

**US-076:** As a visitor, I want to view a playbook detail page so that I can evaluate it fully.
**Validates:** `/marketplace/[slug]` page, public access, detail display
**Preconditions:** Published playbook exists
**Acceptance Criteria:**

- Page loads without authentication
- Displays: name, description, publisher org, category, tags
- Displays metrics: install count, average rating, review count, trust score
- Displays component breakdown: agents (count), skills (count), documents (count), workflows (count), networks (count)
- Displays required integrations
- "Deploy" or "Purchase" CTA button visible
- Reviews section at bottom

**US-077:** As a buyer, I want a deployment wizard so that I can select a workspace and initiate deployment.
**Validates:** `/marketplace/[slug]/deploy` page, auth required, workspace selection
**Preconditions:** Authenticated buyer, purchase completed (or free playbook)
**Acceptance Criteria:**

- Redirects to login if not authenticated
- Shows workspace selector (buyer's workspaces)
- For free playbooks: shows "Deploy" button that triggers purchase + deploy
- For paid playbooks: shows pricing and payment flow before deploy
- After triggering: shows deployment progress (polling status)
- On success: shows "Active" status with link to view deployed agents

**US-078:** As a buyer, I want an installed playbooks page so that I can manage what's deployed in my org.
**Validates:** `/marketplace/installed` page, installation listing
**Preconditions:** Buyer has installed playbooks
**Acceptance Criteria:**

- Page loads with list of installations
- Each card shows: playbook name, version installed, status, created agent count
- Uninstall button available for ACTIVE installations
- Uninstall confirms, then calls `DELETE /api/playbooks/my/installed/[id]`
- After uninstall: card removed from list

---

## Section 7: Navigation & Routing

**US-079:** As a user, I want marketplace and playbook sections in the navigation so that I can access them from any page.
**Validates:** Navigation config, sidebar rendering
**Preconditions:** Navigation items registered
**Acceptance Criteria:**

- "Marketplace" section visible in sidebar with "Browse" and "Installed" children
- "Playbooks" section visible in sidebar with "My Playbooks" and "New Playbook" children
- Navigation links route to correct pages

**US-080:** As a user, I want marketplace pages to be publicly accessible via Caddy so that production routing works.
**Validates:** Proxy middleware, Caddyfile configuration
**Preconditions:** Production deployment
**Acceptance Criteria:**

- `https://domain/agent/marketplace` resolves and renders without auth
- `https://domain/agent/marketplace/[slug]` resolves and renders without auth
- `https://domain/agent/marketplace/[slug]/deploy` requires auth (redirects to login)
- `https://domain/agent/marketplace/installed` requires auth

---

## Section 8: Agent Tools (Programmatic Access)

**US-081:** As an agent, I want to search the marketplace programmatically so that I can discover capabilities I need.
**Validates:** `playbookSearchTool`, tool registry
**Preconditions:** Published playbooks exist, agent has tool assigned
**Acceptance Criteria:**

- Agent calling `playbookSearchTool` with `{ query: "customer support" }` returns matching playbooks
- Results include slug, name, pricing, trust score, install count
- Only PUBLISHED playbooks are returned

**US-082:** As an agent, I want to get playbook details programmatically so that I can evaluate before recommending deployment.
**Validates:** `playbookDetailTool`
**Preconditions:** Published playbook exists
**Acceptance Criteria:**

- Agent calling `playbookDetailTool` with `{ slug: "..." }` returns full details
- Includes component breakdown, required integrations, reviews summary

**US-083:** As an agent, I want to list installed playbooks so that I can report on what's deployed.
**Validates:** `playbookListInstalledTool`
**Preconditions:** Installations exist for the agent's org
**Acceptance Criteria:**

- Returns installations scoped to the agent's `organizationId`
- Each result includes playbook name, version, status, created entity counts

**US-084:** As an agent, I want to trigger playbook deployment so that I can autonomously extend workspace capabilities.
**Validates:** `playbookDeployTool`
**Preconditions:** Free playbook purchased, workspace exists
**Acceptance Criteria:**

- Agent calling `playbookDeployTool` with `{ playbookSlug, workspaceId }` initiates deployment
- Returns installation ID for status tracking
- Deployment proceeds via Inngest background job

---

## Section 9: End-to-End Journeys (Full Stack Validation)

These stories exercise every layer simultaneously, from UI to database.

### 9.1 The Happy Path: Free Playbook

**US-085:** As an end-to-end test, I want to validate the complete lifecycle of a free playbook — build, package, publish, browse, purchase, deploy, use, review, uninstall.
**Validates:** ALL 20 subsystems simultaneously
**Preconditions:** Two orgs exist (Org A = builder, Org B = buyer), both with workspaces
**Acceptance Criteria:**

1. **Build (Org A):**
    - Create 3 agents: Router, FAQ, Escalation in Org A's workspace
    - Create skills and attach to agents
    - Create documents and ingest into RAG
    - Create guardrail policies for each agent
    - Create test cases for each agent
    - Create a multi-agent network with topology: Router -> FAQ, Router -> Escalation, Escalation -> FAQ
    - Verify network execution works (run a test message through the network)

2. **Package (Org A):**
    - Call `POST /api/playbooks` to create a draft
    - Call `POST /api/playbooks/[slug]/package` to snapshot the system
    - Verify manifest contains all 3 agents, all skills, all documents, network topology, guardrails, test cases
    - Verify manifest is sanitized (no secrets, no PII, no org-specific IDs)
    - Verify manifest passes validation

3. **Publish (Org A):**
    - Call `POST /api/playbooks/[slug]/publish` to submit
    - (Admin) Call `PATCH /api/admin/playbooks/[id]/status` to approve
    - Verify playbook appears in `GET /api/playbooks` (public marketplace)

4. **Browse (Org B, unauthenticated):**
    - Visit `/marketplace` — see the playbook listed
    - Visit `/marketplace/[slug]` — see full details: agents, skills, docs, trust score, reviews
    - Verify component counts match what Org A packaged

5. **Purchase (Org B, authenticated):**
    - Call `POST /api/playbooks/[slug]/purchase` — free purchase
    - Verify `PlaybookPurchase` with `status: COMPLETED`, `amountUsd: 0`

6. **Deploy (Org B):**
    - Call `POST /api/playbooks/[slug]/deploy` with Org B's workspace
    - Poll status until `ACTIVE`
    - Verify 3 agents created in Org B's workspace
    - Verify skills attached to correct agents
    - Verify documents created with Org B's `organizationId`
    - Verify network created with correct topology
    - Verify guardrail policies applied
    - Verify test cases run and pass (in `testResults`)
    - Verify `Playbook.installCount` incremented

7. **Use (Org B):**
    - Send a message to the deployed Router Agent
    - Verify it routes to FAQ Agent for a standard question
    - Verify it routes to Escalation Agent for a complex issue
    - Verify FAG Agent uses RAG to search Org B's documents (not Org A's originals)
    - Verify memory works across turns
    - Verify guardrails enforce (PII filtered, tone enforced)
    - Verify cost events created
    - Verify runs tracked with correct org scope

8. **Data Isolation Verification:**
    - Query RAG from Org A's context — verify Org B's re-embedded documents are NOT returned
    - Query agents from Org A's session — verify Org B's deployed agents are NOT returned
    - Verify `PlaybookInstallation.createdAgentIds` match agent IDs visible only to Org B

9. **Review (Org B):**
    - Call `POST /api/playbooks/[slug]/reviews` with `{ rating: 5, title: "Works great", body: "..." }`
    - Verify `Playbook.averageRating` and `Playbook.reviewCount` updated

10. **Uninstall (Org B):**
    - Call `DELETE /api/playbooks/my/installed/[id]`
    - Verify all 3 agents deleted from Org B's workspace
    - Verify skills, documents, network deleted
    - Verify `PlaybookInstallation.status` set to `UNINSTALLED`
    - Verify `Playbook.installCount` decremented

### 9.2 The Happy Path: Paid Playbook

**US-086:** As an end-to-end test, I want to validate the paid purchase flow with Stripe Connect so that billing works end-to-end.
**Validates:** Stripe Connect, revenue split, billing subsystem
**Preconditions:** US-085 completed successfully, Org A has active Stripe Connect account
**Acceptance Criteria:**

1. **Seller Onboarding (Org A):**
    - Call `POST /api/stripe/connect/onboard` — Express account created
    - Simulate onboarding completion
    - Call `GET /api/stripe/connect/status` — status returns `active`

2. **Pricing (Org A):**
    - Update playbook pricing: `pricingModel: ONE_TIME`, `priceUsd: 1.00`
    - Verify playbook listing shows $1.00 price

3. **Purchase (Org B):**
    - Call `POST /api/playbooks/[slug]/purchase`
    - Verify Stripe PaymentIntent created
    - Verify `application_fee_amount` = $0.15 (15%)
    - Simulate successful payment (webhook `payment_intent.succeeded`)
    - Verify `PlaybookPurchase.status` updates to `COMPLETED`
    - Verify `amountUsd: 1.00`, `platformFeeUsd: 0.15`, `sellerPayoutUsd: 0.85`

4. **Deploy (Org B):**
    - Deploy proceeds only after payment succeeds
    - Same deployment verification as US-085

### 9.3 Error Paths

**US-087:** As an end-to-end test, I want deployment to fail gracefully when test cases fail so that broken playbooks don't go live.
**Validates:** Post-deploy test failure handling, installation status
**Preconditions:** Playbook with failing test cases (e.g., expected output doesn't match)
**Acceptance Criteria:**

- Deployment proceeds through entity creation
- Test cases execute and some fail
- `PlaybookInstallation.status` set to `FAILED`
- `testResults` JSON contains failure details (which tests failed, actual vs expected)
- Buyer notification sent: "Deployment failed — N of M tests failed"

**US-088:** As an end-to-end test, I want the system to handle a playbook with missing integrations gracefully so that partial functionality is communicated.
**Validates:** Integration mapping, partial deployment
**Preconditions:** Playbook requires `hubspot`, buyer has not connected HubSpot
**Acceptance Criteria:**

- `integrationStatus` shows `{ provider: "hubspot", connected: false }`
- Deploy wizard warns about missing integration
- Deployment proceeds (not blocked)
- Agent with HubSpot tools can still be created (tools will fail at runtime until integration is connected)

**US-089:** As an end-to-end test, I want the system to reject invalid status transitions so that playbook lifecycle integrity is maintained.
**Validates:** Status transition validation
**Preconditions:** Playbook in various states
**Acceptance Criteria:**

- `DRAFT` cannot transition directly to `PUBLISHED` via admin (must go through `PENDING_REVIEW`)
- `PUBLISHED` cannot transition to `DRAFT`
- `SUSPENDED` cannot transition to `DRAFT`
- `ARCHIVED` cannot transition to any active state
- Invalid transitions return 400 with allowed transitions list

**US-090:** As an end-to-end test, I want slug conflicts during deployment to be resolved automatically so that deployments don't fail due to naming collisions.
**Validates:** Slug conflict resolution in deployer
**Preconditions:** Buyer already has an agent with slug `support-router`
**Acceptance Criteria:**

- Deployment detects the slug conflict
- Deployed agent gets suffixed slug: `support-router-2`
- Network topology references updated to use the new slug
- All entity references remain internally consistent

---

## Section 10: Cross-Cutting Concerns

### 10.1 Observability

**US-091:** As a platform operator, I want all playbook lifecycle events logged so that I can audit and debug issues.
**Validates:** AuditLog, ActivityEvent, observability
**Preconditions:** Full lifecycle executed
**Acceptance Criteria:**

- `AuditLog` entries exist for: playbook created, status changed (each transition), deployment started, deployment completed/failed
- `AgentRun` records exist for all agent executions during deployment testing
- `AgentTrace` records exist with step-by-step execution data
- `CostEvent` records exist for all LLM calls during testing
- Structured logs (pino) capture playbook operations with correlation IDs

### 10.2 Inngest Event Chain

**US-092:** As a platform operator, I want the full Inngest event chain to fire correctly during deployment so that background processing completes.
**Validates:** All Inngest playbook events
**Preconditions:** Deployment triggered
**Acceptance Criteria:**

- `playbook/deploy` event fires and is received by `playbookDeployFunction`
- Function progresses through: entity creation, document re-embedding, test execution
- Status updates written to `PlaybookInstallation` at each stage
- On failure: error captured, status set to `FAILED`, error propagated to installation record

### 10.3 Trust Score Lifecycle

**US-093:** As a platform operator, I want trust scores to recalculate daily so that marketplace listings reflect real performance.
**Validates:** Trust score cron, AgentReputation aggregation
**Preconditions:** Active installations with agent run history
**Acceptance Criteria:**

- Daily cron (`playbook/trust-score.recalculate`) fires
- For each published playbook: queries `AgentReputation` records for agents across all active installations
- Computes weighted average trust score (weighted by `totalRuns`)
- Updates `Playbook.trustScore`
- Marketplace listing displays the updated trust score

### 10.4 Version Control

**US-094:** As a builder, I want to publish a new version of my playbook so that buyers can get updates.
**Validates:** PlaybookVersion, version incrementing, manifest regeneration
**Preconditions:** Published playbook with at least one installation
**Acceptance Criteria:**

- Builder modifies agent instructions
- `POST /api/playbooks/[slug]/package` creates a new `PlaybookVersion` with `version: 2`
- New version has its own manifest (reflecting the changes)
- Previous version remains accessible
- `Playbook.version` field updated to 2
- Existing installations remain on version 1 (no auto-update in MVP)

### 10.5 Performance

**US-095:** As a platform operator, I want playbook API endpoints to respond within acceptable latency so that the marketplace is usable.
**Validates:** API performance
**Preconditions:** Database with 50+ playbooks
**Acceptance Criteria:**

- `GET /api/playbooks` (browse) responds in < 500ms
- `GET /api/playbooks/[slug]` (detail) responds in < 300ms
- `POST /api/playbooks/[slug]/purchase` responds in < 2s (includes Stripe call for paid)
- `POST /api/playbooks/[slug]/deploy` responds in < 1s (returns immediately, background job runs async)
- Deployment background job completes within 5 minutes for a 3-agent playbook

### 10.6 Concurrency

**US-096:** As a platform operator, I want concurrent deployments to not interfere with each other so that multi-tenant operations are safe.
**Validates:** Transaction isolation, concurrent writes
**Preconditions:** Two different buyers deploying the same playbook simultaneously
**Acceptance Criteria:**

- Both deployments complete successfully
- Each buyer has their own set of created entities (no shared state)
- `PlaybookInstallation` records are distinct with separate `createdAgentIds`
- `installCount` is incremented correctly (not lost due to race condition)

---

## Section 11: Seed Script Validation

**US-097:** As a developer, I want the marketplace seed script to execute cleanly so that test data is available for manual and automated testing.
**Validates:** `scripts/seed-marketplace-test.ts`, Prisma operations, data relationships
**Preconditions:** Clean database with schema applied
**Acceptance Criteria:**

- `bun run scripts/seed-marketplace-test.ts` completes without errors
- Org A (Publisher) created with workspace, 3 agents, network, documents, test cases, guardrails
- Org B (Buyer) created with workspace
- All records have correct foreign key relationships
- Running the script twice is idempotent (upserts don't duplicate data)

---

## Section 12: Type Safety & Build

**US-098:** As a developer, I want the entire codebase to pass TypeScript type-checking so that there are no type errors in the playbook implementation.
**Validates:** TypeScript compilation, type safety
**Preconditions:** All playbook code written
**Acceptance Criteria:**

- `bunx tsc --noEmit` passes for `packages/agentc2` with zero errors
- `bunx tsc --noEmit` passes for `apps/agent` with zero errors (given sufficient memory)
- All Prisma types are correctly used (no `any` casts on model operations)
- Zod schemas in `manifest.ts` align with TypeScript interfaces in `types.ts`

**US-099:** As a developer, I want the linter to pass with zero errors so that code quality is maintained.
**Validates:** ESLint, code quality
**Preconditions:** All playbook code written
**Acceptance Criteria:**

- `bun run lint` passes with zero errors (warnings acceptable)
- No unused imports in playbook files
- No unused variables in playbook files

**US-100:** As a developer, I want the full monorepo build to succeed so that the playbook marketplace is deployable.
**Validates:** Turborepo build, production readiness
**Preconditions:** All playbook code written
**Acceptance Criteria:**

- `bun run build` completes for all apps without errors
- Built output includes all playbook API routes and UI pages
- No missing module errors at build time

---

## Validation Matrix

This matrix maps each user story to the 20 subsystems identified in the vision document, confirming complete coverage.

| #   | Subsystem             | Primary Stories                        | Supporting Stories |
| --- | --------------------- | -------------------------------------- | ------------------ |
| 1   | Agent runtime         | US-008, US-009, US-010, US-011         | US-060, US-085     |
| 2   | Skills system         | US-012, US-013                         | US-061, US-085     |
| 3   | Network routing       | US-018, US-019                         | US-064, US-085     |
| 4   | RAG pipeline          | US-014, US-015                         | US-062, US-085     |
| 5   | Workflow engine       | US-016, US-017                         | US-063, US-085     |
| 6   | Evaluation system     | US-020, US-021, US-022                 | US-067, US-085     |
| 7   | Trust scoring         | US-027, US-093                         | US-085             |
| 8   | Guardrail enforcement | US-023, US-024                         | US-065, US-085     |
| 9   | Budget system         | US-025, US-026                         | US-085             |
| 10  | Multi-tenancy         | US-006, US-007                         | US-062, US-085     |
| 11  | Authentication        | US-003, US-004, US-005                 | US-085             |
| 12  | Packaging engine      | US-031, US-032, US-033, US-034, US-040 | US-085             |
| 13  | Sanitizer             | US-035, US-036, US-037, US-038         | US-085             |
| 14  | Deployment engine     | US-060 - US-065                        | US-085             |
| 15  | Data privacy          | US-007, US-062                         | US-085 (step 8)    |
| 16  | Billing               | US-049, US-050, US-068 - US-071        | US-086             |
| 17  | Version control       | US-017, US-019, US-094                 | US-040             |
| 18  | Integration mapping   | US-028, US-029, US-066                 | US-088             |
| 19  | Memory                | US-010                                 | US-085 (step 7)    |
| 20  | Observability         | US-091, US-092                         | US-085             |

**Coverage:** All 20 subsystems have at least one primary user story and at least one supporting story. US-085 (the free playbook end-to-end journey) touches all 20 simultaneously.

---

## Execution Priority

### Phase A: Bottom-Up (run first)

US-001 through US-030 — validate every primitive independently before composing them.

### Phase B: Vertical Integration (run second)

US-031 through US-070 — validate the packaging, marketplace API, deployment, and commerce subsystems.

### Phase C: Top-Down (run third)

US-071 through US-084 — validate UI pages, navigation, and programmatic tool access.

### Phase D: End-to-End (run last)

US-085 through US-097 — validate the complete lifecycle across all layers simultaneously.

### Phase E: Build Verification (continuous)

US-098 through US-100 — run on every change to ensure the codebase is sound.
