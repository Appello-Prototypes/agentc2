# Pulse at Scale: A Vision

## What Pulse Actually Is

Pulse is not a feature. It is an implementation of a new work primitive.

When Karpathy released Auto Research, he showed that a single agent running experiments in a loop — bounded by a fixed time budget, scored by a single unambiguous number, committing winners and discarding losers — could make meaningful research progress overnight without human involvement. When the Ralph Wiggum technique emerged, it showed the same pattern applied to software: persistent coding loops where state lives in external artifacts, not in context windows, so the system self-heals across sessions.

Pulse is the multi-agent, multi-domain version of this pattern. It takes the core insight — define a goal, define a score, let agents iterate autonomously — and extends it from a single agent on a single file to a collective of specialists on an arbitrary problem domain. The God Agent is the orchestrator that Karpathy himself said was the missing next step: not emulating a single PhD student, but emulating a research community of them.

The infrastructure is built. The question is what happens when you turn it loose.

---

## The Unit of Autonomous Work

Today, the fundamental unit of AI-assisted work is a prompt. A human writes a prompt, an agent responds, the human evaluates, and the cycle repeats. This is powerful but bounded by human attention. The human is the bottleneck.

Pulse changes the unit of work from a prompt to a **goal**. A human defines a goal ("get our website to page 1 for 20 keywords"), a score function ("number of page-1 keywords"), and review checkpoints ("pause after 10 constraints"). Then they walk away. The system decomposes the goal into milestones, creates specialist agents, assigns tasks, runs experiments, accumulates constraints, and drives the score toward the target. The human re-engages at checkpoints — not to do work, but to exercise judgment on the system's accumulated decisions.

This is not automation. Automation replaces a known process. This is autonomous goal pursuit, where the process itself is discovered through iteration.

---

## What Compounds

The most important property of Pulse is that it gets smarter over time. Three artifacts compound:

**The Constraint Library.** Every rejected experiment produces a constraint: "NEVER do X BECAUSE Y." After 500 experiments, a Pulse might have 40 active constraints — distilled rules that prevent the collective from repeating mistakes. These constraints are the system's institutional taste. They cannot be written upfront because they emerge from contact with reality. A constraint like "never target keywords with Domain Authority above 70 because our site's authority is too low to compete" is only discoverable through failed experiments. The Constraint Library is the Pulse's most valuable artifact, and it only grows.

**The Experiment Log.** Every experiment — keep, discard, or crash — is recorded with its hypothesis, result, and score delta. This is the complete archaeological record of what the collective tried. Unlike human organizations where failed experiments go to the graveyard, every failure in Pulse is a data point that prunes the search tree for all agents. Agent 47 knows what Agent 12 already tried.

**The State of the Pulse.** A living narrative document that the God Agent updates every run: current score, trend, what's working, what failed, what to try next. This is the system's self-awareness — its ability to articulate where it is relative to where it needs to be.

None of these require new infrastructure. They use documents, community boards, and existing RAG — the same primitives the platform already has. The intelligence emerges from the loop, not from the tools.

---

## Ten Pulses Running Simultaneously

Imagine an organization running ten Pulses concurrently:

| Pulse | Goal | Score Function | Timeline |
|-------|------|----------------|----------|
| SEO Growth | Page 1 for 50 keywords | Count of page-1 keywords | Ongoing |
| Sales Pipeline | Close rate above 25% | Monthly close rate % | Ongoing |
| Churn Prevention | Reduce churn to under 3% | Monthly churn rate % | Ongoing |
| Content Engine | 20 articles/month with 1K+ views each | Articles exceeding 1K views | Ongoing |
| Competitor Intel | Complete dossiers on 5 competitors | Dossier completeness % | 30 days |
| Product Launch | Launch by March 15 | Milestone completion % | Fixed |
| Customer Onboarding | Time-to-value under 48 hours | Median onboarding hours | Ongoing |
| Knowledge Base | Answer 90% of support questions | Auto-resolution rate % | Ongoing |
| Recruiting Pipeline | 30-day average time-to-hire | Days to hire | Ongoing |
| OSS Community | 1000 GitHub stars, 20 contributors | Weighted composite | 90 days |

Each Pulse has its own God Agent, its own worker collective, its own constraint library, its own experiment log. Each is running 24/7, iterating autonomously, accumulating taste. The human reviews each at their configured checkpoints — maybe weekly for the ongoing ones, daily for the fixed-deadline ones.

The organization's capacity for parallel goal pursuit is no longer bounded by headcount or attention. It is bounded by the number of goals that have measurable score functions.

---

## Cross-Pulse Intelligence

The Skill system already supports promoting mature constraints into portable Skills that can be attached to agents in any Pulse. This creates a natural path for cross-pollination:

A constraint discovered in the SEO Pulse — "always check search intent before targeting a keyword because informational keywords don't convert" — gets promoted to a Skill called "Search Intent Validation." That Skill gets attached to agents in the Content Engine Pulse, which was about to make the same mistake.

