# Agentic Workflows 2026-2028: 50 Enterprise Use Cases

**Platform**: AgentC2
**Primitives**: Agents, Workflows, Networks, Campaigns, Skills, Tools, MCP Integrations, RAG, Memory, Triggers, Schedules
**Integrations**: HubSpot, Jira, Gmail, Google Calendar, Google Drive, Slack, GitHub, Firecrawl, Playwright, Fathom, ATLAS, JustCall, Dropbox, Microsoft Outlook

---

## The Review-Rework Loop Pattern

Before the 50 concepts, the design pattern the platform needs to support at scale:

```
Campaign creates work
    → Reviewer agent evaluates quality
        → IF quality < threshold:
            → Rework mission re-executes with reviewer feedback
            → Reviewer evaluates again (loop up to N times)
        → IF quality >= threshold:
            → Proceed to next mission
    → Human approval gate (optional)
        → Human rejects with feedback
            → Rework mission re-executes with human feedback
        → Human approves
            → Proceed
```

This fits the campaign architecture today with one enhancement: **missions can loop**. Currently missions execute once. Adding a `maxIterations` field on Mission and a `rework` event type would allow the reviewer to send a mission back for re-execution with its feedback injected as context. The campaign-reviewer already produces structured feedback (AARs with improve patterns). That feedback becomes the input to the reworked mission.

This is how humans work: draft, review, revise, review, approve. The platform should mirror this.

---

## The 50 Concepts

### Category 1: Sales & Revenue (1-10)

---

#### 1. Autonomous SDR — Outbound Prospecting Machine

**What it replaces**: A team of 5-10 SDRs doing manual prospecting, email writing, and follow-up tracking.

**How it works**:

- **Campaign (weekly)**: "Generate 50 new qualified leads in the fintech vertical"
- **Mission 1 — Research**: Firecrawl scrapes Crunchbase, LinkedIn company pages, and industry directories for companies matching ICP criteria (size, industry, funding stage, tech stack). GitHub searches for companies using specific open-source tools indicating technical sophistication.
- **Mission 2 — Qualification**: Agent cross-references against HubSpot to eliminate existing contacts. Scores each prospect on fit criteria. Produces a ranked list of 50.
- **Mission 3 — Personalization**: For each prospect, agent reads their recent blog posts, press releases, and social media (Firecrawl). Drafts a 3-email sequence personalized to their specific situation, pain points, and recent company news.
- **Mission 4 — Review & Rework**: Reviewer agent evaluates each email for personalization quality, tone, compliance with brand guidelines. Sends low-scoring drafts back to Mission 3 with specific feedback ("email 2 for Acme Corp is too generic — reference their Series B announcement from last week"). Loop until quality threshold met.
- **Mission 5 — Execution**: Creates HubSpot contacts, schedules email sequences in Gmail, creates Jira tickets for follow-up tracking, posts summary to Slack.
- **Ongoing workflow trigger**: When a prospect replies (Gmail trigger), classify response (interested/not interested/objection), route to appropriate follow-up sequence or alert human AE.

**Review-rework pattern**: Mission 4 reviews Mission 3's output. Failed emails loop back to Mission 3 with feedback up to 3 times.

---

#### 2. Deal Acceleration Intelligence

**What it replaces**: Revenue operations analyst who manually tracks deal health and prepares pipeline reviews.

**How it works**:

- **Scheduled campaign (daily)**: "Analyze all active deals in stages 2-4 and identify acceleration opportunities or stall risks"
- **Mission 1**: Pull all active deals from HubSpot. For each deal, check: last activity date, email engagement (Gmail), meeting frequency (Google Calendar), Jira ticket status for implementation planning, Slack mentions in deal-related channels.
- **Mission 2**: Score each deal on velocity (is it progressing faster or slower than average?), engagement (is the champion responsive?), and risk signals (competitor mentions in emails, cancelled meetings, unanswered proposals).
- **Mission 3**: For at-risk deals, draft specific intervention recommendations: "Schedule a technical deep-dive — the CTO hasn't been in a meeting since Jan 15" or "Send the ROI calculator — they asked about pricing 3 times in the last call transcript."
- **Mission 4**: Produce a daily deal intelligence Google Doc. Post critical alerts to Slack. Update HubSpot deal properties with risk scores.

**Review-rework**: Reviewer validates that recommendations are actionable and specific, not generic. Vague recommendations ("follow up soon") get sent back for rework with instruction to include specific dates, people, and content.

---

#### 3. Proposal Generator

**What it replaces**: Solutions engineer spending 4-8 hours per custom proposal.

**How it works**:

- **Campaign (per deal)**: "Generate a technical proposal for [Company X] based on their stated requirements"
- **Mission 1**: Pull all context — Fathom meeting transcripts, email threads (Gmail), Jira requirements tickets, HubSpot deal notes. Extract stated requirements, technical constraints, timeline, and budget signals.
- **Mission 2**: Draft the proposal in sections — executive summary, solution architecture, implementation timeline, pricing, team bios, case studies. Each section is a separate task that can be reviewed independently.
- **Mission 3 — Review**: Reviewer agent checks each section against requirements ("Section 3 mentions Kubernetes but the client transcript says they're on bare metal"), verifies pricing math, checks for inconsistencies.
- **Mission 4 — Rework**: Failed sections regenerated with review feedback. Loop up to 3 times per section.
- **Mission 5**: Assemble final proposal as Google Doc. Create Jira ticket for human final review. Post to Slack for SE team visibility.

**Human gate**: Campaign pauses after Mission 4 for human SE to approve before the final doc is created and shared.

---

#### 4. Customer Renewal Autopilot

