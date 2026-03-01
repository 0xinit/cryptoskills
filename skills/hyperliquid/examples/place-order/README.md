# Place Orders on Hyperliquid

End-to-end example: connect to Hyperliquid, resolve asset indices, and place limit, market, and trigger orders using the Python SDK.

## Prerequisites

```bash
pip install hyperliquid-python-sdk eth-account
```

## Step 1: Initialize Client

```python
import json
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from eth_account import Account

wallet = Account.from_key("0xYOUR_PRIVATE_KEY")
info = Info(constants.MAINNET_API_URL, skip_ws=True)
exchange = Exchange(wallet, constants.MAINNET_API_URL)
```

## Step 2: Resolve Asset Index and Tick Size

Asset indices shift when new markets are listed. Always query `meta` instead of hardcoding.

```python
meta = info.meta()
universe = meta["universe"]

asset_map = {asset["name"]: i for i, asset in enumerate(universe)}
asset_info = {asset["name"]: asset for asset in universe}

coin = "ETH"
asset_index = asset_map[coin]
max_leverage = int(asset_info[coin]["maxLeverage"])
print(f"{coin} -> asset index {asset_index}, max leverage {max_leverage}x")
```

## Step 3: Place a Limit Order (GTC)

```python
result = exchange.order(
    name="ETH",
    is_buy=True,
    sz=0.1,
    limit_px=3000.0,
    order_type={"limit": {"tif": "Gtc"}},
    reduce_only=False
)

status = result["response"]["data"]["statuses"][0]
if "resting" in status:
    print(f"Order resting on book, oid: {status['resting']['oid']}")
elif "filled" in status:
    print(f"Order filled immediately, oid: {status['filled']['oid']}")
elif "error" in status:
    print(f"Order rejected: {status['error']}")
```

## Step 4: Place a Market Order

`market_open` sends an IOC limit order with slippage tolerance against the current best price.

```python
result = exchange.market_open(
    name="BTC",
    is_buy=True,
    sz=0.001,
    slippage=0.03  # 3% max slippage from mid price
)

status = result["response"]["data"]["statuses"][0]
if "filled" in status:
    print(f"Filled: oid={status['filled']['oid']} totalSz={status['filled']['totalSz']} avgPx={status['filled']['avgPx']}")
```

## Step 5: Place a Post-Only Order (ALO)

Add-Liquidity-Only orders are rejected if they would match immediately. Useful for maker strategies.

```python
result = exchange.order(
    name="ETH",
    is_buy=True,
    sz=0.5,
    limit_px=2950.0,
    order_type={"limit": {"tif": "Alo"}},
    reduce_only=False
)

status = result["response"]["data"]["statuses"][0]
if "error" in status:
    # "Post only order would have immediately matched, bbo was ..."
    print(f"ALO rejected — price too aggressive: {status['error']}")
```

## Step 6: Place a Trigger Order (Stop-Loss)

Trigger orders activate when the oracle price crosses the trigger price.

```python
result = exchange.order(
    name="ETH",
    is_buy=False,
    sz=0.1,
    limit_px=2780.0,           # limit price after trigger fires
    order_type={"trigger": {
        "triggerPx": "2800",   # trigger when price <= 2800
        "isMarket": True,      # fill as market order when triggered
        "tpsl": "sl"           # "sl" = stop-loss, "tp" = take-profit
    }},
    reduce_only=True
)

status = result["response"]["data"]["statuses"][0]
if "resting" in status:
    print(f"Trigger order set, oid: {status['resting']['oid']}")
```

## Step 7: Place an Order with Client Order ID

Client Order IDs (CLOIDs) let you track orders by your own identifier. Must be a hex string representing a 128-bit value.

```python
import uuid

cloid = "0x" + uuid.uuid4().hex

result = exchange.order(
    name="BTC",
    is_buy=True,
    sz=0.01,
    limit_px=94000.0,
    order_type={"limit": {"tif": "Gtc"}},
    reduce_only=False,
    cloid=cloid
)
print(f"Placed with cloid: {cloid}")

# Later: check order status by CLOID
import requests

order_status = requests.post("https://api.hyperliquid.xyz/info", json={
    "type": "orderStatus",
    "user": wallet.address,
    "oid": cloid
}).json()
print(f"Status: {order_status['status']}")
```

## Step 8: Cancel an Order

```python
# Cancel by OID
exchange.cancel(name="ETH", oid=123456)

# Cancel by CLOID
exchange.cancel_by_cloid(name="ETH", cloid=cloid)
```

## Step 9: Batch Orders

Place multiple orders atomically. If pre-validation fails on any order, the entire batch is rejected.

```python
orders = [
    {
        "name": "BTC",
        "is_buy": True,
        "sz": 0.01,
        "limit_px": 93000.0,
        "order_type": {"limit": {"tif": "Gtc"}},
        "reduce_only": False
    },
    {
        "name": "BTC",
        "is_buy": True,
        "sz": 0.01,
        "limit_px": 92000.0,
        "order_type": {"limit": {"tif": "Gtc"}},
        "reduce_only": False
    },
    {
        "name": "BTC",
        "is_buy": True,
        "sz": 0.01,
        "limit_px": 91000.0,
        "order_type": {"limit": {"tif": "Gtc"}},
        "reduce_only": False
    }
]
result = exchange.bulk_orders(orders)

for i, status in enumerate(result["response"]["data"]["statuses"]):
    if "resting" in status:
        print(f"Order {i}: resting, oid={status['resting']['oid']}")
    elif "error" in status:
        print(f"Order {i}: rejected — {status['error']}")
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Order must have minimum value of $10` | Notional below minimum | Increase `sz` or `limit_px` |
| `Price must be divisible by tick size` | Wrong price precision | Query `meta` for tick size |
| `Insufficient margin to place order` | Not enough collateral | Deposit USDC or reduce position |
| `Post only order would have immediately matched` | ALO price crosses spread | Use a less aggressive price |
| `No liquidity available for market order` | Empty book at your slippage | Increase slippage or use limit |
