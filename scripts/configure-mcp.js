#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Get environment variables
const secretKey = process.env.HYPERLIQUID_SECRET_KEY;
const accountAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';

if (!secretKey) {
  console.error('HYPERLIQUID_SECRET_KEY environment variable is required');
  process.exit(1);
}

// Determine the MCP settings file path based on the OS
let mcpSettingsPath;
if (process.platform === 'darwin') {
  // macOS
  mcpSettingsPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
} else if (process.platform === 'win32') {
  // Windows
  mcpSettingsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
} else {
  // Linux and others
  mcpSettingsPath = path.join(os.homedir(), '.local', 'share', 'code-server', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json');
}

// Create the directory if it doesn't exist
const mcpSettingsDir = path.dirname(mcpSettingsPath);
if (!fs.existsSync(mcpSettingsDir)) {
  fs.mkdirSync(mcpSettingsDir, { recursive: true });
}

// Read the existing MCP settings file or create a new one
let mcpSettings = { mcpServers: {} };
if (fs.existsSync(mcpSettingsPath)) {
  try {
    mcpSettings = JSON.parse(fs.readFileSync(mcpSettingsPath, 'utf8'));
  } catch (error) {
    console.error(`Error reading MCP settings file: ${error.message}`);
  }
}

// Add or update the Hyperliquid MCP server configuration
mcpSettings.mcpServers = mcpSettings.mcpServers || {};
mcpSettings.mcpServers.hyperliquid = {
  command: 'node',
  args: [path.join(__dirname, '..', 'server', 'build', 'index.js')],
  env: {
    HYPERLIQUID_SECRET_KEY: secretKey,
    HYPERLIQUID_ACCOUNT_ADDRESS: accountAddress || '',
    HYPERLIQUID_NETWORK: network
  },
  disabled: false,
  alwaysAllow: []
};

// Write the updated MCP settings file
try {
  fs.writeFileSync(mcpSettingsPath, JSON.stringify(mcpSettings, null, 2));
  console.log(`MCP server configured successfully at ${mcpSettingsPath}`);
} catch (error) {
  console.error(`Error writing MCP settings file: ${error.message}`);
  process.exit(1);
}