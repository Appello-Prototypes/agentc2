# AgentC2 — Sales Document

_For use by Corey, Nathan, and the sales team in demos, follow-ups, and prospect conversations._

---

## WHO THIS IS FOR

This document is structured by buyer persona. Jump to the section that matches who you're talking to. Each section contains their pain, the outcome we deliver, which products to lead with, objection handling, and a closing script.

---

## PART 1: THE 30-SECOND PITCH (EVERY CONVERSATION)

**Opening (adapt to context):**

> "What if the work between your tools happened automatically — and you could measure exactly what it saved you?
>
> AgentC2 connects the tools your team already uses — CRM, email, calendar, Slack, project management — and deploys AI that works across all of them autonomously. Not chatbots. Not simple automations. AI that reasons about your business, makes decisions, and delivers measurable results.
>
> 35 companies already run on it. Zero have churned. The average customer saves 10+ hours a week."

**If they ask "what kind of AI?":**

> "It depends on what you need. Deal Copilot auto-updates your CRM after every meeting. Ticket Triager classifies and routes support tickets in seconds. Morning Dispatch tells a construction company owner their entire day at 5 AM. Each one connects 3-6 of your existing tools and runs autonomously. You just measure the result."

**If they ask "how is this different from Zapier / ChatGPT / [competitor]?":**

> "Zapier chains two tools with if/then logic. ChatGPT answers questions in a chat window. AgentC2 is AI that reasons across your entire tool stack — reads a meeting transcript, updates your CRM, drafts a follow-up, schedules the next meeting, and notifies your team. All in one run, with full audit trail. And we can show you exactly what it saves."

---

## PART 2: BY ICP PERSONA

---

### REVENUE LEADER (VP Sales, CRO, Head of Sales)

**Their pain (in their words):**

- "My reps spend more time in the CRM than talking to prospects"
- "Meeting notes never make it into the pipeline"
- "I don't know which deals are at risk until it's too late"
- "Follow-ups fall through the cracks"

**What to show them:**

| Product                   | What It Does                                                                                                                                                              | Outcome They Care About                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Deal Copilot**          | After every email and meeting: extracts contact info, enriches CRM record, drafts contextual follow-up, schedules next meeting, posts update to Slack                     | **"8+ hours/week per rep back on selling"**                     |
| **Pipeline Intelligence** | Captures meeting transcripts (Fathom), extracts deal signals (objections, buying intent, next steps), updates deal stage, alerts on at-risk deals, weekly pipeline report | **"Every meeting becomes a deal signal"**                       |
| **Outbound Researcher**   | Scrapes prospect websites, enriches CRM records, generates personalized outreach emails, tracks engagement                                                                | **"Research 100 prospects in the time it takes to research 1"** |

**Demo flow:**

1. Show a real email thread → Deal Copilot processing it → CRM updated, follow-up drafted, meeting booked
2. Show a Fathom transcript → Pipeline Intelligence extracting signals → deal stage updated, at-risk alert sent
3. Show the time calculation: "Your team has 5 reps. At 8 hours each, that's 40 hours/week — a full headcount — going back to selling."

**ROI calculation:**

```
Team size:           [X] reps
Hours saved/rep:     8/week
Rep hourly cost:     $[Y] (or use $50 as default)
Weekly savings:      X × 8 × $Y
Monthly savings:     × 4.3
Annual savings:      × 12
AgentC2 cost:        $79-199/month

Example: 5 reps × 8 hrs × $50 = $2,000/week = $8,600/month
AgentC2 at $199/mo = 43:1 ROI
```

**Objections:**

| They Say                                  | You Say                                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "We already have HubSpot/Salesforce AI"   | "HubSpot's AI works inside HubSpot. Deal Copilot works across HubSpot AND Gmail AND Calendar AND Slack. It's the connections between tools where the hours are lost."               |
| "My reps won't trust AI with CRM updates" | "Deal Copilot is read-and-suggest by default. It drafts the follow-up and proposes the CRM update — your rep approves with one click. Trust builds over time."                      |
| "What if it gets something wrong?"        | "Every run has a full trace. You can see exactly what it read, what it decided, and what it did. Plus guardrails prevent sensitive data leakage. It's more auditable than a human." |

