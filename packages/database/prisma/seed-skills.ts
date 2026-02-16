/**
 * Seed Script for SYSTEM Skills
 *
 * Creates all 33 composable skills that group the platform's 148+ tools
 * into focused capability bundles for progressive tool disclosure.
 *
 * Skills are attached to agents via the AgentSkill junction table.
 * Each skill bundles: tools + instructions + description (discovery manifest).
 *
 * Run: bun run prisma/seed-skills.ts
 * Must run BEFORE seed-agents.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SkillDefinition {
    slug: string;
    name: string;
    description: string;
    instructions: string;
    category: string;
    tags: string[];
    tools: string[];
    type: "SYSTEM" | "USER";
}

// ==============================
// Platform Skills (17)
// ==============================

const platformSkills: SkillDefinition[] = [
    {
        slug: "platform-agent-management",
        name: "Agent Management",
        description: "Create, configure, read, update, delete, and list AI agents on the platform.",
        instructions: `## Agent Management

You can create, read, update, delete, and list AI agents.

### When creating agents:
- Always ask for a clear name and purpose
- Set modelProvider to "openai" or "anthropic"
- Set modelName to a valid model (e.g., "gpt-4o", "claude-sonnet-4-20250514")
- Include clear instructions that define the agent's role and capabilities
- Set appropriate maxSteps (default 5)

### When updating agents:
- Use agent-read first to get current configuration
- Only modify the fields that need changing
- Agent updates create a new version automatically`,
        category: "builder",
        tags: ["agents", "crud", "management"],
        tools: [
            "agent-create",
            "agent-read",
            "agent-update",
            "agent-delete",
            "agent-list",
            "agent-overview"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-workflow-management",
        name: "Workflow Management",
        description:
            "Create, read, update, delete, and version workflow definitions with rollback support.",
        instructions: `## Workflow Management

You can create, read, update, delete, and version workflow definitions.

### When creating/updating workflows:
- Workflows have a definitionJson with steps array
- Each step has an id, type, and configuration
- Workflows support input/output schemas for type safety
- Use workflow-versions to inspect version history and roll back`,
        category: "builder",
        tags: ["workflows", "crud", "builder"],
        tools: [
            "workflow-create",
            "workflow-read",
            "workflow-update",
            "workflow-delete",
            "workflow-versions"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-workflow-execution",
        name: "Workflow Execution",
        description:
            "Execute workflows, monitor runs, resume suspended workflows, and view metrics.",
        instructions: `## Workflow Execution

You can execute workflows, list and inspect runs, resume suspended workflows, and view metrics.

### Executing workflows:
- Use workflow-execute with the workflow slug and input payload
- Workflows return the run ID and output
- Some workflows may suspend for human-in-the-loop approval

### Monitoring:
- Use workflow-list-runs to see recent runs with status filters
- Use workflow-get-run to inspect a specific run's steps and output
- Use workflow-metrics for aggregate performance data`,
        category: "operations",
        tags: ["workflows", "execution", "monitoring"],
        tools: [
            "workflow-execute",
            "workflow-list-runs",
            "workflow-get-run",
            "workflow-resume",
            "workflow-metrics",
            "workflow-stats"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-network-management",
        name: "Network Management",
        description:
            "Create, read, update, delete, and version agent network definitions with rollback support.",
        instructions: `## Network Management

You can create, read, update, delete, and version agent networks.

### Network structure:
- Networks have a routing agent that delegates to sub-agents
- Primitives define which agents, workflows, and tools are available
- Networks require memory configuration for conversation state
- Use network-versions to inspect version history and roll back`,
        category: "builder",
        tags: ["networks", "crud", "builder"],
        tools: [
            "network-create",
            "network-read",
            "network-update",
            "network-delete",
            "network-versions"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-network-execution",
        name: "Network Execution",
        description: "Execute agent networks, monitor runs, and view network metrics.",
        instructions: `## Network Execution

You can execute networks, list and inspect runs, and view metrics.

### Executing networks:
- Use network-execute with the network slug and a message
- Networks route messages to the appropriate sub-agent
- Results include the routing decisions and final output

### Monitoring:
- Use network-list-runs for run history
- Use network-get-run for detailed run inspection
- Use network-metrics for aggregate performance data`,
        category: "operations",
        tags: ["networks", "execution", "monitoring"],
        tools: [
            "network-execute",
            "network-list-runs",
            "network-get-run",
            "network-metrics",
            "network-stats"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-triggers-schedules",
        name: "Triggers & Schedules",
        description:
            "Create and manage unified execution triggers: schedules, webhooks, and event-based triggers for agents.",
        instructions: `## Triggers & Schedules

You can create, read, update, delete, enable, and disable unified execution triggers.

### Trigger types:
- **schedule**: Cron-based recurring execution (e.g., "0 9 * * MON-FRI")
- **webhook**: HTTP endpoint that triggers on incoming requests
- **event**: Triggered by internal platform events

### Best practices:
- Always set a descriptive name and description
- For schedules, use standard cron expressions
- Triggers can be enabled/disabled without deleting them`,
        category: "operations",
        tags: ["triggers", "schedules", "automation"],
        tools: [
            "trigger-unified-list",
            "trigger-unified-get",
            "trigger-unified-create",
            "trigger-unified-update",
            "trigger-unified-delete",
            "trigger-unified-enable",
            "trigger-unified-disable"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-observability",
        name: "Observability & Metrics",
        description:
            "Monitor live runs, view agent analytics and costs, manage budgets, and query audit logs.",
        instructions: `## Observability & Metrics

You can monitor live production runs, view agent analytics, track costs, manage budgets, and query audit logs.

### Key tools:
- live-runs/live-metrics/live-stats: Real-time production monitoring
- agent-overview: Quick stats for a specific agent
- agent-analytics: Detailed analytics with tool usage and quality scores
- agent-costs: Cost breakdown by model and time period
- agent-budget-get/update: View and manage spend limits
- audit-logs-list: Query all write operations for compliance`,
        category: "operations",
        tags: ["monitoring", "metrics", "costs", "analytics"],
        tools: [
            "live-runs",
            "live-metrics",
            "live-stats",
            "agent-overview",
            "agent-analytics",
            "agent-costs",
            "agent-budget-get",
            "agent-budget-update",
            "metrics-agent-runs",
            "audit-logs-list",
            "metrics-live-summary",
            "metrics-agent-analytics",
            "metrics-workflow-daily",
            "metrics-network-daily"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-quality-safety",
        name: "Quality & Safety",
        description:
            "Submit feedback, manage guardrails, create test cases, and control agent runs (cancel, rerun, trace).",
        instructions: `## Quality & Safety

You can manage agent quality through feedback, guardrails, test cases, and run control.

### Feedback:
- Submit thumbs up/down or ratings for agent runs
- View feedback summaries to understand agent performance

### Guardrails:
- Get/update guardrail policies that filter agent output
- View guardrail events to see what was blocked/modified

### Test Cases:
- Create test cases with expected outputs for regression testing
- List existing test cases for an agent

### Run Control:
- Cancel running executions
- Rerun a previous execution with the same input
- Get detailed execution traces for debugging`,
        category: "operations",
        tags: ["quality", "safety", "feedback", "guardrails", "testing"],
        tools: [
            "agent-feedback-submit",
            "agent-feedback-list",
            "agent-guardrails-get",
            "agent-guardrails-update",
            "agent-guardrails-events",
            "agent-test-cases-list",
            "agent-test-cases-create",
            "agent-run-cancel",
            "agent-run-rerun",
            "agent-run-trace"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-learning",
        name: "Agent Learning",
        description:
            "Start and manage closed-loop learning sessions, review proposals, run experiments, and track learning metrics.",
        instructions: `## Agent Learning

You can manage the closed-loop learning system that improves agents over time.

### Learning flow:
1. Start a learning session to analyze recent runs
2. The system extracts signals (failures, low scores, patterns)
3. Proposals are generated for improvements
4. Experiments (A/B tests) validate proposals
5. Approve or reject proposals to promote changes

### Key tools:
- agent-learning-start: Begin a new learning cycle
- agent-learning-sessions: List past sessions
- agent-learning-session-get: Detailed session info
- agent-learning-proposal-approve/reject: Human decision on proposals
- agent-learning-experiments: View A/B test results
- agent-learning-metrics: KPIs for the learning system`,
        category: "operations",
        tags: ["learning", "improvement", "experiments"],
        tools: [
            "agent-learning-sessions",
            "agent-learning-start",
            "agent-learning-session-get",
            "agent-learning-proposal-approve",
            "agent-learning-proposal-reject",
            "agent-learning-experiments",
            "agent-learning-metrics",
            "agent-learning-policy"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-simulations",
        name: "Agent Simulations",
        description:
            "Run and analyze simulated conversations to test agents under realistic conditions.",
        instructions: `## Agent Simulations

You can run batches of simulated conversations to stress-test agents.

### Usage:
- Start a simulation with a theme (e.g., "Customer service about timesheets")
- The system generates realistic user messages and runs them against the agent
- View results: success rate, quality scores, duration, cost
- Use simulations before deploying agents to production`,
        category: "operations",
        tags: ["simulations", "testing", "quality"],
        tools: ["agent-simulations-list", "agent-simulations-start", "agent-simulations-get"],
        type: "SYSTEM"
    },
    {
        slug: "platform-knowledge-management",
        name: "Knowledge Management",
        description:
            "Manage the RAG pipeline: ingest documents, query the knowledge base, and manage document lifecycle.",
        instructions: `## Knowledge Management

You can manage the RAG (Retrieval Augmented Generation) pipeline and document system.

### RAG Pipeline:
- rag-ingest: Add documents to the vector index for semantic search
- rag-query: Search the knowledge base by meaning (not just keywords)
- rag-documents-list: See all ingested documents
- rag-document-delete: Remove documents from the index

### Document Management:
- document-create: Create structured documents (auto-embedded into RAG)
- document-read/update/delete: Full lifecycle management
- document-list: Browse documents with category and tag filters
- document-search: Semantic search scoped to specific documents`,
        category: "knowledge",
        tags: ["rag", "documents", "knowledge-base", "search"],
        tools: [
            "rag-query",
            "rag-ingest",
            "rag-documents-list",
            "rag-document-delete",
            "document-create",
            "document-read",
            "document-update",
            "document-delete",
            "document-list",
            "document-search"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-skill-management",
        name: "Skill Management",
        description:
            "Create, update, and manage composable skill bundles: attach/detach tools and documents, bind skills to agents.",
        instructions: `## Skill Management

You can manage skills — composable competency bundles that group tools, instructions, and knowledge.

### Skill lifecycle:
- Create skills with instructions, description, category, and tags
- Attach tools to a skill (tools define what the skill can do)
- Attach documents to a skill (documents provide reference knowledge)
- Attach skills to agents (agents gain the skill's tools and knowledge)

### Best practices:
- Keep skills focused: 5-15 tools per skill
- Write clear instructions that explain WHEN and HOW to use the tools
- Use descriptions as discovery manifests (1-2 sentences)
- Categorize skills: builder, operations, integration, utility, domain`,
        category: "builder",
        tags: ["skills", "crud", "management"],
        tools: [
            "skill-create",
            "skill-read",
            "skill-update",
            "skill-delete",
            "skill-list",
            "skill-attach-document",
            "skill-detach-document",
            "skill-attach-tool",
            "skill-detach-tool",
            "agent-attach-skill",
            "agent-detach-skill",
            "skill-get-versions"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-canvas-dashboards",
        name: "Canvas & Dashboards",
        description:
            "Build interactive dashboards and data views with data queries, charts, KPIs, and tables.",
        instructions: `## Canvas & Dashboards

You can create, read, update, and delete interactive canvases (dashboards/reports).

### Building canvases:
- Use canvas-list-blocks to see available component types (charts, KPIs, tables, etc.)
- Use canvas-query-preview to test data queries before adding them
- Use canvas-create to build the canvas with components and data bindings
- Use canvas-execute-queries to verify data flows after creation

### Canvas structure:
- schemaJson: { title, components[], dataQueries[], layout, theme }
- Components reference dataQueries by ID for data binding
- Data queries support: mcp, sql, rag, static, api sources`,
        category: "builder",
        tags: ["canvas", "dashboards", "visualization"],
        tools: [
            "canvas-create",
            "canvas-read",
            "canvas-update",
            "canvas-delete",
            "canvas-list",
            "canvas-query-preview",
            "canvas-list-blocks",
            "canvas-execute-queries"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-integrations",
        name: "Integration Management",
        description:
            "Manage MCP server connections: import configurations, test connections, list providers and connections.",
        instructions: `## Integration Management

You can manage MCP (Model Context Protocol) server integrations.

### Key operations:
- integration-providers-list: See all available integration providers
- integration-connections-list: See active connections for the organization
- integration-connection-create: Create a new connection with credentials
- integration-connection-test: Validate credentials and list available tools
- integration-import-mcp-json: Bulk import MCP server configurations from JSON
- integration-mcp-config: Read/plan/apply MCP configuration changes`,
        category: "admin",
        tags: ["integrations", "mcp", "connections"],
        tools: [
            "integration-import-mcp-json",
            "integration-mcp-config",
            "integration-connection-test",
            "integration-providers-list",
            "integration-connections-list",
            "integration-connection-create"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-organization",
        name: "Organization Management",
        description:
            "Manage organizations, members, and workspaces for multi-tenant platform administration.",
        instructions: `## Organization Management

You can manage the multi-tenant organization structure.

### Key operations:
- org-list/org-get: View organizations
- org-members-list/org-member-add: Manage team members and roles
- org-workspaces-list/org-workspace-create: Manage workspaces within an org

### Organization hierarchy:
Organization → Workspaces → Agents/Workflows/Networks
Members have roles: owner, admin, member, viewer`,
        category: "admin",
        tags: ["organization", "members", "workspaces", "admin"],
        tools: [
            "org-list",
            "org-get",
            "org-members-list",
            "org-member-add",
            "org-workspaces-list",
            "org-workspace-create"
        ],
        type: "SYSTEM"
    },
    {
        slug: "platform-webhooks",
        name: "Webhook Management",
        description:
            "List available agents for webhooks and create webhook triggers wired to agents.",
        instructions: `## Webhook Management

You can manage webhook triggers that connect external systems to agents.

### Key operations:
- webhook-list-agents: List all active agents that can receive webhook triggers
- webhook-create: Create a new webhook trigger wired to a specific agent`,
        category: "operations",
        tags: ["webhooks", "triggers"],
        tools: ["webhook-list-agents", "webhook-create"],
        type: "SYSTEM"
    },
    {
        slug: "platform-goals",
        name: "Goal Management",
        description: "Create, list, and track goals for the current user.",
        instructions: `## Goal Management

You can create and track goals.

### Key operations:
- goal-create: Create a new goal with title, description, and priority
- goal-list: List all goals for the current user
- goal-get: Get details for a specific goal`,
        category: "operations",
        tags: ["goals", "tracking"],
        tools: ["goal-create", "goal-list", "goal-get"],
        type: "SYSTEM"
    }
];

// ==============================
// Utility Skills (3)
// ==============================

const utilitySkills: SkillDefinition[] = [
    {
        slug: "core-utilities",
        name: "Core Utilities",
        description:
            "Basic utility tools: current date/time, mathematical calculations, unique ID generation, and JSON parsing.",
        instructions: `## Core Utilities

Always-available utility tools for common operations.

- **date-time**: Get current date/time in any timezone
- **calculator**: Perform math (basic ops, exponents, trig, etc.)
- **generate-id**: Create unique identifiers with optional prefix
- **json-parser**: Parse JSON strings and extract fields using dot notation`,
        category: "utility",
        tags: ["utilities", "datetime", "math", "json"],
        tools: ["date-time", "calculator", "generate-id", "json-parser"],
        type: "SYSTEM"
    },
    {
        slug: "web-research",
        name: "Web Research",
        description:
            "Fetch and parse web content from URLs and recall information from conversation memory.",
        instructions: `## Web Research

Tools for gathering information from the web and conversation history.

- **web-fetch**: Fetch content from any URL with automatic HTML text extraction
- **memory-recall**: Search conversation history using semantic similarity to recall past context`,
        category: "utility",
        tags: ["web", "research", "memory"],
        tools: ["web-fetch", "memory-recall"],
        type: "SYSTEM"
    },
    {
        slug: "user-interaction",
        name: "User Interaction",
        description:
            "Collect structured input from users with interactive multiple-choice questions.",
        instructions: `## User Interaction

- **ask-questions**: Present structured questions to the user with clickable numbered options. Use when you need to gather specific information through a structured question format.`,
        category: "utility",
        tags: ["interactive", "questions", "ui"],
        tools: ["ask-questions"],
        type: "SYSTEM"
    }
];

// ==============================
// Domain Skills (2)
// ==============================

const domainSkills: SkillDefinition[] = [
    {
        slug: "bim-engineering",
        name: "BIM Engineering",
        description:
            "Building Information Modeling analysis: query elements, compute takeoffs, compare versions, detect clashes, and generate handover docs.",
        instructions: `## BIM Engineering

Tools for Building Information Modeling (BIM) analysis and reporting.

- **bim-query**: Query BIM elements with filters (category, system, level, type)
- **bim-takeoff**: Compute quantity takeoff totals from a BIM model version
- **bim-diff**: Compare two BIM model versions by element GUID and properties
- **bim-clash**: Run bounding-box clash analysis for a BIM version
- **bim-handover**: Generate an asset register for operations and handover`,
        category: "domain",
        tags: ["bim", "engineering", "construction"],
        tools: ["bim-query", "bim-takeoff", "bim-diff", "bim-clash", "bim-handover"],
        type: "SYSTEM"
    },
    {
        slug: "email-management",
        name: "Email & Calendar Management",
        description:
            "Full email and calendar operations across Google (Gmail, Google Calendar) and Microsoft (Outlook Mail, Outlook Calendar): search, read, draft, send, archive emails and list, search, create, update calendar events.",
        instructions: `## Email & Calendar Management

### Gmail
- **gmail-search-emails**: Search Gmail for emails matching a query
- **gmail-read-email**: Read the full content of a specific email
- **gmail-draft-email**: Create a draft reply or new email in Gmail
- **gmail-send-email**: Send an email via Gmail. ALWAYS show a preview first and get user confirmation before sending (use confirmSend=true only after approval).
- **gmail-archive-email**: Archive a Gmail email by removing it from the inbox

### Google Calendar
- **google-calendar-search-events**: Search Google Calendar for events by text query and date range
- **google-calendar-list-events**: List upcoming events in a date range
- **google-calendar-get-event**: Get full details of a specific event by ID
- **google-calendar-create-event**: Create a new calendar event. ALWAYS show a preview first and get user confirmation before creating (use confirmCreate=true only after approval).
- **google-calendar-update-event**: Update an existing event (PATCH — only sends changed fields)
- **google-calendar-delete-event**: Delete a calendar event. ALWAYS confirm with the user before deleting (use confirmDelete=true only after explicit approval).

### Outlook Mail
- **outlook-mail-list-emails**: List recent emails from Outlook inbox or folders
- **outlook-mail-get-email**: Read a specific Outlook email by ID
- **outlook-mail-send-email**: Send an email via Outlook
- **outlook-mail-archive-email**: Archive an Outlook email

### Outlook Calendar
- **outlook-calendar-list-events**: List upcoming events from Outlook Calendar
- **outlook-calendar-get-event**: Get details of a specific Outlook Calendar event
- **outlook-calendar-create-event**: Create a new Outlook Calendar event
- **outlook-calendar-update-event**: Update an existing Outlook Calendar event`,
        category: "domain",
        tags: ["email", "gmail", "outlook", "calendar", "google-calendar"],
        tools: [
            "gmail-search-emails",
            "gmail-read-email",
            "gmail-draft-email",
            "gmail-send-email",
            "gmail-archive-email",
            "google-calendar-search-events",
            "google-calendar-list-events",
            "google-calendar-get-event",
            "google-calendar-create-event",
            "google-calendar-update-event",
            "google-calendar-delete-event",
            "outlook-mail-list-emails",
            "outlook-mail-get-email",
            "outlook-mail-send-email",
            "outlook-mail-archive-email",
            "outlook-calendar-list-events",
            "outlook-calendar-get-event",
            "outlook-calendar-create-event",
            "outlook-calendar-update-event"
        ],
        type: "SYSTEM"
    },
    {
        slug: "google-drive-files",
        name: "Google Drive Files",
        description:
            "Native Google Drive file operations: search, read, and create Google Docs, Sheets, and Slides using Google OAuth.",
        instructions: `## Google Drive Files

Access Google Drive using native OAuth (same Google account as Gmail/Calendar).

### Capabilities:
- **google-drive-search-files**: Search files by name, content, or type using Drive query syntax
- **google-drive-read-file**: Read content from Google Docs (as text), Sheets (as CSV), Slides, or other files
- **google-drive-create-doc**: Create a new Google Doc with text content

### Best practices:
- Use search to find files before trying to read them
- Google Docs/Sheets/Slides are automatically exported to text formats
- File content is truncated at 50KB to avoid token explosion`,
        category: "domain",
        tags: ["google-drive", "files", "documents", "google"],
        tools: ["google-drive-search-files", "google-drive-read-file", "google-drive-create-doc"],
        type: "SYSTEM"
    },
    {
        slug: "cloud-file-storage",
        name: "Cloud File Storage",
        description:
            "Access and manage files in cloud storage: list, read, upload, search files and manage sharing links in Dropbox.",
        instructions: `## Cloud File Storage

Manage files in Dropbox cloud storage.

### Capabilities:
- **dropbox-list-files**: List files and folders in a Dropbox path
- **dropbox-get-file**: Read the content of a specific file
- **dropbox-upload-file**: Upload a file to Dropbox
- **dropbox-search-files**: Search for files by name or content
- **dropbox-get-sharing-links**: Get or create sharing links for files

### Best practices:
- Use search before listing to find files efficiently
- Always check sharing link permissions before sharing externally`,
        category: "domain",
        tags: ["dropbox", "files", "storage", "cloud"],
        tools: [
            "dropbox-list-files",
            "dropbox-get-file",
            "dropbox-upload-file",
            "dropbox-search-files",
            "dropbox-get-sharing-links"
        ],
        type: "SYSTEM"
    }
];

// ==============================
// MCP Integration Skills (11)
// ==============================

const mcpSkills: SkillDefinition[] = [
    {
        slug: "mcp-crm-hubspot",
        name: "HubSpot CRM",
        description:
            "CRM operations via HubSpot: search and manage contacts, companies, deals, pipeline, properties, and engagements.",
        instructions: `## HubSpot CRM Integration

Access HubSpot CRM data and operations through MCP tools.

### Capabilities:
- Search, create, and update contacts, companies, and deals
- Manage deal pipeline and stages
- View and manage properties and property groups
- Access engagements (notes, calls, emails, meetings)
- Get current user details

### Best practices:
- Use search tools before creating to avoid duplicates
- When creating contacts, include email as a required field
- Deal stages follow the configured pipeline order`,
        category: "integration",
        tags: ["crm", "hubspot", "sales", "contacts"],
        tools: [], // MCP tools are dynamically resolved — tool IDs populated at connection time
        type: "SYSTEM"
    },
    {
        slug: "mcp-project-jira",
        name: "Jira Project Management",
        description:
            "Project management via Jira: search and manage issues, sprints, projects, comments, and transitions.",
        instructions: `## Jira Project Management Integration

Access Jira project management through MCP tools.

### Capabilities:
- Search issues with JQL queries
- Create, update, and transition issues
- Add and view comments
- List projects and get current user info
- Manage sprint-related workflow

### Best practices:
- Use JQL for powerful issue searches (e.g., "project = PROJ AND status = 'In Progress'")
- Check available transitions before transitioning an issue
- Always include a summary when creating issues`,
        category: "integration",
        tags: ["jira", "project-management", "issues", "agile"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-web-firecrawl",
        name: "Firecrawl Web Scraping",
        description:
            "Web scraping and crawling via Firecrawl: scrape single pages, crawl websites, and extract structured content.",
        instructions: `## Firecrawl Web Scraping Integration

Access web scraping capabilities through MCP tools.

### Capabilities:
- Scrape single URLs for content extraction
- Crawl entire websites to discover pages
- Get sitemaps for a domain
- Monitor crawl job status
- Cancel running crawl jobs`,
        category: "integration",
        tags: ["web", "scraping", "firecrawl"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-web-playwright",
        name: "Playwright Browser Automation",
        description:
            "Browser automation via Playwright: navigate pages, interact with elements, take screenshots, and test web applications.",
        instructions: `## Playwright Browser Automation Integration

Access browser automation through MCP tools.

### Capabilities:
- Navigate to URLs and interact with page elements
- Fill forms, click buttons, select options
- Take screenshots of pages or elements
- Execute JavaScript in the browser context
- Useful for testing web applications and extracting dynamic content`,
        category: "integration",
        tags: ["browser", "automation", "playwright", "testing"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-communication-slack",
        name: "Slack Messaging",
        description:
            "Slack channel messaging and search: send messages, search channels and users, and interact with workspaces.",
        instructions: `## Slack Messaging Integration

Access Slack workspace through MCP tools.

### Capabilities:
- Send messages to channels and users
- Search messages across the workspace
- List channels and users
- Read channel history

### Best practices:
- Use channel names or IDs to target messages
- Search before posting to avoid duplicates
- Format messages with Slack markdown`,
        category: "integration",
        tags: ["slack", "messaging", "communication"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-communication-justcall",
        name: "JustCall Phone & SMS",
        description:
            "Phone calls and SMS messaging via JustCall: access call logs, send SMS, and manage communication.",
        instructions: `## JustCall Phone & SMS Integration

Access JustCall phone and SMS capabilities through MCP tools.

### Capabilities:
- View call logs and call details
- Send SMS messages
- Access contact communication history`,
        category: "integration",
        tags: ["justcall", "phone", "sms", "communication"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-communication-twilio",
        name: "Twilio Voice Calls",
        description: "Outbound voice calls via Twilio: initiate and manage voice calls.",
        instructions: `## Twilio Voice Calls Integration

Access Twilio voice call capabilities through MCP tools.

### Capabilities:
- Make outbound voice calls
- Monitor call status`,
        category: "integration",
        tags: ["twilio", "voice", "calls", "communication"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-files-gdrive",
        name: "Google Drive Files",
        description: "DEPRECATED — replaced by google-drive-files skill. Do not use.",
        instructions: `## DEPRECATED
This MCP-based Google Drive skill has been replaced by the native OAuth google-drive-files skill.`,
        category: "integration",
        tags: ["deprecated"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-code-github",
        name: "GitHub Repository Management",
        description:
            "Repository management via GitHub: manage repos, issues, pull requests, code, and GitHub Actions.",
        instructions: `## GitHub Repository Management Integration

Access GitHub through MCP tools.

### Capabilities:
- List and manage repositories
- Create, read, and update issues
- Manage pull requests (create, review, merge)
- Read and search code
- Trigger and monitor GitHub Actions workflows

### Best practices:
- Use search before creating issues to avoid duplicates
- Include clear descriptions in PRs and issues
- Reference related issues in PR descriptions`,
        category: "integration",
        tags: ["github", "code", "repositories", "issues", "prs"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-knowledge-fathom",
        name: "Fathom Meeting Knowledge",
        description:
            "Meeting recordings and transcripts via Fathom: access meeting recordings, summaries, and full transcripts.",
        instructions: `## Fathom Meeting Knowledge Integration

Access Fathom meeting data through MCP tools.

### Capabilities:
- List recent meetings
- Get meeting transcripts (full text)
- Get meeting summaries and action items
- Search meetings by date or participants`,
        category: "integration",
        tags: ["fathom", "meetings", "transcripts", "knowledge"],
        tools: [],
        type: "SYSTEM"
    },
    {
        slug: "mcp-automation-atlas",
        name: "ATLAS Workflow Automation",
        description: "n8n workflow automation via ATLAS: trigger and monitor automation workflows.",
        instructions: `## ATLAS Workflow Automation Integration

Access n8n automation workflows through the ATLAS MCP server.

### Capabilities:
- Trigger n8n workflows via webhook
- Check n8n accessibility and status
- Query the ATLAS knowledge base`,
        category: "integration",
        tags: ["atlas", "n8n", "automation", "workflows"],
        tools: [],
        type: "SYSTEM"
    }
];

// ==============================
// Campaign Skills (4)
// ==============================

const campaignSkills: SkillDefinition[] = [
    {
        slug: "campaign-analysis",
        name: "Campaign Analysis",
        description:
            "Mission decomposition doctrine — analyze commander's intent and break down into missions with verb-purpose statements and classified tasks.",
        instructions: `## Campaign Analysis — Mission Decomposition

You are equipped to analyze campaign intent and decompose it into executable missions and tasks.

### Doctrine

1. **Read the campaign** using campaign-get to understand intent, end state, constraints, and restraints.
2. **Decompose into missions** — each mission should have:
   - A **verb + "in order to" + purpose** mission statement (e.g., "Scrape competitor websites in order to understand market positioning")
   - A **priority** (0=low, 10=critical)
   - A **sequence** (execution order; 0 means can run in parallel with other sequence-0 missions)
3. **Classify tasks** within each mission:
   - **ASSIGNED** — directly stated or obvious from the intent
   - **IMPLIED** — not stated but necessary to accomplish the mission
   - **ESSENTIAL** — the single most critical task for campaign success
4. **Task granularity** — one task = one agent action. A task like "research and write report" should be split into "research topic X" and "write report from research findings."
5. **Sequencing** — tasks with sequence 0 can run in parallel. Tasks with sequence 1, 2, 3... run after all lower-sequence tasks complete.
6. **Coordinating instructions** — include any dependencies, context, or special instructions the executing agent needs.

### After Analysis

Call campaign-write-missions to persist your decomposition. Include the essential task name.`,
        category: "campaign",
        tags: ["campaign", "analysis", "planning", "missions"],
        tools: ["campaign-get", "campaign-write-missions"],
        type: "SYSTEM"
    },
    {
        slug: "campaign-planning",
        name: "Campaign Planning",
        description:
            "Agent assignment methodology — evaluate agent fitness, assign best agents to tasks, detect capability gaps, and estimate costs.",
        instructions: `## Campaign Planning — Agent Assignment

You are equipped to assign the best available agents to campaign tasks and detect capability gaps.

### Methodology

1. **Read the campaign** using campaign-get to see missions, tasks, and analysis output.
2. **List available agents** using agent-list to see all active agents with their tools, skills, and capabilities.
3. **Optionally list tools** using tool-registry-list to understand what capabilities exist in the platform.
4. **Optionally list skills** using skill-list to see reusable skill bundles.
5. **For each task, evaluate agent fitness:**
   - Does the agent have the right tools/skills for the task verb?
   - Are the agent's instructions aligned with the task purpose?
   - Prefer agents with specific relevant skills over general-purpose agents.
6. **Detect gaps:** If no existing agent is suitable for a task, flag it as a capability gap with:
   - Reason why no agent fits
   - Required capabilities (what the agent would need)
   - Suggested tools that would be needed
7. **Execution strategy:** Determine whether missions should run sequentially, in parallel, or mixed.
8. **Cost estimation:** Estimate tokens and cost per task based on complexity.

### After Planning

Call campaign-write-plan to persist assignments. Include any gaps in gapsDetected.
If gaps exist, the system will invoke the campaign architect to build needed capabilities, then re-plan.`,
        category: "campaign",
        tags: ["campaign", "planning", "assignment", "gaps"],
        tools: [
            "campaign-get",
            "agent-list",
            "tool-registry-list",
            "skill-list",
            "campaign-write-plan"
        ],
        type: "SYSTEM"
    },
    {
        slug: "campaign-architecture",
        name: "Campaign Architecture",
        description:
            "Agent and skill design — build new agents and skills to fill capability gaps, reusing existing skills wherever possible.",
        instructions: `## Campaign Architecture — Building Capabilities

You design and build new agents and skills to fill capability gaps identified by the campaign planner.

### Core Principle: REUSE FIRST

Before creating anything new:
1. **Always call skill-list first** to see all existing skills.
2. **Call skill-read** on any skill that might cover the needed capability.
3. If an existing skill covers the need (even partially), use it. There are 30+ skills already covering CRM, email, web scraping, project management, etc.

### When Creating Skills

Only create a new skill when no existing skill covers the capability combination:
- Use **skill-create** with clear, specific instructions
- Use **skill-attach-tool** to bind the relevant tools
- Follow naming convention: lowercase-hyphenated slug (e.g., "competitor-research")
- Category should be descriptive (e.g., "web", "research", "content")
- Instructions should tell the agent HOW to use the tools, not just list them

### When Creating Agents

- Use **agent-create** with:
  - Clear, specific instructions focused on ONE job
  - modelProvider: "anthropic", modelName: "claude-opus-4-6" (default for capability assessment)
  - maxSteps: appropriate for complexity (5 for simple, 10 for medium, 15+ for complex multi-tool)
- Use **agent-attach-skill** to attach skills (pinned=true since these are purpose-built agents)
- Prefer attaching existing skills over creating new tool bindings
- Example: For a "scrape competitor websites" agent, attach the existing mcp-web-firecrawl and mcp-web-playwright skills

### Agent Design Principles

- **Single responsibility** — each agent does one thing well
- **Clear instructions** — write specific instructions, not vague ones like "help with tasks"
- **Skill-based tool access** — agents get tools through skills, not direct bindings
- **Model selection** — use claude-opus-4-6 for complex reasoning, gpt-4o for simpler tasks

### After Building

The system will re-invoke the planner to assign the newly created agents to the gap tasks.`,
        category: "campaign",
        tags: ["campaign", "architecture", "agent-builder", "skills"],
        tools: [
            "tool-registry-list",
            "skill-list",
            "skill-read",
            "skill-create",
            "skill-attach-tool",
            "agent-create",
            "agent-attach-skill",
            "campaign-get"
        ],
        type: "SYSTEM"
    },
    {
        slug: "campaign-review",
        name: "Campaign Review",
        description:
            "After Action Review doctrine — evaluate mission/campaign outcomes, extract sustain/improve patterns, score results, and write actionable lessons learned.",
        instructions: `## Campaign Review — After Action Review (AAR)

You generate structured After Action Reviews for missions and campaigns.

### AAR Doctrine

1. **Read the campaign** using campaign-get to see missions, tasks, their statuses, and results.
2. **For mission AARs**, analyze:
   - Planned vs actual task completion
   - Which tasks succeeded, failed, or were skipped
   - Agent performance per task (use agent-evaluations-list if available)
   - Total cost and token usage
   - Duration analysis
3. **For campaign AARs**, additionally analyze:
   - Whether the commander's intent was achieved
   - Whether the end state was reached
   - Cross-mission patterns and lessons learned
   - Overall score aggregation

### Patterns to Extract

- **Sustain patterns** — what worked well and should be repeated
- **Improve patterns** — what didn't work and how to fix it
- Be SPECIFIC. "Agent X failed because tool Y returned empty results for query Z" not "some tasks failed."

### AAR Fields

For missions: plannedTasks, completedTasks, failedTasks, skippedTasks, avgTaskScore, lowestScoringTask, totalCostUsd, totalTokens, durationMs, sustainPatterns (array of strings), improvePatterns (array of strings), summary.

For campaigns: all mission fields plus intentAchieved (boolean), endStateReached (boolean), overallScore, lessonsLearned (array of strings), recommendations (array of strings).

### After Review

Call campaign-write-aar with targetType ("mission" or "campaign"), targetId, and the structured AAR data.`,
        category: "campaign",
        tags: ["campaign", "review", "aar", "evaluation"],
        tools: ["campaign-get", "agent-runs-get", "agent-evaluations-list", "campaign-write-aar"],
        type: "SYSTEM"
    }
];

// ==============================
// Seed function
// ==============================

const allSkills: SkillDefinition[] = [
    ...platformSkills,
    ...utilitySkills,
    ...domainSkills,
    ...mcpSkills,
    ...campaignSkills
];

async function seedSkills() {
    console.log(`\n--- Seeding ${allSkills.length} skills ---\n`);

    for (const skillDef of allSkills) {
        // Find-or-create pattern (slug is no longer globally unique, compound with workspaceId)
        const existing = await prisma.skill.findFirst({
            where: { slug: skillDef.slug, workspaceId: null }
        });
        const skill = existing
            ? await prisma.skill.update({
                  where: { id: existing.id },
                  data: {
                      name: skillDef.name,
                      description: skillDef.description,
                      instructions: skillDef.instructions,
                      category: skillDef.category,
                      tags: skillDef.tags,
                      type: skillDef.type
                  }
              })
            : await prisma.skill.create({
                  data: {
                      slug: skillDef.slug,
                      name: skillDef.name,
                      description: skillDef.description,
                      instructions: skillDef.instructions,
                      category: skillDef.category,
                      tags: skillDef.tags,
                      type: skillDef.type
                  }
              });

        // Attach tools (only for non-MCP skills that have static tool IDs)
        if (skillDef.tools.length > 0) {
            // Delete existing tool attachments and re-create
            await prisma.skillTool.deleteMany({ where: { skillId: skill.id } });
            await prisma.skillTool.createMany({
                data: skillDef.tools.map((toolId) => ({
                    skillId: skill.id,
                    toolId
                })),
                skipDuplicates: true
            });
        }

        const toolCount = skillDef.tools.length;
        const mcpNote = toolCount === 0 ? " (MCP — tools resolved dynamically)" : "";
        console.log(`  ✓ ${skillDef.slug} [${skillDef.category}] — ${toolCount} tools${mcpNote}`);
    }

    console.log(`\n--- Seeded ${allSkills.length} skills successfully ---\n`);
}

// ==============================
// Main
// ==============================

seedSkills()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("Seed skills failed:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
