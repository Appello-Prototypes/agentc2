# AgentC2 Measurement and Optimization Runbook

## 1. Measurement Setup

### Search Console

1. Verify `https://agentc2.ai` as a domain property.
2. Submit `https://agentc2.ai/sitemap.xml`.
3. Confirm docs/blog URLs are discoverable and indexed.
4. Create weekly export views for:
    - `/docs/*`
    - `/blog/*`
    - top keyword clusters (orchestration, MCP, guardrails, evaluation)

### Analytics

Track core events for docs/blog conversion paths:

- `docs_page_view`
- `blog_post_view`
- `docs_cta_click`
- `blog_cta_click`
- `signup_click_from_content`
- `workspace_click_from_content`

Recommended event parameters:

- `content_type` (`docs` or `blog`)
- `content_slug`
- `primary_keyword`
- `category`
- `cta_target`

## 2. Weekly Operating Cadence

### Weekly KPI Review Template

| Metric                   | Current | Previous | Delta | Action |
| ------------------------ | ------- | -------- | ----- | ------ |
| Indexed docs pages       |         |          |       |        |
| Indexed blog pages       |         |          |       |        |
| Total impressions (docs) |         |          |       |        |
| Total impressions (blog) |         |          |       |        |
| Avg CTR (docs)           |         |          |       |        |
| Avg CTR (blog)           |         |          |       |        |
| Keywords in top 20       |         |          |       |        |
| Organic signup clicks    |         |          |       |        |

### Weekly Actions

- Rewrite titles/meta for pages with high impressions and weak CTR.
- Add internal links to pages ranking positions 11-20.
- Update at least 3 stale pages with fresh examples and date.
- Identify one net-new long-tail page based on query data.

## 3. Monthly Optimization Cycle

1. Content refresh sprint (docs + blog updates).
2. New content sprint (2-4 posts + selected docs expansion pages).
3. Internal link audit (orphan pages, weak hub pages).
4. Competitive SERP check for core terms:
    - AI agent orchestration platform
    - MCP integration
    - AI agent guardrails
    - AI agent evaluation

## 4. Definition of Ongoing Success

- Organic traffic trend to `/docs` and `/blog` is positive month-over-month.
- Priority pages maintain metadata quality and link coverage.
- New product capabilities are documented within the release cycle.
- Optimization backlog remains actively managed weekly.