**What it replaces**: Customer success manager manually tracking 50-100 accounts for renewal readiness.

**How it works**:

- **Scheduled campaign (monthly, per cohort)**: "Evaluate renewal readiness for all accounts renewing in the next 90 days"
- For each account: check product usage metrics (API), support ticket history (Jira), NPS scores (HubSpot), meeting cadence (Calendar), email sentiment (Gmail), Fathom transcripts for satisfaction signals.
- Classify each account: auto-renew (high confidence), needs attention (moderate risk), escalate (high risk).
- For "needs attention": draft personalized re-engagement plan with specific actions.
- For "escalate": alert CSM via Slack with full context package.
- Produce renewal forecast Google Doc for leadership.

---

#### 5. Win/Loss Analysis Engine

**What it replaces**: Revenue ops analyst spending days compiling win/loss reports quarterly.

**How it works**:

- **Campaign (quarterly)**: "Analyze all closed-won and closed-lost deals from Q4 to identify patterns"
- Pulls every closed deal from HubSpot. For each: reads all email threads, meeting transcripts (Fathom), Slack discussions, Jira implementation notes.
- Categorizes loss reasons: pricing, feature gap, competitor, timing, champion left.
- Identifies win patterns: which features resonated, which sales motions worked, which personas converted.
- Scrapes competitor websites for new features/pricing that may have influenced losses.
- Produces a comprehensive Google Doc with: executive summary, win pattern analysis, loss pattern analysis, competitor intelligence, strategic recommendations.
- Creates Jira epics for product team addressing top feature gaps.

---

#### 6. Territory Planning Assistant

**What it replaces**: Sales ops spending 2-3 weeks annually on territory design.

**How it works**:

- **Campaign (annual)**: "Design optimal sales territories for 12 AEs covering North America"
- Scrapes market data (Firecrawl) for company density by region and vertical.
- Pulls historical deal data from HubSpot: win rates, deal sizes, sales cycle lengths by region.
- Models territory assignments optimizing for: equal opportunity distribution, geographic coverage, vertical alignment, historical performance.
- Produces territory maps and assignment recommendations as Google Doc.
- Creates HubSpot property updates for territory reassignment.
- Review-rework loop: Sales leadership reviews, provides feedback ("Move healthcare accounts to Sarah"), system re-optimizes around constraints.

---

#### 7. Competitive Battlecard Maintenance

**What it replaces**: Product marketing manager spending 2+ hours per competitor per month maintaining battlecards.

**How it works**:

- **Scheduled campaign (weekly)**: "Update competitive battlecards for our top 5 competitors"
- Firecrawl scrapes competitor pricing pages, feature pages, changelogs, blog posts, press releases.
- Compares against last week's scrape (stored in RAG) to detect changes.
- For each change detected: updates the relevant battlecard section in Google Drive.
- Searches Fathom transcripts for recent competitive mentions in sales calls — extracts new objections and talk tracks.
- Posts a weekly competitive update to Slack with a summary of changes and new talking points.
- Review: Reviewer validates factual accuracy of claims, flags anything that needs human PMM verification.

---

#### 8. Pricing Optimization Analyst

**What it replaces**: Pricing analyst doing quarterly pricing reviews.

**How it works**:

- **Campaign (quarterly)**: "Analyze our pricing relative to competitors and customer feedback"
- Scrapes all competitor pricing pages (Firecrawl).
- Pulls win/loss data from HubSpot filtered by "pricing" as loss reason.
- Searches email and meeting transcripts for pricing objections.
- Analyzes feature-to-price ratios across competitors.
- Models pricing scenarios: "If we reduce the Pro tier by 15%, what's the projected impact on conversion based on historical sensitivity?"
- Produces a pricing recommendation Google Doc with scenarios, supporting data, and risk assessment.

---

#### 9. Partner Ecosystem Scout

**What it replaces**: BD team manually researching potential integration and channel partners.

**How it works**:

- **Campaign (monthly)**: "Identify 20 potential technology partners whose products complement ours"
- Scrapes app marketplaces, integration directories, and industry analyst reports (Firecrawl).
- Checks GitHub for open-source projects that frequently appear alongside our tech stack.
- Cross-references against HubSpot to exclude existing partners.
- For each prospect: researches their product, customer base overlap, integration complexity.
- Drafts partnership pitch emails personalized to each prospect's value proposition.
- Creates Jira tickets for BD team follow-up.

---

#### 10. Revenue Forecasting Narrator

**What it replaces**: VP Sales manually assembling the weekly forecast narrative for the board.

**How it works**:

- **Scheduled campaign (weekly)**: "Produce this week's revenue forecast narrative"
- Pulls pipeline data from HubSpot: stage distribution, week-over-week changes, commit vs. best case.
- Reads meeting transcripts from forecast calls (Fathom) for qualitative context.
- Identifies the 5 deals that moved most (up or down) and explains why using email/meeting/Jira evidence.
- Produces a 1-page narrative Google Doc: what changed, why, and what we expect next week.
- Posts to Slack and emails to leadership.

---

### Category 2: Engineering & Product (11-20)

---

#### 11. Automated Code Review Companion

**What it replaces**: Senior engineers spending 30-60 min per PR on routine reviews.

**How it works**:

- **Workflow trigger**: New PR opened on GitHub.
- Agent reads the PR diff, checks against coding standards (stored in RAG documents).
- Runs static analysis, checks for common patterns (security vulnerabilities, performance anti-patterns, missing tests).
- Posts structured review comments on the PR: categorized as "must fix," "suggestion," "question."
- If all checks pass, auto-approves with a summary comment.
- If issues found, creates Jira subtask linked to the PR for tracking.
- Review-rework: After developer pushes fixes, agent re-reviews only the changed sections and updates its assessment.

