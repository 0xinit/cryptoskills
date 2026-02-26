# Exact Input Swap Examples

Working TypeScript examples for exact input swaps on Uniswap V3 using viem and SwapRouter02.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
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
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const;
```

## Token Approval

Before any swap, the router must be approved to spend your tokens. This is a one-time operation per token/spender pair.

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

async function ensureApproval(
  token: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, spender],
  });

  if (allowance >= amount) return;

  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Approval reverted");
}
```

## Quote Before Swapping

Always quote first to determine `amountOutMinimum` for slippage protection. Never set it to `0n` in production.

```typescript
const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

async function quoteExactInputSingle(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number
): Promise<bigint> {
  const { result } = await publicClient.simulateContract({
    address: QUOTER_V2,
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  return result[0];
}
```

## Single-Hop Exact Input Swap (WETH to USDC)

```typescript
const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

async function swapExactInputSingle(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  amountIn: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; amountOut: bigint }> {
  // Quote expected output
  const quotedOut = await quoteExactInputSingle(tokenIn, tokenOut, amountIn, fee);

  // Apply slippage tolerance (e.g. 50 = 0.5%)
  const amountOutMinimum = quotedOut - (quotedOut * slippageBps) / 10000n;

  // Approve router to spend tokenIn
  await ensureApproval(tokenIn, SWAP_ROUTER_02, amountIn);

  // Execute swap
  const { request, result } = await publicClient.simulateContract({
    address: SWAP_ROUTER_02,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee,
        recipient: account.address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Swap reverted");

  return { hash, amountOut: result };
}
```

## Reading Swap Result from Transaction Receipt

The swap emits a `Swap` event on the pool contract. Decode it from the receipt logs.

```typescript
import { decodeEventLog } from "viem";

const poolEventAbi = parseAbi([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
]);

function parseSwapEvent(receipt: { logs: readonly { topics: readonly `0x${string}`[]; data: `0x${string}`; address: Address }[] }) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: poolEventAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Swap") {
        return {
          amount0: decoded.args.amount0,
          amount1: decoded.args.amount1,
          sqrtPriceX96: decoded.args.sqrtPriceX96,
          tick: decoded.args.tick,
          pool: log.address,
        };
      }
    } catch {
      // Log doesn't match Swap event, skip
    }
  }
  return null;
}
```

## Deadline and Slippage Handling

SwapRouter02's `exactInputSingle` does not include a `deadline` parameter directly -- deadlines are handled via the router's `multicall(uint256 deadline, bytes[] data)` wrapper.

```typescript
const multicallAbi = parseAbi([
  "function multicall(uint256 deadline, bytes[] calldata data) payable returns (bytes[] memory)",
]);

import { encodeFunctionData } from "viem";

async function swapWithDeadline(
  amountIn: bigint,
  amountOutMinimum: bigint,
  deadlineSeconds: number
): Promise<`0x${string}`> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const swapCalldata = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 500,
        recipient: account.address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const { request } = await publicClient.simulateContract({
    address: SWAP_ROUTER_02,
    abi: multicallAbi,
    functionName: "multicall",
    args: [deadline, [swapCalldata]],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Swap reverted");

  return hash;
}
```

## Complete Usage

```typescript
async function main() {
  const amountIn = 1_000_000_000_000_000_000n; // 1 WETH (18 decimals)
  const slippageBps = 50n; // 0.5%

  const { hash, amountOut } = await swapExactInputSingle(
    WETH,
    USDC,
    500, // 0.05% fee tier -- highest WETH/USDC liquidity
    amountIn,
    slippageBps
  );

  // USDC has 6 decimals
  const usdcReceived = Number(amountOut) / 1e6;
  console.log(`Swapped 1 WETH for ${usdcReceived} USDC`);
  console.log(`Transaction: ${hash}`);
}

main().catch(console.error);
```
