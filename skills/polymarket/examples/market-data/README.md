# Polymarket Market Data

Demonstrates fetching events, markets, orderbook data, and price history from the Gamma API and CLOB API. No authentication required.

## Prerequisites

```bash
npm install @polymarket/clob-client
```

## Full Working Code

```typescript
import { ClobClient, Side, PriceHistoryInterval } from "@polymarket/clob-client";

const CLOB_HOST = "https://clob.polymarket.com";
const GAMMA_HOST = "https://gamma-api.polymarket.com";
const CHAIN_ID = 137;

interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  volume: number;
  markets: Array<{
    id: string;
    question: string;
    tokens: Array<{ token_id: string; outcome: string }>;
    minimum_tick_size: string;
    enableOrderBook: boolean;
  }>;
}

async function fetchTopEvents(): Promise<GammaEvent[]> {
  const url = `${GAMMA_HOST}/events?active=true&closed=false&sort=volume_24hr&ascending=false&limit=10`;
  const res = await fetch(url);
  return res.json() as Promise<GammaEvent[]>;
}

async function fetchEventBySlug(slug: string): Promise<GammaEvent[]> {
  const url = `${GAMMA_HOST}/events?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url);
  return res.json() as Promise<GammaEvent[]>;
}

async function main() {
  // --- Top Events by 24h Volume ---
  const topEvents = await fetchTopEvents();
  console.log("=== Top Events by 24h Volume ===");
  for (const event of topEvents.slice(0, 5)) {
    console.log(`  ${event.title} (vol: $${event.volume.toLocaleString()})`);
  }

  // --- Fetch Specific Event ---
  const events = await fetchEventBySlug("fed-decision-in-october");
  if (events.length > 0) {
    const event = events[0];
    console.log(`\n=== Event: ${event.title} ===`);
    for (const market of event.markets) {
      console.log(`  Market: ${market.question}`);
      console.log(`  Tick size: ${market.minimum_tick_size}`);
      for (const token of market.tokens) {
        console.log(`    ${token.outcome}: ${token.token_id.slice(0, 16)}...`);
      }
    }
  }

  // --- Orderbook Data (no auth needed) ---
  const readClient = new ClobClient(CLOB_HOST, CHAIN_ID);

  // Use a token ID from a real market
  const TOKEN_ID = topEvents[0]?.markets[0]?.tokens[0]?.token_id;
  if (!TOKEN_ID) {
    console.log("No active markets found");
    return;
  }

  console.log(`\n=== Orderbook for ${TOKEN_ID.slice(0, 16)}... ===`);

  const book = await readClient.getOrderBook(TOKEN_ID);
  console.log("Top 5 bids:");
  for (const bid of book.bids.slice(0, 5)) {
    console.log(`  ${bid.price} x ${bid.size}`);
  }
  console.log("Top 5 asks:");
  for (const ask of book.asks.slice(0, 5)) {
    console.log(`  ${ask.price} x ${ask.size}`);
  }

  const mid = await readClient.getMidpoint(TOKEN_ID);
  const spread = await readClient.getSpread(TOKEN_ID);
  const lastPrice = await readClient.getLastTradePrice(TOKEN_ID);
  console.log(`Midpoint: ${mid.mid}`);
  console.log(`Spread: ${spread.spread}`);
  console.log(`Last trade: ${lastPrice.price} (${lastPrice.side})`);

  // --- Price History ---
  const history = await readClient.getPricesHistory({
    market: TOKEN_ID,
    interval: PriceHistoryInterval.ONE_WEEK,
    fidelity: 60,
  });
  console.log(`\n=== Price History (last week, hourly) ===`);
  for (const point of history.slice(-5)) {
    const date = new Date(point.t * 1000).toISOString();
    console.log(`  ${date}: ${point.p}`);
  }

  // --- Batch Prices ---
  const tokens = topEvents[0]?.markets[0]?.tokens;
  if (tokens && tokens.length >= 2) {
    const batchPrices = await readClient.getPrices([
      { token_id: tokens[0].token_id, side: Side.BUY },
      { token_id: tokens[1].token_id, side: Side.BUY },
    ]);
    console.log("\n=== Batch Prices ===");
    console.log(`  ${tokens[0].outcome}: ${batchPrices[0]}`);
    console.log(`  ${tokens[1].outcome}: ${batchPrices[1]}`);
  }

  // --- Estimate Fill Price ---
  const estimatedPrice = await readClient.calculateMarketPrice(
    TOKEN_ID, Side.BUY, 500, OrderType.FOK
  );
  console.log(`\nEstimated fill for 500 shares: ${estimatedPrice}`);
}

main().catch(console.error);
```

## Expected Output

```
=== Top Events by 24h Volume ===
  Will the Fed cut rates in March? (vol: $12,345,678)
  Presidential Election 2028 (vol: $9,876,543)
  ...

=== Event: Fed Decision in October ===
  Market: Will the Fed cut rates?
  Tick size: 0.01
    Yes: 7182736451829...
    No:  9283746152839...

=== Orderbook for 7182736451829... ===
Top 5 bids:
  0.62 x 1500
  0.61 x 3200
  ...
Top 5 asks:
  0.64 x 800
  0.65 x 2100
  ...
Midpoint: 0.63
Spread: 0.02
Last trade: 0.63 (BUY)

=== Price History (last week, hourly) ===
  2026-02-28T12:00:00.000Z: 0.58
  ...

=== Batch Prices ===
  Yes: 0.64
  No: 0.36

Estimated fill for 500 shares: 0.641
```

## Notes

- Gamma API and CLOB read endpoints require no authentication.
- Always include `active=true&closed=false` when fetching events unless you need historical data.
- Events contain their markets, reducing API calls. Prefer fetching events over individual markets.
- Pagination: use `limit` and `offset` parameters. Response includes `has_more` to signal more pages.
- If bid-ask spread exceeds $0.10, the Polymarket UI shows last traded price instead of midpoint.
