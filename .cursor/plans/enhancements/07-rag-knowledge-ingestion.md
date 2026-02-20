# 07 -- RAG Knowledge Base Ingestion

**Priority:** TIER 3 (Foundation)
**Effort:** Low (1-2 hours for initial seed)
**Dependencies:** None

## Problem Statement

1 document and 0 RAG entries means agents have no institutional knowledge. When agents need context about the company, products, customers, or processes, they have nothing to reference.

## Current State

- 1 document: "Vanos Insulations Ltd. Brady Davenport Training & Certificate Report" (16 chunks, embedded)
- 0 RAG entries (the vector index has data from the document but no standalone RAG ingestions)
- Document service fully functional at `packages/agentc2/src/documents/service.ts`
- RAG pipeline fully functional at `packages/agentc2/src/rag/pipeline.ts`

## Documents to Ingest

### Category 1: Platform Documentation (can be generated)

| Document               | Slug                     | Description                                                                       | Source                                        |
| ---------------------- | ------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------- |
| AgentC2 Platform Guide | `agentc2-platform-guide` | What AgentC2 is, what it does, how agents/workflows/networks work                 | Generate from CLAUDE.md                       |
| Email Triage Runbook   | `email-triage-runbook`   | How the 8 email categories are defined, classification criteria, escalation rules | Generate from email-triage agent instructions |
| Agent Catalog          | `agent-catalog`          | List of all active agents with their capabilities and how to use them             | Generate from agent list data                 |
| Integration Guide      | `integration-guide`      | What integrations are connected, what tools they provide, how to use them         | Generate from connection + tool data          |

### Category 2: Business Context (needs user input)

| Document              | Slug               | Description                                          | Source                             |
| --------------------- | ------------------ | ---------------------------------------------------- | ---------------------------------- |
| Company Overview      | `company-overview` | What Appello does, products/services, team structure | User provides                      |
| Key Customers         | `key-customers`    | Top accounts, relationship context, key contacts     | User provides or pull from HubSpot |
| Product Documentation | `product-docs`     | Product features, pricing, technical specs           | User provides                      |
| Team Directory        | `team-directory`   | Who does what, contact info, roles                   | User provides or pull from HubSpot |

### Category 3: Templates & Playbooks (can be generated)

| Document                 | Slug                     | Description                                     | Source                                  |
| ------------------------ | ------------------------ | ----------------------------------------------- | --------------------------------------- |
| Email Response Templates | `email-templates`        | Standard responses for common email categories  | Generate based on email-triage patterns |
| Meeting Prep Checklist   | `meeting-prep-checklist` | How to prepare for different meeting types      | Generate                                |
| Escalation Playbook      | `escalation-playbook`    | When and how to escalate issues across channels | Generate                                |

## Implementation Plan

### Step 1: Generate Platform Documentation

These can be auto-generated from existing data:

**AgentC2 Platform Guide:**

```
Use document_create with:
- slug: "agentc2-platform-guide"
- name: "AgentC2 Platform Guide"
- content: [Generated from CLAUDE.md, trimmed to essentials]
- contentType: "markdown"
- category: "platform"
- tags: ["platform", "guide", "onboarding"]
```

**Email Triage Runbook:**

```
Use document_create with:
- slug: "email-triage-runbook"
- name: "Email Triage Classification Runbook"
- content: [Extract from email-triage agent instructions + skill definitions]
- category: "runbook"
- tags: ["email", "triage", "classification"]
```

### Step 2: Pull Business Context from Integrations

**From HubSpot:** Pull company and contact data to create a customer overview document.
**From Fathom:** Index recent meeting summaries as knowledge base entries.

### Step 3: Request User Content

For documents that require proprietary business info, provide the user with a template:

```markdown
# Company Overview Template

## About [Company Name]

- What does the company do?
- Key products/services:
- Founded:
- Team size:

## Key Customers

- Customer 1: [Name, relationship, key contacts]
- Customer 2: [Name, relationship, key contacts]

## Products/Services

- Product 1: [Description, pricing, target audience]
- Product 2: [Description, pricing, target audience]
```

### Step 4: Ingest via Document Service

Use the `document_create` MCP tool for each document. The service automatically:

1. Chunks the content
2. Generates embeddings
3. Stores in vector index
4. Creates searchable Document record

## How Agents Use RAG

Once documents are ingested, agents with RAG tools can query them:

- `rag_query` tool: Semantic search across all documents
- `document_search` tool: Search with optional document scope
- Agents with memory can reference RAG results in conversation

## Acceptance Criteria

- [ ] At least 4 platform documentation documents ingested
- [ ] Documents visible in platform UI under Documents section
- [ ] RAG queries return relevant results (test with "What does email-triage do?")
- [ ] User provided with template for business context documents
- [ ] All documents properly categorized and tagged
