# AgentC2 & The Agentic Web: Gap Analysis & Opportunity Map

**Date:** February 21, 2026
**Context:** Analysis of "The Web Is Forking in the Age of Agents" mapped against AgentC2's current capabilities, existing plans, and immediate opportunities.

---

## Executive Summary

The video describes five infrastructure primitives converging to create a parallel "agent web": **money, content access, search, execution, and security**. After auditing AgentC2's current stack (80+ integration providers, 145+ native tools, full billing/budget infrastructure), the analysis reveals:

- **We're strong on execution and cost management** — model routing, budget controls, skills, memory, RAG
- **We have payment integrations but not agent-as-economic-actor capabilities** — Stripe MCP exists but agents can't autonomously transact
- **We're dependent on Firecrawl for search/scraping and missing the agent-native search layer entirely** — no Exa, no Brave Search
- **We have no crypto/wallet/x402 infrastructure** — the entire "agents with wallets" primitive is absent
- **We're not serving content to other agents** — no llms.txt, no markdown-for-agents, no way for external agents to consume our platform

The biggest strategic takeaway: **AgentC2 is currently a platform where humans deploy agents. The agentic web requires AgentC2 to also be a platform where agents interact with other agents and services autonomously.** We need to add primitives that let our agents participate in the agent economy, and primitives that let external agents consume our platform.

---

## The Five Primitives: Where We Stand

### 1. MONEY — Agents as Economic Entities

| Capability                | Video Reference                            | AgentC2 Status                                                         | Gap                                           |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------- |
| Agent wallets (crypto)    | Coinbase AgentKit, x402 protocol           | **Not present**                                                        | Critical for agent autonomy                   |
| Traditional payment rails | Stripe ACS, shared payment tokens          | **Partial** — Stripe MCP exists but not ACS-specific                   | Need ACS integration                          |
| Agent spending controls   | Programmable spending limits, session caps | **Strong** — BudgetPolicy with hard limits, per-agent/org/user budgets | Aligned                                       |
| Cost tracking per action  | Cost-per-outcome metrics                   | **Strong** — CostEvent model with per-run/per-turn tracking            | Need cost-per-outcome (not just cost-per-run) |
| Agents earning revenue    | PolyMarket trading, arbitrage              | **Not present** — agents consume budget, never generate revenue        | Strategic gap                                 |

**Assessment:** We track costs well but our agents are pure cost centers. The video describes agents that earn, spend, and accumulate capital. We have zero infrastructure for agents to generate revenue or manage their own funds.

### 2. CONTENT ACCESS — Making the Web Readable

| Capability                             | Video Reference                    | AgentC2 Status                                        | Gap                                   |
| -------------------------------------- | ---------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| Web scraping to markdown               | Cloudflare Markdown for Agents     | **Present** — Firecrawl `web-scrape` returns markdown | Functional but dependent on Firecrawl |
| Basic web fetch                        | Direct HTTP requests               | **Present** — `web-fetch` tool (5000 char limit)      | Limit is low for agent workflows      |
| llms.txt / machine-readable sitemaps   | Cloudflare llms.txt, llms-full.txt | **Not present** — we don't serve this for agentc2.ai  | Should add                            |
| Content monetization (x402)            | Cloudflare x402 support            | **Not present**                                       | Future consideration                  |
| Serving our content to external agents | Cloudflare AI Index                | **Not present**                                       | Strategic opportunity                 |

**Assessment:** We can read the web but we're invisible to the agent web. No external agent can discover or consume AgentC2's capabilities through agent-native protocols. We also have a hard dependency on Firecrawl — Cloudflare's markdown-for-agents makes Firecrawl redundant for ~20% of the web.

### 3. SEARCH — Agent-Native Discovery

| Capability                | Video Reference                  | AgentC2 Status                                      | Gap                              |
| ------------------------- | -------------------------------- | --------------------------------------------------- | -------------------------------- |
| Agent-native search       | Exa.ai (95% SimpleQA, own index) | **Not present**                                     | **Immediate opportunity**        |
| Fast search (<1s)         | Brave Search (669ms)             | **Not present**                                     | **Immediate opportunity**        |
| Structured data search    | Exa research endpoint            | **Not present**                                     | Need for complex agent workflows |
| Internal knowledge search | RAG pipeline                     | **Present** — vector search, hybrid planned (Gap 5) | Solid foundation                 |
| Memory-based search       | Semantic recall                  | **Present** — Mastra Memory with semantic recall    | Aligned                          |

**Assessment:** This is our biggest immediate gap for agent capability. Our agents can only search via Firecrawl, which is a scraping tool repurposed as search — not a search engine built for agents. Exa and Brave Search would immediately upgrade every agent's ability to find and act on information. Both have MCP servers or APIs available today.

### 4. EXECUTION — Agents as Workers