---

#### 12. Incident Response Coordinator

**What it replaces**: On-call engineer manually coordinating incident response.

**How it works**:

- **Workflow trigger**: Alert from monitoring system (webhook).
- Agent creates a Slack incident channel, posts initial context (what alert fired, which service, current status).
- Pulls recent deployments from GitHub (last 24h of merges to main).
- Pulls relevant Jira tickets (recently deployed features).
- Correlates: "Alert: API latency spike. Last deploy: 2 hours ago, PR #1234 — database query change by @engineer."
- Drafts initial status page update.
- Every 15 minutes: checks metrics, updates Slack thread, asks for status from tagged responders.
- Post-resolution: produces a postmortem Google Doc template pre-filled with timeline, root cause hypothesis, and contributing factors.

---

#### 13. Sprint Planning Autopilot

**What it replaces**: Engineering manager spending 2-3 hours preparing for sprint planning.

**How it works**:

- **Scheduled campaign (bi-weekly)**: "Prepare sprint planning materials for the next sprint"
- Pulls backlog from Jira: unestimated tickets, priority order, dependencies.
- Reads Fathom transcripts from last sprint retro for commitments made.
- Checks GitHub for in-progress PRs that might carry over.
- For each candidate ticket: estimates complexity based on description, similar past tickets, and codebase analysis (GitHub file search).
- Produces a sprint planning Google Doc: recommended sprint backlog, capacity analysis, risk items, carryover from last sprint.
- Creates a Slack poll in the engineering channel for async input on priorities.

---

#### 14. Technical Debt Archaeologist

**What it replaces**: Tech lead doing quarterly tech debt audits.

**How it works**:

- **Campaign (quarterly)**: "Audit the codebase for technical debt and produce a prioritized remediation plan"
- GitHub: analyzes code age, change frequency, complexity metrics across all repos.
- Jira: searches for tickets tagged "tech-debt," "refactor," "hack," "workaround" — tracks which ones keep getting deprioritized.
- Slack: searches engineering channels for "TODO," "FIXME," "we should really," "temporary" to find undocumented debt.
- Fathom: searches engineering meeting transcripts for discussions about things that are "hard to change" or "fragile."
- Produces a prioritized tech debt register as Google Doc: each item scored on blast radius, remediation cost, and business risk.
- Creates Jira epic with child tickets for top 10 items.

---

#### 15. Release Notes Generator

**What it replaces**: Product manager writing release notes from PR descriptions.

**How it works**:

- **Workflow trigger**: Release branch merged to main (GitHub webhook).
- Agent reads all PRs in the release: titles, descriptions, linked Jira tickets.
- Categorizes changes: new features, improvements, bug fixes, breaking changes.
- For each user-facing change: rewrites the PR description into customer-friendly language.
- Drafts release notes in two formats: technical (for docs) and marketing (for blog/email).
- Creates Google Doc with both versions.
- Review-rework: Reviewer checks that all PRs are accounted for, customer-facing language is accurate, and breaking changes have migration guides.
- Posts draft to Slack for PM approval before publishing.

---

#### 16. On-Call Handoff Briefer

**What it replaces**: On-call engineer spending 30 minutes writing handoff notes.

**How it works**:

- **Scheduled workflow (every rotation change)**: "Generate on-call handoff briefing"
- Pulls all incidents from the past rotation period (Slack incident channels, Jira incident tickets).
- Summarizes: what happened, resolution status, follow-up items.
- Identifies ongoing concerns: "Database replica lag has been elevated for 3 days — no incident yet but watch it."
- Checks GitHub for any in-flight deployments that the next on-call should be aware of.
- Produces handoff Google Doc and DMs it to the incoming on-call engineer via Slack.

---

#### 17. API Documentation Auditor

**What it replaces**: Developer advocate manually reviewing docs for accuracy.

**How it works**:

- **Campaign (monthly)**: "Audit API documentation for accuracy against current codebase"
- Firecrawl scrapes the live documentation site.
- GitHub reads the actual API route handlers, schemas, and types.
- Compares: does the doc match the code? Are there undocumented endpoints? Are there deprecated endpoints still in docs?
- For each discrepancy: creates a Jira ticket with the specific file, line, and suggested fix.
- Produces a documentation health report as Google Doc.
- Playwright runs sample API calls from documentation examples to verify they actually work.

---

#### 18. Dependency Vulnerability Monitor

**What it replaces**: Security engineer doing weekly dependency audits.

**How it works**:

- **Scheduled campaign (weekly)**: "Scan all repositories for dependency vulnerabilities and produce a remediation plan"
- GitHub: reads package.json, requirements.txt, go.mod across all repos.
- Firecrawl: checks CVE databases, npm advisory, GitHub advisory for each dependency.
- Prioritizes by: severity (CVSS score), exposure (is it in production? does it handle user input?), patchability (is a fixed version available?).
- For critical/high: creates Jira tickets with upgrade instructions and breaking change notes.
- Produces weekly security report as Google Doc.
- Posts critical alerts to Slack immediately.

---

#### 19. Feature Flag Cleanup Orchestrator

**What it replaces**: Engineering team manually tracking which feature flags are stale.

**How it works**:

- **Campaign (monthly)**: "Identify stale feature flags and coordinate their removal"
- GitHub: searches codebase for all feature flag references, checks when each was last modified.
- Jira: checks if the associated feature ticket is closed and has been in production for 30+ days.
- Slack: asks the flag owner (via DM) if it's safe to remove.
- For confirmed stale flags: creates a PR on GitHub removing the flag and its conditional code.
- Creates Jira ticket for code review of the cleanup PR.
- Produces a flag inventory Google Doc with status of each.

