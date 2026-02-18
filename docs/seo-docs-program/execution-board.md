# AgentC2 SEO + Documentation Execution Board

## Program Summary

- Program name: AgentC2 SEO Docs Rollout
- Objective: Make AgentC2 discoverable for high-intent AI agent orchestration and MCP search demand
- Duration: 12-week implementation + ongoing optimization loop
- Product surfaces: `apps/frontend` public routes (`/`, `/about`, `/terms`, `/privacy`, `/security`, `/docs/*`, `/blog/*`)

## Ownership Matrix

| Workstream               | Primary Owner        | Supporting Owners                | Status |
| ------------------------ | -------------------- | -------------------------------- | ------ |
| Program initialization   | Product Marketing    | Platform Engineering, Docs Lead  | Done   |
| Technical SEO foundation | Platform Engineering | Growth, Docs Lead                | Done   |
| Docs platform            | Platform Engineering | Docs Lead                        | Done   |
| Blog platform            | Platform Engineering | Product Marketing                | Done   |
| Content wave 1           | Docs Lead            | Platform SMEs, Product Marketing | Done   |
| Content wave 2           | Docs Lead            | Platform SMEs, Product Marketing | Done   |
| Guides launch            | Docs Lead            | Platform SMEs                    | Done   |
| Blog launch              | Product Marketing    | Docs Lead                        | Done   |
| Measurement setup        | Growth Ops           | Platform Engineering             | Done   |
| Optimization loop assets | Growth Ops           | Product Marketing, Docs Lead     | Done   |

## Milestone Tracker

| Milestone                     | Scope                                | Exit Criteria                                             | Status |
| ----------------------------- | ------------------------------------ | --------------------------------------------------------- | ------ |
| M0 Program setup              | Inventory, ownership, standards      | URL inventory and keyword map created                     | Done   |
| M1 SEO foundation             | Robots, sitemap, metadata, schema    | Crawl/index baseline and canonical structure live         | Done   |
| M2 Content platform           | Docs and blog templates/routes       | `/docs` and `/blog` shells live with dynamic detail pages | Done   |
| M3 Core publish               | Priority docs + first blog content   | High-intent pages live and linked                         | Done   |
| M4 Expansion publish          | Remaining docs/blog/guides inventory | 90+ docs + 12 blog entries defined and rendered           | Done   |
| M5 Measurement + optimization | Reporting templates and loop         | Weekly/monthly operating templates in place               | Done   |

## Page Type Acceptance Criteria

### Documentation Page

- Has unique canonical URL
- Has SEO metadata (title, description, OG, Twitter)
- Has one primary keyword and at least two secondary keywords
- Has one visible `h1` and structured sections
- Has at least one conversion CTA
- Has 3-5 internal links through related pages and section graph
- Appears in sitemap

### Blog Post

- Has unique canonical URL
- Has metadata and breadcrumb schema
- Has category, author, publish/update dates
- Has keyword mapping and intent
- Links to at least 3 relevant docs pages
- Appears in sitemap

### Index Pages (`/docs`, `/blog`)

- Crawlable and indexable
- Link to all child detail pages
- Present clear topical structure
- Include conversion paths (`/signup`, `/workspace`)

## Risk Register

| Risk                       | Trigger                               | Mitigation                                 | Owner                |
| -------------------------- | ------------------------------------- | ------------------------------------------ | -------------------- |
| Non-public routes indexed  | Incorrect route-level indexing policy | Controlled sitemap and proxy exclusions    | Platform Engineering |
| Keyword cannibalization    | Multiple URLs target same head term   | URL-to-keyword map and intent ownership    | Docs Lead            |
| CTR underperformance       | High impressions, low click-through   | Weekly title/description optimization pass | Growth Ops           |
| Content drift from product | Product changes without docs updates  | Release checklist includes docs updates    | Platform SMEs        |
| Orphan pages               | Missing internal links                | Related-links requirement on every page    | Docs Lead            |

## Publish Governance

- Every new feature requires docs delta before release is marked complete
- Every content page must pass metadata + internal-link QA checklist
- Weekly SEO triage and monthly optimization cycle are mandatory
