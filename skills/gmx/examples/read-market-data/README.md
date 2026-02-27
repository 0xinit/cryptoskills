# Read GMX V2 Market Data

Query market information, positions, and orders from the GMX V2 Reader contract on Arbitrum. Includes multicall patterns for efficient batched reads.

## Prerequisites

```bash
npm install viem
```

Environment variables:
- `ARBITRUM_RPC_URL` — Arbitrum RPC endpoint

## Step 1: Setup Public Client

```typescript
import { createPublicClient, http, formatEther, type Address } from "viem";
import { arbitrum } from "viem/chains";

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const READER = "0x22199a49A999c351eF7927602CFB187ec3cae489" as const;
const DATA_STORE = "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8" as const;
```

## Step 2: Fetch All Markets

```typescript
const getMarketsAbi = [
  {
    name: "getMarkets",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dataStore", type: "address" },
      { name: "start", type: "uint256" },
      { name: "end", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "marketToken", type: "address" },
          { name: "indexToken", type: "address" },
          { name: "longToken", type: "address" },
          { name: "shortToken", type: "address" },
        ],
      },
    ],
  },
] as const;

const markets = await publicClient.readContract({
  address: READER,
  abi: getMarketsAbi,
  functionName: "getMarkets",
  args: [DATA_STORE, 0n, 100n],
});

for (const market of markets) {
  console.log("Market:", market.marketToken);
  console.log("  Index token:", market.indexToken);
  console.log("  Long token:", market.longToken);
  console.log("  Short token:", market.shortToken);
}
```

## Step 3: Fetch Account Positions

```typescript
const ACCOUNT = "0xYourAddressHere" as Address;

const getPositionsAbi = [
  {
    name: "getAccountPositions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dataStore", type: "address" },
      { name: "account", type: "address" },
      { name: "start", type: "uint256" },
      { name: "end", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          {
            name: "addresses",
            type: "tuple",
            components: [
              { name: "account", type: "address" },
              { name: "market", type: "address" },
              { name: "collateralToken", type: "address" },
            ],
          },
          {
            name: "numbers",
            type: "tuple",
            components: [
              { name: "sizeInUsd", type: "uint256" },
              { name: "sizeInTokens", type: "uint256" },
              { name: "collateralAmount", type: "uint256" },
              { name: "borrowingFactor", type: "uint256" },
              { name: "fundingFeeAmountPerSize", type: "uint256" },
              { name: "longTokenClaimableFundingAmountPerSize", type: "uint256" },
              { name: "shortTokenClaimableFundingAmountPerSize", type: "uint256" },
              { name: "increasedAtTime", type: "uint256" },
              { name: "decreasedAtTime", type: "uint256" },
            ],
          },
          {
            name: "flags",
            type: "tuple",
            components: [{ name: "isLong", type: "bool" }],
          },
        ],
      },
    ],
  },
] as const;

const positions = await publicClient.readContract({
  address: READER,
  abi: getPositionsAbi,
  functionName: "getAccountPositions",
  args: [DATA_STORE, ACCOUNT, 0n, 100n],
});

// 30-decimal USD values
const fromUsd30 = (value: bigint) => Number(value / 10n ** 24n) / 1e6;

for (const position of positions) {
  console.log("Position:");
  console.log("  Market:", position.addresses.market);
  console.log("  Direction:", position.flags.isLong ? "LONG" : "SHORT");
  console.log("  Size (USD):", fromUsd30(position.numbers.sizeInUsd));
  console.log("  Collateral:", position.numbers.collateralAmount);
  console.log("  Size (tokens):", position.numbers.sizeInTokens);
}
```

## Step 4: Fetch Account Orders

