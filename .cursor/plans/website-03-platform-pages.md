---
name: "Website — Plan 3: Platform & Technical Pages"
overview: "Build the platform detail pages that support the home page — Platform Overview, How It Works, Architecture, Channels & Voice, Mission Command, Dark Factory, Marketplace, and Developer pages. These pages serve evaluators who need more depth than the home page provides."
todos:
    - id: phase-1-platform-overview
      content: "Phase 1: Platform Overview and How It Works pages"
      status: pending
    - id: phase-2-architecture-channels
      content: "Phase 2: Architecture & Technical page + Channels & Voice page"
      status: pending
    - id: phase-3-mission-command-dark-factory-marketplace
      content: "Phase 3: Mission Command, Dark Factory, and Marketplace pages"
      status: pending
    - id: phase-4-developer-pages
      content: "Phase 4: Developer Overview, API Reference overview, and MCP Integration Guide"
      status: pending
isProject: false
---

# Plan 3: Platform & Technical Pages

**Priority:** High — evaluators need depth beyond the home page

**Depends on:** Plan 1 (Foundation)

**Estimated Effort:** Large (5–7 days)

---

## Phase 1: Platform Overview + How It Works

### 1.1 Platform Overview (`/platform`)

**Purpose:** The deep-dive page for visitors who want to understand everything AgentC2 does. This is the "product page."

**Sections:**

1. **Hero:** "The complete AI agent operations platform"
    - Short paragraph establishing the scope
    - CTA: "Get Started Free" + "See Architecture"

2. **Agent Lifecycle Diagram:**
   Build → Configure → Deploy → Monitor → Learn → Improve
    - Visual flow with icons for each stage
    - Short description under each stage

3. **Core Primitives:**
    - **Agents** — Database-driven, model-agnostic, instruction-based AI agents with memory, skills, and tools
    - **Skills** — Composable bundles of instructions, documents, and tools that can be pinned or progressively discovered
    - **Workflows** — Multi-step orchestration with branch, parallel, foreach, human-in-the-loop, and sub-workflow steps
    - **Networks** — Multi-agent topologies where agents delegate, collaborate, and escalate
    - **Campaigns** — Autonomous multi-mission execution with planning, task assignment, and After Action Reviews
    - **Playbooks** — Packaged agent solutions (agents + skills + docs + workflows + networks) deployable from the marketplace

    Each primitive gets a card with icon, title, description, and "Learn more →" link.

4. **Model Flexibility:**
    - Model-agnostic: OpenAI, Anthropic, Google
    - Automatic complexity-based routing (Fast / Primary / Escalation / Reasoning)
    - Budget-aware model selection
    - Per-organization API key support

5. **Memory & Knowledge:**
    - Conversation memory (last 40 messages)
    - Semantic recall (vector search across older conversations)
    - Working memory (structured user/context data with auto-consolidation)
    - RAG pipeline: document ingestion, chunking, vector search, keyword search, reciprocal rank fusion
    - Tenant-isolated knowledge bases

6. **Voice Capabilities:**
    - ElevenLabs: text-to-speech, voice cloning
    - OpenAI: STT (Whisper), TTS
    - Hybrid mode: OpenAI STT + ElevenLabs TTS
    - Twilio voice channel for phone calls
    - Live conversational agents with MCP tool integration

7. **Background Processing:**
    - Inngest event-driven workflows
    - Cron scheduling with timezone support
    - Webhook triggers
    - Event-based automation

8. **CTA Banner:** "Ready to see it in action?" + "Get Started Free" + "Watch Demo"

### 1.2 How It Works (`/platform/how-it-works`)

**Purpose:** Step-by-step walkthrough for evaluators who want to understand the product flow before signing up.

**Sections:**

1. **Hero:** "From zero to production agents in under an hour"

2. **Step 1: Sign Up & Onboarding**
    - Create account (Google OAuth or email)
    - Create or join an organization
    - Connect first integration (Gmail, Slack, HubSpot, etc.)
    - Screenshot of onboarding flow

3. **Step 2: Build Your First Agent**
    - Write natural language instructions
    - Select model (GPT-4o, Claude Sonnet, etc.)
    - Attach tools from the 200+ MCP registry
    - Attach skills for domain-specific capabilities
    - Connect knowledge base (RAG)
    - Configure memory settings
    - Screenshot of agent configuration

4. **Step 3: Deploy**
    - Deploy to workspace (web chat)
    - Connect to Slack, WhatsApp, Telegram, or voice
    - Create white-label embed for external deployment
    - Or install from the Playbook Marketplace
    - Screenshot of deployment options

5. **Step 4: Monitor & Observe**
    - View runs, traces, and tool calls
    - Monitor conversations and activity feed
    - Check agent performance scorecards
    - Screenshot of observability dashboard

