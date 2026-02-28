"""
Vertex Protocol Python Client — Starter Template

Setup:
    pip install vertex-protocol python-dotenv

Environment:
    VERTEX_PRIVATE_KEY=0x...   (your wallet private key, never commit this)
    VERTEX_CHAIN=mainnet       (mainnet | sepolia_testnet | base_mainnet | mantle_mainnet)
"""

import os
import time
from dotenv import load_dotenv

from vertex_protocol.client import create_vertex_client, VertexClientMode
from vertex_protocol.engine_client.types.execute import (
    PlaceOrderParams,
    OrderParams,
    CancelOrdersParams,
    WithdrawCollateralParams,
)
from vertex_protocol.contracts.types import DepositCollateralParams
from vertex_protocol.utils.math import to_x18, to_pow_10
from vertex_protocol.utils.nonce import gen_order_nonce
from vertex_protocol.utils.expiration import get_expiration_timestamp, OrderType
from vertex_protocol.utils.subaccount import SubaccountParams

load_dotenv()


CHAIN_MODES = {
    "mainnet": VertexClientMode.MAINNET,
    "sepolia_testnet": VertexClientMode.SEPOLIA_TESTNET,
    "base_mainnet": VertexClientMode.BASE_MAINNET,
    "mantle_mainnet": VertexClientMode.MANTLE_MAINNET,
}

# BTC products share health group: spot=1, perp=2
# ETH products share health group: spot=3, perp=4
BTC_SPOT = 1
BTC_PERP = 2
ETH_SPOT = 3
ETH_PERP = 4
USDC = 0


def get_client():
    private_key = os.environ["VERTEX_PRIVATE_KEY"]
    chain = os.environ.get("VERTEX_CHAIN", "mainnet")
    mode = CHAIN_MODES.get(chain)
    if mode is None:
        raise ValueError(f"Unknown chain '{chain}'. Options: {list(CHAIN_MODES.keys())}")
    return create_vertex_client(mode, private_key)


def get_subaccount(client, name="default"):
    owner = client.context.engine_client.signer.address
    return SubaccountParams(subaccount_owner=owner, subaccount_name=name)


def print_account_health(client, subaccount):
    info = client.context.engine_client.get_subaccount_info(subaccount=subaccount)
    print(f"Initial health:     {info.healths.initial.health}")
    print(f"Maintenance health: {info.healths.maintenance.health}")
    print(f"Spot balances:      {len(info.spot_balances)}")
    print(f"Perp balances:      {len(info.perp_balances)}")
    return info


def print_all_balances(info):
    print("\n--- Spot Balances ---")
    for b in info.spot_balances:
        print(f"  Product {b.product_id}: amount={b.balance.amount}")

    print("\n--- Perp Balances ---")
    for b in info.perp_balances:
        print(
            f"  Product {b.product_id}: "
            f"amount={b.balance.amount}, "
            f"vquote={b.balance.v_quote_balance}"
        )


def get_market_price(client, product_id):
    price = client.context.engine_client.get_market_price(product_id=product_id)
    print(f"Product {product_id} — bid: {price.bid}, ask: {price.ask}")
    return price


def place_limit_order(client, subaccount, product_id, price, amount, order_type=OrderType.DEFAULT, ttl_seconds=86400):
    """Place a limit order. Positive amount = buy/long, negative = sell/short."""
    order = OrderParams(
        sender=subaccount,
        priceX18=to_x18(price),
        amount=amount,
        expiration=get_expiration_timestamp(order_type, int(time.time()) + ttl_seconds),
        nonce=gen_order_nonce(),
    )
    res = client.market.place_order(
        PlaceOrderParams(product_id=product_id, order=order)
    )
    print(f"Order placed — product={product_id} digest={res.digest}")
    return res


def cancel_orders(client, subaccount, product_ids, digests):
    res = client.market.cancel_orders(
        CancelOrdersParams(
            sender=subaccount,
            product_ids=product_ids,
            digests=digests,
            nonce=gen_order_nonce(),
        )
    )
    print(f"Cancelled {len(digests)} order(s)")
    return res


def deposit_usdc(client, amount_usdc):
    """Deposit USDC. amount_usdc is a human-readable number (e.g., 1000 for $1,000)."""
    raw_amount = to_pow_10(int(amount_usdc), 6)

    approve_tx = client.spot.approve_allowance(product_id=USDC, amount=raw_amount)
    print(f"Approved — tx: {approve_tx}")

    deposit_tx = client.spot.deposit(
        DepositCollateralParams(
            subaccount_name="default",
            product_id=USDC,
            amount=raw_amount,
        )
    )
    print(f"Deposited {amount_usdc} USDC — tx: {deposit_tx}")
    return deposit_tx


def withdraw_usdc(client, subaccount, amount_usdc):
    """Withdraw USDC. amount_usdc is a human-readable number."""
    res = client.spot.withdraw(
        WithdrawCollateralParams(
            sender=subaccount,
            product_id=USDC,
            amount=to_pow_10(int(amount_usdc), 6),
            nonce=gen_order_nonce(),
        )
    )
    print(f"Withdrawal submitted for {amount_usdc} USDC")
    return res


def list_products(client):
    products = client.context.engine_client.get_all_products()
    print("\n=== Spot Products ===")
    for s in products.spot_products:
        print(f"  ID={s.product_id} — {s.book_info}")
    print("\n=== Perp Products ===")
    for p in products.perp_products:
        print(f"  ID={p.product_id} — {p.book_info}")
    return products


if __name__ == "__main__":
    client = get_client()
    sub = get_subaccount(client)

    print("=== Account Health ===")
    info = print_account_health(client, sub)
    print_all_balances(info)

    print("\n=== Market Prices ===")
    get_market_price(client, BTC_PERP)
    get_market_price(client, ETH_PERP)

    print("\n=== Available Products ===")
    list_products(client)
