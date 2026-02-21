# High Availability Architecture

## Overview

AgentC2 is designed for 99.9% uptime (< 8.7 hours downtime/year) through:

1. **Stateless application layer** — All state in Redis/PostgreSQL
2. **Horizontal scaling** — PM2 cluster mode + multiple Droplets
3. **Load balancing** — DigitalOcean Load Balancer (active-active)
4. **Database HA** — Supabase Pro (built-in HA)
5. **Redis HA** — Upstash Global (multi-region replication)
6. **DNS failover** — Cloudflare with health checks

## Architecture Diagram

```
                    ┌──────────────┐
                    │  Cloudflare  │
                    │  CDN + WAF   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │   DO Load    │
                    │  Balancer    │
                    └──────┬───────┘
                    ┌──────┴───────┐
              ┌─────┤              ├─────┐
              │     └──────────────┘     │
     ┌────────┴────────┐     ┌──────────┴────────┐
     │  Droplet 1      │     │  Droplet 2        │
     │  PM2 Cluster    │     │  PM2 Cluster      │
     │  - Agent x4     │     │  - Agent x4       │
     │  - Frontend x2  │     │  - Frontend x2    │
     │  - Caddy        │     │  - Caddy          │
     └────────┬────────┘     └──────────┬────────┘
              │                          │
     ┌────────┴──────────────────────────┴────────┐
     │              Supabase PostgreSQL            │
     │              (HA, PITR enabled)             │
     └────────────────────┬───────────────────────┘
                          │
     ┌────────────────────┴───────────────────────┐
     │           Upstash Redis (Global)            │
     │        Multi-region replication             │
     └─────────────────────────────────────────────┘
```

## Load Balancer Configuration

- **Algorithm:** Round-robin (stateless app, no session affinity needed)
- **Health check:** `GET /api/health` every 10 seconds
- **Healthy threshold:** 3 consecutive successes
- **Unhealthy threshold:** 3 consecutive failures
- **TLS:** Passthrough (Caddy handles TLS termination)

## Failover Behavior

### Droplet Failure

- Load balancer detects failure via health checks (30 seconds)
- Traffic automatically routed to healthy Droplet(s)
- No manual intervention required

### Database Failover

- Supabase manages automatic failover
- Application retries with exponential backoff (retry.ts)
- Circuit breaker opens after 5 failures (circuit-breaker.ts)

### Redis Failover

- Upstash Global replicates across regions
- Automatic failover to nearest healthy replica
- In-memory fallback for development only

### DNS Failover

- Cloudflare monitors origin health
- Automatic failover via DNS if all origins are down
- Can route to secondary region if configured

## Scaling Thresholds

| Metric                       | Current          | Action                       |
| ---------------------------- | ---------------- | ---------------------------- |
| CPU > 70% sustained 10min    | 2 Droplets       | Add Droplet                  |
| Memory > 80% sustained 10min | 32GB per Droplet | Upgrade or add Droplet       |
| DB connections > 80% pool    | PgBouncer 60     | Increase pool or add replica |
| Request latency P95 > 2s     | -                | Profile and optimize         |
| Error rate > 1%              | -                | Investigate immediately      |
