# Hyperliquid MCP Integration for HL Coder

A complete package for interacting with the Hyperliquid exchange through a Model Context Protocol (MCP) server, designed to work seamlessly with HL Coder.

## Features

- Automatic installation of the Hyperliquid Python SDK and dependencies
- Web dashboard for authentication and account management
- MCP server for secure interaction with the Hyperliquid exchange
- Integration with HL Coder for natural language trading

## Quick Start

Run this single command to install and start the Hyperliquid MCP integration:

```bash
curl -s https://raw.githubusercontent.com/TradingBalthazar/hyperliquid-mcp-v1/main/install-and-run.sh | bash
```

This will:
1. Clone the repository
2. Install all dependencies
3. Start the web dashboard at http://localhost:3000
4. Configure the MCP server for use with HL Coder

## Authentication

After running the installation script:

1. The web dashboard will open in your browser
2. Enter your Hyperliquid private key and other optional settings
3. Click "Authenticate" to configure the MCP server
4. Once authenticated, you can start using HL Coder to interact with Hyperliquid

## Using with HL Coder

After setting up the MCP server, you can use HL Coder to interact with the Hyperliquid exchange using natural language. Here are some examples:

- "Get the current BTC price on Hyperliquid"
- "Place a limit order to buy 0.1 BTC at $50,000"
- "Check my open orders on Hyperliquid"
- "Update my leverage for ETH to 10x"

## Available MCP Tools

### get_market_data

Get market data from Hyperliquid.

Parameters:
- `dataType`: Type of market data to retrieve (all_mids, l2_snapshot, meta, etc.)
- `coin`: Coin symbol (required for some data types)
- `interval`: Candle interval (required for candles)
- `startTime`: Start time in milliseconds (required for some data types)
- `endTime`: End time in milliseconds (optional)

### get_user_data

Get user-specific data from Hyperliquid.

Parameters:
- `dataType`: Type of user data to retrieve (user_state, open_orders, user_fills, etc.)
- `startTime`: Start time in milliseconds (required for some data types)
- `endTime`: End time in milliseconds (optional)

### place_limit_order

Place a limit order on Hyperliquid.

Parameters:
- `coin`: Coin symbol
- `isBuy`: Whether the order is a buy
- `size`: Order size
- `price`: Order price
- `timeInForce`: Time in force (Gtc, Ioc, Alo)
- `reduceOnly`: Whether the order is reduce-only (optional)
- `clientOrderId`: Client order ID (optional)

### place_market_order

Place a market order on Hyperliquid.

Parameters:
- `coin`: Coin symbol
- `isBuy`: Whether the order is a buy
- `size`: Order size
- `slippage`: Slippage tolerance (optional, default: 0.05)
- `clientOrderId`: Client order ID (optional)

### cancel_order

Cancel an order on Hyperliquid.

Parameters:
- `coin`: Coin symbol
- `orderId`: Order ID (required if clientOrderId is not provided)
- `clientOrderId`: Client order ID (required if orderId is not provided)

### update_leverage

Update leverage for a coin.

Parameters:
- `coin`: Coin symbol
- `leverage`: Leverage value
- `isCross`: Whether to use cross margin (optional, default: true)

## Security

Your private keys and account information are stored securely on your local machine and are never sent to any external servers. All interactions with the Hyperliquid exchange are performed locally through the MCP server.

## License

MIT