**Close:**

> "Let me set this up with your actual HubSpot data. We'll run Deal Copilot for a week on one rep's workflow — you'll see exactly what it catches and what it saves. First month is on us."

---

### OPERATIONS LEADER (COO, Head of Ops, Chief of Staff)

**Their pain (in their words):**

- "I check 6 dashboards every morning and I'm still not sure what's happening"
- "Meeting action items disappear into the ether"
- "Our tools don't talk to each other"
- "We have 15 tools and no single source of truth"

**What to show them:**

| Product            | What It Does                                                                                                                                                                      | Outcome They Care About                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Daily Briefing** | At 7 AM: aggregates key metrics (revenue, pipeline, tickets), summarizes today's meetings with context, flags priority emails, surfaces blockers, reports yesterday's outcomes    | **"Your entire business in a 2-minute morning read"** |
| **Meeting Memory** | After every meeting: captures transcript (Fathom), extracts action items and decisions, creates Jira tasks, shares summary to Slack, stores in Drive, follows up on overdue items | **"100% of action items tracked and completed"**      |
| **Inbox Zero**     | Triages email by priority/category, drafts responses, schedules meetings from threads, updates CRM, archives processed email                                                      | **"Process 100 emails in 10 minutes"**                |

**Demo flow:**

1. Show a Daily Briefing output — their own data if possible, or a realistic mock
2. Show Meeting Memory: a real Fathom transcript → action items extracted → Jira tickets created → Slack summary posted
3. Show Inbox Zero processing a cluttered inbox → categorized, drafted, scheduled

**ROI calculation:**

```
Morning dashboard time:    1 hr/day × 5 days = 5 hrs/week
Meeting follow-up time:    30 min/meeting × [X] meetings/week
Email triage time:         2 hrs/day × 5 days = 10 hrs/week

Total recoverable:         15-20 hrs/week
AgentC2 cost:              $199/month
Value of Ops Leader time:  $75-150/hour

Weekly savings:            15 hrs × $100 = $1,500/week = $6,500/month
ROI:                       32:1
```

**Objections:**

| They Say                                  | You Say                                                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I need to see it work with OUR tools"    | "We connect via OAuth — one click for Gmail, one click for Slack, one click for HubSpot. We can have a pilot running on your actual stack by end of week."                                            |
| "What about data privacy across tools?"   | "All credentials are AES-256 encrypted. Every run is traced and auditable. We have guardrails that prevent PII leakage. Your data never trains our models."                                           |
| "We tried Zapier and it broke constantly" | "Zapier is if/then logic — if the data doesn't match the expected format, it breaks. AgentC2 uses AI reasoning. It adapts to context, handles edge cases, and makes decisions the way a human would." |

**Close:**

> "I'll set up Daily Briefing on your actual tools — your email, your calendar, your Slack, your CRM. You'll get your first briefing at 7 AM tomorrow. If it doesn't save you an hour, turn it off. No charge for 30 days."

---

### SUPPORT LEADER (VP Support, Head of CS, Support Manager)

**Their pain (in their words):**

- "Ticket volume is growing faster than headcount"
- "Our first response time is killing our CSAT"
- "Knowledge is scattered across docs, wiki, and tribal knowledge"
- "We can't tell which accounts are about to churn until they cancel"

**What to show them:**

| Product                     | What It Does                                                                                                                                                                    | Outcome They Care About                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Ticket Triager**          | Auto-classifies by priority/category, searches knowledge base for solutions, suggests resolution to agent, routes to correct team, creates Jira ticket for bugs, notifies Slack | **"Reduce first-response time by 80%"**               |
| **Knowledge Concierge**     | Answers customer questions using ingested internal docs, surfaces relevant articles, escalates when confidence is low, learns from corrections                                  | **"Deflect 60% of Tier 1 tickets automatically"**     |
| **Customer Health Monitor** | Monitors support ticket volume, payment failures, usage patterns, conversation sentiment → generates health scores → alerts CSMs on at-risk accounts                            | **"Catch churn signals 30 days before cancellation"** |

