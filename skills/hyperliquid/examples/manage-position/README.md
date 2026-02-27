# Manage Positions on Hyperliquid

End-to-end example: query positions, set leverage, adjust margin, attach TP/SL, and close positions using the Python SDK.

## Prerequisites

```bash
pip install hyperliquid-python-sdk eth-account requests
```

## Step 1: Initialize Client

```python
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from eth_account import Account

wallet = Account.from_key("0xYOUR_PRIVATE_KEY")
info = Info(constants.MAINNET_API_URL, skip_ws=True)
exchange = Exchange(wallet, constants.MAINNET_API_URL)
```

## Step 2: Query All Positions

```python
state = info.user_state(wallet.address)

margin = state["marginSummary"]
print(f"Account value:      {margin['accountValue']}")
print(f"Total margin used:  {margin['totalMarginUsed']}")
print(f"Withdrawable:       {margin['totalNtlPos']}")

for pos in state["assetPositions"]:
    p = pos["position"]
    coin = p["coin"]
    size = float(p["szi"])
    entry = float(p["entryPx"])
    unrealized = float(p["unrealizedPnl"])
    leverage_type = p["leverage"]["type"]
    leverage_val = p["leverage"]["value"]
    liq_px = p.get("liquidationPx", "N/A")

    direction = "LONG" if size > 0 else "SHORT"
    print(f"\n{coin} {direction}")
    print(f"  Size:       {abs(size)}")
    print(f"  Entry:      {entry}")
    print(f"  PnL:        {unrealized:+.2f}")
    print(f"  Leverage:   {leverage_val}x ({leverage_type})")
    print(f"  Liq price:  {liq_px}")
```

## Step 3: Set Leverage Before Opening

Always set leverage before placing your entry order. Leverage applies per-asset, not per-order.

```python
# Cross margin at 10x
exchange.update_leverage(name="BTC", leverage=10, is_cross=True)

# Isolated margin at 20x
exchange.update_leverage(name="ETH", leverage=20, is_cross=False)
```

## Step 4: Open a Position with Leverage

```python
# Set leverage first
exchange.update_leverage(name="ETH", leverage=15, is_cross=False)

# Open long via market order
result = exchange.market_open(
    name="ETH",
    is_buy=True,
    sz=1.0,
    slippage=0.03
)
print(f"Opened: {result['response']['data']['statuses'][0]}")
```

## Step 5: Adjust Isolated Margin

Add or remove margin from an isolated position without changing leverage.

```python
# Add $200 margin to isolated ETH position
exchange.update_isolated_margin(name="ETH", amount=200.0)

# Remove $100 margin (negative value)
exchange.update_isolated_margin(name="ETH", amount=-100.0)
```

## Step 6: Attach Take-Profit and Stop-Loss

After opening a position, place trigger orders to manage risk.

```python
position_size = 1.0  # must match your position size
entry_price = 3200.0

# Take-profit at 5% above entry
tp_price = entry_price * 1.05
exchange.order(
    name="ETH",
    is_buy=False,       # close long = sell
    sz=position_size,
    limit_px=tp_price,
    order_type={"trigger": {
        "triggerPx": str(tp_price),
        "isMarket": True,
        "tpsl": "tp"
    }},
    reduce_only=True
)
print(f"TP set at {tp_price}")

# Stop-loss at 3% below entry
sl_price = entry_price * 0.97
exchange.order(
    name="ETH",
    is_buy=False,
    sz=position_size,
    limit_px=sl_price * 0.995,  # slightly worse to ensure fill
    order_type={"trigger": {
        "triggerPx": str(sl_price),
        "isMarket": True,
        "tpsl": "sl"
    }},
    reduce_only=True
)
print(f"SL set at {sl_price}")
```

## Step 7: Partially Close a Position

```python
# Close half of a 1.0 ETH long
exchange.order(
    name="ETH",
    is_buy=False,
    sz=0.5,
    limit_px=3500.0,
    order_type={"limit": {"tif": "Gtc"}},
    reduce_only=True
)
```

## Step 8: Market Close Entire Position

```python
exchange.market_close(name="ETH")
```

## Step 9: Monitor Liquidation Risk

```python
import time

while True:
    state = info.user_state(wallet.address)
    margin = state["marginSummary"]
    account_value = float(margin["accountValue"])
    margin_used = float(margin["totalMarginUsed"])

    if margin_used > 0:
        margin_ratio = account_value / margin_used
        print(f"Margin ratio: {margin_ratio:.2f}x — ", end="")
        if margin_ratio < 1.5:
            print("DANGER — close to liquidation")
        elif margin_ratio < 3.0:
            print("WARNING — monitor closely")
        else:
            print("healthy")

    for pos in state["assetPositions"]:
        p = pos["position"]
        if p.get("liquidationPx"):
            current_mid = float(info.all_mids()[p["coin"]])
            liq_px = float(p["liquidationPx"])
            distance_pct = abs(current_mid - liq_px) / current_mid * 100
            print(f"  {p['coin']}: liq={liq_px:.2f} current={current_mid:.2f} distance={distance_pct:.1f}%")

    time.sleep(10)
```

## Step 10: Transfer Between Spot and Perp

Move USDC between your spot and perpetual wallets.

```python
# Perp -> Spot
exchange.class_transfer(amount=500.0, to_perp=False)

# Spot -> Perp
exchange.class_transfer(amount=500.0, to_perp=True)
```

## Position Lifecycle Summary

```
Set leverage → Place entry → Attach TP/SL → Monitor → Partial close / Market close
      │              │              │              │              │
update_leverage  market_open    order(trigger)  user_state   market_close
                   order()      reduce_only=True             order(reduce_only)
```