6. **Step 5: Learn & Improve**
    - Learning pipeline extracts signals from runs
    - Generates improvement proposals
    - Runs A/B experiments
    - Auto-promotes winning configurations
    - Screenshot of learning pipeline

7. **Step 6: Scale**
    - Add workspaces for different teams/environments
    - Set organization-wide guardrails and budgets
    - Federate with partner organizations
    - Execute campaigns across multiple agents
    - Screenshot of org settings / admin

8. **CTA:** "Start building now" + link to signup

---

## Phase 2: Architecture + Channels & Voice

### 2.1 Architecture & Technical (`/platform/architecture`)

**Purpose:** For CTOs, architects, and engineering leads evaluating the technical stack.

**Sections:**

1. **Hero:** "Built on proven open-source foundations, hardened for production"

2. **Technology Stack Table:**

    | Layer           | Technology                         | Purpose                                                  |
    | --------------- | ---------------------------------- | -------------------------------------------------------- |
    | Runtime         | Bun 1.3.4+, Turborepo              | Package management, build orchestration                  |
    | Framework       | Next.js 16, React 19, TypeScript 5 | Application framework                                    |
    | AI Framework    | Mastra Core                        | Agent orchestration, workflows, memory                   |
    | MCP             | @mastra/mcp                        | Model Context Protocol client for 200+ tool integrations |
    | Database        | PostgreSQL (Supabase), Prisma 6    | Relational data, schema management                       |
    | Vector DB       | PgVector                           | Embeddings for RAG and semantic search                   |
    | Auth            | Better Auth                        | Session-based authentication with OAuth                  |
    | Voice           | ElevenLabs, OpenAI                 | TTS, STT, voice cloning, real-time voice                 |
    | Background Jobs | Inngest                            | Event-driven workflow processing                         |
    | UI              | shadcn/ui, Tailwind CSS 4          | Component library, styling                               |

3. **Architecture Diagram:**
   Multi-tier diagram showing:
    - Client layer (web, Slack, WhatsApp, Telegram, voice, embed)
    - API layer (Next.js API routes, middleware, auth)
    - Agent layer (resolver, memory, tools, guardrails, learning)
    - MCP layer (tool registry, MCP clients, OAuth)
    - Data layer (PostgreSQL, PgVector, Supabase)
    - Background layer (Inngest, triggers, schedules)

4. **MCP Architecture:**
    - What is MCP (Model Context Protocol): the open standard for AI-to-tool communication
    - How AgentC2 uses MCP: per-org clients with cached connections, credential encryption, schema sanitization, last-known-good fallback
    - Dynamic tool loading: tools discovered at runtime via MCP servers
    - Naming convention: `{serverId}_{toolName}`
    - Custom MCP server support

5. **Multi-Tenant Architecture:**
    - Organization → Workspace → Agent hierarchy
    - Per-org credentials, connections, and policies
    - Workspace environments (development, staging, production)
    - Org-scoped resource IDs and thread IDs

6. **Security Architecture:**
    - Brief summary linking to the full Security page
    - Guardrail pipeline (input → agent → output)
    - Tool execution guard (permission + egress check)
    - Credential encryption (AES-256-GCM)
    - Federation security (Ed25519 signing)

7. **Deployment Architecture:**
    - Production: Digital Ocean droplet, PM2, Caddy reverse proxy
    - CI/CD: GitHub Actions
    - Database: Supabase (direct connection, not pooled)

8. **API Overview:**
    - REST API for agents, workflows, networks, RAG, skills
    - Webhook endpoints for Slack, ElevenLabs, integrations
    - Inngest event endpoints
    - Link to full API reference

### 2.2 Channels & Voice (`/platform/channels`)

**Purpose:** Detail the multi-channel deployment capability — a key differentiator.

**Sections:**

1. **Hero:** "Deploy once. Reach every channel."

2. **Channel Overview Grid:**

    | Channel               | Capabilities                                                                                             |
    | --------------------- | -------------------------------------------------------------------------------------------------------- |
    | **Web Chat**          | Real-time streaming, file attachments, tool activity visibility, suggestions                             |
    | **Slack**             | @mention and DM support, thread-based memory, per-agent display identity, agent routing (`agent:<slug>`) |
    | **WhatsApp**          | Via Baileys (WhatsApp Web), keyword and session-based routing, commands (`/agent`, `/help`)              |
    | **Telegram**          | Via grammy, keyword and session-based routing, commands                                                  |
    | **Voice (Twilio)**    | Inbound/outbound calls, TTS (ElevenLabs/OpenAI), STT, call routing                                       |
    | **Email**             | Gmail and Outlook integration, thread-based conversations, draft approvals                               |
    | **White-Label Embed** | HMAC authentication, JIT user provisioning, custom branding, domain restrictions, feature presets        |

