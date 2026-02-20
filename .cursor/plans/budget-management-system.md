# Budget Management & Pricing System - Implementation Plan

## Overview

A comprehensive budget management and pricing system for AgentC2, inspired by Cursor's pricing model. The system enforces budgets at multiple levels (platform → org → user → agent), supports tiered pricing plans with included usage credits and marked-up overage billing, and provides admin controls at every level.

## Cursor Model Analysis (Applied to AgentC2)

### How Cursor Works

- **Flat monthly fee** per tier ($20 / $60 / $200)
- **Included usage credits** ($20 at API pricing for Pro)
- **Usage multipliers** for higher tiers (3x, 20x)
- **Overage** at API cost with spend limits
- **Teams** adds centralized billing, analytics, RBAC
- **Enterprise** adds pooled usage, invoice billing

### AgentC2 Adaptation

- **Flat monthly fee** per tier with included usage credits
- **Margin built into credits** — credits are valued at marked-up rates (platform buys tokens at API cost, sells at markup)
- **Overage** at marked-up rates with configurable spend limits
- **Budget hierarchy** — org → user → agent enforcement
- **Hard vs soft limits** — enforcement toggle at every level

---

## Pricing Tiers

|                      | Starter     | Pro                     | Business                  | Enterprise             |
| -------------------- | ----------- | ----------------------- | ------------------------- | ---------------------- |
| **Price**            | $0/mo       | $79/mo                  | $199/mo (or $49/user/mo)  | Custom                 |
| **Included Credits** | $10         | $60                     | $150 (pooled)             | Custom                 |
| **Platform Markup**  | 3x API cost | 2x API cost             | 1.5x API cost             | Negotiated             |
| **Overage**          | Blocked     | At 2x rate, spend limit | At 1.5x rate, spend limit | At negotiated rate     |
| **Agents**           | 2           | 10                      | Unlimited                 | Unlimited              |
| **Runs/month**       | 200         | 5,000                   | 25,000                    | Unlimited              |
| **Seats**            | 1           | 3                       | Unlimited                 | Unlimited              |
| **MCP Integrations** | 3           | All                     | All + Custom              | Custom                 |
| **Voice**            | —           | Basic                   | Full                      | Full + Custom          |
| **Budget Controls**  | —           | Per-agent               | Full hierarchy            | Full + custom policies |
| **Support**          | Community   | Email                   | Priority                  | Dedicated              |
| **Annual Discount**  | —           | 17% (2 months free)     | 17%                       | Negotiated             |

### Margin Math (Example: Pro at $79/mo)

- Customer gets $60 in "platform credits" (valued at 2x markup)
- Real API cost to us: ~$30 (since credits are at 2x markup)
- Gross margin on base: $79 - $30 = $49 (62% margin)
- Overage: billed at 2x API cost → 50% margin on every overage dollar
- Customers who don't use all credits → even higher margin

---

## Database Schema Design

### New Models

```prisma
// Plan definitions (admin-managed)
model PricingPlan {
    id          String  @id @default(cuid())
    slug        String  @unique // "starter", "pro", "business", "enterprise"
    name        String
    description String? @db.Text
    isActive    Boolean @default(true)
    sortOrder   Int     @default(0)

    // Pricing
    monthlyPriceUsd Float // 0, 79, 199, etc.
    annualPriceUsd  Float? // annual price (discounted)
    perSeatPricing  Boolean @default(false) // true = price is per-seat

    // Included usage credits (at platform markup rates)
    includedCreditsUsd Float   @default(0) // $10, $60, $150
    markupMultiplier   Float   @default(2.0) // 2x, 1.5x, 3x
    overageEnabled     Boolean @default(false)
    overageMarkup      Float? // multiplier for overage (null = same as markupMultiplier)

    // Resource limits
    maxAgents       Int?
    maxSeats        Int?
    maxRunsPerMonth Int?
    maxWorkspaces   Int?
    maxStorageBytes BigInt?
    maxIntegrations Int?

    // Feature flags
    features Json? // {"voice": true, "budgetControls": true, ...}

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    subscriptions OrgSubscription[]

    @@map("pricing_plan")
}

// Org-to-plan subscription
model OrgSubscription {
    id             String       @id @default(cuid())
    organizationId String       @unique
    organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    planId         String
    plan           PricingPlan  @relation(fields: [planId], references: [id])

    // Billing
    status             String    @default("active") // "trialing", "active", "past_due", "canceled", "paused"
    billingCycle       String    @default("monthly") // "monthly", "annual"
    currentPeriodStart DateTime  @default(now())
    currentPeriodEnd   DateTime
    trialEndsAt        DateTime?
    canceledAt         DateTime?

    // Stripe
    stripeSubscriptionId String? @unique
    stripeCustomerId     String?

    // Credit balance for current period
    includedCreditsUsd Float @default(0) // Snapshot from plan at period start
    usedCreditsUsd     Float @default(0) // Running total for current period

    // Overage
    overageSpendLimitUsd Float? // Max overage spend (credit card limit)
    overageAccruedUsd    Float  @default(0) // Overage this period

    // Seat count (for per-seat plans)
    seatCount Int @default(1)

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([organizationId])
    @@index([planId])
    @@map("org_subscription")
}

// Org-level budget policy (separate from subscription limits)
model OrgBudgetPolicy {
    id             String       @id @default(cuid())
    organizationId String       @unique
    organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

    enabled         Boolean @default(false)
    monthlyLimitUsd Float? // Org-wide monthly budget cap
    alertAtPct      Float?  @default(80)
    hardLimit       Boolean @default(true)

    // Per-user default budget (applied to new users)
    defaultUserBudgetUsd Float?

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("org_budget_policy")
}

// Per-user budget within an org
model UserBudgetPolicy {
    id             String @id @default(cuid())
    userId         String
    organizationId String

    enabled         Boolean @default(false)
    monthlyLimitUsd Float?
    alertAtPct      Float?  @default(80)
    hardLimit       Boolean @default(true)

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@unique([userId, organizationId])
    @@index([userId])
    @@index([organizationId])
    @@map("user_budget_policy")
}

// Platform markup rates (admin-managed, per model)
model PlatformMarkup {
    id              String   @id @default(cuid())
    provider        String // "openai", "anthropic", "google"
    modelName       String // "gpt-4o", "claude-sonnet-4", etc.
    inputCostPer1M  Float // Our cost per 1M input tokens
    outputCostPer1M Float // Our cost per 1M output tokens
    defaultMarkup   Float    @default(2.0) // Default markup multiplier
    isActive        Boolean  @default(true)
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    @@unique([provider, modelName])
    @@map("platform_markup")
}

// Budget alert history
model BudgetAlert {
    id              String   @id @default(cuid())
    organizationId  String?
    userId          String?
    agentId         String?
    level           String // "org", "user", "agent", "subscription"
    type            String // "threshold_warning", "limit_reached", "overage_started"
    percentUsed     Float
    currentSpendUsd Float
    limitUsd        Float
    message         String   @db.Text
    acknowledged    Boolean  @default(false)
    createdAt       DateTime @default(now())

    @@index([organizationId, createdAt])
    @@index([userId, createdAt])
    @@index([agentId, createdAt])
    @@map("budget_alert")
}
```

