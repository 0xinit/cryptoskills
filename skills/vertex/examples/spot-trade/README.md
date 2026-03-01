# Spot Trading on Vertex

Complete example of placing a spot limit buy order for wETH/USDC, monitoring the fill, and querying the resulting position.

## Prerequisites

```bash
pip install vertex-protocol
```

You need a funded subaccount with USDC deposited on a supported chain (Arbitrum, Base, etc.).

## Full Example

```python
import os
import time
from vertex_protocol.client import create_vertex_client, VertexClientMode
from vertex_protocol.engine_client.types.execute import (
    PlaceOrderParams,
    OrderParams,
    CancelOrdersParams,
)
from vertex_protocol.utils.math import to_x18, to_pow_10
from vertex_protocol.utils.nonce import gen_order_nonce
from vertex_protocol.utils.expiration import get_expiration_timestamp, OrderType
from vertex_protocol.utils.subaccount import SubaccountParams

private_key = os.environ["VERTEX_PRIVATE_KEY"]
client = create_vertex_client(VertexClientMode.MAINNET, private_key)
owner = client.context.engine_client.signer.address

WETH_SPOT_PRODUCT_ID = 3

# Step 1: Check current market price
market_price = client.context.engine_client.get_market_price(
    product_id=WETH_SPOT_PRODUCT_ID
)
print(f"wETH/USDC — bid: {market_price.bid}, ask: {market_price.ask}")

# Step 2: Check account health before placing order
info = client.context.engine_client.get_subaccount_info(
    subaccount=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    )
)
print(f"Initial health: {info.healths.initial.health}")

# Step 3: Place a limit buy 0.5 wETH at $2,400
buy_order = OrderParams(
    sender=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    ),
    priceX18=to_x18(2400),
    amount=to_pow_10(5, 17),  # 0.5 ETH (positive = buy)
    expiration=get_expiration_timestamp(
        OrderType.DEFAULT,  # GTC limit order
        int(time.time()) + 86400,  # 24 hour expiry
    ),
    nonce=gen_order_nonce(),
)

res = client.market.place_order(
    PlaceOrderParams(product_id=WETH_SPOT_PRODUCT_ID, order=buy_order)
)
print(f"Order placed — digest: {res.digest}")

# Step 4: Poll for fill status
for _ in range(30):
    order = client.context.engine_client.get_order(
        product_id=WETH_SPOT_PRODUCT_ID,
        digest=res.digest,
    )
    if order.status == "filled":
        print("Order fully filled")
        break
    elif order.status == "cancelled":
        print("Order was cancelled")
        break
    print(f"Status: {order.status}, filled: {order.filled_amount}")
    time.sleep(2)

# Step 5: Check updated spot balance
info = client.context.engine_client.get_subaccount_info(
    subaccount=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    )
)
for balance in info.spot_balances:
    if balance.product_id == WETH_SPOT_PRODUCT_ID:
        print(f"wETH balance: {balance.balance.amount}")
    if balance.product_id == 0:
        print(f"USDC balance: {balance.balance.amount}")
```

## Spot Sell Order (Post-Only)

```python
# Sell 0.5 wETH as a maker (post-only) order
sell_order = OrderParams(
    sender=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    ),
    priceX18=to_x18(2600),
    amount=-to_pow_10(5, 17),  # negative = sell
    expiration=get_expiration_timestamp(
        OrderType.POST_ONLY,  # maker only — rejected if would cross
        int(time.time()) + 86400,
    ),
    nonce=gen_order_nonce(),
)

res = client.market.place_order(
    PlaceOrderParams(product_id=WETH_SPOT_PRODUCT_ID, order=sell_order)
)
print(f"Post-only sell placed — digest: {res.digest}")
```

## Cancel Open Orders

```python
res = client.market.cancel_orders(
    CancelOrdersParams(
        sender=SubaccountParams(
            subaccount_owner=owner,
            subaccount_name="default",
        ),
        product_ids=[WETH_SPOT_PRODUCT_ID],
        digests=[res.digest],
        nonce=gen_order_nonce(),
    )
)
print(f"Cancelled: {res}")
```

## Key Points

- Spot product IDs are odd numbers: 1=wBTC, 3=wETH, 5=wARB
- Positive `amount` = buy, negative = sell
- All prices are in x18 fixed-point (use `to_x18()`)
- `OrderType.DEFAULT` = GTC limit, `OrderType.IOC` = immediate-or-cancel, `OrderType.POST_ONLY` = maker only
- Buying spot you can't fully cover with USDC implicitly borrows (margin trade)
- Your spot deposits automatically earn lending interest
