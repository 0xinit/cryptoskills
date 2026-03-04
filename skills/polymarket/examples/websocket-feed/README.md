# Polymarket WebSocket Feed

Demonstrates connecting to the Polymarket market and user WebSocket channels for real-time orderbook updates, trade prints, and order lifecycle events.

## Prerequisites

```bash
npm install ws @polymarket/clob-client
```

Environment variables (only needed for user channel):

```
POLY_API_KEY=...
POLY_API_SECRET=...
POLY_PASSPHRASE=...
```

## Full Working Code

```typescript
import WebSocket from "ws";

const MARKET_WS = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const USER_WS = "wss://ws-subscriptions-clob.polymarket.com/ws/user";

// Replace with real token IDs from the Gamma API
const TOKEN_IDS = ["YOUR_TOKEN_ID_1", "YOUR_TOKEN_ID_2"];
const CONDITION_ID = "0xYOUR_CONDITION_ID";

interface BookEvent {
  event_type: "book";
  asset_id: string;
  market: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  timestamp: string;
}

interface PriceChangeEvent {
  event_type: "price_change";
  market: string;
  price_changes: Array<{
    asset_id: string;
    price: string;
    size: string;
    side: string;
    best_bid: string;
    best_ask: string;
  }>;
}

interface LastTradeEvent {
  event_type: "last_trade_price";
  asset_id: string;
  price: string;
  side: string;
  size: string;
}

interface TickSizeChangeEvent {
  event_type: "tick_size_change";
  asset_id: string;
  old_tick_size: string;
  new_tick_size: string;
}

type MarketEvent = BookEvent | PriceChangeEvent | LastTradeEvent | TickSizeChangeEvent;

function connectMarketChannel(): void {
  const ws = new WebSocket(MARKET_WS);
  let pingInterval: NodeJS.Timeout;

  ws.on("open", () => {
    console.log("[market] connected");

    ws.send(JSON.stringify({
      type: "market",
      assets_ids: TOKEN_IDS,
      custom_feature_enabled: true,
    }));

    // Heartbeat every 10s to keep connection alive
    pingInterval = setInterval(() => ws.send("PING"), 10_000);
  });

  ws.on("message", (data: WebSocket.Data) => {
    const raw = data.toString();
    if (raw === "PONG") return;

    const msg: MarketEvent = JSON.parse(raw);
    switch (msg.event_type) {
      case "book": {
        const bestBid = msg.bids[0];
        const bestAsk = msg.asks[0];
        console.log(
          `[book] ${msg.asset_id.slice(0, 12)}... ` +
          `bid: ${bestBid?.price ?? "---"} x ${bestBid?.size ?? "0"} | ` +
          `ask: ${bestAsk?.price ?? "---"} x ${bestAsk?.size ?? "0"}`
        );
        break;
      }
      case "price_change": {
        for (const pc of msg.price_changes) {
          // size "0" means the price level was removed
          const action = pc.size === "0" ? "REMOVED" : pc.side;
          console.log(
            `[price] ${action} ${pc.size}@${pc.price} ` +
            `(BBO: ${pc.best_bid}/${pc.best_ask})`
          );
        }
        break;
      }
      case "last_trade_price": {
        console.log(`[trade] ${msg.side} ${msg.size}@${msg.price}`);
        break;
      }
      case "tick_size_change": {
        // Critical for bots: update tick size immediately or orders get rejected
        console.log(`[tick] ${msg.old_tick_size} -> ${msg.new_tick_size}`);
        break;
      }
    }
  });

  ws.on("close", () => {
    clearInterval(pingInterval);
    console.log("[market] disconnected, reconnecting in 5s...");
    setTimeout(connectMarketChannel, 5000);
  });

  ws.on("error", (err) => {
    console.error("[market] error:", err.message);
  });
}

function connectUserChannel(): void {
  if (!process.env.POLY_API_KEY) {
    console.log("[user] skipping — no API credentials configured");
    return;
  }

  const ws = new WebSocket(USER_WS);
  let pingInterval: NodeJS.Timeout;

  ws.on("open", () => {
    console.log("[user] connected");

    ws.send(JSON.stringify({
      auth: {
        apiKey: process.env.POLY_API_KEY!,
        secret: process.env.POLY_API_SECRET!,
        passphrase: process.env.POLY_PASSPHRASE!,
      },
      markets: [CONDITION_ID],
      type: "USER",
    }));

    pingInterval = setInterval(() => ws.send("PING"), 10_000);
  });

  ws.on("message", (data: WebSocket.Data) => {
    const raw = data.toString();
    if (raw === "PONG") return;

    const msg = JSON.parse(raw);
    if (msg.event_type === "trade") {
      console.log(
        `[user:trade] ${msg.side} ${msg.size}@${msg.price} ` +
        `status: ${msg.status}`
      );
    } else if (msg.event_type === "order") {
      console.log(
        `[user:order] ${msg.type} ${msg.side} ` +
        `${msg.original_size}@${msg.price} matched: ${msg.size_matched}`
      );
    }
  });

  ws.on("close", () => {
    clearInterval(pingInterval);
    console.log("[user] disconnected, reconnecting in 5s...");
    setTimeout(connectUserChannel, 5000);
  });

  ws.on("error", (err) => {
    console.error("[user] error:", err.message);
  });
}

// Dynamic subscribe example: add/remove assets after connection
function addAsset(ws: WebSocket, tokenId: string): void {
  ws.send(JSON.stringify({ assets_ids: [tokenId], operation: "subscribe" }));
}

function removeAsset(ws: WebSocket, tokenId: string): void {
  ws.send(JSON.stringify({ assets_ids: [tokenId], operation: "unsubscribe" }));
}

connectMarketChannel();
connectUserChannel();
```

## Expected Output

```
[market] connected
[book] 718273645182... bid: 0.62 x 1500 | ask: 0.64 x 800
[price] BUY 200@0.63 (BBO: 0.63/0.64)
[trade] BUY 50@0.63
[price] REMOVED 0@0.61 (BBO: 0.62/0.64)
[user] connected
[user:trade] BUY 10@0.63 status: MATCHED
[user:order] PLACEMENT SELL 100@0.65 matched: 0
```

## Notes

- Market channel subscribes by **token IDs** (asset IDs). User channel subscribes by **condition IDs** (market IDs). Mixing these up produces no data and no errors.
- `custom_feature_enabled: true` enables `best_bid_ask`, `new_market`, and `market_resolved` events on the market channel.
- A `price_change` with `size: "0"` means the price level was removed from the book.
- User channel trade statuses follow the lifecycle: `MATCHED -> MINED -> CONFIRMED` (or `RETRYING -> FAILED`).
- The sports WebSocket (`wss://sports-api.polymarket.com/ws`) requires no subscription message. Connect and receive all active sports data. Its heartbeat is server-initiated: respond to `ping` with `pong` within 10 seconds.
