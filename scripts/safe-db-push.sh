#!/usr/bin/env bash
# safe-db-push.sh — Prisma db push with a pre-flight destructive-change check.
#
# Runs `prisma migrate diff` first and aborts if any tables would be dropped.
# This prevents accidental destruction of externally-managed tables (e.g.
# rag_documents managed by @mastra/pg) that live outside the Prisma schema.
#
# Usage:  scripts/safe-db-push.sh [extra prisma flags...]
# Example: scripts/safe-db-push.sh --skip-generate

set -euo pipefail

SCHEMA="packages/database/prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
    echo "ERROR: Schema not found at $SCHEMA (run from repo root)" >&2
    exit 1
fi

echo "▶ Running pre-flight schema diff..."

DIFF=$(cd packages/database && dotenv -e ../../.env -- bun run --bun prisma migrate diff \
    --from-schema-datasource ./prisma/schema.prisma \
    --to-schema-datamodel ./prisma/schema.prisma 2>&1) || true

DROPPED=$(echo "$DIFF" | grep -E '^\[-\] Removed tables' || true)

if [ -n "$DROPPED" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ⛔  DESTRUCTIVE CHANGES DETECTED — db push ABORTED        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "$DIFF" | sed -n '/\[-\] Removed tables/,/^$/p'
    echo ""
    echo "Tables listed above would be DROPPED, causing data loss."
    echo ""
    echo "If a table is externally managed (e.g. by @mastra/pg):"
    echo "  → Add a model with @@map(\"table_name\") and @@ignore to the Prisma schema."
    echo "  → See RagDocument / MastraAiSpan models for examples."
    echo ""
    echo "If you truly want to drop these tables, run:"
    echo "  cd packages/database && dotenv -e ../../.env -- bunx prisma db push --accept-data-loss"
    echo ""
    exit 1
fi

echo "✓ No destructive changes detected."
echo ""
echo "▶ Applying schema changes with prisma db push..."

cd packages/database
dotenv -e ../../.env -- bun run --bun prisma db push "$@"