**Demo flow:**

1. Show a raw support ticket → Ticket Triager classifying it → knowledge base article surfaced → suggested response generated → correct team notified — in seconds
2. Show Knowledge Concierge answering a common question using the company's own docs
3. Show Customer Health Monitor flagging an account: "Ticket volume up 300% this month + payment failure last week = churn risk: HIGH"

**ROI calculation:**

```
Current ticket volume:        [X] tickets/month
Current first response time:  [Y] hours
Target first response time:   [Y × 0.2] hours (80% reduction)

Tier 1 tickets deflected:     X × 60% = [Z] tickets handled without human
Support agent cost:           $[cost]/ticket
Monthly savings:              Z × $[cost]

Churn prevented:              Even 1 account saved = $[ARR of that account]
```

**Objections:**

| They Say                                    | You Say                                                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "We don't want AI talking to our customers" | "Ticket Triager doesn't respond to customers — it triage, suggests, and routes. Your agents still own the conversation. It just gives them the answer faster."                                     |
| "Our knowledge base is a mess"              | "That's exactly what the RAG knowledge base solves. We ingest your docs, wiki, and past tickets. The messier it is, the more value the AI adds — because it can search across everything at once." |
| "What if it misroutes a critical ticket?"   | "Every classification has a confidence score. Below threshold, it flags for human review instead of auto-routing. You set the threshold."                                                          |

**Close:**

> "Send me your 10 most common ticket types. I'll show you Ticket Triager classifying and routing all 10 correctly, with knowledge base answers for each, in a live demo. If it handles 8 out of 10 correctly, we talk next steps."

---

### ENGINEERING LEADER (CTO, VP Eng, Engineering Manager)

**Their pain (in their words):**

- "Bugs pile up while we build features"
- "Sprint planning and standups eat 5+ hours a week"
- "We don't know if a release is healthy until users complain"
- "Context switching between Sentry, Jira, and GitHub kills flow"

**What to show them:**

| Product            | What It Does                                                                                                                                                                             | Outcome They Care About                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Bug Bouncer**    | Monitors Sentry for new errors, deduplicates, creates Jira/Linear tickets with stack traces and reproduction steps, assigns to owning team, notifies Slack, suggests fixes from codebase | **"Error → ticket in 30 seconds, not 30 minutes"**  |
| **Release Radar**  | Monitors deployments, tracks error rates post-deploy, compares to baseline, auto-generates release notes, alerts on regressions, recommends rollback                                     | **"Know release health in 5 minutes, not 5 hours"** |
| **Sprint Copilot** | Generates sprint reports from Jira/Linear, summarizes PR activity from GitHub, runs async standups via Slack, generates data-driven retrospective insights                               | **"Automate 5 hours/week of sprint ceremonies"**    |

**Demo flow:**

1. Show a Sentry error → Bug Bouncer deduplicating → Jira ticket created with full context → Slack notification → suggested fix
2. Show a deploy event → Release Radar tracking error rate → comparison to baseline → release health score
3. Show Sprint Copilot's async standup: team members' PR activity + Jira progress → synthesized into a 2-minute read

**This audience cares about HOW it works:**

- "It connects via MCP — the Model Context Protocol, same open standard Anthropic uses. Not a proprietary connector that breaks."
- "Every run is fully traced. You can see token usage, cost, latency, and every decision the AI made."
- "Guardrails prevent it from ever modifying code or merging PRs. Read and report only, unless you configure write access."

**Objections:**

| They Say                             | You Say                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "We'll just build this ourselves"    | "You could. It took us 18 months and 30+ MCP integrations. Or you deploy Bug Bouncer in an afternoon and your team ships features instead of building internal tools." |
| "I don't trust AI-generated tickets" | "Every ticket includes the raw Sentry data, the stack trace, and the reproduction context. The AI adds structure and deduplication — the evidence is all verifiable."  |
| "We use Linear, not Jira"            | "We support both. MCP integrations for Jira, Linear, GitHub, Sentry, Vercel, Slack — all connected."                                                                   |