---

#### 20. Architecture Decision Record Writer

**What it replaces**: Senior engineer writing ADRs from meeting discussions.

**How it works**:

- **Workflow trigger**: Meeting tagged "architecture" in Fathom completes.
- Agent reads the full transcript, extracts: the decision made, alternatives considered, trade-offs discussed, who participated.
- Drafts an ADR in the standard template (stored in RAG): Title, Status, Context, Decision, Consequences.
- Creates the ADR as a Google Doc in the Architecture Decisions folder.
- Creates a Jira ticket for the implementation of the decision.
- Posts the ADR link to Slack for team review.
- Review-rework: Reviewer checks that all alternatives from the transcript are represented and the consequences section is thorough.

---

### Category 3: Customer Success & Support (21-30)

---

#### 21. Intelligent Ticket Routing and First Response

**What it replaces**: L1 support agents triaging and writing initial responses.

**How it works**:

- **Workflow trigger**: New support ticket created (Jira webhook or email).
- Agent reads the ticket, classifies: product area, severity, customer tier (from HubSpot).
- Searches RAG knowledge base for similar past tickets and their resolutions.
- Drafts a first response: acknowledges the issue, provides relevant documentation links, suggests troubleshooting steps.
- If high-confidence match to a known issue: includes the specific resolution.
- Routes to appropriate team queue in Jira based on product area.
- Posts to Slack support channel for visibility.
- Review: If the customer replies "that didn't work," escalates to human with full context package.

---

#### 22. Customer Onboarding Concierge

**What it replaces**: Implementation manager manually running onboarding checklists.

**How it works**:

- **Campaign (per new customer, 2-4 weeks)**: "Onboard [Company X] according to their purchased tier"
- **Week 1 missions**: Create Jira project for onboarding tasks. Schedule kickoff meeting (Calendar). Send welcome email sequence (Gmail). Set up HubSpot lifecycle stage.
- **Week 2 missions**: Check if kickoff happened (Calendar). If meeting transcript exists (Fathom), extract action items and requirements. Create implementation tasks in Jira. Draft configuration guide personalized to their use case (Google Doc).
- **Week 3 missions**: Check Jira task completion status. If blockers exist, alert CSM via Slack. Send progress update email to customer stakeholder.
- **Week 4 missions**: Verify all checklist items complete. Schedule training session (Calendar). Produce onboarding summary report (Google Doc). Update HubSpot to "Active" lifecycle stage.
- If any week's review finds incomplete items, the rework loop re-executes that week's tasks with adjusted approach.

---

#### 23. Proactive Support Intelligence

**What it replaces**: Support team reacting to tickets instead of preventing them.

**How it works**:

- **Scheduled campaign (daily)**: "Identify customers who may need proactive support"
- Monitors: API error rates per customer (if available via webhooks), support ticket frequency trends (Jira), email sentiment trajectory (Gmail), meeting cancellation patterns (Calendar).
- Cross-references against product release notes (GitHub) — "Customer X uses Feature Y which had a known regression in yesterday's release."
- For each at-risk customer: drafts proactive outreach email acknowledging the issue before they report it.
- Creates Jira ticket for support team to follow up.
- Posts daily proactive support digest to Slack.

---

#### 24. Knowledge Base Maintainer

**What it replaces**: Technical writer manually updating help docs based on support tickets.

**How it works**:

- **Scheduled campaign (weekly)**: "Update the knowledge base based on this week's support patterns"
- Analyzes all support tickets from the past week (Jira): clusters common issues, identifies gaps in documentation.
- Searches existing knowledge base (RAG) for articles that should exist but don't.
- For each gap: drafts a new KB article using resolution data from closed tickets.
- For existing articles with high ticket volume: updates the article with new information or clearer instructions.
- Creates/updates Google Docs in the KB folder.
- Review-rework: Reviewer checks technical accuracy and clarity. Sends back unclear articles for rewrite.
- Posts a weekly KB update summary to Slack.

---

#### 25. Customer Feedback Synthesizer

**What it replaces**: Product manager manually reading and categorizing customer feedback.

**How it works**:

- **Scheduled campaign (weekly)**: "Synthesize all customer feedback received this week"
- Sources: support tickets (Jira), email threads (Gmail), meeting transcripts (Fathom), Slack customer channels, NPS survey responses (HubSpot), app store reviews (Firecrawl).
- Categorizes each piece of feedback: feature request, bug report, praise, complaint, churn signal.
- Groups related feedback into themes.
- Produces a weekly Voice of Customer report (Google Doc): top themes, representative quotes, trend analysis (week-over-week), recommended product actions.
- Creates Jira feature request tickets for top-requested capabilities.
- Tags HubSpot contacts with relevant feedback themes.

---

#### 26. SLA Compliance Monitor

**What it replaces**: Support ops analyst pulling SLA reports manually.

**How it works**:

- **Scheduled campaign (daily)**: "Monitor SLA compliance and flag at-risk tickets"
- Scans all open Jira support tickets, calculates time-to-first-response and time-to-resolution against SLA tiers (pulled from HubSpot customer tier).
- For tickets approaching SLA breach: escalates via Slack to the assigned agent and their manager.
- Produces daily SLA dashboard (Google Doc) with: compliance rate, breached tickets, at-risk tickets, team performance breakdown.
- If breach occurs: creates a Jira incident ticket for SLA breach, drafts apology email for the customer.

---

#### 27. Customer Health Score Calculator

