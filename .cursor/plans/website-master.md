# Website & Positioning — Master Implementation Plan

## Source

Strategic analysis of AgentC2 platform capabilities, competitive landscape (15 competitors across 5 categories), and existing website audit. This master plan organizes 7 implementation plans to transform the public-facing website from an embed-first experience into a high-conviction marketing platform.

## Plans Overview

| #   | Plan                                  | Priority     | Risk                      | Effort | Dependencies |
| --- | ------------------------------------- | ------------ | ------------------------- | ------ | ------------ |
| 1   | Website Foundation & Structure        | **Critical** | Broken UX, missed traffic | Medium | None         |
| 2   | Home Page Redesign                    | **Critical** | First impression failure  | Large  | Plan 1       |
| 3   | Platform & Technical Pages            | **High**     | Evaluator drop-off        | Large  | Plan 1       |
| 4   | Competitive Comparison Pages          | **High**     | SEO / sales enablement    | Medium | Plan 1       |
| 5   | Vertical Use Case Pages               | **Medium**   | Conversion gap            | Medium | Plan 2       |
| 6   | Enterprise, Security & Trust Pages    | **Medium**   | Enterprise deal blocker   | Medium | Plan 1       |
| 7   | Content Strategy & SEO Infrastructure | **Medium**   | Long-term organic growth  | Medium | Plans 2–6    |

## Dependency Graph

```
Plan 1 (Foundation) ────────────────────> Must start first (structural fixes)
Plan 2 (Home Page) ─────────────────────> Depends on Plan 1
Plan 3 (Platform Pages) ────────────────> Depends on Plan 1, can parallel with Plan 2
Plan 4 (Comparison Pages) ──────────────> Depends on Plan 1, can parallel with Plan 2
Plan 5 (Use Case Pages) ────────────────> Depends on Plan 2 (shared components)
Plan 6 (Enterprise/Security) ───────────> Depends on Plan 1, can parallel with Plan 2
Plan 7 (Content/SEO) ──────────────────> Depends on Plans 2–6 (needs pages to optimize)
```

## Execution Order

### Sprint 1: Foundation + Home Page Start

- **Plan 1 Phases 1–3**: Fix navigation, restructure routes, create shared layout system
- **Plan 2 Phase 1**: Hero section and problem statement

### Sprint 2: Home Page Finish + Platform/Comparison Start

- **Plan 2 Phases 2–5**: Pillars, channels, integrations, differentiators, demo embed, CTAs
- **Plan 3 Phases 1–2**: Platform Overview, How It Works
- **Plan 4 Phases 1–2**: First 3 comparison pages (LangChain, n8n, CrewAI)

### Sprint 3: Technical + Enterprise + Comparisons Finish

- **Plan 3 Phases 3–4**: Architecture, Developer pages
- **Plan 4 Phases 3–4**: Remaining comparison pages (OpenAI, Copilot Studio, Relevance AI, Mastra)
- **Plan 6 Phases 1–3**: Security & Governance, Enterprise, Embed Partners

### Sprint 4: Use Cases + Content/SEO

- **Plan 5 Phases 1–3**: Vertical use case pages
- **Plan 6 Phase 4**: Federation page
- **Plan 7 Phases 1–3**: SEO infrastructure, structured data, content calendar

## Positioning Framework

### Positioning Statement

AgentC2 is the AI operating system for organizations — where businesses build, deploy, govern, and scale intelligent agents across teams, channels, and partner organizations, with enterprise-grade security, a marketplace of ready-to-deploy solutions, and the only cross-organization federation protocol in the market.

### Category

AI Agent Operations Platform (AgentOps)

### Three-Tier Competitive Narrative

1. "We are not a model provider" — separates from OpenAI, Anthropic, Copilot
2. "We are not a framework" — separates from LangChain, Mastra, CrewAI, AutoGen
3. "We are not a workflow tool" — separates from n8n, Zapier, Make

Then: "We are the operating system that sits on top of all three."

### Messaging Pillars

