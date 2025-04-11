#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PythonShell } from 'python-shell';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Python bridge script
const BRIDGE_SCRIPT_PATH = path.join(__dirname, 'hyperliquid_bridge.py');

// Environment variables
const SECRET_KEY = process.env.HYPERLIQUID_SECRET_KEY;
const ACCOUNT_ADDRESS = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
const NETWORK = process.env.HYPERLIQUID_NETWORK || 'mainnet';

if (!SECRET_KEY) {
  throw new Error('HYPERLIQUID_SECRET_KEY environment variable is required');
}

// Helper function to run the Python bridge script
async function runBridgeScript(command: string, args: Record<string, any>) {
  const options = {
    mode: 'text',
    pythonPath: 'python3',
    pythonOptions: ['-u'], // unbuffered output
    scriptPath: __dirname,
    args: [
      command,
      '--secret-key', SECRET_KEY as string, // Type assertion since we check it's defined above
      '--network', NETWORK,
      ...(ACCOUNT_ADDRESS ? ['--account-address', ACCOUNT_ADDRESS] : []),
      ...Object.entries(args).flatMap(([key, value]) => {
        if (value === undefined || value === null) return [];
        return [`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, String(value)];
      })
    ]
  };

  try {
    const result = await PythonShell.run(BRIDGE_SCRIPT_PATH, options);
    return JSON.parse(result[0]);
  } catch (error) {
    console.error('Error running Python bridge script:', error);
    throw error;
  }
}

class HyperliquidServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: 'hyperliquid-server',
      version: '0.1.0',
    }, {
      capabilities: {
        resources: {},
        tools: {},
      },
    });

    this.setupResourceHandlers();
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: `hyperliquid://market/all-mids`,
          name: `Current mid prices for all coins`,
          mimeType: 'application/json',
          description: 'Real-time mid prices for all actively traded coins on Hyperliquid',
        },
      ],
    }));

    // List resource templates
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        {
          uriTemplate: 'hyperliquid://market/l2-book/{coin}',
          name: 'L2 order book for a specific coin',
          mimeType: 'application/json',
          description: 'Order book data for a specific coin on Hyperliquid',
        },
        {
          uriTemplate: 'hyperliquid://user/{address}/state',
          name: 'User state for a specific address',
          mimeType: 'application/json',
          description: 'Trading details about a user including positions, margin, and account value',
        },
        {
          uriTemplate: 'hyperliquid://user/{address}/open-orders',
          name: 'Open orders for a specific address',
          mimeType: 'application/json',
          description: 'List of open orders for a specific user',
        },
      ],
    }));

    // Handle resource requests
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      // Match for all-mids resource
      if (uri === 'hyperliquid://market/all-mids') {
        const data = await runBridgeScript('market-data', { dataType: 'all_mids' });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // Match for L2 order book resource
      const l2BookMatch = uri.match(/^hyperliquid:\/\/market\/l2-book\/([^/]+)$/);
      if (l2BookMatch) {
        const coin = decodeURIComponent(l2BookMatch[1]);
        const data = await runBridgeScript('market-data', { dataType: 'l2_snapshot', coin });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // Match for user state resource
      const userStateMatch = uri.match(/^hyperliquid:\/\/user\/([^/]+)\/state$/);
      if (userStateMatch) {
        const address = decodeURIComponent(userStateMatch[1]);
        const data = await runBridgeScript('user-data', { dataType: 'user_state' });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // Match for user open orders resource
      const openOrdersMatch = uri.match(/^hyperliquid:\/\/user\/([^/]+)\/open-orders$/);
      if (openOrdersMatch) {
        const address = decodeURIComponent(openOrdersMatch[1]);
        const data = await runBridgeScript('user-data', { dataType: 'open_orders' });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      throw new McpError(ErrorCode.InvalidRequest, `Invalid URI format: ${uri}`);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_market_data',
          description: 'Get market data from Hyperliquid',
          inputSchema: {
            type: 'object',
            properties: {
              dataType: {
                type: 'string',
                description: 'Type of market data to retrieve',
                enum: [
                  'all_mids',
                  'l2_snapshot',
                  'meta',
                  'meta_and_asset_ctxs',
                  'spot_meta',
                  'spot_meta_and_asset_ctxs',
                  'candles',
                  'funding_history'
                ]
              },
              coin: {
                type: 'string',
                description: 'Coin symbol (required for l2_snapshot, candles, funding_history)'
              },
              interval: {
                type: 'string',
                description: 'Candle interval (required for candles)'
              },
              startTime: {
                type: 'integer',
                description: 'Start time in milliseconds (required for candles, funding_history)'
              },
              endTime: {
                type: 'integer',
                description: 'End time in milliseconds (optional for candles, funding_history)'
              }
            },
            required: ['dataType']
          }
        },
        {
          name: 'get_user_data',
          description: 'Get user-specific data from Hyperliquid',
          inputSchema: {
            type: 'object',
            properties: {
              dataType: {
                type: 'string',
                description: 'Type of user data to retrieve',
                enum: [
                  'user_state',
                  'spot_user_state',
                  'open_orders',
                  'frontend_open_orders',
                  'user_fills',
                  'user_fills_by_time',
                  'user_funding_history',
                  'user_fees',
                  'user_staking_summary',
                  'user_staking_delegations',
                  'user_staking_rewards',
                  'query_sub_accounts'
                ]
              },
              startTime: {
                type: 'integer',
                description: 'Start time in milliseconds (required for user_fills_by_time, user_funding_history)'
              },
              endTime: {
                type: 'integer',
                description: 'End time in milliseconds (optional for user_fills_by_time, user_funding_history)'
              }
            },
            required: ['dataType']
          }
        },
        {
          name: 'place_limit_order',
          description: 'Place a limit order on Hyperliquid',
          inputSchema: {
            type: 'object',
            properties: {
              coin: {
                type: 'string',
                description: 'Coin symbol'
              },
              isBuy: {
                type: 'boolean',
                description: 'Whether the order is a buy'
              },
              size: {
                type: 'number',
                description: 'Order size'
              },
              price: {
                type: 'number',
                description: 'Order price'
              },
              timeInForce: {
                type: 'string',
                description: 'Time in force',
                enum: ['Gtc', 'Ioc', 'Alo']
              },
              reduceOnly: {
                type: 'boolean',
                description: 'Whether the order is reduce-only'
              },
              clientOrderId: {
                type: 'string',
                description: 'Client order ID'
              }
            },
            required: ['coin', 'isBuy', 'size', 'price', 'timeInForce']
          }
        },
        {
          name: 'place_market_order',
          description: 'Place a market order on Hyperliquid',
          inputSchema: {
            type: 'object',
            properties: {
              coin: {
                type: 'string',
                description: 'Coin symbol'
              },
              isBuy: {
                type: 'boolean',
                description: 'Whether the order is a buy'
              },
              size: {
                type: 'number',
                description: 'Order size'
              },
              slippage: {
                type: 'number',
                description: 'Slippage tolerance (default: 0.05)'
              },
              clientOrderId: {
                type: 'string',
                description: 'Client order ID'
              }
            },
            required: ['coin', 'isBuy', 'size']
          }
        },
        {
          name: 'cancel_order',
          description: 'Cancel an order on Hyperliquid',
          inputSchema: {
            type: 'object',
            properties: {
              coin: {
                type: 'string',
                description: 'Coin symbol'
              },
              orderId: {
                type: 'integer',
                description: 'Order ID'
              },
              clientOrderId: {
                type: 'string',
                description: 'Client order ID'
              }
            },
            required: ['coin'],
            oneOf: [
              { required: ['orderId'] },
              { required: ['clientOrderId'] }
            ]
          }
        },
        {
          name: 'update_leverage',
          description: 'Update leverage for a coin',
          inputSchema: {
            type: 'object',
            properties: {
              coin: {
                type: 'string',
                description: 'Coin symbol'
              },
              leverage: {
                type: 'integer',
                description: 'Leverage value'
              },
              isCross: {
                type: 'boolean',
                description: 'Whether to use cross margin (default: true)'
              }
            },
            required: ['coin', 'leverage']
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;

        switch (name) {
          case 'get_market_data': {
            if (!args) throw new Error('Arguments are required');
            result = await runBridgeScript('market-data', {
              dataType: args.dataType,
              coin: args.coin,
              interval: args.interval,
              startTime: args.startTime,
              endTime: args.endTime
            });
            break;
          }
          case 'get_user_data': {
            if (!args) throw new Error('Arguments are required');
            result = await runBridgeScript('user-data', {
              dataType: args.dataType,
              startTime: args.startTime,
              endTime: args.endTime
            });
            break;
          }
          case 'place_limit_order': {
            if (!args) throw new Error('Arguments are required');
            const orderType = JSON.stringify({
              limit: {
                tif: args.timeInForce
              }
            });
            result = await runBridgeScript('place-order', {
              coin: args.coin,
              isBuy: args.isBuy ? 'true' : 'false',
              size: args.size,
              price: args.price,
              orderType,
              reduceOnly: args.reduceOnly ? 'true' : 'false',
              cloid: args.clientOrderId
            });
            break;
          }
          case 'place_market_order': {
            if (!args) throw new Error('Arguments are required');
            result = await runBridgeScript('market-order', {
              coin: args.coin,
              isBuy: args.isBuy ? 'true' : 'false',
              size: args.size,
              slippage: args.slippage,
              cloid: args.clientOrderId
            });
            break;
          }
          case 'cancel_order': {
            if (!args) throw new Error('Arguments are required');
            result = await runBridgeScript('cancel-order', {
              coin: args.coin,
              oid: args.orderId,
              cloid: args.clientOrderId
            });
            break;
          }
          case 'update_leverage': {
            if (!args) throw new Error('Arguments are required');
            result = await runBridgeScript('update-leverage', {
              coin: args.coin,
              leverage: args.leverage,
              isCross: args.isCross === undefined ? 'true' : (args.isCross ? 'true' : 'false')
            });
            break;
          }
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        if (result.error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Hyperliquid MCP server running on stdio');
  }
}

const server = new HyperliquidServer();
server.run().catch(console.error);