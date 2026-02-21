# Database Scaling Configuration

## Connection Pooling (PgBouncer)

Supabase includes built-in PgBouncer. To enable transaction-mode pooling for Prisma:

### Connection String Format

```bash
# Direct connection (for migrations, schema changes)
DATABASE_URL="postgresql://postgres.[project]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# Pooled connection (for application queries — use this in production)
DATABASE_URL="postgresql://postgres.[project]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### Prisma Configuration

```prisma
datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL") // Non-pooled for migrations
}
```

### Pool Size Recommendations

| Component       | Instances   | Pool Size Per Instance | Total Connections |
| --------------- | ----------- | ---------------------- | ----------------- |
| Agent App       | 4 (cluster) | 5                      | 20                |
| Frontend        | 2 (cluster) | 3                      | 6                 |
| Admin           | 1           | 3                      | 3                 |
| Inngest Workers | 2           | 3                      | 6                 |
| **Total**       |             |                        | **35**            |

Supabase Pro plan allows 60 direct connections. With PgBouncer in transaction mode, effective concurrency is much higher.

## Read Replicas

### When to Add

Add a read replica when:

- Read-heavy analytics queries cause latency on write path
- Data exports (GDPR portability) block the primary
- Dashboard aggregation queries exceed acceptable latency

### Implementation

```typescript
// packages/database/src/read-replica.ts
import { PrismaClient } from "@prisma/client";

export const readReplica = new PrismaClient({
    datasourceUrl: process.env.DATABASE_REPLICA_URL
});
```

Route read-only operations to the replica:

- Agent stats aggregation
- Dashboard metrics
- Data export endpoints
- Reporting queries

## Slow Query Monitoring

### Enable pg_stat_statements

```sql
-- Run on Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### Alert Queries

```sql
-- Queries taking > 1 second (run periodically)
SELECT
    calls,
    mean_exec_time::numeric(10,2) as avg_ms,
    max_exec_time::numeric(10,2) as max_ms,
    total_exec_time::numeric(10,2) as total_ms,
    query
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Prisma Query Logging

```typescript
const prisma = new PrismaClient({
    log: [
        { level: "query", emit: "event" },
        { level: "warn", emit: "stdout" },
        { level: "error", emit: "stdout" }
    ]
});

prisma.$on("query", (e) => {
    if (e.duration > 1000) {
        logger.warn({ query: e.query, duration: e.duration }, "Slow query detected");
    }
});
```

## Automated Backups

Supabase Pro plan includes:

- **Point-in-Time Recovery (PITR)**: Restore to any point in the last 7 days
- **Daily backups**: Automatic, retained for 7 days
- **WAL archiving**: Continuous archival for PITR

### Verify PITR Is Enabled

1. Go to Supabase Dashboard > Project Settings > Database
2. Confirm "Point in Time Recovery" is enabled
3. Verify backup retention period meets RPO (< 15 minutes)

### Manual Backup Script

```bash
#!/bin/bash
# scripts/db-backup.sh
pg_dump "$DATABASE_URL" --format=custom --compress=9 \
  --file="backups/agentc2-$(date +%Y%m%d-%H%M%S).dump"
```