**What it replaces**: CS ops building and maintaining health score models in spreadsheets.

**How it works**:

- **Scheduled campaign (weekly)**: "Calculate health scores for all active accounts"
- For each account, pulls signals from: HubSpot (engagement, deal value, lifecycle), Jira (ticket volume, severity trends), Gmail (response times, sentiment), Calendar (meeting frequency), Fathom (satisfaction keywords in calls).
- Weights signals based on historical correlation with churn (stored in RAG from past analysis).
- Updates HubSpot custom properties with the calculated score.
- Flags accounts that dropped significantly week-over-week.
- Produces a weekly health report (Google Doc) with trend charts and recommended actions.

---

#### 28. Automated QBR Preparation

**What it replaces**: CSM spending 4-6 hours preparing Quarterly Business Review materials.

**How it works**:

- **Campaign (per account, quarterly)**: "Prepare QBR materials for [Company X]"
- Pulls usage data, support history (Jira), email interaction history (Gmail), meeting summaries (Fathom), deal history (HubSpot).
- Produces a QBR deck outline (Google Doc) with: business outcomes achieved, product adoption metrics, support summary, roadmap alignment, expansion opportunities.
- Creates a suggested agenda based on what topics came up most in recent interactions.
- Schedules the QBR meeting (Calendar) if not already scheduled.
- Review-rework: CSM reviews the draft, sends back sections needing adjustment with comments, system revises.

---

#### 29. Churn Recovery Sequencer

**What it replaces**: CS leadership manually orchestrating win-back campaigns.

**How it works**:

- **Campaign (triggered on churn event)**: "Execute win-back sequence for [Company X]"
- Immediately: analyzes churn reason from HubSpot, last interactions (Gmail, Fathom), outstanding issues (Jira).
- Day 1: Drafts personalized "we're sorry to see you go" email addressing their specific concerns.
- Day 7: Checks if they responded. If not, drafts follow-up with a specific remediation offer.
- Day 14: Checks competitive intelligence (what are they likely switching to?). Drafts a comparison showing advantages they'd lose.
- Day 30: Final outreach with a "door is always open" message.
- Throughout: updates HubSpot lifecycle stage, logs all touchpoints, tracks response rates.
- Review: Each email reviewed for tone (empathetic, not desperate) before sending.

---

#### 30. Support Training Content Generator

**What it replaces**: Training manager creating training materials from resolved tickets.

**How it works**:

- **Campaign (monthly)**: "Generate training content from this month's complex support resolutions"
- Identifies the 10 most complex resolved tickets from Jira (longest resolution time, most back-and-forth).
- For each: reads the full ticket history, extracts the problem, investigation steps, red herrings, and final resolution.
- Produces training scenarios (Google Docs) in a case-study format: "Here's what the customer reported. What would you do?" with an answer key.
- Ingests the scenarios into RAG so future support agents can find them.
- Posts the new training materials to Slack with a summary.

---

### Category 4: Marketing & Content (31-38)

---

#### 31. Content Calendar Executor

**What it replaces**: Content team manually researching, writing, and scheduling content.

**How it works**:

- **Scheduled campaign (weekly)**: "Produce next week's content calendar deliverables"
- Reads the content calendar (Google Sheets/Drive) for next week's planned topics.
- For each piece: researches the topic (Firecrawl scrapes industry sources), pulls internal data (HubSpot for customer stories, Jira for product updates, Fathom for executive quotes).
- Drafts the content: blog posts, social media captions, email newsletter sections.
- Review-rework loop: Content quality reviewer checks for brand voice, factual accuracy, SEO optimization. Weak sections sent back for rewrite with specific feedback. Up to 3 iterations.
- Final drafts saved to Google Drive in the appropriate folders.
- Creates Jira tickets for design team (graphics needed) and social team (scheduling).

---

#### 32. SEO Intelligence Agent

**What it replaces**: SEO specialist doing monthly keyword research and competitor analysis.

**How it works**:

- **Scheduled campaign (monthly)**: "Analyze our SEO position and identify content gaps"
- Firecrawl scrapes SERPs for top 100 target keywords, identifies who's ranking.
- Scrapes competitor blog post titles, meta descriptions, and content topics.
- Compares against our published content (Google Drive/website scrape).
- Identifies: keywords we should target, competitor content we should create equivalents for, existing content that needs updating.
- Produces an SEO action plan (Google Doc) with: priority keywords, content briefs for top 10 gaps, update recommendations for existing pages.
- Creates Jira tickets for each content brief.

---

#### 33. Social Listening and Response Engine

**What it replaces**: Social media manager monitoring mentions and crafting responses.

**How it works**:

- **Scheduled campaign (daily)**: "Monitor brand mentions and industry conversations"
- Firecrawl searches Twitter/X, Reddit, Hacker News, Product Hunt, LinkedIn for brand mentions, competitor mentions, and industry keyword discussions.
- Classifies each mention: positive (amplify), negative (address), question (answer), feature request (log), competitive comparison (respond).
- For each actionable mention: drafts an appropriate response.
- Posts response drafts to Slack for social team approval before publishing.
- Logs feature requests as Jira tickets.
- Updates HubSpot contacts if a known contact is mentioned.
- Weekly: produces a social listening report (Google Doc) with sentiment trends and key themes.

---

#### 34. Email Marketing Optimizer

**What it replaces**: Email marketing specialist A/B testing and optimizing campaigns.

**How it works**:

