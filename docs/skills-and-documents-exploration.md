# Skills & Documents: The Missing Primitives

**Date:** February 9, 2026
**Status:** Exploration / RFC

---

## The Observation

The platform today has five primitives:

| Primitive    | What It Is                             | Analogy              |
| ------------ | -------------------------------------- | -------------------- |
| **Agent**    | LLM worker with instructions and tools | An employee          |
| **Workflow** | DAG-based multi-step orchestration     | A standard procedure |
| **Network**  | LLM-routed dynamic agent orchestration | A team meeting       |
| **Tool**     | Atomic action (API call, computation)  | A hammer             |
| **Scorer**   | Quality metric for evaluating outputs  | A rubric             |

Two things are missing:

1. **Skills** — the training, domain expertise, and procedural knowledge that make an agent _competent_ at something, not just _capable_ of it
2. **Documents** — managed knowledge artifacts that can be ingested, versioned, searched, and composed into agent context

---

## Part 1: The Skill Primitive

### The Problem: Tools ≠ Competence

An agent with 200 MCP tools has **capability** — it _can_ create HubSpot contacts, search Jira, send emails. But capability without context is dangerous. Consider:

- An agent with `hubspot-batch-update-objects` can update CRM records, but does it know the company's deal stage definitions? Lead scoring criteria? Data hygiene rules?
- An agent with `jira-create-issue` can file tickets, but does it know the team's workflow? The project key conventions? The required fields?
- An agent with `gmail-send-email` can send mail, but does it know the brand voice? The escalation paths? When NOT to email?

**Tools tell an agent WHAT it can do. Skills tell it HOW, WHEN, and WHY.**

### What Is a Skill?

A Skill is a bundle of four things:

```
Skill
├── Knowledge     — Domain context, business rules, reference material (Documents)
├── Procedure     — Step-by-step playbooks, decision trees, SOPs
├── Tools         — Which tools are relevant for this competency
└── Examples      — Reference inputs/outputs showing "what good looks like"
```

This is directly analogous to how humans develop competence:

- Reading the manual (Knowledge/Documents)
- Following the training guide (Procedure)
- Knowing which tools to reach for (Tools)
- Seeing examples of good work (Examples)

### Cursor Skills Already Prove This Pattern

The `.cursor/skills/` directory already contains skills for Cursor AI:

| Skill             | What It Provides                                            |
| ----------------- | ----------------------------------------------------------- |
| `mastra-platform` | Platform knowledge + MCP tool catalog + operational recipes |
| `mastra-vv`       | V&V procedures + acceptance criteria + report templates     |
| `mastra-deploy`   | Deployment knowledge + step-by-step server procedures       |
| `mastra-db-dump`  | Database schema knowledge + dump procedures                 |

These work because they **inject context that changes how the AI operates** — not by giving it new tools, but by giving it the _understanding_ of when and how to use them.

The platform should have this same concept as a first-class primitive.

### Concrete Skill Examples

**Skill: "HubSpot CRM Management"**

- Knowledge: Deal stage definitions, lead scoring criteria, data quality rules, CRM governance policy
- Procedure: "When creating contacts, check for duplicates by email first. When updating deal stages, always log a note explaining why. Follow the lead scoring rubric to prioritize outreach."
- Tools: `hubspot-search-objects`, `hubspot-batch-create-objects`, `hubspot-batch-update-objects`, `hubspot-create-engagement`
- Examples: Sample CRM audit output, properly formatted contact notes

**Skill: "Jira Project Management"**

- Knowledge: Team workflow (statuses, transitions), project key conventions, sprint planning guidelines, issue type definitions
- Procedure: "Before creating an issue, verify the correct project key and issue type. Use the Plan for Review workflow for all architectural decisions. Link related issues."
- Tools: `jira-create-issue`, `jira-search`, `jira-transition-issue`, `jira-add-comment`
- Examples: Well-formatted Jira tickets, proper status transitions

**Skill: "Meeting Intelligence"**

- Knowledge: Meeting types and cadences, key stakeholders, follow-up SLAs, action item tracking rules
- Procedure: "After each meeting transcript is ingested, extract action items, identify decisions made, flag unresolved blockers, and route follow-ups to the appropriate channels."
- Tools: `fathom-get-meeting-summary`, `fathom-get-meeting-transcript`, `jira-create-issue`, `slack-post-message`
- Examples: Sample meeting digest, properly extracted action items

**Skill: "Customer Onboarding"**

