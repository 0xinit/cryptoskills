# Multicall Patterns

Examples for batching contract reads into a single RPC call using viem's `multicall`.

## Setup

```typescript
import { createPublicClient, http, formatUnits } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## Basic Multicall

```typescript
const results = await client.multicall({
  contracts: [
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      abi: erc20Abi,
      functionName: "balanceOf",
      args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      abi: erc20Abi,
      functionName: "decimals",
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      abi: erc20Abi,
      functionName: "symbol",
    },
  ],
});

// results[0].result -> bigint (balance)
// results[1].result -> number (decimals)
// results[2].result -> string (symbol)
```

## Read Multiple Tokens for One Wallet

```typescript
const TOKENS = [
  { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const, name: "USDC" },
  { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const, name: "USDT" },
  { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const, name: "DAI" },
  { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as const, name: "WBTC" },
] as const;

const wallet = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;

const results = await client.multicall({
  contracts: TOKENS.flatMap((token) => [
    {
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [wallet],
    },
    {
      address: token.address,
      abi: erc20Abi,
      functionName: "decimals" as const,
    },
  ]),
});

// Results come back in the same order as the contracts array
for (let i = 0; i < TOKENS.length; i++) {
  const balanceResult = results[i * 2];
  const decimalsResult = results[i * 2 + 1];

  if (balanceResult.status === "success" && decimalsResult.status === "success") {
    const formatted = formatUnits(
      balanceResult.result as bigint,
      decimalsResult.result as number
    );
    console.log(`${TOKENS[i].name}: ${formatted}`);
  }
}
```

## allowFailure Handling

By default `allowFailure` is `true`. Failed calls return `{ status: "failure", error }` instead of throwing.

```typescript
const results = await client.multicall({
  contracts: [
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      abi: erc20Abi,
      functionName: "balanceOf",
      args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    },
    {
      // This contract might not exist or might revert
      address: "0x0000000000000000000000000000000000000001",
      abi: erc20Abi,
      functionName: "balanceOf",
      args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    },
  ],
  allowFailure: true, // default
});

for (const result of results) {
  if (result.status === "success") {
    console.log("Value:", result.result);
  } else {
    console.error("Failed:", result.error.message);
  }
}
```

Set `allowFailure: false` to throw on the first failure.

```typescript
// Throws if ANY call fails
const results = await client.multicall({
  contracts: [
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      abi: erc20Abi,
      functionName: "balanceOf",
      args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    },
  ],
  allowFailure: false,
});

// results[0] is the raw value (bigint), no status wrapper
```

## Uniswap V3 Pool State in Batch

```typescript
const poolAbi = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  {
    name: "liquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
] as const;

// ETH/USDC 0.3% pool
const POOL = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8" as const;

const [slot0Result, liquidityResult] = await client.multicall({
  contracts: [
    { address: POOL, abi: poolAbi, functionName: "slot0" },
    { address: POOL, abi: poolAbi, functionName: "liquidity" },
  ],
  allowFailure: false,
});

console.log("sqrtPriceX96:", slot0Result[0]);
console.log("tick:", slot0Result[1]);
console.log("liquidity:", liquidityResult);
```

## Gas Savings

Multicall routes through the Multicall3 contract deployed at `0xcA11bde05977b3631167028862bE2a173976CA11` on most EVM chains. One RPC round-trip replaces N individual calls. The gas cost is borne by the Multicall3 contract's `eth_call` execution, not by the caller -- there is no on-chain transaction.
