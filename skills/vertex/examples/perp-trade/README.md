# Perpetual Trading on Vertex

Complete example of opening a leveraged BTC-PERP position, setting a stop-loss via the trigger API, and managing the position lifecycle.

## Prerequisites

```bash
pip install vertex-protocol
```

You need USDC deposited as collateral. Perp positions are cross-margined against your entire portfolio.

## Full Example: Open Long Position

```python
import os
import time
from vertex_protocol.client import create_vertex_client, VertexClientMode
from vertex_protocol.engine_client.types.execute import (
    PlaceOrderParams,
    OrderParams,
    CancelAndPlaceParams,
    CancelOrdersParams,
)
from vertex_protocol.utils.math import to_x18, to_pow_10
from vertex_protocol.utils.nonce import gen_order_nonce
from vertex_protocol.utils.expiration import get_expiration_timestamp, OrderType
from vertex_protocol.utils.subaccount import SubaccountParams

private_key = os.environ["VERTEX_PRIVATE_KEY"]
client = create_vertex_client(VertexClientMode.MAINNET, private_key)
owner = client.context.engine_client.signer.address

BTC_PERP_PRODUCT_ID = 2
ETH_PERP_PRODUCT_ID = 4

# Step 1: Check available margin
info = client.context.engine_client.get_subaccount_info(
    subaccount=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    )
)
print(f"Initial health: {info.healths.initial.health}")
print(f"Maintenance health: {info.healths.maintenance.health}")

# Step 2: Check BTC-PERP market price
market_price = client.context.engine_client.get_market_price(
    product_id=BTC_PERP_PRODUCT_ID
)
print(f"BTC-PERP — bid: {market_price.bid}, ask: {market_price.ask}")

# Step 3: Open long 0.1 BTC via IOC (market-like) order
# IOC fills immediately at best available price or cancels unfilled portion
long_order = OrderParams(
    sender=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    ),
    priceX18=to_x18(70000),  # max price willing to pay (slippage bound)
    amount=to_pow_10(1, 17),  # 0.1 BTC (positive = long)
    expiration=get_expiration_timestamp(
        OrderType.IOC,
        int(time.time()) + 60,
    ),
    nonce=gen_order_nonce(),
)

res = client.market.place_order(
    PlaceOrderParams(product_id=BTC_PERP_PRODUCT_ID, order=long_order)
)
print(f"Long order — digest: {res.digest}")

# Step 4: Verify position
info = client.context.engine_client.get_subaccount_info(
    subaccount=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    )
)
for balance in info.perp_balances:
    if balance.product_id == BTC_PERP_PRODUCT_ID:
        print(f"BTC-PERP position: {balance.balance.amount}")
        print(f"Entry VQUOTE: {balance.balance.v_quote_balance}")
```

## Close Position

```python
# Close the 0.1 BTC long by selling
close_order = OrderParams(
    sender=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    ),
    priceX18=to_x18(60000),  # min price willing to accept
    amount=-to_pow_10(1, 17),  # -0.1 BTC (sell / close long)
    expiration=get_expiration_timestamp(
        OrderType.IOC,
        int(time.time()) + 60,
    ),
    nonce=gen_order_nonce(),
)

res = client.market.place_order(
    PlaceOrderParams(product_id=BTC_PERP_PRODUCT_ID, order=close_order)
)
print(f"Close order — digest: {res.digest}")
```

## Atomic Cancel and Replace

Replace an existing limit order in one atomic operation — avoids the gap where you have no order in the book:

```python
old_digest = "0xpreviousorderdigest..."

res = client.market.cancel_and_place(
    CancelAndPlaceParams(
        cancel_orders=CancelOrdersParams(
            sender=SubaccountParams(
                subaccount_owner=owner,
                subaccount_name="default",
            ),
            product_ids=[BTC_PERP_PRODUCT_ID],
            digests=[old_digest],
            nonce=gen_order_nonce(),
        ),
        place_order=PlaceOrderParams(
            product_id=BTC_PERP_PRODUCT_ID,
            order=OrderParams(
                sender=SubaccountParams(
                    subaccount_owner=owner,
                    subaccount_name="default",
                ),
                priceX18=to_x18(67500),
                amount=to_pow_10(1, 17),
                expiration=get_expiration_timestamp(
                    OrderType.POST_ONLY, int(time.time()) + 3600
                ),
                nonce=gen_order_nonce(),
            ),
        ),
    )
)
```

## Check Funding Rate

Perps have a funding rate that settles periodically. Longs pay shorts (or vice versa) based on the rate:

```python
funding = client.context.indexer_client.get_funding_rate(
    product_id=BTC_PERP_PRODUCT_ID
)
print(f"BTC-PERP 24h funding rate: {funding.funding_rate}")
```

## Key Points

- Perp product IDs are even numbers: 2=BTC-PERP, 4=ETH-PERP, 6=ARB-PERP
- Positive `amount` = long, negative = short
- `OrderType.IOC` for market-like execution (fills or cancels immediately)
- `priceX18` on IOC orders acts as a slippage bound — set above market for buys, below for sells
- Cross-margin means your spot deposits and other perp P&L all contribute to margin
- Monitor `healths.maintenance` — if it goes negative, you face liquidation
- Funding payments happen continuously and are reflected in `v_quote_balance`
