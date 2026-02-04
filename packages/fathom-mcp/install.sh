#!/bin/bash

# Fathom MCP Installation Script
# Run this after copying the folder to your preferred location

echo "🎙️  Fathom MCP Installer"
echo "========================"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $NODE_VERSION"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the fathom-mcp folder"
    echo "   cd /path/to/fathom-mcp && ./install.sh"
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo ""
echo "✅ Dependencies installed!"
echo ""

# Get the current directory
INSTALL_PATH="$(pwd)/index.js"

echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Open Cursor Settings → MCP"
echo ""
echo "2. Add this configuration (replace the API key):"
echo ""
echo '   {'
echo '     "mcpServers": {'
echo '       "Fathom": {'
echo '         "command": "node",'
echo "         \"args\": [\"$INSTALL_PATH\"],"
echo '         "env": {'
echo '           "FATHOM_API_KEY": "YOUR_API_KEY_HERE"'
echo '         }'
echo '       }'
echo '     }'
echo '   }'
echo ""
echo "3. Restart Cursor"
echo ""
echo "4. Test by asking: 'List my recent Fathom meetings'"
echo ""
echo "🎉 Installation complete!"