**Close:**

> "Connect your Sentry and Jira. I'll have Bug Bouncer running by end of day. Every error that fires tonight will have a ticket with full context by morning. You'll see in 24 hours whether it's worth keeping."

---

### EXECUTIVE (CEO, Founder, C-Suite)

**Their pain (in their words):**

- "I don't know what I don't know"
- "Information is spread across too many dashboards"
- "Decisions are delayed because I'm waiting for data someone has to compile manually"
- "I want to understand the business without interrogating my team"

**What to show them:**

| Product                | What It Does                                                                                                                                                                                            | Outcome They Care About                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Daily Briefing**     | Aggregates: revenue metrics (Stripe/HubSpot), pipeline status (CRM), support health (ticket volume, CSAT), engineering velocity (Jira/GitHub), today's calendar with context, priority emails, blockers | **"Your entire business in a 2-minute morning read"** |
| **Board Deck Builder** | Pulls live data from CRM, payments, project management → generates formatted deck with charts → saves to Drive                                                                                          | **"Board-ready reports from live data in 5 minutes"** |

**Demo flow:**

1. Show a Daily Briefing — as realistic as possible to their business
2. Walk through each section: "Here's revenue. Here's pipeline. Here's support health. Here's what your team shipped yesterday. Here's your calendar today with background on each meeting."
3. The WOW moment: "This was generated at 7 AM using live data from 6 tools. Nobody compiled it."

**This buyer makes fast decisions. Keep the pitch tight:**

> "You have 6 tools. You check 3 of them. Your team checks the other 3 and tells you what they think you need to know. Daily Briefing reads all 6, synthesizes what matters, and delivers it before you get to the office. Every morning. Automatically.
>
> 35 companies run on this. Zero have left. The ones in construction save 10+ hours a week. Want to see what yours would look like?"

**Objections:**

| They Say                               | You Say                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I need to talk to my team about this" | "Absolutely. Can I send you a sample briefing using your public data so you have something concrete to show them?"                                      |
| "What does this cost?"                 | "Pro is $79/month. Business is $199/month with 5 seats so your leadership team can each get their own briefing. That's the cost of one team lunch."     |
| "Is this secure?"                      | "AES-256 encryption, full audit logs, SOC 2 in progress, your data never trains our models. We'll walk your IT team through the security architecture." |

**Close:**

> "Give me your email, your CRM, and your Slack — I'll generate your first Daily Briefing. If it doesn't tell you something you didn't already know, I'll buy you coffee for wasting your time."

---

## PART 3: THE CONSTRUCTION CONVERSATION (Appello Intelligence)

_For existing Appello customers only. Different product, different pitch._

**This is NOT an "AI platform" conversation. This is an "Appello got smarter" conversation.**

**Opening (on a regular check-in call):**

> "Hey [name], quick question — how much time does [dispatcher / payroll person / safety manager] spend on [specific thing you know they struggle with from their Jira tickets]?
>
> We've been building something on top of Appello called Intelligence. It reads your scheduling, timesheets, safety forms, and job cost data — and tells you what you need to know before you get to the office.
>
> Want to see what it looks like with your data? We can have it running this week."

**What to show (in order of impact):**

1. **Morning Dispatch Intelligence** — Show the sample output with crew names, conflicts, missing timesheets, job alerts. Use THEIR data if available.
2. **Timesheet Compliance** — "Your team had 4 missing timesheets last Monday. This would have caught them at 6 AM."
3. **Job Profitability Warning** — "Airport Terminal is 45% complete but 61% through budget. This alert fires before the job is done, not after."

**Pricing (say it simply):**

> "It's $250 a month on your existing Appello bill. First month free. That's less than what one payroll mistake costs you."

**The line that closes:**

> "You'll know your day before you get to the office."

---

## PART 4: COMPETITIVE POSITIONING CHEAT SHEET

_Quick reference for when a prospect mentions a competitor._

