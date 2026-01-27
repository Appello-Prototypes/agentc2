#!/usr/bin/env bash
set -e

# Check if at least one component name is provided
if [ $# -eq 0 ]; then
    echo "❌ Error: No component name provided"
    echo ""
    echo "Usage: bun run add-shadcn <component-name> [additional-components...]"
    echo ""
    echo "Examples:"
    echo "  bun run add-shadcn accordion"
    echo "  bun run add-shadcn accordion tabs form"
    exit 1
fi

# Store the root directory
ROOT_DIR=$(pwd)

echo "🎨 Adding ShadCN component(s): $*"
echo ""

# Navigate to packages/ui
cd packages/ui

# Add the component(s)
echo "📦 Running ShadCN CLI..."
bunx --bun shadcn@latest add "$@"

# Fix imports
echo ""
echo "🔧 Converting @/ imports to relative imports..."
bun run fix-imports

# Navigate back to root
cd "$ROOT_DIR"

# Format and lint
echo ""
echo "✨ Formatting and linting..."
bun run format > /dev/null 2>&1
bun run lint

echo ""
echo "✅ Component(s) added successfully!"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Export the component(s) in packages/ui/src/components/index.ts"
echo "   2. Create Storybook story at packages/ui/src/components/<component>.stories.tsx"
echo "   3. Import and use: import { ComponentName } from '@repo/ui'"