3. **Unified Memory:**
    - Conversation context preserved across channels
    - Per-channel thread isolation where appropriate
    - Working memory shared across sessions

4. **Routing & Commands:**
    - Default agent per channel
    - Keyword routing: "Agent Name: message"
    - Session-based routing (remembers last agent)
    - Commands: `/agent <name>`, `/help`, `/status`, `/switch`

5. **Voice Deep Dive:**
    - ElevenLabs: text-to-speech with voice cloning, live conversational agents
    - OpenAI: Whisper for STT, TTS models
    - Hybrid mode: best of both (OpenAI STT + ElevenLabs TTS)
    - Twilio integration for phone call channels
    - MCP tool access during voice conversations

6. **Embed System Deep Dive:**
    - HMAC-SHA256 authentication for partner security
    - Feature presets: chat-only, chat-plus, workspace, builder, full
    - JIT provisioning of partner users and memberships
    - Custom branding (colors, logo, name)
    - Domain restrictions for embed deployment
    - Token expiry and session management

---

## Phase 3: Mission Command + Dark Factory + Marketplace

### 3.1 Mission Command (`/platform/mission-command`)

**Purpose:** Explain the autonomous campaign execution system — a unique differentiator.

**Sections:**

1. **Hero:** "Autonomous multi-step execution with military-grade planning"

2. **What is Mission Command:**
    - Borrowed from military doctrine: define intent and end state, let subordinates execute
    - AgentC2 applies this to AI agent operations
    - Campaigns decompose into missions, missions into tasks
    - Agents are assigned to tasks based on capability

3. **Execution Flow:**
   Visual flow diagram:

    ```
    Campaign Created → Analyze (campaign-analyst) → Plan (campaign-planner)
    → [Optional: Build Capabilities] → Mission Execute (parallel by sequence)
    → Task Execute (agent runs) → Mission AAR (campaign-reviewer)
    → [Rework loop if needed] → Campaign AAR → Complete
    ```

4. **Key Features:**
    - Intent-based planning: define what you want, not how to do it
    - Automatic agent assignment with gap detection
    - Budget enforcement per task (`maxCostUsd`)
    - Human approval gates (optional, per-campaign or per-mission)
    - Rework loops with max iteration limits
    - After Action Reviews: sustain/improve patterns with failure taxonomy
    - Context summarization when prior mission context exceeds limits

5. **Use Cases:**
    - Multi-step research campaigns across multiple agents
    - Cross-department project execution
    - Automated reporting pipelines with quality reviews
    - Compliance audit campaigns

### 3.2 Dark Factory (`/platform/dark-factory`)

**Purpose:** Showcase the autonomous coding pipeline for engineering teams.

**Sections:**

1. **Hero:** "Autonomous software development. From ticket to deploy."

2. **Pipeline Stages:**
   Visual flow:

    ```
    Ticket Ingest → Codebase Analysis → Implementation Plan → Risk Classification
    → Plan Approval Gate → Code (Cursor Cloud) → Provision Build Env (DigitalOcean)
    → Build & Test → Scenario Verification → Teardown Compute → CI Checks
    → Trust Score → PR Review Gate → Merge → Await Deployment
    ```

3. **Autonomy Levels:**
   | Level | Description | Human Involvement |
   |-------|-------------|-------------------|
   | 0 | Manual | Every step requires approval |
   | 1 | Assisted | Plan and review require approval |
   | 2 | Supervised | High-risk actions require approval |
   | 3 | Semi-autonomous | Only critical risk requires approval |
   | 4 | Autonomous | Auto-approve low/medium risk |
   | 5 | Full autonomy | Auto-approve high-confidence changes |

4. **Risk Classification:**
    - Trivial / Low / Medium / High / Critical
    - Based on file count, complexity, test coverage, dependency impact
    - Risk gates auto-approve or escalate based on autonomy level

5. **Cursor Cloud Integration:**
    - Launches Cursor Background Agents via API
    - Provides repository context and implementation prompt
    - Polls until completion (configurable timeout)
    - Collects branch name and agent URL

6. **Ephemeral Compute:**
    - Provisions DigitalOcean droplets for build verification
    - Bootstraps with Node, Bun, Git, Docker
    - TTL enforcement (5–180 minutes)
    - Per-org limits (3 active, 10 provisions/hour)
    - Automatic teardown after verification

7. **Trust Scoring:**
    - Build success, test pass rate, scenario coverage
    - CI check status
    - Holdout scenario results
    - Combined into a trust score that gates PR merge

### 3.3 Playbook Marketplace (`/platform/marketplace`)

**Purpose:** Showcase the marketplace as a unique value proposition and growth engine.

**Sections:**