| They Mention                            | Your Response                                                                                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"We use Zapier"**                     | "Zapier connects A to B with a rule. AgentC2 reasons across A, B, C, D, and E — understanding context, not just triggers. We're not replacing your Zaps. We're doing the work Zaps can't — the stuff that requires judgment."                   |
| **"ChatGPT does this"**                 | "ChatGPT is a conversation tool — you ask it a question, it answers. AgentC2 runs autonomously across your tools without you being in the loop. Deal Copilot doesn't wait for you to ask — it processes every email and meeting automatically." |
| **"We're looking at Relevance AI"**     | "Relevance gives you a builder and templates. We give you named products with documented ROI from 35 real companies. Ask them for a case study with hours saved and dollars recovered. We have five."                                           |
| **"Microsoft Copilot does this"**       | "Copilot works inside Microsoft tools. AgentC2 works across your entire stack — HubSpot, Gmail, Jira, Slack, Fathom, and 25 more. If your business runs on one vendor, Copilot is fine. If it runs on many, you need AgentC2."                  |
| **"We'll build it ourselves"**          | "You could. We have 30+ MCP integrations, multi-agent orchestration, guardrails, observability, and 18 months of production learning baked in. Or you deploy in an afternoon and your engineers build product instead."                         |
| **"AI is too risky / we're not ready"** | "That's why we built guardrails — PII detection, budget limits, hallucination filtering, full audit logs. And everything starts read-only. It reports to you. It doesn't act without permission."                                               |
| **"We need SOC 2 / security review"**   | "SOC 2 Type 1 in progress, targeting Q2. AES-256 encryption for all credentials. Role-based access. Full audit trails. Your data never trains our models. Happy to do a security walkthrough with your IT team."                                |

---

## PART 5: PRICING QUICK REFERENCE

**Say this when pricing comes up:**

> "We have a free tier to get started. Most teams land on Pro at $79/month or Business at $199/month for 5 seats. Enterprise is custom for SSO, SLA, and dedicated infrastructure."

|              | Free               | Starter   | Pro                      | Business   | Enterprise   |
| ------------ | ------------------ | --------- | ------------------------ | ---------- | ------------ |
| **Monthly**  | $0                 | $29       | **$79**                  | **$199**   | Custom       |
| **Annual**   | $0                 | $24       | **$66**                  | **$165**   | Custom       |
| **Runs**     | 200                | 1,500     | 8,000                    | 25,000     | Unlimited    |
| **Best for** | Trying one product | Solo user | Individual or small team | Department | Organization |

**If they push on price:**

> "Pro at $79/month saves the average user 8-10 hours/week. At any hourly rate above $10, the ROI is positive in week one."

**If they want to start small:**

> "Start on Free. Deploy one product — Deal Copilot, Daily Briefing, whatever matches your biggest pain point. Use it for a week. If it doesn't save you time, it costs you nothing. If it does, you'll upgrade because you'll want more."

**Appello Intelligence (construction only):**

| Starter              | Pro                  | Enterprise                        |
| -------------------- | -------------------- | --------------------------------- |
| +$250/mo             | +$500/mo             | +$1,000/mo                        |
| 3 products           | All 10               | Full library + voice + dashboards |
| On your Appello bill | On your Appello bill | On your Appello bill              |
| First 30 days free   | First 30 days free   | First 30 days free                |

---

## PART 6: DEMO CHECKLIST

**Before every demo:**

- [ ] Know which persona you're talking to (Revenue, Ops, Support, Engineering, Executive)
- [ ] Know which tools they use (CRM, email, calendar, project management, messaging)
- [ ] Prepare the product demo that matches their pain (see persona sections above)
- [ ] Have a realistic output sample ready (Daily Briefing, Deal Copilot output, etc.)
- [ ] Know their team size for the ROI calculation
- [ ] Have the competitive response ready if they've mentioned alternatives

**During the demo (15-minute structure):**