- Knowledge: Onboarding playbook, product documentation, FAQ database, common setup issues
- Procedure: "Follow the 30-60-90 framework. Day 1: send welcome email. Day 3: schedule kickoff. Week 2: first check-in. Track progress in HubSpot deal pipeline."
- Tools: `hubspot-create-engagement`, `gmail-send-email`, `google-calendar-create-event`
- Examples: Welcome email templates, kickoff agenda format

### How Skills Differ From Everything Else

| Dimension     | Tool                 | Skill                                    | Agent Instructions  |
| ------------- | -------------------- | ---------------------------------------- | ------------------- |
| **Scope**     | Single action        | Domain of competence                     | General personality |
| **Reusable**  | Yes, by any agent    | Yes, composable across agents            | No, per-agent       |
| **Knowledge** | None — pure function | Rich domain context                      | Embedded inline     |
| **Structure** | Input → Output       | Knowledge + Procedure + Tools + Examples | Freeform text       |
| **Versioned** | Via MCP server       | Yes, independently                       | Via agent version   |

The key insight: **Skills are reusable, composable packages of competence.** One skill can be attached to many agents. One agent can have many skills. The same "HubSpot CRM Management" skill works whether it's attached to the Sales Agent, the Reporting Agent, or the Customer Success Agent.

---

## Part 2: The Document Primitive

### The Problem: Knowledge Without Management

The platform has a RAG pipeline (`ingestDocument`, `queryRag`, `ragGenerate`) but:

1. **No first-class document model** — documents exist only as embeddings in the vector DB with no Prisma model, no versioning, no metadata management
2. **`listDocuments()` is a stub** — it returns index stats, not actual documents
3. **No document-agent relationship** — which agent knows which documents? Nobody knows
4. **15 markdown docs in `docs/` are unused** — rich knowledge (AI best practices, platform vision, process docs, integration guides) sitting disconnected from any agent
5. **No lifecycle management** — can't update a document's content and have it re-embed automatically, can't track when things were last refreshed

### What Is a Document?

A Document is a managed knowledge artifact:

```
Document
├── Content      — The actual text (Markdown, plain text, HTML)
├── Metadata     — Source, author, tags, category, last verified date
├── Embeddings   — Chunked and embedded in vector DB for semantic search
└── Versions     — Content changes tracked over time
```

Documents are the **atomic unit of knowledge** in the platform. They can exist independently and be composed into Skills.

### What Already Exists But Isn't Connected

The `docs/` folder contains 15 documents that represent significant organizational knowledge:

| Document                               | Type                | Potential Use                       |
| -------------------------------------- | ------------------- | ----------------------------------- |
| `ai-agent-best-practices.md`           | Reference           | Agent design skill, learning system |
| `agent-platform-vision.md`             | Strategy            | Platform assistant context          |
| `executive-l10-process-improvement.md` | Process/SOP         | Jira management skill               |
| `integrations-hub.md`                  | Technical reference | Integration management skill        |
| `integrations-validation-runbook.md`   | Procedure/Runbook   | V&V skill, QA skill                 |
| `agent-execution-triggers.md`          | Technical reference | Platform operations skill           |
| `mcp-tool-exposure.md`                 | Architecture        | MCP management skill                |
| `mcp-workflows-networks.md`            | Architecture        | Workflow/network design skill       |
| `agent-learning-mechanisms.md`         | Technical reference | Learning system operations skill    |
| `agentc2-vision-plan.md`               | Strategy            | Platform assistant context          |

None of these are ingested into RAG. None are connected to agents. They're knowledge trapped in files.

### The Document Lifecycle

```
Create/Upload → Chunk → Embed → Index → Link to Skills → Agent Queries at Runtime
     ↑                                                            │
     └────────── Update Content → Re-chunk → Re-embed ←──────────┘
```

When a document is updated:

1. Old embeddings are removed from the vector index
2. New content is chunked and embedded
3. Any agent using a skill that references this document automatically gets fresh knowledge
4. Version history tracks what changed

---

## Part 3: Skills + Documents Together

### The Composition Model

```
Agent
├── Skills (higher-level competencies)
│   ├── Documents (knowledge/context → RAG-searchable)
│   ├── Tools (actions to take)
│   ├── Procedures (how to apply knowledge + tools)
│   └── Examples (reference outputs)
├── Tools (direct tool access, independent of skills)
├── Memory (conversation context)
└── Workflows / Networks (orchestration patterns)
```

### How It Works at Runtime

1. **Agent Resolution**: Load the agent from DB, including its skills
2. **Skill Resolution**: For each skill, load its documents, tools, and instructions
3. **Context Assembly**:
    - Agent's base instructions (personality, role)
    - Skill instructions injected as structured context blocks
    - Skill tools merged into the agent's tool set