| Capability                             | Video Reference            | AgentC2 Status                                                    | Gap                    |
| -------------------------------------- | -------------------------- | ----------------------------------------------------------------- | ---------------------- |
| Versioned instruction bundles (Skills) | OpenAI Skills              | **Present** — Skills system with CRUD, attachment, discovery      | Aligned (we have this) |
| Shell/terminal access                  | OpenAI Shell Tool          | **Present** — `execute-code` tool with workspace file ops         | Aligned (sandboxed)    |
| Context window management              | OpenAI Compaction          | **Present** — Managed Generate with windowed context, compression | Aligned                |
| Long-running workflows                 | Multi-step agent execution | **Present** — up to 200 steps, async via Inngest                  | Aligned                |
| Multi-agent orchestration              | Agent chaining             | **Present** — Network system, Big Jim 2 architecture              | Aligned                |

**Assessment:** This is our strongest area. Skills, execution environments, compaction/compression, and orchestration are all production-ready. The video's description of OpenAI Skills is essentially what we already have. Our model routing (FAST/PRIMARY/ESCALATION/REASONING) is more sophisticated than what the video describes.

### 5. SECURITY — Treating Agents as Potential Adversaries

| Capability               | Video Reference                   | AgentC2 Status                                                | Gap                       |
| ------------------------ | --------------------------------- | ------------------------------------------------------------- | ------------------------- |
| Tool sandboxing          | IronClaw WebAssembly isolation    | **Partial** — code execution is sandboxed, MCP tools are not  | Need per-tool isolation   |
| Network allowlists       | OpenAI org-level network controls | **Partial** — web-fetch blocks private IPs/localhost          | Need org-level allowlists |
| Spending guardrails      | Coinbase programmable limits      | **Present** — BudgetPolicy with hard limits                   | Aligned                   |
| Credential isolation     | Coinbase enclave isolation        | **Partial** — env vars, no enclave                            | Need credential vault     |
| Agent-as-adversary model | Industry consensus                | **Not formalized** — no formal threat model for agent actions | Should document           |

**Assessment:** We have budget guardrails and basic sandboxing but haven't adopted the "agent as potential adversary" security model. As we add payment and wallet capabilities, this becomes critical.

---

## Immediate MCP Tools to Add

These can be added to `INTEGRATION_PROVIDER_SEEDS` and configured with minimal effort. Ordered by impact.

### Priority 1: Exa Search (Agent-Native Search Engine)

**Why:** 95% SimpleQA accuracy, own neural index, returns structured data not SERPs. Every agent on our platform that needs to search the web would immediately get better results.

**Integration approach:**

- **Type:** Native tool (API is simple enough to not need MCP overhead)
- **API:** `https://api.exa.ai/search` and `https://api.exa.ai/contents`
- **Auth:** API key (`EXA_API_KEY`)
- **Tools to create:**
    - `exa-search` — Neural search with auto/keyword/neural modes
    - `exa-find-similar` — Find pages similar to a given URL
    - `exa-get-contents` — Extract clean text/markdown from URLs
    - `exa-research` — Multi-query research endpoint (parallelized)

**Revenue impact:** Better search = better agent outputs = higher perceived value = lower churn. Every agent that currently does web research benefits.

### Priority 2: Brave Search (Fast Agent Search)

**Why:** 669ms latency (fastest in benchmarks), independent index (not a Google wrapper), privacy-focused. Complements Exa — use Brave for speed, Exa for depth.

**Integration approach:**

- **Type:** Native tool or MCP (Brave has an official MCP server)
- **API:** `https://api.search.brave.com/res/v1/web/search`
- **Auth:** API key (`BRAVE_SEARCH_API_KEY`)
- **Tools to create:**
    - `brave-search` — Fast web search
    - `brave-local-search` — Local business search (POIs, addresses)
    - `brave-news-search` — News-specific search

**Revenue impact:** Speed matters in multi-step workflows. An agent doing 10 searches per workflow saves 130 seconds switching from a 13.6s provider to Brave's 669ms.

### Priority 3: Coinbase CDP / AgentKit

**Why:** This is the wallet primitive. 50M+ machine-to-machine transactions on x402. Agents with wallets can participate in the agent economy.

**Integration approach:**

- **Type:** MCP (Coinbase has an official AgentKit MCP: `@coinbase/agentkit` with `CdpMcpServer`)
- **Tools provided:**
    - Wallet creation and management
    - Token transfers (ETH, USDC, ERC-20)
    - Smart contract deployment and interaction
    - NFT operations
    - DeFi operations (Uniswap, Aave)
    - Faucet access (testnet)

**Revenue impact:** Opens entirely new use cases — DeFi agents, trading agents, payment agents. Positions AgentC2 as agent-economy-ready.

### Priority 4: Perplexity (AI-Powered Research)

