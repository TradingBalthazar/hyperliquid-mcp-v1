#!/bin/bash

# Hyperliquid MCP Installation and Run Script
set -e

echo "=== Hyperliquid MCP Installation and Run ==="
echo ""

# Check if repository is already cloned
if [ ! -d "hyperliquid-mcp-v1" ]; then
  echo "Cloning repository..."
  git clone https://github.com/TradingBalthazar/hyperliquid-mcp-v1.git
  cd hyperliquid-mcp-v1
else
  echo "Repository already exists, using existing directory..."
  cd hyperliquid-mcp-v1
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p ~/.local/share/Roo-Code/MCP/hyperliquid-server/src
mkdir -p ~/.local/share/code-server/User/globalStorage/rooveterinaryinc.roo-cline/settings

# Install Python dependencies
echo "Installing Python dependencies..."
pip install hyperliquid-python-sdk

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Start the dashboard
echo "Starting the dashboard..."
npm start

echo ""
echo "=== Installation and startup complete ==="
echo "The web dashboard should be open in your browser."
echo "If not, navigate to: http://localhost:3000"