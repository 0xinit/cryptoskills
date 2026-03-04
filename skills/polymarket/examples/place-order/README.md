# Place Order on Polymarket

Demonstrates authentication, client setup, and placing limit, market, and GTD orders on the Polymarket CLOB.

## Prerequisites

```bash
npm install @polymarket/clob-client ethers@^5.7.0
```

Environment variables:

```
PRIVATE_KEY=0x...        # Polygon wallet private key
FUNDER_ADDRESS=0x...     # Proxy wallet from polymarket.com/settings
```

## Full Working Code

```typescript
import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

async function main() {
  const signer = new Wallet(process.env.PRIVATE_KEY!);

  // Step 1: Derive API credentials (L1 auth)
  const tempClient = new ClobClient(HOST, CHAIN_ID, signer);
  const apiCreds = await tempClient.createOrDeriveApiKey();
  console.log("API Key:", apiCreds.apiKey);

  // Step 2: Initialize trading client (L2 auth)
  const client = new ClobClient(
    HOST,
    CHAIN_ID,
    signer,
    apiCreds,
    2, // GNOSIS_SAFE
    process.env.FUNDER_ADDRESS!
  );

  // Replace with a real token ID from the Gamma API
  const TOKEN_ID = "YOUR_TOKEN_ID";

  // Fetch tick size and neg risk flag for this market
  const tickSize = await client.getTickSize(TOKEN_ID);
  const negRisk = await client.getNegRisk(TOKEN_ID);
  console.log("Tick size:", tickSize, "Neg risk:", negRisk);

  // --- GTC Limit Order ---
  const gtcResponse = await client.createAndPostOrder(
    { tokenID: TOKEN_ID, price: 0.45, size: 20, side: Side.BUY },
    { tickSize, negRisk },
    OrderType.GTC
  );
  console.log("GTC Order:", gtcResponse.orderID, gtcResponse.status);

  // --- FOK Market Order (buy $50 worth) ---
  const fokResponse = await client.createAndPostMarketOrder(
    { tokenID: TOKEN_ID, side: Side.BUY, amount: 50, price: 0.55 },
    { tickSize, negRisk },
    OrderType.FOK
  );
  console.log("FOK Order:", fokResponse.orderID, fokResponse.status);

  // --- GTD Order (expires in 2 hours) ---
  const expiration = Math.floor(Date.now() / 1000) + 60 + 7200;
  const gtdResponse = await client.createAndPostOrder(
    { tokenID: TOKEN_ID, price: 0.40, size: 50, side: Side.BUY, expiration },
    { tickSize, negRisk },
    OrderType.GTD
  );
  console.log("GTD Order:", gtdResponse.orderID, "expires:", new Date(expiration * 1000).toISOString());

  // --- Cancel All ---
  await client.cancelAll();
  console.log("All orders cancelled");
}

main().catch(console.error);
```

## Expected Output

```
API Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Tick size: 0.01 Neg risk: false
GTC Order: 0xabc123... live
FOK Order: 0xdef456... matched
GTD Order: 0xghi789... expires: 2026-03-04T16:00:00.000Z
All orders cancelled
```

## Notes

- `createOrDeriveApiKey()` is idempotent. It creates credentials on first call and derives existing ones on subsequent calls.
- FOK BUY `amount` is dollars to spend, not share count. The response includes the actual shares filled.
- GTD expiration must be at least `now + 60` seconds. The 60-second buffer is a protocol-enforced security threshold.
- Always query `tickSize` and `negRisk` per market before placing orders. Using stale values causes `INVALID_ORDER_MIN_TICK_SIZE` rejections.
