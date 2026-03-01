# Streaming Real-Time Data from Vertex

Complete example of connecting to the Vertex WebSocket subscriptions API to receive live orderbook, trade, and fill data.

## Prerequisites

```bash
pip install vertex-protocol websocket-client
```

## Full Example: Multi-Stream Subscriber

```python
import json
import threading
import websocket

SUBSCRIBE_URL = "wss://gateway.prod.vertexprotocol.com/v1/subscribe"

BTC_PERP_PRODUCT_ID = 2
ETH_PERP_PRODUCT_ID = 4


def on_message(ws, message):
    data = json.loads(message)
    stream_type = data.get("type", "unknown")

    if stream_type == "best_bid_offer":
        product_id = data["product_id"]
        print(
            f"[BBO] product={product_id} "
            f"bid={data['bid_price']} ask={data['ask_price']}"
        )
    elif stream_type == "trade":
        product_id = data["product_id"]
        print(
            f"[TRADE] product={product_id} "
            f"price={data['price']} qty={data['qty']} "
            f"side={'buy' if data['is_taker_buyer'] else 'sell'}"
        )
    elif stream_type == "book_depth":
        product_id = data["product_id"]
        bids = data.get("bids", [])[:3]
        asks = data.get("asks", [])[:3]
        print(f"[DEPTH] product={product_id} top3_bids={bids} top3_asks={asks}")
    else:
        print(f"[{stream_type.upper()}] {json.dumps(data, indent=2)}")


def on_error(ws, error):
    print(f"WebSocket error: {error}")


def on_close(ws, close_status_code, close_msg):
    print(f"WebSocket closed: {close_status_code} — {close_msg}")


def on_open(ws):
    # Subscribe to BTC-PERP best bid/offer
    ws.send(json.dumps({
        "method": "subscribe",
        "stream": {
            "type": "best_bid_offer",
            "product_id": BTC_PERP_PRODUCT_ID,
        },
    }))

    # Subscribe to ETH-PERP trades
    ws.send(json.dumps({
        "method": "subscribe",
        "stream": {
            "type": "trade",
            "product_id": ETH_PERP_PRODUCT_ID,
        },
    }))

    # Subscribe to BTC-PERP orderbook depth
    ws.send(json.dumps({
        "method": "subscribe",
        "stream": {
            "type": "book_depth",
            "product_id": BTC_PERP_PRODUCT_ID,
        },
    }))

    print("Subscribed to BTC-PERP BBO, ETH-PERP trades, BTC-PERP depth")


ws = websocket.WebSocketApp(
    SUBSCRIBE_URL,
    on_open=on_open,
    on_message=on_message,
    on_error=on_error,
    on_close=on_close,
)

ws.run_forever()
```

## Subscribe to Your Fills

To receive fill notifications for a specific subaccount:

```python
import json
import websocket
from vertex_protocol.utils.subaccount import SubaccountParams, subaccount_to_bytes32

SUBSCRIBE_URL = "wss://gateway.prod.vertexprotocol.com/v1/subscribe"

owner = "0xYourAddress"
subaccount = subaccount_to_bytes32(
    SubaccountParams(subaccount_owner=owner, subaccount_name="default")
).hex()


def on_open(ws):
    ws.send(json.dumps({
        "method": "subscribe",
        "stream": {
            "type": "fill",
            "product_id": 2,  # BTC-PERP
            "subaccount": subaccount,
        },
    }))

    ws.send(json.dumps({
        "method": "subscribe",
        "stream": {
            "type": "position_change",
            "subaccount": subaccount,
        },
    }))

    ws.send(json.dumps({
        "method": "subscribe",
        "stream": {
            "type": "order_update",
            "product_id": 2,
            "subaccount": subaccount,
        },
    }))

    print("Subscribed to fills, position changes, and order updates")


def on_message(ws, message):
    data = json.loads(message)
    stream_type = data.get("type", "unknown")

    if stream_type == "fill":
        print(
            f"[FILL] product={data['product_id']} "
            f"price={data['price']} qty={data['qty']} "
            f"side={'maker' if data['is_maker'] else 'taker'}"
        )
    elif stream_type == "position_change":
        print(
            f"[POSITION] product={data['product_id']} "
            f"amount={data['amount']} entry_price={data.get('entry_price')}"
        )
    elif stream_type == "order_update":
        print(
            f"[ORDER] product={data['product_id']} "
            f"status={data['status']} digest={data['digest']}"
        )


ws = websocket.WebSocketApp(
    SUBSCRIBE_URL,
    on_open=on_open,
    on_message=on_message,
)
ws.run_forever()
```

## Unsubscribe

```python
ws.send(json.dumps({
    "method": "unsubscribe",
    "stream": {
        "type": "best_bid_offer",
        "product_id": 2,
    },
}))
```

## Reconnection Pattern

WebSocket connections can drop. Wrap with automatic reconnection:

```python
import time
import json
import websocket

SUBSCRIBE_URL = "wss://gateway.prod.vertexprotocol.com/v1/subscribe"


def create_connection():
    def on_open(ws):
        ws.send(json.dumps({
            "method": "subscribe",
            "stream": {"type": "trade", "product_id": 2},
        }))

    def on_message(ws, message):
        data = json.loads(message)
        print(data)

    def on_close(ws, code, msg):
        print(f"Connection closed ({code}), reconnecting in 5s...")
        time.sleep(5)
        create_connection()

    def on_error(ws, error):
        print(f"Error: {error}")

    ws = websocket.WebSocketApp(
        SUBSCRIBE_URL,
        on_open=on_open,
        on_message=on_message,
        on_close=on_close,
        on_error=on_error,
    )
    ws.run_forever()


create_connection()
```

## Available Stream Types

| Type | Required Fields | Description |
|------|----------------|-------------|
| `best_bid_offer` | `product_id` | Top-of-book bid and ask price |
| `trade` | `product_id` | All executed trades for a product |
| `book_depth` | `product_id` | Full orderbook snapshot and deltas |
| `fill` | `product_id`, `subaccount` | Your fills (requires subaccount auth) |
| `position_change` | `subaccount` | Position updates across all products |
| `order_update` | `product_id`, `subaccount` | Status changes for your orders |

## Key Points

- Subscriptions endpoint is separate from the gateway WebSocket (`/v1/subscribe` vs `/v1/ws`)
- Each subscription message must include `method: "subscribe"` and a `stream` object
- Fill, position_change, and order_update streams require your subaccount in bytes32 hex
- The WebSocket sends JSON messages — parse with `json.loads()`
- No authentication needed for public streams (BBO, trade, depth)
- Implement reconnection logic — connections will drop during maintenance or network issues
- Rate limits apply per IP — avoid subscribing to the same stream repeatedly