4. **RAG at Query Time**: When the agent needs deeper knowledge, it queries RAG **scoped to its skill documents** — not the entire vector index
5. **Focused Retrieval**: The agent doesn't search ALL knowledge — it searches knowledge relevant to its assigned skills

### The Power of Scoped RAG

Today, `queryRag` searches the entire vector index. With Skills + Documents:

```typescript
// Before: search everything
const results = await queryRag("deal stage criteria");

// After: search within the agent's skill documents
const results = await queryRag("deal stage criteria", {
    filter: {
        documentId: { $in: agent.skills.flatMap((s) => s.documents.map((d) => d.id)) }
    }
});
```

This means:

- The **Sales Agent** with the "CRM Management" skill searches CRM knowledge
- The **Dev Agent** with the "Code Review" skill searches coding standards
- The **Platform Agent** with the "Operations" skill searches platform docs
- **No cross-contamination** — each agent's knowledge is scoped to its competencies

---

## Part 4: Technical Design

### Database Schema (Proposed)

```prisma
// ==============================
// Document Primitive
// ==============================

model Document {
    id          String  @id @default(cuid())
    slug        String  @unique
    name        String
    description String? @db.Text
    content     String  @db.Text // The actual markdown/text content
    type        String  @default("markdown") // markdown, text, html, json

    // RAG integration
    vectorIds  String[] // References to chunks in vector DB
    chunkCount Int       @default(0)
    embeddedAt DateTime? // When last embedded

    // Categorization
    category String? // e.g., "process", "reference", "architecture"
    tags     String[]
    metadata Json? // Flexible key-value metadata

    // Multi-tenancy
    workspaceId String
    workspace   Workspace @relation(fields: [workspaceId], references: [id])

    // Versioning
    version  Int               @default(1)
    versions DocumentVersion[]

    // Relations
    skills SkillDocument[]

    // Audit
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    createdBy String?

    @@index([workspaceId])
    @@index([category])
    @@map("document")
}

model DocumentVersion {
    id            String   @id @default(cuid())
    documentId    String
    document      Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
    version       Int
    content       String   @db.Text
    changeSummary String?
    createdAt     DateTime @default(now())
    createdBy     String?

    @@unique([documentId, version])
    @@map("document_version")
}

// ==============================
// Skill Primitive
// ==============================

model Skill {
    id          String  @id @default(cuid())
    slug        String  @unique
    name        String
    description String? @db.Text

    // Core skill content
    instructions String  @db.Text // Procedural knowledge - the "how to"
    examples     String? @db.Text // Reference outputs, patterns

    // Categorization
    category String? // e.g., "crm", "development", "operations"
    tags     String[]
    metadata Json?

    // Multi-tenancy
    workspaceId String
    workspace   Workspace @relation(fields: [workspaceId], references: [id])

    // Versioning
    version  Int            @default(1)
    versions SkillVersion[]

    // Relations
    documents SkillDocument[] // Knowledge base
    tools     SkillTool[] // Associated tools
    agents    AgentSkill[] // Agents with this skill

    // Type
    type String @default("USER") // USER or SYSTEM

    // Audit
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    createdBy String?

    @@index([workspaceId])
    @@index([category])
    @@map("skill")
}

model SkillVersion {
    id            String   @id @default(cuid())
    skillId       String
    skill         Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
    version       Int
    instructions  String   @db.Text
    configJson    Json? // Snapshot of documents, tools, etc.
    changeSummary String?
    createdAt     DateTime @default(now())
    createdBy     String?

    @@unique([skillId, version])
    @@map("skill_version")
}

// ==============================
// Junction Tables
// ==============================

model SkillDocument {
    id         String   @id @default(cuid())
    skillId    String
    skill      Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
    documentId String
    document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
    role       String? // "reference", "procedure", "example", "context"

    @@unique([skillId, documentId])
    @@map("skill_document")
}

model SkillTool {
    id      String @id @default(cuid())
    skillId String
    skill   Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)
    toolId  String // References tool registry key or MCP tool name

    @@unique([skillId, toolId])
    @@map("skill_tool")
}

model AgentSkill {
    id      String @id @default(cuid())
    agentId String
    agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)
    skillId String
    skill   Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)

    @@unique([agentId, skillId])
    @@map("agent_skill")
}
```

### The Complete Primitive Hierarchy

After adding Skills and Documents:

```
Organization
  └── Workspace
        ├── Agent         — The worker
        │   ├── AgentSkill[]     → Skill (competencies)
        │   ├── AgentTool[]      → Tool (direct access)
        │   └── instructions     → Base personality/role
        │
        ├── Skill         — The competency
        │   ├── SkillDocument[]  → Document (knowledge)
        │   ├── SkillTool[]      → Tool (relevant tools)
        │   ├── instructions     → Procedural knowledge
        │   └── examples         → Reference outputs
        │
        ├── Document      — The knowledge
        │   ├── content          → Markdown/text
        │   ├── vectorIds[]      → RAG embeddings
        │   └── versions[]       → Content history
        │
        ├── Workflow       — Deterministic orchestration
        ├── Network        — Dynamic orchestration
        └── Tool           — Atomic action (via registry/MCP)
```

### API Surface (MCP Tools)

New platform operations:

```
// Documents
document_create    — Create a document, auto-embed into RAG
document_read      — Read a document by ID or slug
document_update    — Update content, auto-re-embed
document_delete    — Remove document and its embeddings
document_list      — List documents with filters
document_search    — Semantic search across documents (via RAG)

// Skills
skill_create       — Create a skill with documents + tools + instructions
skill_read         — Read a skill definition
skill_update       — Update skill configuration
skill_delete       — Remove a skill
skill_list         — List skills with filters

// Composition
skill_attach_document  — Link a document to a skill
skill_detach_document  — Unlink a document from a skill
skill_attach_tool      — Link a tool to a skill
agent_attach_skill     — Give an agent a skill
agent_detach_skill     — Remove a skill from an agent
```

---

## Part 5: Why This Matters

### Without Skills + Documents

```
User: "Create a HubSpot deal for Acme Corp"

Agent (has tools, no skill):
→ Creates deal with minimal info
→ Doesn't know correct pipeline
→ Doesn't set required custom fields
→ Doesn't add a note
→ Doesn't notify the sales team
```

### With Skills + Documents

```
User: "Create a HubSpot deal for Acme Corp"

Agent (has "CRM Management" skill):
→ Checks for existing Acme Corp company record
→ Searches contacts for Acme Corp stakeholders
→ Creates deal in correct pipeline ("Enterprise Sales")
→ Sets required fields per CRM governance doc
→ Adds structured note with context
→ Notifies #sales-deals Slack channel
→ Logs action to CRM audit trail
```

The difference isn't more tools — it's **understanding the domain.**

### The Compounding Effect

Skills + Documents create a flywheel:

1. **Agents do better work** because they have domain knowledge
2. **Better work generates better evaluation scores** through existing scorers
3. **Learning sessions** can identify which skills need improvement
4. **Documents get updated** with refined knowledge
5. **Skills evolve** with better procedures
6. **Agents automatically improve** because they reference living documents

This is how organizations actually work: institutional knowledge improves over time through documented processes and trained people.

---

## Part 6: Migration Path

### Phase 1: Documents (Foundation)

1. Add `Document` and `DocumentVersion` models to Prisma schema
2. Build document CRUD with automatic RAG embedding on create/update
3. Ingest the existing 15 `docs/*.md` files as seed documents
4. Expose `document_*` MCP tools on the platform
5. Enhance `queryRag` to support document-scoped filtering

### Phase 2: Skills (Composition)

1. Add `Skill`, `SkillVersion`, `SkillDocument`, `SkillTool`, `AgentSkill` models
2. Build skill CRUD with document and tool linking
3. Modify agent resolver to load and inject skill context
4. Expose `skill_*` MCP tools on the platform
5. Create initial skills from existing patterns (e.g., convert Cursor skills to platform skills)

### Phase 3: Intelligence (Refinement)

1. Skill-scoped RAG queries at agent runtime
2. Skill recommendations: "This agent uses HubSpot tools but has no CRM skill"
3. Document freshness tracking: "This document hasn't been verified in 90 days"
4. Skill analytics: which skills are used most, which correlate with higher eval scores
5. Skill marketplace: share skills across workspaces/organizations

---

## Summary

| What                    | Current State                        | Proposed State                                  |
| ----------------------- | ------------------------------------ | ----------------------------------------------- |
| **Knowledge**           | Trapped in `docs/` files, unindexed  | First-class Documents, auto-embedded, versioned |
| **RAG**                 | Flat vector search, no scoping       | Document-scoped, skill-filtered, agent-aware    |
| **Domain Expertise**    | Crammed into agent instructions      | Reusable Skills composable across agents        |
| **Tool Context**        | Tools exist but agents lack guidance | Skills bundle tools with "how and when to use"  |
| **Composability**       | Agent = instructions + tools         | Agent = instructions + skills + tools + memory  |
| **Knowledge Lifecycle** | Static, manual                       | Versioned, auto-embedded, freshness-tracked     |

**A tool is a hammer. A document is a blueprint. A skill is the carpentry training that teaches you WHEN to use the hammer and HOW to read the blueprint.**