```typescript
const getOrdersAbi = [
  {
    name: "getAccountOrders",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dataStore", type: "address" },
      { name: "account", type: "address" },
      { name: "start", type: "uint256" },
      { name: "end", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          {
            name: "addresses",
            type: "tuple",
            components: [
              { name: "account", type: "address" },
              { name: "receiver", type: "address" },
              { name: "cancellationReceiver", type: "address" },
              { name: "callbackContract", type: "address" },
              { name: "uiFeeReceiver", type: "address" },
              { name: "market", type: "address" },
              { name: "initialCollateralToken", type: "address" },
              { name: "swapPath", type: "address[]" },
            ],
          },
          {
            name: "numbers",
            type: "tuple",
            components: [
              { name: "orderType", type: "uint8" },
              { name: "decreasePositionSwapType", type: "uint8" },
              { name: "sizeDeltaUsd", type: "uint256" },
              { name: "initialCollateralDeltaAmount", type: "uint256" },
              { name: "triggerPrice", type: "uint256" },
              { name: "acceptablePrice", type: "uint256" },
              { name: "executionFee", type: "uint256" },
              { name: "callbackGasLimit", type: "uint256" },
              { name: "minOutputAmount", type: "uint256" },
              { name: "updatedAtBlock", type: "uint256" },
              { name: "updatedAtTime", type: "uint256" },
            ],
          },
          {
            name: "flags",
            type: "tuple",
            components: [
              { name: "isLong", type: "bool" },
              { name: "shouldUnwrapNativeToken", type: "bool" },
              { name: "isFrozen", type: "bool" },
              { name: "autoCancel", type: "bool" },
            ],
          },
        ],
      },
    ],
  },
] as const;

const orders = await publicClient.readContract({
  address: READER,
  abi: getOrdersAbi,
  functionName: "getAccountOrders",
  args: [DATA_STORE, ACCOUNT, 0n, 100n],
});

const ORDER_TYPE_NAMES: Record<number, string> = {
  0: "MarketSwap",
  1: "LimitSwap",
  2: "MarketIncrease",
  3: "LimitIncrease",
  4: "MarketDecrease",
  5: "LimitDecrease",
  6: "StopLossDecrease",
  7: "Liquidation",
};

for (const order of orders) {
  const typeName = ORDER_TYPE_NAMES[order.numbers.orderType] ?? "Unknown";
  console.log(`Order: ${typeName}`);
  console.log("  Market:", order.addresses.market);
  console.log("  Direction:", order.flags.isLong ? "LONG" : "SHORT");
  console.log("  Size (USD):", fromUsd30(order.numbers.sizeDeltaUsd));
  console.log("  Frozen:", order.flags.isFrozen);
}
```

## Step 5: Batched Multicall Reads

Fetch markets, positions, and orders in a single RPC request.

```typescript
const results = await publicClient.multicall({
  contracts: [
    {
      address: READER,
      abi: getMarketsAbi,
      functionName: "getMarkets",
      args: [DATA_STORE, 0n, 100n],
    },
    {
      address: READER,
      abi: getPositionsAbi,
      functionName: "getAccountPositions",
      args: [DATA_STORE, ACCOUNT, 0n, 100n],
    },
    {
      address: READER,
      abi: getOrdersAbi,
      functionName: "getAccountOrders",
      args: [DATA_STORE, ACCOUNT, 0n, 100n],
    },
  ],
});

const [marketsResult, positionsResult, ordersResult] = results;

if (marketsResult.status === "success") {
  console.log("Total markets:", marketsResult.result.length);
}

if (positionsResult.status === "success") {
  console.log("Open positions:", positionsResult.result.length);
}

if (ordersResult.status === "success") {
  console.log("Pending orders:", ordersResult.result.length);
}
```

## Step 6: Read Data via SDK

The `@gmx-io/sdk` provides a higher-level interface for reading market data.

```typescript
import { GmxSdk } from "@gmx-io/sdk";

const sdk = new GmxSdk({
  chainId: 42161,
  rpcUrl: process.env.ARBITRUM_RPC_URL!,
  oracleUrl: "https://arbitrum-api.gmxinfra.io",
  subsquidUrl:
    "https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql",
});

const { marketsInfoData, tokensData } = await sdk.markets.getMarketsInfo();

for (const [address, market] of Object.entries(marketsInfoData)) {
  console.log(`${market.name}: ${address}`);
  console.log(`  Long token: ${market.longToken.symbol}`);
  console.log(`  Short token: ${market.shortToken.symbol}`);
}
```

## Key Points

- **Reader contract is view-only** — all calls are free (no gas) and can be called without a wallet
- **Pagination**: use `start` and `end` params. `getMarkets(dataStore, 0, 100)` fetches the first 100 markets
- **`sizeInUsd` uses 30 decimals** — divide by `10^30` or use the `fromUsd30` helper to get human-readable USD values
- **`collateralAmount` uses the collateral token's decimals** — ETH uses 18 decimals, USDC uses 6 decimals
- **Multicall saves RPC calls** — batch Reader queries into a single `publicClient.multicall()` call instead of individual reads
- **SDK vs direct reads**: the SDK adds market metadata (names, symbols, pricing) on top of raw contract reads. Use direct reads for minimal dependencies.
