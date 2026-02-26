# Multi-Hop Swap Examples

Multi-hop swaps route through multiple pools when no direct pool exists or when an intermediate route provides better pricing. Uses SwapRouter02's `exactInput` with encoded paths.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  encodePacked,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const;
const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const;

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as const;
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;
```

## Path Encoding

Multi-hop paths are ABI-packed as: `tokenIn + fee + intermediateToken + fee + tokenOut`. Each segment is `address(20 bytes) + uint24(3 bytes)`.

```typescript
// Two-hop path: WBTC -> WETH -> USDC
function encodeTwoHopPath(
  tokenIn: Address,
  fee1: number,
  intermediate: Address,
  fee2: number,
  tokenOut: Address
): `0x${string}` {
  return encodePacked(
    ["address", "uint24", "address", "uint24", "address"],
    [tokenIn, fee1, intermediate, fee2, tokenOut]
  );
}

// Three-hop path: DAI -> USDC -> WETH -> WBTC
function encodeThreeHopPath(
  token0: Address,
  fee1: number,
  token1: Address,
  fee2: number,
  token2: Address,
  fee3: number,
  token3: Address
): `0x${string}` {
  return encodePacked(
    ["address", "uint24", "address", "uint24", "address", "uint24", "address"],
    [token0, fee1, token1, fee2, token2, fee3, token3]
  );
}

const wbtcToUsdcPath = encodeTwoHopPath(WBTC, 500, WETH, 500, USDC);
const daiToWbtcPath = encodeThreeHopPath(DAI, 100, USDC, 500, WETH, 500, WBTC);
```

## Quoting Multi-Hop

```typescript
const quoterAbi = parseAbi([
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
]);

async function quoteMultiHop(
  path: `0x${string}`,
  amountIn: bigint
): Promise<{ amountOut: bigint; gasEstimate: bigint }> {
  const { result } = await publicClient.simulateContract({
    address: QUOTER_V2,
    abi: quoterAbi,
    functionName: "quoteExactInput",
    args: [path, amountIn],
  });

  return {
    amountOut: result[0],
    gasEstimate: result[3],
  };
}
```

## Executing Multi-Hop Swap

```typescript
const multiHopAbi = parseAbi([
  "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) payable returns (uint256 amountOut)",
]);

async function swapMultiHop(
  path: `0x${string}`,
  amountIn: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; amountOut: bigint }> {
  // Quote first for slippage calculation
  const { amountOut: quotedOut } = await quoteMultiHop(path, amountIn);
  const amountOutMinimum = quotedOut - (quotedOut * slippageBps) / 10000n;

  const { request, result } = await publicClient.simulateContract({
    address: SWAP_ROUTER_02,
    abi: multiHopAbi,
    functionName: "exactInput",
    args: [
      {
        path,
        recipient: account.address,
        amountIn,
        amountOutMinimum,
      },
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Multi-hop swap reverted");

  return { hash, amountOut: result };
}
```

## Comparing Single-Hop vs Multi-Hop Pricing

For some pairs, routing through an intermediate token yields more output due to deeper liquidity in the intermediate pools.

```typescript
const singleHopQuoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

async function compareSingleVsMultiHop(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
) {
  // Try direct single-hop at each fee tier
  const feeTiers = [100, 500, 3000, 10000];
  const singleHopQuotes: { fee: number; amountOut: bigint; gas: bigint }[] = [];

  for (const fee of feeTiers) {
    try {
      const { result } = await publicClient.simulateContract({
        address: QUOTER_V2,
        abi: singleHopQuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      singleHopQuotes.push({ fee, amountOut: result[0], gas: result[3] });
    } catch {
      // Pool doesn't exist or has no liquidity at this fee tier
    }
  }

  // Try multi-hop through WETH
  const multiHopPaths = [
    { label: "via WETH (0.05%/0.05%)", path: encodeTwoHopPath(tokenIn, 500, WETH, 500, tokenOut) },
    { label: "via WETH (0.3%/0.05%)", path: encodeTwoHopPath(tokenIn, 3000, WETH, 500, tokenOut) },
    { label: "via USDC (0.05%/0.05%)", path: encodeTwoHopPath(tokenIn, 500, USDC, 500, tokenOut) },
  ];

  const multiHopQuotes: { label: string; amountOut: bigint; gas: bigint }[] = [];

  for (const { label, path } of multiHopPaths) {
    try {
      const quote = await quoteMultiHop(path, amountIn);
      multiHopQuotes.push({ label, ...quote });
    } catch {
      // Route not viable
    }
  }

  // Find best route
  const allQuotes = [
    ...singleHopQuotes.map((q) => ({
      label: `Direct (${q.fee / 10000}%)`,
      amountOut: q.amountOut,
      gas: q.gas,
    })),
    ...multiHopQuotes,
  ];

  allQuotes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));

  console.log("Route comparison:");
  for (const q of allQuotes) {
    console.log(`  ${q.label}: ${q.amountOut} out, ~${q.gas} gas`);
  }

  return allQuotes[0];
}
```

## Gas Estimation

Multi-hop swaps use more gas than single-hop. Each additional hop costs roughly 80,000-120,000 additional gas depending on pool state.

```typescript
async function estimateSwapGas(
  path: `0x${string}`,
  amountIn: bigint
): Promise<bigint> {
  const amountOutMinimum = 0n; // Only for estimation -- never use 0n in production

  const gas = await publicClient.estimateContractGas({
    address: SWAP_ROUTER_02,
    abi: multiHopAbi,
    functionName: "exactInput",
    args: [
      {
        path,
        recipient: account.address,
        amountIn,
        amountOutMinimum,
      },
    ],
    account: account.address,
  });

  return gas;
}
```

## Complete Usage

```typescript
async function main() {
  // Swap 0.1 WBTC to USDC via WETH
  const amountIn = 10_000_000n; // 0.1 WBTC (8 decimals)
  const path = encodeTwoHopPath(WBTC, 500, WETH, 500, USDC);
  const slippageBps = 50n; // 0.5%

  const { hash, amountOut } = await swapMultiHop(path, amountIn, slippageBps);

  const usdcReceived = Number(amountOut) / 1e6;
  console.log(`Swapped 0.1 WBTC for ${usdcReceived} USDC`);
  console.log(`Transaction: ${hash}`);
}

main().catch(console.error);
```
