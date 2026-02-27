# WebSocket Streaming on Hyperliquid

End-to-end example: subscribe to real-time trades, orderbook updates, and user fill events over WebSocket with automatic reconnection.

## Prerequisites

```bash
pip install websocket-client requests
```

## Step 1: Basic Trade Stream

```python
import json
import websocket

WS_URL = "wss://api.hyperliquid.xyz/ws"

def on_message(ws, message):
    data = json.loads(message)
    channel = data.get("channel")

    if channel == "trades":
        for trade in data["data"]:
            side = trade["side"]
            price = trade["px"]
            size = trade["sz"]
            coin = trade["coin"]
            ts = trade["time"]
            print(f"[{ts}] {coin} {side.upper()} {size}@{price}")

def on_open(ws):
    ws.send(json.dumps({
        "method": "subscribe",
        "subscription": {"type": "trades", "coin": "BTC"}
    }))
    print("Subscribed to BTC trades")

ws = websocket.WebSocketApp(
    WS_URL,
    on_open=on_open,
    on_message=on_message,
    on_error=lambda ws, e: print(f"Error: {e}"),
    on_close=lambda ws, c, m: print(f"Closed: {c} {m}")
)
ws.run_forever()
```

## Step 2: L2 Orderbook Stream

```python
import json
import websocket

WS_URL = "wss://api.hyperliquid.xyz/ws"

orderbook = {"bids": [], "asks": []}

def on_message(ws, message):
    data = json.loads(message)
    channel = data.get("channel")

    if channel == "l2Book":
        book = data["data"]
        bids = book["levels"][0]
        asks = book["levels"][1]

        if bids:
            best_bid = bids[0]
            print(f"Best bid: {best_bid['px']} x {best_bid['sz']} ({best_bid['n']} orders)")
        if asks:
            best_ask = asks[0]
            print(f"Best ask: {best_ask['px']} x {best_ask['sz']} ({best_ask['n']} orders)")
        if bids and asks:
            spread = float(asks[0]["px"]) - float(bids[0]["px"])
            mid = (float(asks[0]["px"]) + float(bids[0]["px"])) / 2
            print(f"Spread: {spread:.2f} ({spread/mid*10000:.1f} bps)")

def on_open(ws):
    ws.send(json.dumps({
        "method": "subscribe",
        "subscription": {"type": "l2Book", "coin": "ETH"}
    }))

ws = websocket.WebSocketApp(WS_URL, on_open=on_open, on_message=on_message)
ws.run_forever()
```

## Step 3: Multi-Channel Stream with User Events

```python
import json
import websocket

WS_URL = "wss://api.hyperliquid.xyz/ws"
USER_ADDRESS = "0xYOUR_ADDRESS"

def on_message(ws, message):
    data = json.loads(message)
    channel = data.get("channel")

    if channel == "trades":
        for t in data["data"]:
            print(f"TRADE  {t['coin']} {t['side']} {t['sz']}@{t['px']}")

    elif channel == "l2Book":
        book = data["data"]
        bids = book["levels"][0]
        asks = book["levels"][1]
        if bids and asks:
            print(f"BOOK   {book['coin']} bid={bids[0]['px']} ask={asks[0]['px']}")

    elif channel == "userFills":
        for fill in data["data"]:
            print(f"FILL   {fill['coin']} {fill['dir']} {fill['sz']}@{fill['px']} fee={fill['fee']}")

    elif channel == "orderUpdates":
        for update in data["data"]:
            status = update.get("status", "unknown")
            print(f"ORDER  {update['coin']} oid={update['oid']} status={status}")

    elif channel == "allMids":
        mids = data["data"]["mids"]
        btc = mids.get("BTC", "?")
        eth = mids.get("ETH", "?")
        print(f"MIDS   BTC={btc} ETH={eth}")

def on_open(ws):
    subs = [
        {"type": "trades", "coin": "BTC"},
        {"type": "l2Book", "coin": "BTC"},
        {"type": "allMids"},
        {"type": "userFills", "user": USER_ADDRESS},
        {"type": "orderUpdates", "user": USER_ADDRESS},
    ]
    for sub in subs:
        ws.send(json.dumps({"method": "subscribe", "subscription": sub}))
    print(f"Subscribed to {len(subs)} channels")

ws = websocket.WebSocketApp(
    WS_URL,
    on_open=on_open,
    on_message=on_message,
    on_error=lambda ws, e: print(f"WS error: {e}"),
    on_close=lambda ws, c, m: print(f"WS closed: {c}")
)
ws.run_forever()
```