**Why:** The video didn't mention it but Perplexity fits the "agent-native search" category. They have a Sonar API that returns sourced, synthesized answers — not raw links. Useful for research-heavy agent workflows.

**Integration approach:**

- **Type:** Native tool (simple API)
- **API:** `https://api.perplexity.ai/chat/completions`
- **Auth:** API key (`PERPLEXITY_API_KEY`)
- **Tools to create:**
    - `perplexity-research` — Ask a research question, get sourced answer
    - `perplexity-search` — Web search with AI synthesis

### Priority 5: Enhanced Cloudflare Integration

**Why:** We have Cloudflare in our integration seeds but it's not configured for the agent-web primitives. Cloudflare's markdown-for-agents, AI Index, and x402 support are relevant.

**Integration approach:**

- Upgrade existing Cloudflare integration to include Workers AI and AI Gateway
- Add support for requesting markdown format via `Accept: text/markdown` headers in our `web-fetch` tool
- Future: Register agentc2.ai in Cloudflare AI Index

---

## Strategic Gaps: What the Video Reveals About Our Business Model

### Gap A: We Are an Agent Deployment Platform, Not an Agent Economy Platform

**Current model:** Humans → configure agents → agents do tasks → humans review outputs
**Agentic web model:** Agents → discover services → negotiate access → transact → produce outputs → earn revenue

We are missing the economic loop. Our agents consume tokens but never generate revenue. The video describes agents that:

- Trade on PolyMarket to subsidize their own compute costs
- Purchase API access as they need it
- Participate in creator economies
- Rebalance DeFi portfolios

**Opportunity:** Position AgentC2 agents as economic actors. An agent on our platform should be able to:

1. Have a budget (we have this)
2. Spend that budget on external services (partially — via MCP tools)
3. **Earn revenue from its outputs** (not present)
4. **Self-fund its operations** (not present)

### Gap B: We Don't Serve External Agents

The video describes a world where every service serves two clients: humans (HTML) and agents (markdown/JSON/APIs). AgentC2 only serves humans.

**Immediate actions:**

1. Add `llms.txt` and `llms-full.txt` to agentc2.ai describing our platform capabilities
2. Add a public MCP endpoint so external agents can discover and invoke our agents
3. Return markdown/JSON when the request has appropriate Accept headers

This is how we become discoverable in the agent web — not just a tool for deploying agents, but a service that agents themselves can use.

### Gap C: No Agent Identity / Reputation System

The video's security section emphasizes that agents need to be treated as potential adversaries. The flip side: trusted agents need a way to prove trustworthiness.

- Agent identity (verifiable credentials for agent actions)
- Agent reputation (track record of successful/failed transactions)
- Trust tiers (escalating permissions based on history)

This is longer-term but becomes critical as agents transact autonomously.

### Gap D: The Emergent Web Pattern — Agent Workflow Chaining

The UGC product video example (Amazon link → product extraction → video generation) demonstrates something we could enable today:

1. Agent receives a URL
2. Uses `web-scrape` (Firecrawl) or `web-fetch` to extract content
3. Uses `exa-search` to find additional context
4. Uses a video/image generation API to produce output
5. Delivers the artifact

We have steps 1-2 and 5. We're missing step 3 (better search) and step 4 (generative media tools). Adding Exa immediately enables the pattern.

---

## Revenue Opportunities Mapped to the Video

| Opportunity                          | Video Evidence                                                                             | AgentC2 Path                                                                                | Revenue Model                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Intelligence Operations Platform** | "Token management is the new core competency"                                              | Already our positioning (Brice briefing)                                                    | $500-$2K/mo enterprise              |
| **Agent Commerce Enablement**        | Stripe ACS, Coinbase AgentKit                                                              | Add payment/wallet MCP tools, offer "commerce-ready agents"                                 | Per-transaction fee or premium tier |
| **Agent-as-a-Service**               | Agents as economic entities                                                                | Expose agents via public MCP endpoint, charge per invocation                                | Usage-based ($X per agent call)     |
| **Vertical Agent Marketplace**       | "Businesses that emerge from it will be ones that could not have existed on the human web" | Recipe/playbook marketplace for vertical-specific agent workflows                           | 30% revenue share                   |
| **Agent Search Optimization**        | Exa, Brave, Cloudflare AI Index                                                            | Help businesses make their content discoverable to agents (ASO — Agent Search Optimization) | Consulting + tooling                |
| **Trust & Compliance Layer**         | "Every serious security approach treats the agent as a potential adversary"                | Agent audit logs, spending guardrails, compliance reporting                                 | Enterprise premium                  |

---

## Implementation Priority Matrix

### Do Now (This Week)