1. **Hero:** "Don't build from scratch. Deploy proven agent solutions in one click."

2. **What is a Playbook:**
    - A packaged agent solution containing:
        - Agents (with instructions, model config, tool bindings)
        - Skills (instructions, documents, tools)
        - Documents (knowledge base content)
        - Workflows (multi-step orchestration)
        - Networks (multi-agent topologies)
        - Campaign templates
        - Guardrail policies
        - Test cases and scorecards
    - Versioned, reviewed, and rated

3. **How Installation Works:**
    - Browse marketplace by category or search
    - View playbook details: components, required integrations, reviews
    - One-click install into your org/workspace
    - Automatic integration mapping to your connections
    - Slug conflict resolution
    - Optional boot sequence: auto-embeds documents, seeds backlog tasks
    - Customize after installation

4. **Publishing Your Own:**
    - Package agents, skills, docs, workflows, networks from your workspace
    - Set pricing model: Free, One-Time, Subscription, Per-Use
    - Submit for review
    - Track install count, ratings, and revenue

5. **Monetization:**
    - Stripe Connect integration for payouts
    - Platform fee structure
    - Revenue tracking and payout history

6. **Featured Categories:**
    - Sales & CRM
    - Customer Support
    - Engineering & DevOps
    - Operations & Project Management
    - Industry-Specific (Construction, etc.)

---

## Phase 4: Developer Pages

### 4.1 Developer Overview (`/developers`)

**Purpose:** Entry point for developers who want to extend, integrate, or build on AgentC2.

**Sections:**

1. **Hero:** "Build with AgentC2. Extend everything."

2. **Getting Started:**
    - API authentication (session-based, API keys)
    - Quick example: invoke an agent via API
    - Link to full docs

3. **Capabilities Grid:**
    - **REST API** — Full CRUD for agents, workflows, networks, skills, knowledge, campaigns
    - **MCP Integration** — Bring your own MCP servers, connect custom tools
    - **Webhook System** — Inngest events, Slack, ElevenLabs, integration webhooks
    - **Embed SDK** — White-label agent deployment with HMAC auth
    - **Custom Tools** — Build and register custom tools
    - **Playbook Authoring** — Package and publish agent solutions

4. **Links:**
    - Full Documentation → `/docs`
    - API Reference → `/developers/api`
    - MCP Guide → `/developers/mcp`
    - GitHub → (actual repo URL)

### 4.2 API Reference Overview (`/developers/api`)

**Purpose:** Overview of the API surface with quick references.

**Note:** The full API docs already exist at `/docs/api/*`. This page serves as a navigable overview with code examples.

**Sections:**

1. Authentication
2. Agents API (list, create, invoke, chat, stream)
3. Workflows API (create, execute, resume)
4. Networks API (create, execute)
5. Knowledge API (ingest, query, list)
6. Skills API (create, attach, list)
7. MCP API (list tools, execute tool)
8. Webhooks (receive events)

Each section: endpoint summary + curl example + link to full docs.

### 4.3 MCP Integration Guide (`/developers/mcp`)

**Purpose:** Explain MCP and how developers can connect custom MCP servers to AgentC2.

**Sections:**

1. **What is MCP:**
    - Model Context Protocol — the open standard for connecting AI agents to external tools and services
    - Developed by Anthropic, adopted across the ecosystem
    - How it works: servers expose tools, clients discover and invoke them
    - Why it matters: standardized tool integration instead of custom adapters

2. **MCP in AgentC2:**
    - 40+ built-in MCP server integrations
    - Per-organization MCP clients with credential isolation
    - Schema sanitization for compatibility
    - Last-known-good fallback for resilience
    - Dynamic tool loading at runtime

3. **Bring Your Own MCP Server:**
    - How to connect a custom MCP server
    - Configuration via the Integrations Hub
    - JSON import for MCP server definitions
    - Testing and debugging MCP connections

4. **Using MCP Tools in Cursor:**
    - AgentC2 as an MCP server for Cursor IDE
    - Setup guide with screenshots
    - Available tools via MCP

5. **Tool Naming and Discovery:**
    - Convention: `{serverId}_{toolName}`
    - How agents discover and select tools
    - Skill-based MCP tool exposure

---

## Verification Checklist

- [ ] All 8 platform pages render correctly
- [ ] Each page has unique meta tags (title, description, OG image)
- [ ] MCP is explained clearly on first use in each page where it appears
- [ ] Architecture diagram is accurate and matches actual system
- [ ] Channel capabilities match actual implementation
- [ ] Dark Factory autonomy levels are correctly described
- [ ] Marketplace page accurately describes playbook structure
- [ ] Developer pages link to actual documentation
- [ ] All internal links work (no broken links)
- [ ] Pages are responsive (mobile, tablet, desktop)
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