## Step 4: Reconnecting WebSocket with Backfill

Hyperliquid does not replay missed messages on reconnect. Use the Info REST API to backfill state after reconnection.

```python
import json
import time
import threading
import requests
import websocket

WS_URL = "wss://api.hyperliquid.xyz/ws"
INFO_URL = "https://api.hyperliquid.xyz/info"
USER_ADDRESS = "0xYOUR_ADDRESS"

reconnect_delay = 1.0
max_reconnect_delay = 60.0

def backfill_on_reconnect():
    """Fetch current state from REST API to recover from missed WS messages."""
    state = requests.post(INFO_URL, json={
        "type": "clearinghouseState",
        "user": USER_ADDRESS
    }).json()
    print(f"Backfilled: {len(state['assetPositions'])} positions")

    orders = requests.post(INFO_URL, json={
        "type": "frontendOpenOrders",
        "user": USER_ADDRESS
    }).json()
    print(f"Backfilled: {len(orders)} open orders")

def on_message(ws, message):
    data = json.loads(message)
    channel = data.get("channel")
    if channel:
        print(f"[{channel}] {json.dumps(data['data'])[:120]}...")

def on_open(ws):
    global reconnect_delay
    reconnect_delay = 1.0

    backfill_on_reconnect()

    subs = [
        {"type": "userFills", "user": USER_ADDRESS},
        {"type": "orderUpdates", "user": USER_ADDRESS},
        {"type": "clearinghouseState", "user": USER_ADDRESS},
    ]
    for sub in subs:
        ws.send(json.dumps({"method": "subscribe", "subscription": sub}))

def on_close(ws, code, msg):
    global reconnect_delay
    print(f"Disconnected (code={code}). Reconnecting in {reconnect_delay}s...")
    time.sleep(reconnect_delay)
    reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
    connect()

def connect():
    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=lambda ws, e: print(f"Error: {e}"),
        on_close=on_close,
    )
    ws.run_forever()

connect()
```

## Step 5: Candle Stream

```python
import json
import websocket

WS_URL = "wss://api.hyperliquid.xyz/ws"

def on_message(ws, message):
    data = json.loads(message)
    if data.get("channel") == "candle":
        c = data["data"]
        print(f"{c['s']} {c['i']} O={c['o']} H={c['h']} L={c['l']} C={c['c']} V={c['v']}")

def on_open(ws):
    ws.send(json.dumps({
        "method": "subscribe",
        "subscription": {"type": "candle", "coin": "BTC", "interval": "1m"}
    }))

ws = websocket.WebSocketApp(WS_URL, on_open=on_open, on_message=on_message)
ws.run_forever()
```

## Channel Reference

| Channel | Auth | Params | Update Frequency |
|---------|------|--------|-----------------|
| `trades` | No | `coin` | Every trade |
| `l2Book` | No | `coin` | Every book change |
| `bbo` | No | `coin` | Best bid/offer change |
| `candle` | No | `coin`, `interval` | Every candle close/update |
| `allMids` | No | — | Every mid price change |
| `activeAssetCtx` | No | `coin` | Funding/OI updates |
| `userFills` | No | `user` | Every fill |
| `orderUpdates` | No | `user` | Order status changes |
| `userFundings` | No | `user` | Funding payments |
| `clearinghouseState` | No | `user`, `dex` | Position changes |
| `openOrders` | No | `user`, `dex` | Order book changes |
| `twapStates` | No | `user`, `dex` | TWAP progress |

WebSocket subscriptions use the user's public address — no signing required. The data is publicly queryable on Hyperliquid's L1.