At scale, the organization develops a **constraint commons**: a library of learned rules that spans all Pulses. New Pulses start faster because they inherit the organization's accumulated taste from day one. The hundredth Pulse created by an organization will converge on its goal dramatically faster than the first, because the search space has already been pruned by the constraints learned across all previous Pulses.

This is how institutional knowledge actually works in high-performing human organizations — except it takes decades to build and is fragile (it lives in people's heads). In Pulse, it is explicit, versioned, and compounding.

---

## The Human Role

Pulse does not remove humans. It changes what they do.

Today: humans do the work and occasionally delegate to AI.

With Pulse: humans design arenas, define score functions, set constraints, and exercise judgment at checkpoints.

The skills that matter shift upward in abstraction:

**Arena Design.** Defining the goal clearly enough that a score function can be constructed. This is harder than it sounds. "Improve our marketing" is not a Pulse goal. "Increase organic traffic by 40% in 90 days as measured by Google Analytics sessions" is. The ability to decompose ambiguous business objectives into measurable goals is the new core skill.

**Score Function Construction.** Deciding what "better" means in a way that an automated system can evaluate. This requires deep domain expertise. A naive score function optimizes for the wrong thing. A thoughtful one encodes the judgment of the best person in the organization.

**Constraint Review.** At checkpoints, the human reviews the Constraint Library — not the work output, not the individual experiments, but the distilled rules the system has learned. "Do these rules reflect reality? Are any of them wrong? Are any critical rules missing?" This is the highest-leverage moment in the entire loop, because a single corrected constraint redirects hundreds of future experiments.

**Checkpoint Judgment.** Should the Pulse continue operating? Should the score function be adjusted? Should a God Agent be given more or fewer resources? These are strategic decisions, not tactical ones.

This is not a future state. The infrastructure for all of this exists today.

---

## The Economics

A single Pulse running with 5 worker agents at 2-hour intervals generates roughly 60 agent runs per day. At current LLM pricing (~$0.01-0.05 per run for focused, bounded tasks), that is $0.60-3.00/day — $20-90/month.

An organization running 10 Pulses spends $200-900/month on fully autonomous goal pursuit across 10 strategic objectives, with no human labor except checkpoint review.

Compare this to hiring 10 specialists to pursue the same objectives manually. The Pulse doesn't replace the specialists — it amplifies them. One person can oversee 10 Pulses that would have required 10 dedicated teams.

The constraint is not cost. The constraint is the ability to define measurable score functions for business objectives. Every objective that can be scored can be Pulsed.

---

## What This Means for AgentC2

Pulse is the reason the platform exists. Individual agents are useful. Workflows are useful. Networks are useful. But Pulse is the primitive that turns all of them into a self-improving system that pursues goals autonomously.

The platform's moat is not "we have agents." Everyone has agents. The moat is the Constraint Library — the accumulated taste of every experiment ever run across every Pulse in every organization. That cannot be replicated by spinning up a new instance of any agent framework. It can only be grown through iteration.

Every Pulse that runs on AgentC2 makes the platform more valuable, because every constraint learned is a data point about what works and what doesn't in autonomous goal pursuit. The platform's intelligence compounds with usage.

This is the flywheel:
1. Organizations create Pulses to pursue goals.
2. Pulses generate experiments and constraints.
3. Constraints get promoted to portable Skills.
4. Skills accelerate new Pulses (faster convergence).
5. Faster convergence attracts more organizations.
6. More organizations create more Pulses.

The endgame is a platform where creating a new Pulse for a common business objective (SEO, sales pipeline, churn reduction) produces results in days instead of weeks, because the constraint library for that type of objective has already been built by the collective experience of every organization that pursued it before.

---

## The Gap Between Here and There

The infrastructure is built. The gap is operational:

**External metrics.** 7 of 10 battle-tested scenarios require external data (SEO rankings, CRM metrics, analytics data). The God Agent can measure these manually today via MCP tools (Firecrawl for web scraping, HubSpot for CRM data), but a first-class external metrics pipeline would make score measurement automatic and reliable.

**Constraint quality.** The God Agent writes constraints in natural language. Some will be vague, some will be wrong, some will conflict. Automated constraint validation (does this constraint actually correlate with score improvement?) would separate signal from noise.

**Multi-Pulse coordination.** Today, Pulses are independent. Cross-Pulse constraint sharing works via the Skill system but requires manual promotion. An automated "constraint marketplace" where Pulses with similar goals automatically share relevant constraints would accelerate convergence across the organization.

**Human review UX.** The checkpoint system exists but the review experience is bare. A dedicated review dashboard — showing score trends, new constraints since last review, God Agent effectiveness metrics, experiment-log highlights — would make the human's job faster and higher-quality.

None of these are blockers. The system works today for any goal with a measurable score function. These are optimizations that make it work better.

---

## One Sentence

Pulse turns any measurable business goal into a self-improving autonomous system that gets smarter with every experiment it runs, every constraint it learns, and every rejection it encodes — compounding the organization's institutional taste at machine speed.
