# Hermes Client (TypeScript)

Fetch Pyth price data from Hermes API using `@pythnetwork/hermes-client` and submit on-chain via viem.

## Dependencies

```bash
npm install @pythnetwork/hermes-client@^3.1.0 viem
```

## Fetch Latest Price (Off-Chain Only)

```typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const hermes = new HermesClient("https://hermes.pyth.network");

const BTC_USD = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const SOL_USD = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

async function getLatestPrices() {
  const updates = await hermes.getLatestPriceUpdates([BTC_USD, ETH_USD, SOL_USD]);

  if (!updates.parsed || updates.parsed.length === 0) {
    throw new Error("No parsed price data returned from Hermes");
  }

  for (const feed of updates.parsed) {
    const price = Number(feed.price.price) * Math.pow(10, feed.price.expo);
    const conf = Number(feed.price.conf) * Math.pow(10, feed.price.expo);
    const confPct = (conf / price) * 100;

    console.log(`Feed: ${feed.id}`);
    console.log(`  Price: $${price.toFixed(2)}`);
    console.log(`  Confidence: +/- $${conf.toFixed(2)} (${confPct.toFixed(3)}%)`);
    console.log(`  Published: ${new Date(Number(feed.price.publish_time) * 1000).toISOString()}`);
  }

  return updates;
}
```

## Submit Price Update On-Chain

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { HermesClient } from "@pythnetwork/hermes-client";

const PYTH_ABI = parseAbi([
  "function updatePriceFeeds(bytes[] calldata updateData) external payable",
  "function getUpdateFee(bytes[] calldata updateData) external view returns (uint256)",
  "function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))",
]);

// Arbitrum Pyth address
const PYTH_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C" as Address;
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as `0x${string}`;

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  chain: arbitrum,
  transport: http(process.env.RPC_URL),
});

const hermes = new HermesClient("https://hermes.pyth.network");

async function submitPriceUpdate() {
  const priceUpdates = await hermes.getLatestPriceUpdates([ETH_USD]);

  const updateData = priceUpdates.binary.data.map(
    (hex: string) => `0x${hex}` as `0x${string}`
  );

  // Compute fee dynamically -- never hardcode
  const updateFee = await publicClient.readContract({
    address: PYTH_ADDRESS,
    abi: PYTH_ABI,
    functionName: "getUpdateFee",
    args: [updateData],
  });

  const hash = await walletClient.writeContract({
    address: PYTH_ADDRESS,
    abi: PYTH_ABI,
    functionName: "updatePriceFeeds",
    args: [updateData],
    value: updateFee,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("Price update transaction reverted");
  }

  console.log(`Price updated: ${hash}`);

  // Read the updated price
  const pythPrice = await publicClient.readContract({
    address: PYTH_ADDRESS,
    abi: PYTH_ABI,
    functionName: "getPriceNoOlderThan",
    args: [ETH_USD, 60n],
  });

  const price = Number(pythPrice.price) * Math.pow(10, pythPrice.expo);
  console.log(`ETH/USD: $${price.toFixed(2)}`);

  return { hash, price };
}
```

## SSE Streaming (Real-Time Prices)

```typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const hermes = new HermesClient("https://hermes.pyth.network");
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

async function streamPrices() {
  const eventSource = await hermes.getPriceUpdatesStream([ETH_USD], {
    encoding: "hex",
    parsed: true,
  });

  eventSource.onmessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    if (data.parsed && data.parsed.length > 0) {
      const feed = data.parsed[0];
      const price = Number(feed.price.price) * Math.pow(10, feed.price.expo);
      console.log(`ETH/USD: $${price.toFixed(2)} @ ${new Date().toISOString()}`);
    }
  };

  eventSource.onerror = (error: Event) => {
    console.error("SSE stream error:", error);
    eventSource.close();
  };
}
```

## Notes

- `@pythnetwork/hermes-client` v3.1.0 is the current stable release. It provides type-safe access to Hermes REST and SSE endpoints.
- Feed IDs are the same `bytes32` across all chains. You do not need chain-specific feed IDs.
- Hermes returns `binary.data` as hex strings without the `0x` prefix. Prepend `0x` before passing to contract calls.
- For production workloads, consider running your own Hermes instance to avoid rate limits.
- The SSE stream is useful for frontends that need live price display. The binary data from stream events can be submitted on-chain.