- **Campaign (per email campaign)**: "Optimize the subject line and content for the Q1 product launch email"
- Pulls historical email performance data from marketing platform (via API/webhook).
- Analyzes: which subject lines got highest open rates, which CTAs got highest click rates, which segments responded best.
- Generates 10 subject line variants based on patterns from top performers.
- Generates 3 content variants: benefit-focused, feature-focused, social-proof-focused.
- Review-rework: Reviewer evaluates each variant against brand guidelines and compliance requirements. Rejects non-compliant versions.
- Produces final test matrix (Google Doc) with recommended A/B test plan.

---

#### 35. Event Marketing Coordinator

**What it replaces**: Event marketing manager coordinating logistics across channels.

**How it works**:

- **Campaign (per event, 4-6 weeks)**: "Coordinate marketing for [Annual Conference]"
- **Phase 1 (6 weeks out)**: Scrape similar events for agenda ideas (Firecrawl). Draft speaker outreach emails (Gmail). Create event Jira project with task breakdown.
- **Phase 2 (4 weeks out)**: Draft promotional content (blog post, email sequence, social posts). Create registration page content. Schedule promotional emails.
- **Phase 3 (2 weeks out)**: Check registration numbers (webhook/API). If below target, draft additional promotional push. Update Slack with status.
- **Phase 4 (1 week out)**: Send reminder sequences. Prepare attendee materials (Google Docs). Schedule day-of coordination meetings (Calendar).
- **Post-event**: Compile attendee feedback, produce event recap Google Doc, create follow-up sequences for attendees in HubSpot, create Jira tickets for next-event improvements.

---

#### 36. Thought Leadership Content Factory

**What it replaces**: Ghostwriter producing executive thought leadership content.

**How it works**:

- **Campaign (weekly)**: "Produce a thought leadership piece from [CEO's] recent insights"
- Searches Fathom for recent executive meetings, keynotes, interviews.
- Searches Slack for executive channel posts and discussions.
- Identifies the most novel/interesting point of view expressed in the past week.
- Researches the topic: industry data, counterarguments, supporting evidence (Firecrawl).
- Drafts a LinkedIn article/blog post in the executive's voice (voice profile stored in RAG).
- Review-rework: Multiple rounds — first for factual accuracy, second for voice authenticity, third for strategic messaging alignment. Each round provides specific feedback for the next iteration.
- Final version saved to Google Drive, posted to Slack for executive approval.

---

#### 37. Competitive Content Gap Analyzer

**What it replaces**: Content strategist manually auditing competitor content.

**How it works**:

- **Campaign (quarterly)**: "Map our content coverage against competitors"
- Firecrawl scrapes all blog posts, resource pages, and documentation from top 5 competitor websites.
- Categorizes each piece by: topic, funnel stage, content type, target persona.
- Maps against our own content library (Google Drive/website scrape).
- Identifies: topics they cover that we don't, topics we cover that they don't (our advantages), topics we both cover where theirs is stronger.
- Produces a gap analysis Google Doc with: priority ranking of gaps, content briefs for the top 15 gaps, competitive positioning opportunities.

---

#### 38. Case Study Generator

**What it replaces**: Content marketer spending 4-6 weeks producing a customer case study.

**How it works**:

- **Campaign (per customer)**: "Produce a case study for [Company X]"
- Pulls all available data: HubSpot deal history (before/after metrics), Jira implementation timeline, Fathom interview transcripts (if customer interview recorded), email threads with customer quotes.
- Researches the customer's industry for context (Firecrawl).
- Drafts the case study in standard format: challenge, solution, results, customer quotes.
- Review-rework loop: Reviewer checks that all claims have supporting data, quotes are accurately attributed, and results are specific (percentages, dollar amounts, time savings — not vague).
- Creates Google Doc in case studies folder.
- Creates Jira ticket for design team to produce the formatted PDF version.
- Updates HubSpot contact with "case study available" tag.

---

### Category 5: Operations & Finance (39-44)

---

#### 39. Vendor Contract Renewal Tracker

**What it replaces**: Operations manager manually tracking vendor contract dates.

**How it works**:

- **Scheduled campaign (monthly)**: "Review all vendor contracts expiring in the next 90 days"
- Searches Google Drive for contract documents (PDF parsing).
- Extracts key terms: expiration date, auto-renewal clause, notice period, pricing.
- For contracts within notice period: alerts procurement via Slack, creates Jira ticket for renewal decision.
- Scrapes vendor competitor pricing (Firecrawl) to provide negotiation leverage.
- Produces a contract renewal calendar (Google Doc) with recommended actions: renew, renegotiate, or switch.
- Schedules negotiation preparation meetings (Calendar).

---

#### 40. Expense Report Auditor

**What it replaces**: Finance team manually reviewing expense reports for policy compliance.

**How it works**:

- **Workflow trigger**: Expense report submitted (webhook).
- Agent reads the expense report, checks each line item against company policy (stored in RAG): meal limits, hotel rate caps, approved airlines, required receipts.
- Flags violations with specific policy citations.
- Cross-references against Calendar — "Conference expense claimed for March 15, but your calendar shows no travel that week."
- For clean reports: auto-approves and notifies finance.
- For flagged reports: creates Jira ticket with specific items needing clarification, sends email to submitter.
- Monthly: produces compliance report showing violation patterns, repeat offenders, policy gaps.

---

#### 41. Board Meeting Preparation Suite

**What it replaces**: Chief of Staff spending a week preparing board materials.

**How it works**:

- **Campaign (quarterly)**: "Prepare board meeting materials for Q1 board meeting"
- **Mission 1**: Pull financial metrics, pipeline data (HubSpot), product metrics (Jira velocity, release cadence), team metrics.
- **Mission 2**: Draft each board deck section: CEO update, financial summary, product roadmap, competitive landscape, hiring plan.
- **Mission 3**: Research industry comparables and market trends (Firecrawl) for context.
- **Mission 4 — Review**: Each section reviewed for accuracy, completeness, and executive-appropriate framing. Multiple rework iterations.
- **Mission 5**: Assemble final board package (Google Doc) with appendices, pre-read materials, and discussion questions.
- Schedule board meeting (Calendar) and send pre-read 5 days before.

---

#### 42. Office/Space Planning Intelligence

**What it replaces**: Facilities manager analyzing space utilization manually.

**How it works**:

- **Scheduled campaign (monthly)**: "Analyze office space utilization and recommend optimizations"
- Pulls meeting room booking data (Google Calendar) across all rooms.
- Analyzes: which rooms are booked but unused (no-shows), which rooms are always full, which time slots have capacity.
- Pulls headcount data and team assignments (HR system via API).
- Cross-references Slack activity and calendar density to identify remote work patterns.
- Produces a space utilization report (Google Doc) with: heat maps, optimization recommendations (room consolidation, desk sharing ratios), cost saving projections.

---

#### 43. Compliance Training Tracker

**What it replaces**: HR/compliance team manually tracking who's completed required training.

**How it works**:

- **Scheduled campaign (monthly)**: "Audit compliance training completion and follow up with non-compliant employees"
- Checks training platform completion records (via API/webhook).
- Cross-references against employee directory (HR system).
- For overdue employees: sends reminder email (Gmail) with direct link to training.
- For managers of overdue employees: sends escalation email and Slack DM.
- Creates Jira tickets for compliance team tracking.
- Produces monthly compliance dashboard (Google Doc) with: completion rates by department, overdue list, escalation status.

---

#### 44. Procurement Intelligence Agent

**What it replaces**: Procurement team researching vendors for new purchases.

**How it works**:

- **Campaign (per procurement request)**: "Research and recommend vendors for [category]"
- Firecrawl scrapes G2, Capterra, and industry review sites for vendors in the category.
- For each candidate vendor: scrapes their website for pricing, features, customer list, integration capabilities.
- Searches GitHub for open-source alternatives.
- Checks if any existing contacts in HubSpot work at these vendors (warm introductions).
- Searches Fathom/ATLAS for any previous vendor evaluation discussions.
- Produces a vendor comparison matrix (Google Doc) with: feature comparison, pricing comparison, pros/cons, recommendation.
- Creates Jira ticket for procurement team with the shortlist.

---

### Category 6: HR & People (45-48)

---

#### 45. Candidate Pipeline Nurture

**What it replaces**: Recruiting coordinator manually nurturing passive candidates.

**How it works**:

- **Scheduled campaign (bi-weekly)**: "Nurture our passive candidate pipeline"
- For candidates in the "interested but not ready" pipeline:
    - Checks their GitHub for recent activity (are they working on new projects?).
    - Scrapes their company's careers page (are they hiring for similar roles, suggesting growth/stability?).
    - Searches for their conference talks or blog posts (Firecrawl) for conversation starters.
- Drafts personalized nurture emails: share a relevant blog post, congratulate on a recent achievement, mention a new role that's opened.
- Review-rework: Reviewer checks that emails are genuinely personalized and not creepy ("don't mention you scraped their GitHub commit history").
- Tracks engagement: if they respond, alerts recruiter via Slack.

---

#### 46. Employee Onboarding Orchestrator

**What it replaces**: HR coordinator running the new hire onboarding checklist.

**How it works**:

- **Campaign (per new hire, 2 weeks)**: "Execute onboarding for [New Hire Name] starting [Date]"
- **Pre-start**: Send welcome email sequence (Gmail). Create accounts/access requests as Jira tickets. Schedule Day 1 meetings: manager 1:1, team intro, IT setup (Calendar). Share reading materials (Google Drive links).
- **Day 1**: Post welcome message in Slack team channel. Verify all access tickets in Jira are resolved.
- **Week 1**: Schedule buddy lunches, cross-team intros (Calendar). Share role-specific documentation (Google Drive). Create Jira onboarding project with learning milestones.
- **Week 2**: Check in via automated survey (email). Flag any blockers to manager via Slack. Schedule 30-day check-in meeting (Calendar).
- **Day 30**: Produce onboarding completion report (Google Doc). Update HR records. Send feedback survey.

---

#### 47. Performance Review Preparation Assistant

**What it replaces**: Manager spending 4+ hours gathering data for each direct report's review.

**How it works**:

- **Campaign (per review period)**: "Prepare performance review materials for [Manager's] team"
- For each direct report:
    - Jira: tickets completed, sprint velocity, code reviews done.
    - GitHub: PRs authored, code review comments given, documentation contributions.
    - Fathom: meeting participation, presentations given.
    - Slack: cross-team collaboration evidence, knowledge sharing.
    - Gmail: customer/stakeholder feedback threads mentioning the employee.
- Produces a pre-filled review template (Google Doc) with: data-backed accomplishments, growth areas with evidence, peer feedback summary, recommended goals for next period.
- Review-rework: Manager reviews, adjusts, provides additional context. System incorporates manager feedback into a polished final version.

---

#### 48. Culture Pulse Monitor

**What it replaces**: HR team doing quarterly engagement surveys and manually analyzing results.

**How it works**:

- **Scheduled campaign (monthly)**: "Assess organizational culture health"
- Analyzes Slack channel activity: message volume trends, emoji sentiment, participation breadth (are the same 10 people talking or is it distributed?), off-hours activity (burnout signal).
- Calendar analysis: meeting load per person, focus time availability, after-hours meetings.
- Jira: workload distribution, overdue tasks per person, sprint burndown patterns.
- Searches Slack for keywords: "burned out," "overwhelmed," "understaffed," "frustrated," "love working here," "great team."
- Produces a monthly culture health report (Google Doc) with: team-level health scores, burnout risk flags, collaboration patterns, recommended interventions.
- Alerts HR via Slack if any team shows acute stress signals.