| #   | Action                                                                      | Effort    | Impact                                               |
| --- | --------------------------------------------------------------------------- | --------- | ---------------------------------------------------- |
| 1   | Add Exa native tools (`exa-search`, `exa-find-similar`, `exa-get-contents`) | 4-6 hours | Every research agent gets dramatically better        |
| 2   | Add Brave Search native tool (`brave-search`)                               | 2-3 hours | Fast fallback search for latency-sensitive workflows |
| 3   | Add `llms.txt` to agentc2.ai                                                | 1 hour    | Makes us discoverable to the agent web               |
| 4   | Increase `web-fetch` char limit from 5000 to 25000                          | 30 min    | Agents can read full pages                           |

### Do This Month

| #   | Action                                           | Effort    | Impact                                    |
| --- | ------------------------------------------------ | --------- | ----------------------------------------- |
| 5   | Add Coinbase AgentKit MCP integration            | 1-2 days  | Wallet/crypto capabilities for agents     |
| 6   | Add Perplexity Sonar tools                       | 3-4 hours | AI-synthesized research for agents        |
| 7   | Implement `Accept: text/markdown` in `web-fetch` | 2-3 hours | Leverage Cloudflare's markdown-for-agents |
| 8   | Add cost-per-outcome analytics                   | 3-5 days  | The metric that sells enterprise deals    |
| 9   | Create public API for external agent invocation  | 2-3 days  | Other agents can call our agents          |

### Do This Quarter

| #   | Action                                     | Effort    | Impact                                        |
| --- | ------------------------------------------ | --------- | --------------------------------------------- |
| 10  | Agent wallet infrastructure (x402 support) | 1-2 weeks | Agents can pay for external services          |
| 11  | Agent revenue tracking                     | 1 week    | Track value agents generate, not just cost    |
| 12  | Formal agent security threat model         | 3-5 days  | Enterprise credibility                        |
| 13  | Public MCP endpoint for AgentC2            | 1-2 weeks | External agents can discover/use our platform |
| 14  | Agent identity/reputation system           | 2-3 weeks | Trust infrastructure for autonomous agents    |

---

## What We Can Learn and Apply Right Now

### 1. "Skills aren't prompts. They're versioned, mountable instruction packages."

We already have this. But the video's framing is more powerful than ours. Glean saw 73% → 85% accuracy with a single skill. We should:

- Benchmark our skills the same way (accuracy before/after)
- Market our skills system as "enterprise-grade SOPs for AI" not "agent instructions"
- Build a library of pre-built skills for common verticals

### 2. "Stripe had to retrain Radar from scratch because fraud signals don't work when the buyer is software."

Our agents that interact with external services (CRM updates, email sending, payment processing) need to account for the fact that they'll be flagged as bots. We should:

- Add proper User-Agent headers identifying our agents
- Implement rate limiting that respects external service bot policies
- Document which integrations have bot-detection issues

### 3. "The companies that recognized the fork early built the dominant platforms of the next era."

The mobile web analogy is directly applicable. We should explicitly build for both clients:

- Human UI (we have this — the dashboard)
- Agent API (we need this — public MCP endpoint, llms.txt, structured API responses)

### 4. "Every primitive that makes agents more capable also makes them more dangerous."

As we add wallet/payment tools:

- Default to read-only permissions, require explicit opt-in for write/spend
- Implement approval workflows for financial actions above thresholds
- Log every financial action with full audit trail
- Human-in-the-loop for first N transactions per agent

### 5. "Agents trying to earn money to pay for their own compute. The loop is closing."

This is the most provocative insight. An AgentC2 agent with:

- A Coinbase wallet (earning)
- Budget controls (spending)
- Skills for a specific domain (capability)
- Memory and RAG (knowledge)

...is functionally an autonomous economic entity. We don't need to build this today, but we should architect for it. The credit system we already have is the foundation — it just needs a "credit in" mechanism, not just "credit out."

---

## Bottom Line

The video describes five primitives converging to create an agent web. Here's our scorecard:

| Primitive          | Score | Key Gap                                                        |
| ------------------ | ----- | -------------------------------------------------------------- |
| **Money**          | 3/10  | Have Stripe MCP, missing wallets, agent-as-economic-actor      |
| **Content Access** | 6/10  | Have Firecrawl, missing markdown-first content, llms.txt       |
| **Search**         | 4/10  | Firecrawl search only, missing Exa, Brave, agent-native search |
| **Execution**      | 9/10  | Skills, routing, compression, orchestration — all strong       |
| **Security**       | 5/10  | Budget guardrails good, missing formal threat model, isolation |

**Immediate wins: Add Exa + Brave Search + llms.txt. These three changes, achievable in under a week, meaningfully upgrade every agent on the platform and make us visible to the emerging agent web.**

**Strategic bet: Start building toward agents-as-economic-entities. The infrastructure companies are betting trust will catch up to capabilities. We should position AgentC2 as the trust layer — the platform where agent economics are auditable, budgeted, and governed.**
