# Hyperliquid Trading Bot

End-to-end example: a simple grid trading bot that places buy and sell orders around the current mid price, monitors fills via WebSocket, and replaces filled orders.

## Prerequisites

```bash
pip install hyperliquid-python-sdk eth-account websocket-client requests
```

## Architecture

```
Grid Bot
├── Initialization
│   ├── Fetch mid price
│   ├── Set leverage
│   └── Calculate grid levels
├── Order Placement
│   ├── Place buy orders below mid
│   └── Place sell orders above mid
├── WebSocket Monitor
│   ├── Listen for fills
│   └── Replace filled orders (buy fill → new sell, sell fill → new buy)
└── Risk Management
    ├── Dead man's switch (schedule_cancel)
    ├── Max position size check
    └── Graceful shutdown
```

## Full Implementation

```python
import json
import time
import signal
import threading
from decimal import Decimal
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from eth_account import Account
import websocket
import requests

# --- Configuration ---
COIN = "ETH"
GRID_LEVELS = 5             # orders per side
GRID_SPACING_PCT = 0.002    # 0.2% between levels
ORDER_SIZE = 0.1             # ETH per order
LEVERAGE = 5
MAX_POSITION = 1.0           # max ETH position before halting new entries
HEARTBEAT_SECONDS = 30       # dead man's switch timeout

INFO_URL = "https://api.hyperliquid.xyz/info"
WS_URL = "wss://api.hyperliquid.xyz/ws"

wallet = Account.from_key("0xYOUR_PRIVATE_KEY")
info = Info(constants.MAINNET_API_URL, skip_ws=True)
exchange = Exchange(wallet, constants.MAINNET_API_URL)

active_orders = {}  # oid -> {"side": "buy"|"sell", "price": float, "level": int}
shutdown_event = threading.Event()


def get_mid_price() -> float:
    mids = requests.post(INFO_URL, json={"type": "allMids"}).json()
    return float(mids[COIN])


def get_position_size() -> float:
    state = info.user_state(wallet.address)
    for pos in state["assetPositions"]:
        if pos["position"]["coin"] == COIN:
            return float(pos["position"]["szi"])
    return 0.0


def place_grid_orders():
    """Place buy orders below mid and sell orders above mid."""
    mid = get_mid_price()
    print(f"Mid price: {mid}")

    orders = []

    for i in range(1, GRID_LEVELS + 1):
        buy_price = round(mid * (1 - GRID_SPACING_PCT * i), 2)
        orders.append({
            "name": COIN,
            "is_buy": True,
            "sz": ORDER_SIZE,
            "limit_px": buy_price,
            "order_type": {"limit": {"tif": "Gtc"}},
            "reduce_only": False,
            "_meta": {"side": "buy", "level": i, "price": buy_price}
        })

    for i in range(1, GRID_LEVELS + 1):
        sell_price = round(mid * (1 + GRID_SPACING_PCT * i), 2)
        orders.append({
            "name": COIN,
            "is_buy": False,
            "sz": ORDER_SIZE,
            "limit_px": sell_price,
            "order_type": {"limit": {"tif": "Gtc"}},
            "reduce_only": False,
            "_meta": {"side": "sell", "level": i, "price": sell_price}
        })

    meta_list = [o.pop("_meta") for o in orders]
    result = exchange.bulk_orders(orders)

    statuses = result["response"]["data"]["statuses"]
    for i, status in enumerate(statuses):
        if "resting" in status:
            oid = status["resting"]["oid"]
            active_orders[oid] = meta_list[i]
            print(f"  Grid {meta_list[i]['side']} #{meta_list[i]['level']} at {meta_list[i]['price']} -> oid={oid}")
        elif "error" in status:
            print(f"  Grid {meta_list[i]['side']} #{meta_list[i]['level']} FAILED: {status['error']}")


def replace_filled_order(filled_side: str, filled_level: int):
    """When a buy fills, place a new sell one grid level up. Vice versa."""
    mid = get_mid_price()
    pos_size = get_position_size()

    if abs(pos_size) >= MAX_POSITION:
        print(f"Max position reached ({pos_size}), skipping replacement")
        return

    if filled_side == "buy":
        new_price = round(mid * (1 + GRID_SPACING_PCT * filled_level), 2)
        result = exchange.order(
            name=COIN,
            is_buy=False,
            sz=ORDER_SIZE,
            limit_px=new_price,
            order_type={"limit": {"tif": "Gtc"}},
            reduce_only=False
        )
    else:
        new_price = round(mid * (1 - GRID_SPACING_PCT * filled_level), 2)
        result = exchange.order(
            name=COIN,
            is_buy=True,
            sz=ORDER_SIZE,
            limit_px=new_price,
            order_type={"limit": {"tif": "Gtc"}},
            reduce_only=False
        )

    status = result["response"]["data"]["statuses"][0]
    if "resting" in status:
        oid = status["resting"]["oid"]
        new_side = "sell" if filled_side == "buy" else "buy"
        active_orders[oid] = {"side": new_side, "level": filled_level, "price": new_price}
        print(f"  Replaced with {new_side} at {new_price} -> oid={oid}")


def heartbeat_loop():
    """Renew dead man's switch every HEARTBEAT_SECONDS. All orders cancel if this stops."""
    while not shutdown_event.is_set():
        try:
            cancel_time = int(time.time() * 1000) + (HEARTBEAT_SECONDS * 2 * 1000)
            exchange.schedule_cancel(time=cancel_time)
        except Exception as e:
            print(f"Heartbeat failed: {e}")
        shutdown_event.wait(HEARTBEAT_SECONDS)


def ws_monitor():
    """Monitor fills via WebSocket and trigger order replacement."""

    def on_message(ws, message):
        data = json.loads(message)
        channel = data.get("channel")

        if channel == "userFills":
            for fill in data["data"]:
                oid = fill.get("oid")
                coin = fill["coin"]
                side = fill["dir"]
                size = fill["sz"]
                price = fill["px"]
                pnl = fill.get("closedPnl", "0")
                print(f"FILL: {coin} {side} {size}@{price} pnl={pnl}")

                if oid in active_orders:
                    meta = active_orders.pop(oid)
                    replace_filled_order(meta["side"], meta["level"])

        elif channel == "orderUpdates":
            for update in data["data"]:
                oid = update.get("oid")
                status = update.get("status")
                if status == "canceled" and oid in active_orders:
                    del active_orders[oid]

    def on_open(ws):
        ws.send(json.dumps({
            "method": "subscribe",
            "subscription": {"type": "userFills", "user": wallet.address}
        }))
        ws.send(json.dumps({
            "method": "subscribe",
            "subscription": {"type": "orderUpdates", "user": wallet.address}
        }))
        print("WebSocket connected, monitoring fills")

    def on_close(ws, code, msg):
        if not shutdown_event.is_set():
            print(f"WebSocket disconnected, reconnecting in 5s...")
            time.sleep(5)
            ws_monitor()

    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=lambda ws, e: print(f"WS error: {e}"),
        on_close=on_close,
    )
    ws.run_forever()


def shutdown(signum, frame):
    print("\nShutting down...")
    shutdown_event.set()

    print("Canceling all open orders...")
    orders = requests.post(INFO_URL, json={
        "type": "frontendOpenOrders",
        "user": wallet.address
    }).json()
    for order in orders:
        try:
            exchange.cancel(name=order["coin"], oid=order["oid"])
        except Exception as e:
            print(f"Cancel failed for oid={order['oid']}: {e}")

    print("Grid bot stopped")
    exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"Grid bot: {COIN} | {GRID_LEVELS} levels | {GRID_SPACING_PCT*100}% spacing | {ORDER_SIZE} per order")

    exchange.update_leverage(name=COIN, leverage=LEVERAGE, is_cross=True)
    print(f"Leverage set to {LEVERAGE}x cross")

    place_grid_orders()

    heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_thread.start()

    ws_monitor()
```