| Minute | Action                                                                                        |
| ------ | --------------------------------------------------------------------------------------------- |
| 0-2    | Ask about their pain. Listen. Confirm which problem hurts most.                               |
| 2-5    | Show the product that solves that problem. Use their data or a realistic mock.                |
| 5-8    | Show the output — the actual thing they'd receive (Slack message, email briefing, dashboard). |
| 8-10   | Walk through the ROI: team size × hours saved × hourly cost = monthly value.                  |
| 10-12  | Show the platform: traces, costs, guardrails — the enterprise governance layer.               |
| 12-15  | Close: "Can I set this up on your tools this week? First month free."                         |

**After the demo:**

- [ ] Send the follow-up email within 2 hours
- [ ] Include: the specific product discussed, the ROI calculation, and the free trial offer
- [ ] Attach the 2-pager PDF (AgentC2 or Appello Intelligence, depending on buyer)
- [ ] Schedule the setup call

---

## PART 7: EMAIL TEMPLATES

### Post-Demo Follow-Up

**Subject:** Your [Daily Briefing / Deal Copilot / Bug Bouncer] — ready to deploy

> Hi [Name],
>
> Thanks for the conversation today. Quick recap of what we discussed:
>
> **The problem:** [their specific pain in their words]
>
> **The solution:** [product name] connects [their tools] and [specific outcome].
>
> **The math:** With [X] people on your team, that's roughly [Y] hours/week saved — about $[Z]/month in recovered productivity. AgentC2 costs $[price]/month.
>
> **Next step:** I can have [product name] running on your [tool stack] by [day]. The first 30 days are free — if it doesn't deliver, you pay nothing.
>
> Want me to set it up?
>
> — [Your name]

### Cold Outreach (Reference a Peer)

**Subject:** How [similar company] saves [X] hours/week

> Hi [Name],
>
> [Similar company in their industry] was spending [X hours/week] on [specific pain]. They deployed [product name] and now [specific outcome — e.g., "their CRM updates itself after every meeting"].
>
> If your team uses [their likely tool stack], I can show you what this looks like with your data in a 15-minute call. No commitment.
>
> Worth a look?
>
> — [Your name]

### Appello Intelligence Intro (Existing Customers)

**Subject:** Your Appello data just got smarter

> Hi [Name],
>
> We built something new on top of Appello that I think you'll want to see.
>
> It's called Appello Intelligence — it reads your scheduling, timesheets, safety forms, and job costs, and delivers a morning briefing to your Slack or email at 5 AM. Before your team gets to the office, you'll know:
>
> - Which crews have scheduling conflicts today
> - Who didn't submit timesheets yesterday
> - Which jobs are trending over budget
>
> All from the data already in your Appello.
>
> It's $250/month on your existing bill, and the first month is free. Can I show you what it looks like with your data on our next call?
>
> — [Your name]

---

## PART 8: QUALIFICATION FRAMEWORK

**A prospect is qualified when you can answer YES to 3 of these 5:**

| #   | Question                                                    | Why It Matters                                                                                                       |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Do they use 3+ SaaS tools that don't connect well?          | AgentC2's value is cross-tool orchestration. One-tool shops get less value.                                          |
| 2   | Can you identify a specific, named pain point?              | "We spend too long on X" > "we're interested in AI."                                                                 |
| 3   | Is the person you're talking to the one who feels the pain? | The user and the buyer must overlap. VP of Sales who does CRM entry = perfect. CEO who has a team doing it = harder. |
| 4   | Is the team size 5+?                                        | Solo users can get value, but the ROI math is stronger with teams.                                                   |
| 5   | Do they have budget authority for $79-199/month?            | If they need 6 months of procurement for $79/month, the sales cycle doesn't justify the deal size.                   |

**Disqualification signals:**

- "We're just exploring AI" — no urgency, no specific pain
- "Can you integrate with our proprietary internal system?" — custom MCP work, not self-serve
- "We need this approved by 4 committees" — enterprise sales cycle for SMB pricing
- "We want to build our own" — they're a platform buyer, not a product buyer

---

_This document is a living resource. Update it every time you learn a new objection, find a new closing line, or discover a new pain point from a prospect conversation._

_Last updated: February 17, 2026_
