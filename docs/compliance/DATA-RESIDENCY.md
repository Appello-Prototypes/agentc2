# Data Residency Controls

## Current State

AgentC2 currently operates with a single database region (Supabase, US region). All user data is stored and processed in the United States.

## Data Flow Mapping

| Data Type           | Storage Location                 | Sub-Processors              | Transfer Mechanism |
| ------------------- | -------------------------------- | --------------------------- | ------------------ |
| User profiles       | Supabase (US)                    | -                           | Direct             |
| Agent conversations | Supabase (US)                    | OpenAI (US), Anthropic (US) | API calls          |
| Voice recordings    | ElevenLabs (US)                  | -                           | API calls          |
| File uploads        | Supabase Storage (US)            | -                           | Direct             |
| Analytics events    | PostHog (EU/US configurable)     | -                           | API calls          |
| Error tracking      | Sentry (US)                      | -                           | API calls          |
| Logs                | Grafana Loki / Logtail           | -                           | API transport      |
| OAuth tokens        | Supabase (US), encrypted at rest | -                           | Direct             |

## Organization Data Region

Each organization has a `dataRegion` preference stored in the Organization model:

- `US` — Default. All data stored in US region.
- `EU` — Flagged for EU data residency. Future: routed to EU Supabase project.
- `APAC` — Flagged for APAC residency. Future: routed to APAC region.

### Implementation Phases

**Phase 1 (Current):**

- Document all data flows
- Implement Standard Contractual Clauses (SCCs) with sub-processors
- Add `dataRegion` field to Organization model
- Tag all API responses with `X-Data-Region` header

**Phase 2 (Future — enterprise demand):**

- Provision EU Supabase project with separate connection string
- Route EU org data to EU database at application layer
- Ensure AI provider calls for EU orgs use EU-hosted endpoints (where available)

**Phase 3 (Future — full compliance):**

- Regional Redis instances
- Regional CDN edge nodes
- Full data sovereignty with no cross-border transfers

## Transfer Impact Assessment (TIA)

### Sub-Processor Registry

| Sub-Processor | Country              | Purpose                 | Compliance     | SCC Status |
| ------------- | -------------------- | ----------------------- | -------------- | ---------- |
| Supabase      | US (AWS us-east-1)   | Database, auth, storage | SOC 2 Type II  | Required   |
| OpenAI        | US                   | AI model inference      | SOC 2 Type II  | Required   |
| Anthropic     | US                   | AI model inference      | SOC 2 Type II  | Required   |
| ElevenLabs    | US                   | Voice synthesis         | In progress    | Required   |
| Upstash       | US/EU (configurable) | Redis, rate limiting    | SOC 2 Type II  | Required   |
| Sentry        | US                   | Error tracking          | SOC 2 Type II  | Required   |
| Cloudflare    | Global               | CDN, DDoS protection    | SOC 2 Type II  | Required   |
| DigitalOcean  | US (NYC region)      | Compute                 | SOC 2 Type II  | Required   |
| Betterstack   | EU                   | Status page, monitoring | GDPR compliant | N/A        |

### Risk Assessment

**Low Risk:** Cloudflare (edge caching, no PII stored), Betterstack (public status info only)

**Medium Risk:** Sentry (error payloads may contain PII — configure scrubbing), Upstash (rate limit keys contain user IDs)

**High Risk:** OpenAI/Anthropic (full conversation content sent for inference), Supabase (all PII stored)

### Mitigations

1. **Data minimization**: Only send necessary context to AI providers
2. **Sentry scrubbing**: Configure `beforeSend` to strip PII from error reports
3. **Redis key hashing**: Hash user IDs in rate limit keys
4. **Encryption**: All data encrypted in transit (TLS 1.3) and at rest (AES-256)
5. **Retention limits**: Automated data purge per retention policy
6. **Contractual**: SCCs executed with all high-risk sub-processors

## Regulatory References

- **GDPR** Articles 44-49 (Data transfers)
- **CCPA** §1798.140 (Service provider obligations)
- **UK GDPR** Post-Brexit adequacy decision (valid until 2025, monitor renewal)
- **Swiss DPA** Follows EU adequacy framework
