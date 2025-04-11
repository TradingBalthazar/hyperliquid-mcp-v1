import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import open from 'open';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON request body
app.use(express.json());

// API routes
app.post('/api/authenticate', (req, res) => {
  const { secretKey, accountAddress, network } = req.body;
  
  if (!secretKey) {
    return res.status(400).json({ error: 'Secret key is required' });
  }
  
  // Save the credentials to the .env file
  const envContent = `HYPERLIQUID_SECRET_KEY=${secretKey}
HYPERLIQUID_ACCOUNT_ADDRESS=${accountAddress || ''}
HYPERLIQUID_NETWORK=${network || 'mainnet'}
`;
  
  fs.writeFileSync(path.join(__dirname, '.env'), envContent);
  
  // Configure the MCP server
  const configScript = spawn('node', [path.join(__dirname, 'scripts', 'configure-mcp.js')]);
  
  configScript.on('close', (code) => {
    if (code === 0) {
      res.json({ success: true, message: 'Authentication successful' });
    } else {
      res.status(500).json({ error: 'Failed to configure MCP server' });
    }
  });
});

// Serve the HTML file for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Opening web dashboard in your browser...');
  
  // Open the web dashboard in the default browser
  open(`http://localhost:${PORT}`);
});

// Start the MCP server
console.log('Starting Hyperliquid MCP server...');

// Function to start the MCP server
function startMcpServer() {
  const mcpServerPath = path.join(__dirname, 'server', 'build', 'index.js');
  
  // Check if the MCP server build exists
  if (!fs.existsSync(mcpServerPath)) {
    console.error('MCP server build not found. Please build the MCP server first.');
    return null;
  }
  
  const mcpServer = spawn('node', [mcpServerPath], {
    env: {
      ...process.env
    }
  });
  
  mcpServer.stdout.on('data', (data) => {
    console.log(`MCP server: ${data}`);
  });
  
  mcpServer.stderr.on('data', (data) => {
    console.error(`MCP server error: ${data}`);
  });
  
  mcpServer.on('close', (code) => {
    console.log(`MCP server exited with code ${code}`);
  });
  
  return mcpServer;
}

// Start the MCP server
const mcpServer = startMcpServer();

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (mcpServer) {
    mcpServer.kill();
  }
  process.exit(0);
});