| #   | Pillar                          | Core Message                                                                                      |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Production, Not Prototype       | Every competitor helps you build. AgentC2 helps you operate.                                      |
| 2   | Governed by Design              | Security and governance are architectural primitives, not bolt-on features.                       |
| 3   | Every Channel, One Platform     | Deploy to web, Slack, WhatsApp, Telegram, voice, email, and white-label embeds from one platform. |
| 4   | Agents That Learn and Improve   | Continuous learning pipeline with two-tier evaluation, A/B experiments, and auto-promotion.       |
| 5   | Federation — The Network Effect | Cross-organization agent collaboration with encrypted channels and agent discovery.               |
| 6   | Deploy, Don't Build             | Playbook Marketplace: install complete agent solutions in one click.                              |

### Terminology Guide

| Term            | Usage                                                                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MCP**         | Keep. Explain on first use: "MCP (Model Context Protocol) — the open standard for connecting AI agents to external tools and services." Use liberally in technical/developer pages. On marketing pages, pair with plain language: "200+ MCP tool integrations." |
| RAG             | Use "knowledge-powered" on marketing pages. Keep "RAG" on technical/developer pages.                                                                                                                                                                            |
| Federation      | Keep. Explain on first use: "cross-organization agent collaboration."                                                                                                                                                                                           |
| Mission Command | Keep. Explain on first use: "autonomous multi-step campaign execution."                                                                                                                                                                                         |
| Dark Factory    | Keep. Explain on first use: "autonomous coding pipeline."                                                                                                                                                                                                       |
| Guardrails      | Keep — broadly understood.                                                                                                                                                                                                                                      |
| Playbook        | Keep — broadly understood.                                                                                                                                                                                                                                      |

## Page Map

```
/                          → Marketing home page (Plan 2)
/platform                  → Platform Overview (Plan 3)
/platform/how-it-works     → How It Works (Plan 3)
/platform/architecture     → Architecture & Technical (Plan 3)
/platform/channels         → Channels & Voice (Plan 3)
/platform/federation       → Federation (Plan 6)
/platform/mission-command  → Campaign / Mission Command (Plan 3)
/platform/dark-factory     → Coding Pipeline (Plan 3)
/platform/marketplace      → Playbook Marketplace (Plan 3)
/security                  → Security & Governance (Plan 6) [exists — enhance]
/enterprise                → Enterprise (Plan 6)
/embed-partners            → Embed Partners (Plan 6)
/developers                → Developers (Plan 3)
/developers/api            → API Reference (Plan 3)
/developers/mcp            → MCP Integration Guide (Plan 3)
/use-cases                 → Use Cases Index (Plan 5)
/use-cases/sales           → Sales & Revenue (Plan 5)
/use-cases/support         → Customer Support (Plan 5)
/use-cases/engineering     → Engineering & DevOps (Plan 5)
/use-cases/construction    → Construction & AEC (Plan 5)
/use-cases/operations      → Operations (Plan 5)
/use-cases/partner-networks → Partner Networks (Plan 5)
/compare                   → Comparison Index (Plan 4)
/compare/langchain         → vs LangChain (Plan 4)
/compare/n8n               → vs n8n (Plan 4)
/compare/crewai            → vs CrewAI (Plan 4)
/compare/openai            → vs OpenAI (Plan 4)
/compare/copilot-studio    → vs Copilot Studio (Plan 4)
/compare/relevance-ai      → vs Relevance AI (Plan 4)
/compare/mastra            → vs Mastra (Plan 4)
/pricing                   → Pricing [exists — enhance] (Plan 2)
/about                     → About [exists — redirect or enhance]
/docs                      → Documentation [exists — no changes]
/blog                      → Blog [exists — no changes]
/trust-center              → Trust Center [exists — enhance] (Plan 6)
/ai-transparency           → AI Transparency [exists — no changes]
/terms                     → Terms [exists — no changes]
/privacy                   → Privacy [exists — no changes]
/subprocessors             → Subprocessors [exists — no changes]
```
