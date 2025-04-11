#!/usr/bin/env python3
import json
import sys
import argparse
import eth_account
from eth_account.signers.local import LocalAccount

# Import Hyperliquid SDK
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants
from hyperliquid.utils.types import Cloid

def setup_client(secret_key, network="mainnet", account_address=None, skip_ws=True):
    """Set up the Hyperliquid client with the provided credentials"""
    base_url = constants.MAINNET_API_URL if network == "mainnet" else constants.TESTNET_API_URL
    
    account: LocalAccount = eth_account.Account.from_key(secret_key)
    address = account_address if account_address else account.address
    
    info = Info(base_url, skip_ws)
    exchange = Exchange(account, base_url, account_address=address)
    
    return address, info, exchange

def get_market_data(args):
    """Get market data from Hyperliquid"""
    _, info, _ = setup_client(args.secret_key, args.network)
    
    if args.data_type == "all_mids":
        return info.all_mids()
    elif args.data_type == "l2_snapshot":
        return info.l2_snapshot(args.coin)
    elif args.data_type == "meta":
        return info.meta()
    elif args.data_type == "meta_and_asset_ctxs":
        return info.meta_and_asset_ctxs()
    elif args.data_type == "spot_meta":
        return info.spot_meta()
    elif args.data_type == "spot_meta_and_asset_ctxs":
        return info.spot_meta_and_asset_ctxs()
    elif args.data_type == "candles":
        return info.candles_snapshot(args.coin, args.interval, args.start_time, args.end_time)
    elif args.data_type == "funding_history":
        return info.funding_history(args.coin, args.start_time, args.end_time)
    else:
        return {"error": f"Unknown data type: {args.data_type}"}

def get_user_data(args):
    """Get user-specific data from Hyperliquid"""
    address, info, _ = setup_client(args.secret_key, args.network, args.account_address)
    
    if args.data_type == "user_state":
        return info.user_state(address)
    elif args.data_type == "spot_user_state":
        return info.spot_user_state(address)
    elif args.data_type == "open_orders":
        return info.open_orders(address)
    elif args.data_type == "frontend_open_orders":
        return info.frontend_open_orders(address)
    elif args.data_type == "user_fills":
        return info.user_fills(address)
    elif args.data_type == "user_fills_by_time":
        return info.user_fills_by_time(address, args.start_time, args.end_time)
    elif args.data_type == "user_funding_history":
        return info.user_funding_history(address, args.start_time, args.end_time)
    elif args.data_type == "user_fees":
        return info.user_fees(address)
    elif args.data_type == "user_staking_summary":
        return info.user_staking_summary(address)
    elif args.data_type == "user_staking_delegations":
        return info.user_staking_delegations(address)
    elif args.data_type == "user_staking_rewards":
        return info.user_staking_rewards(address)
    elif args.data_type == "query_sub_accounts":
        return info.query_sub_accounts(address)
    else:
        return {"error": f"Unknown data type: {args.data_type}"}

def place_order(args):
    """Place an order on Hyperliquid"""
    _, _, exchange = setup_client(args.secret_key, args.network, args.account_address)
    
    order_type = json.loads(args.order_type)
    
    cloid = None
    if args.cloid:
        cloid = Cloid(args.cloid)
    
    builder = None
    if args.builder:
        builder = json.loads(args.builder)
    
    return exchange.order(
        args.coin,
        args.is_buy == "true",
        float(args.size),
        float(args.price),
        order_type,
        args.reduce_only == "true",
        cloid,
        builder
    )

def place_market_order(args):
    """Place a market order on Hyperliquid"""
    _, _, exchange = setup_client(args.secret_key, args.network, args.account_address)
    
    cloid = None
    if args.cloid:
        cloid = Cloid(args.cloid)
    
    builder = None
    if args.builder:
        builder = json.loads(args.builder)
    
    return exchange.market_open(
        args.coin,
        args.is_buy == "true",
        float(args.size),
        float(args.price) if args.price else None,
        float(args.slippage) if args.slippage else 0.05,
        cloid,
        builder
    )

def cancel_order(args):
    """Cancel an order on Hyperliquid"""
    _, _, exchange = setup_client(args.secret_key, args.network, args.account_address)
    
    if args.cloid:
        cloid = Cloid(args.cloid)
        return exchange.cancel_by_cloid(args.coin, cloid)
    else:
        return exchange.cancel(args.coin, int(args.oid))

