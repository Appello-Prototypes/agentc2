#!/usr/bin/env bash
# Setup Cloudflare CDN for AgentC2
#
# Prerequisites:
#   - Cloudflare account
#   - Domain added to Cloudflare (agentc2.ai)
#   - API token: https://dash.cloudflare.com/profile/api-tokens
#     Required permissions: Zone:DNS:Edit, Zone:Cache Purge:Purge, Zone:Zone Settings:Edit
#
# Usage:
#   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ZONE_ID=xxx ./scripts/setup-cloudflare.sh
#
set -euo pipefail

CF_TOKEN="${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
ZONE_ID="${CLOUDFLARE_ZONE_ID:?Set CLOUDFLARE_ZONE_ID}"
API="https://api.cloudflare.com/client/v4"
AUTH="Authorization: Bearer $CF_TOKEN"

echo "=== Configuring Cloudflare for AgentC2 ==="

# 1. Enable Brotli compression
echo "Enabling Brotli compression..."
curl -s -X PATCH "$API/zones/$ZONE_ID/settings/brotli" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"value":"on"}' | jq '.success'

# 2. Enable Auto Minify (CSS, JS, HTML)
echo "Enabling auto-minify..."
curl -s -X PATCH "$API/zones/$ZONE_ID/settings/minify" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"value":{"css":"on","html":"on","js":"on"}}' | jq '.success'

# 3. Set SSL mode to Full (Strict)
echo "Setting SSL to Full (Strict)..."
curl -s -X PATCH "$API/zones/$ZONE_ID/settings/ssl" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"value":"strict"}' | jq '.success'

# 4. Enable Always Use HTTPS
echo "Enabling Always Use HTTPS..."
curl -s -X PATCH "$API/zones/$ZONE_ID/settings/always_use_https" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"value":"on"}' | jq '.success'

# 5. Set Browser Cache TTL (respect origin headers)
echo "Setting browser cache TTL..."
curl -s -X PATCH "$API/zones/$ZONE_ID/settings/browser_cache_ttl" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"value":0}' | jq '.success'

# 6. Create page rules for static assets caching
echo "Creating page rule for Next.js static assets..."
curl -s -X POST "$API/zones/$ZONE_ID/pagerules" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "*agentc2.ai/_next/static/*"}}],
    "actions": [
      {"id": "cache_level", "value": "cache_everything"},
      {"id": "edge_cache_ttl", "value": 2592000},
      {"id": "browser_cache_ttl", "value": 31536000}
    ],
    "priority": 1,
    "status": "active"
  }' | jq '.success'

# 7. Bypass cache for API routes
echo "Creating page rule to bypass API cache..."
curl -s -X POST "$API/zones/$ZONE_ID/pagerules" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "*agentc2.ai/api/*"}}],
    "actions": [
      {"id": "cache_level", "value": "bypass"}
    ],
    "priority": 2,
    "status": "active"
  }' | jq '.success'

# 8. Enable HTTP/3
echo "Enabling HTTP/3..."
curl -s -X PATCH "$API/zones/$ZONE_ID/settings/h2_prioritization" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"value":"on"}' | jq '.success'

echo ""
echo "=== Cloudflare CDN setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Verify DNS is proxied (orange cloud) for agentc2.ai"
echo "  2. Update origin server to accept Cloudflare IPs only"
echo "  3. Set up Cloudflare WAF rules for additional protection"
echo "  4. Consider Cloudflare Workers for edge logic (future)"
