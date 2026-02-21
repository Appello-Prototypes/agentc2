#!/usr/bin/env bash
# Setup Doppler secrets management for AgentC2
#
# Prerequisites:
#   - Doppler CLI: brew install dopplerhq/cli/doppler
#   - Doppler account: https://dashboard.doppler.com
#
# Usage:
#   ./scripts/setup-doppler.sh
#
set -euo pipefail

echo "=== Setting up Doppler for AgentC2 ==="

# Check if Doppler CLI is installed
if ! command -v doppler &> /dev/null; then
    echo "Installing Doppler CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install dopplerhq/cli/doppler
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -sLf --retry 3 --tlsv1.2 --proto "=https" \
          'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | \
          sudo gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | \
          sudo tee /etc/apt/sources.list.d/doppler-cli.list
        sudo apt-get update && sudo apt-get install -y doppler
    fi
fi

# Login to Doppler
echo "Logging into Doppler..."
doppler login

# Create project
echo "Setting up project 'agentc2'..."
doppler projects create agentc2 2>/dev/null || echo "Project already exists"

# Setup environments
echo "Creating environments..."
for env in dev staging production; do
    doppler configs create "$env" --project agentc2 2>/dev/null || echo "Config '$env' already exists"
done

# Import current .env file into development config
if [ -f ".env" ]; then
    echo "Importing .env into 'dev' config..."
    doppler secrets upload .env --project agentc2 --config dev
    echo "Secrets imported successfully!"
else
    echo "No .env file found — skipping import"
fi

# Setup project directory
echo "Linking project directory..."
doppler setup --project agentc2 --config dev

echo ""
echo "=== Doppler setup complete ==="
echo ""
echo "Usage:"
echo "  doppler run -- bun run dev        # Run with secrets injected"
echo "  doppler secrets                    # List secrets"
echo "  doppler secrets set KEY VALUE      # Set a secret"
echo "  doppler secrets get KEY            # Get a secret"
echo ""
echo "CI/CD Integration:"
echo "  1. Create a service token: doppler configs tokens create --project agentc2 --config production ci-token"
echo "  2. Add DOPPLER_TOKEN to GitHub Actions secrets"
echo "  3. In workflow: doppler run -- bun run build"
echo ""
echo "Secret Rotation Schedule:"
echo "  - API keys: Every 90 days"
echo "  - Database passwords: Every 90 days"
echo "  - Encryption keys: Annually (with re-encryption migration)"
echo "  - OAuth client secrets: Every 180 days"