### Schema Modifications to Existing Models

```prisma
// Add to Organization model:
subscription          OrgSubscription?
orgBudgetPolicy       OrgBudgetPolicy?

// Add to CostEvent model:
userId               String?  // Track which user triggered the run
platformCostUsd      Float?   // Our actual API cost
billedCostUsd        Float?   // What we bill the customer (with markup)
markupMultiplier     Float?   // The markup applied
```

---

## Budget Enforcement Hierarchy

```
1. Subscription Check
   └── Does the org have an active subscription?
   └── Are included credits exhausted?
   └── Is overage enabled? Under spend limit?

2. Org Budget Check
   └── Is org budget enabled?
   └── Current month org spend < org monthly limit?

3. User Budget Check
   └── Is user budget enabled?
   └── Current month user spend < user monthly limit?

4. Agent Budget Check (existing)
   └── Is agent budget enabled?
   └── Current month agent spend < agent monthly limit?
```

All checks run in sequence. If ANY level fails with hardLimit=true, the run is blocked.

---

## Implementation Phases

### Phase 1: Schema & Data Model

- Add new Prisma models
- Seed pricing plans
- Migrate existing BudgetPolicy data
- Add markup rates for current models

### Phase 2: Enforcement Engine

- Extend `AgentResolver.checkBudgetLimit()` with full hierarchy
- Add subscription credit tracking to `RunRecorder`
- Add markup calculation to cost events
- Create budget enforcement service

### Phase 3: Settings UI - Billing & Budget Page

- `/settings/billing` page with:
    - Current plan & subscription status
    - Usage credits meter (included vs used)
    - Overage tracking & spend limit
    - Org-wide budget configuration
    - Per-user budget management
    - Alert history

### Phase 4: Admin Portal

- Plan management (CRUD pricing plans)
- Markup rate management
- Per-org subscription management
- Override capabilities
- Revenue/margin dashboards

### Phase 5: Landing Page & Stripe

- Update pricing section with new tiers
- Stripe Checkout integration
- Stripe webhook handlers
- Customer portal link

---

## File Changes Required

### New Files

- `apps/agent/src/app/settings/billing/page.tsx` — Billing & Budget settings page
- `apps/agent/src/app/api/organizations/[orgId]/budget/route.ts` — Org budget API
- `apps/agent/src/app/api/organizations/[orgId]/subscription/route.ts` — Subscription API
- `packages/agentc2/src/budget/enforcement.ts` — Budget enforcement service
- `packages/agentc2/src/budget/markup.ts` — Markup calculation
- `apps/admin/src/app/(dashboard)/plans/page.tsx` — Plan management
- `apps/admin/src/app/(dashboard)/tenants/[orgSlug]/billing/page.tsx` — Admin billing view

### Modified Files

- `packages/database/prisma/schema.prisma` — New models + modifications
- `packages/agentc2/src/agents/resolver.ts` — Enhanced budget checking
- `apps/agent/src/lib/run-recorder.ts` — Add markup + user tracking to cost events
- `apps/agent/src/lib/cost-calculator.ts` — Add markup-aware pricing
- `apps/agent/src/app/settings/layout.tsx` — Add billing nav item
- `apps/frontend/src/components/landing/pricing-section.tsx` — Update pricing tiers