## How It Works

1. **Grid placement**: Calculates N price levels above and below the current mid price, places limit orders at each level.
2. **Fill monitoring**: WebSocket `userFills` channel notifies immediately when an order fills.
3. **Order replacement**: When a buy fills, a new sell is placed at the corresponding level above mid (and vice versa). This creates the grid oscillation.
4. **Dead man's switch**: `schedule_cancel` ensures all orders are canceled if the bot crashes or loses connectivity. Renewed every 30 seconds.
5. **Position limit**: Stops placing new entry orders when position exceeds `MAX_POSITION`.
6. **Graceful shutdown**: SIGINT/SIGTERM cancels all open orders before exit.

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `COIN` | `"ETH"` | Trading pair |
| `GRID_LEVELS` | `5` | Orders per side |
| `GRID_SPACING_PCT` | `0.002` | 0.2% spacing between levels |
| `ORDER_SIZE` | `0.1` | Size per grid order |
| `LEVERAGE` | `5` | Cross leverage multiplier |
| `MAX_POSITION` | `1.0` | Max absolute position before halting entries |
| `HEARTBEAT_SECONDS` | `30` | Dead man's switch renewal interval |

## Risk Considerations

- **Trending markets**: Grid bots accumulate losing positions in strong trends. The `MAX_POSITION` limit caps exposure but does not prevent drawdown.
- **Gaps**: If price jumps past multiple grid levels, only the first-filled level triggers a replacement. Unfilled levels remain as stale orders.
- **Rate limits**: Each replacement is 1 request. At 5 levels per side with fast markets, replacements can consume rate limit quickly. Monitor via `userRateLimit`.
- **Minimum notional**: All grid orders must exceed $10 notional. Adjust `ORDER_SIZE` and price levels accordingly.
