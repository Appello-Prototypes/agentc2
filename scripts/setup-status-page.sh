#!/usr/bin/env bash
# Setup Betterstack status page for AgentC2
#
# Prerequisites:
#   - Betterstack account at https://betterstack.com
#   - API token: https://betterstack.com/docs/uptime/api/getting-started/
#
# Usage:
#   BETTERSTACK_API_TOKEN=xxx ./scripts/setup-status-page.sh
#
set -euo pipefail

API_TOKEN="${BETTERSTACK_API_TOKEN:?Set BETTERSTACK_API_TOKEN}"
BASE_URL="https://uptime.betterstack.com/api/v2"

header="Authorization: Bearer $API_TOKEN"

echo "=== Setting up Betterstack monitors ==="

# 1. Health check monitor (liveness probe)
echo "Creating health check monitor..."
curl -s -X POST "$BASE_URL/monitors" \
  -H "$header" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_type": "status",
    "url": "https://agentc2.ai/api/health",
    "pronounceable_name": "Platform API - Liveness",
    "check_frequency": 30,
    "request_timeout": 10,
    "confirmation_period": 120,
    "regions": ["us", "eu", "au"],
    "expected_status_codes": [200]
  }' | jq .

# 2. Readiness probe
echo "Creating readiness probe monitor..."
curl -s -X POST "$BASE_URL/monitors" \
  -H "$header" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_type": "status",
    "url": "https://agentc2.ai/api/health/ready",
    "pronounceable_name": "Platform API - Readiness",
    "check_frequency": 60,
    "request_timeout": 15,
    "confirmation_period": 180,
    "regions": ["us", "eu"],
    "expected_status_codes": [200]
  }' | jq .

# 3. Frontend check
echo "Creating frontend monitor..."
curl -s -X POST "$BASE_URL/monitors" \
  -H "$header" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_type": "status",
    "url": "https://agentc2.ai/",
    "pronounceable_name": "Frontend",
    "check_frequency": 60,
    "request_timeout": 10,
    "confirmation_period": 120,
    "regions": ["us", "eu", "au"],
    "expected_status_codes": [200]
  }' | jq .

# 4. SSL certificate monitor
echo "Creating SSL monitor..."
curl -s -X POST "$BASE_URL/monitors" \
  -H "$header" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_type": "ssl",
    "url": "https://agentc2.ai",
    "pronounceable_name": "SSL Certificate",
    "check_frequency": 86400,
    "ssl_expiration": 14
  }' | jq .

# 5. Create status page
echo "Creating public status page..."
curl -s -X POST "$BASE_URL/status-pages" \
  -H "$header" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "AgentC2",
    "company_url": "https://agentc2.ai",
    "subdomain": "agentc2",
    "timezone": "America/New_York",
    "custom_domain": "status.agentc2.ai",
    "history": 90
  }' | jq .

echo ""
echo "=== Setup complete ==="
echo "Status page will be available at: https://status.agentc2.ai"
echo "Betterstack dashboard: https://uptime.betterstack.com"
echo ""
echo "Next steps:"
echo "  1. Add CNAME record: status.agentc2.ai -> statuspage.betterstack.com"
echo "  2. Configure alert escalation policies in Betterstack dashboard"
echo "  3. Add Slack webhook for SEV1/SEV2 alerts"