def update_leverage(args):
    """Update leverage for a coin"""
    _, _, exchange = setup_client(args.secret_key, args.network, args.account_address)
    
    return exchange.update_leverage(
        int(args.leverage),
        args.coin,
        args.is_cross == "true"
    )

def main():
    parser = argparse.ArgumentParser(description="Hyperliquid SDK Bridge")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Common arguments
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument("--secret-key", required=True, help="Private key for signing transactions")
    common_parser.add_argument("--network", default="mainnet", choices=["mainnet", "testnet"], help="Network to connect to")
    common_parser.add_argument("--account-address", help="Account address (if different from the wallet address)")
    
    # Market data command
    market_data_parser = subparsers.add_parser("market-data", parents=[common_parser], help="Get market data")
    market_data_parser.add_argument("--data-type", required=True, help="Type of market data to retrieve")
    market_data_parser.add_argument("--coin", help="Coin symbol")
    market_data_parser.add_argument("--interval", help="Candle interval")
    market_data_parser.add_argument("--start-time", type=int, help="Start time in milliseconds")
    market_data_parser.add_argument("--end-time", type=int, help="End time in milliseconds")
    
    # User data command
    user_data_parser = subparsers.add_parser("user-data", parents=[common_parser], help="Get user data")
    user_data_parser.add_argument("--data-type", required=True, help="Type of user data to retrieve")
    user_data_parser.add_argument("--start-time", type=int, help="Start time in milliseconds")
    user_data_parser.add_argument("--end-time", type=int, help="End time in milliseconds")
    
    # Place order command
    place_order_parser = subparsers.add_parser("place-order", parents=[common_parser], help="Place an order")
    place_order_parser.add_argument("--coin", required=True, help="Coin symbol")
    place_order_parser.add_argument("--is-buy", required=True, choices=["true", "false"], help="Whether the order is a buy")
    place_order_parser.add_argument("--size", required=True, help="Order size")
    place_order_parser.add_argument("--price", required=True, help="Order price")
    place_order_parser.add_argument("--order-type", required=True, help="Order type as JSON string")
    place_order_parser.add_argument("--reduce-only", default="false", choices=["true", "false"], help="Whether the order is reduce-only")
    place_order_parser.add_argument("--cloid", help="Client order ID")
    place_order_parser.add_argument("--builder", help="Builder info as JSON string")
    
    # Place market order command
    market_order_parser = subparsers.add_parser("market-order", parents=[common_parser], help="Place a market order")
    market_order_parser.add_argument("--coin", required=True, help="Coin symbol")
    market_order_parser.add_argument("--is-buy", required=True, choices=["true", "false"], help="Whether the order is a buy")
    market_order_parser.add_argument("--size", required=True, help="Order size")
    market_order_parser.add_argument("--price", help="Order price (optional)")
    market_order_parser.add_argument("--slippage", help="Slippage tolerance (default: 0.05)")
    market_order_parser.add_argument("--cloid", help="Client order ID")
    market_order_parser.add_argument("--builder", help="Builder info as JSON string")
    
    # Cancel order command
    cancel_order_parser = subparsers.add_parser("cancel-order", parents=[common_parser], help="Cancel an order")
    cancel_order_parser.add_argument("--coin", required=True, help="Coin symbol")
    cancel_order_parser.add_argument("--oid", help="Order ID")
    cancel_order_parser.add_argument("--cloid", help="Client order ID")
    
    # Update leverage command
    update_leverage_parser = subparsers.add_parser("update-leverage", parents=[common_parser], help="Update leverage")
    update_leverage_parser.add_argument("--coin", required=True, help="Coin symbol")
    update_leverage_parser.add_argument("--leverage", required=True, help="Leverage value")
    update_leverage_parser.add_argument("--is-cross", default="true", choices=["true", "false"], help="Whether to use cross margin")
    
    args = parser.parse_args()
    
    try:
        if args.command == "market-data":
            result = get_market_data(args)
        elif args.command == "user-data":
            result = get_user_data(args)
        elif args.command == "place-order":
            result = place_order(args)
        elif args.command == "market-order":
            result = place_market_order(args)
        elif args.command == "cancel-order":
            result = cancel_order(args)
        elif args.command == "update-leverage":
            result = update_leverage(args)
        else:
            result = {"error": "Unknown command"}
        
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()