---

### Category 7: Cross-Functional & Strategic (49-50)

---

#### 49. M&A Due Diligence Research Suite

**What it replaces**: Investment banking analyst team doing preliminary target research.

**How it works**:

- **Campaign (per target, 1-2 weeks)**: "Conduct preliminary due diligence on [Target Company]"
- **Mission 1 — Public Intelligence**: Firecrawl scrapes target's website, press releases, blog, careers page (headcount proxy), App Store reviews, social media presence. Scrapes SEC filings if public. Searches GitHub for open-source contributions (technical capability proxy).
- **Mission 2 — Market Position**: Scrapes competitors in the same space. Analyzes pricing comparison, feature comparison, market share estimates from industry reports.
- **Mission 3 — Cultural & Team Assessment**: Analyzes Glassdoor reviews (Firecrawl), LinkedIn team composition, hiring patterns (careers page changes over time), engineering blog quality.
- **Mission 4 — Financial Modeling Inputs**: Extracts all available financial data points. Estimates ARR from pricing page + customer count. Identifies key assumptions to validate.
- **Mission 5 — Risk Assessment**: Identifies regulatory risks, customer concentration risks (if visible), technology risks (tech stack analysis from job postings), competitive threats.
- **Mission 6 — Review & Rework**: Each section reviewed for completeness and accuracy. Sections with unsupported claims sent back with instruction to either find supporting evidence or explicitly note the assumption.
- **Mission 7 — Report Assembly**: Produces a comprehensive due diligence report (Google Doc, 30-50 pages) with: executive summary, company overview, market analysis, financial analysis, risk assessment, recommendation.

This is the most complex campaign concept — 7 sequential missions, multiple review-rework loops, touching 8+ external data sources, producing a single high-stakes deliverable.

---

#### 50. Strategic Planning War Room

**What it replaces**: Executive team and strategy consultants doing annual strategic planning.

**How it works**:

- **Campaign (annual, 2-3 weeks)**: "Conduct strategic analysis and produce the annual strategic plan"
- **Phase 1 — External Analysis (Week 1)**:
    - Market sizing: Firecrawl scrapes industry reports, analyst estimates, TAM/SAM/SOM data.
    - Competitive landscape: deep scrape of all competitors (pricing, features, positioning, team size, funding).
    - Customer trends: synthesize all meeting transcripts (Fathom), support tickets (Jira), email threads (Gmail) for the year — what are customers asking for most?
    - Technology trends: scrape tech news, conference talks, research papers for emerging technologies relevant to our space.

- **Phase 2 — Internal Analysis (Week 1-2)**:
    - Financial performance: revenue trends, unit economics, CAC/LTV from HubSpot deal data.
    - Product velocity: Jira epics completed vs planned, roadmap execution rate, tech debt accumulation.
    - Team health: hiring pipeline, attrition data, engagement signals from Slack/Calendar.
    - Operational efficiency: cost per customer, support ticket ratio, deployment frequency (GitHub).

- **Phase 3 — Strategic Synthesis (Week 2)**:
    - SWOT analysis combining external and internal findings.
    - Scenario modeling: 3 strategic scenarios (aggressive growth, profitable growth, market defense) with projected outcomes.
    - Strategic initiatives: 5-7 specific initiatives with expected impact, required investment, timeline, and risk.

- **Phase 4 — Review & Rework (Week 2-3)**:
    - Each section reviewed by a specialist reviewer agent (financial accuracy, market claim verification, strategic coherence).
    - Multiple rework cycles with specific feedback.
    - Human executive review gate before finalization.

- **Phase 5 — Deliverables (Week 3)**:
    - 50+ page strategic plan (Google Doc) with executive summary, analysis sections, strategic recommendations, and implementation roadmap.
    - Board presentation version (condensed Google Doc).
    - Jira epics for each strategic initiative.
    - Calendar holds for quarterly strategy reviews.
    - Slack announcement with the plan summary.

This campaign touches every single integration in the platform and runs for weeks. It's the ultimate expression of the system: autonomous multi-phase strategic analysis with structured review loops, producing the most consequential document a company creates each year.

---

## Summary

| Category              | Concepts | Key Pattern                                                                         |
| --------------------- | -------- | ----------------------------------------------------------------------------------- |
| Sales & Revenue       | 1-10     | Prospect → Research → Personalize → Review → Execute → Track                        |
| Engineering & Product | 11-20    | Monitor → Detect → Draft → Review → Execute → Report                                |
| Customer Success      | 21-30    | Observe → Score → Intervene → Review → Escalate                                     |
| Marketing & Content   | 31-38    | Research → Draft → Review → Rework → Publish                                        |
| Operations & Finance  | 39-44    | Collect → Audit → Flag → Report → Act                                               |
| HR & People           | 45-48    | Gather → Analyze → Personalize → Review → Deliver                                   |
| Cross-Functional      | 49-50    | Deep Research → Multi-Phase Analysis → Iterative Review → Comprehensive Deliverable |

Every concept uses the review-rework loop. Every concept touches 3+ integrations. Every concept replaces work that currently takes a human hours, days, or weeks. The platform's primitives — campaigns for autonomous planning, workflows for repeatable triggers, networks for routing, agents for execution, skills for capability, RAG for memory, and MCP for tool access — support all 50.
