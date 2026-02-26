# Swap Tokens on Curve 3pool

Working TypeScript example for swapping USDC to USDT on Curve 3pool using viem.

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

const THREE_POOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;
```

## ABIs

```typescript
const threePoolAbi = parseAbi([
  "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)",
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
  "function coins(uint256 i) view returns (address)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);
```

## Verify Token Indices

Token indices are pool-specific. Never assume ordering — always verify on-chain.

```typescript
async function verifyTokenIndex(
  pool: Address,
  expectedToken: Address,
  index: bigint
): Promise<void> {
  const coin = await publicClient.readContract({
    address: pool,
    abi: threePoolAbi,
    functionName: "coins",
    args: [index],
  });

  if (coin.toLowerCase() !== expectedToken.toLowerCase()) {
    throw new Error(
      `Token mismatch at index ${index}: expected ${expectedToken}, got ${coin}`
    );
  }
}

// 3pool indices: 0 = DAI, 1 = USDC, 2 = USDT
await verifyTokenIndex(THREE_POOL, USDC, 1n);
await verifyTokenIndex(THREE_POOL, USDT, 2n);
```

## Token Approval

USDT requires resetting allowance to 0 before setting a new value. USDC does not have this restriction.

```typescript
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

  // USDT requires reset to 0 before setting new allowance
  if (token === USDT && allowance > 0n) {
    const { request: resetReq } = await publicClient.simulateContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, 0n],
      account: account.address,
    });
    const resetHash = await walletClient.writeContract(resetReq);
    await publicClient.waitForTransactionReceipt({ hash: resetHash });
  }

  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Approval failed for ${token}`);
}
```

## Quote Before Swapping

Always quote with `get_dy()` to determine the minimum acceptable output.

```typescript
async function quoteSwap(
  pool: Address,
  i: bigint,
  j: bigint,
  amountIn: bigint
): Promise<bigint> {
  return publicClient.readContract({
    address: pool,
    abi: threePoolAbi,
    functionName: "get_dy",
    args: [i, j, amountIn],
  });
}
```

## Execute Swap (USDC to USDT)

```typescript
async function swapUsdcToUsdt(
  amountIn: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; expectedOut: bigint }> {
  // Quote expected output
  const expectedOut = await quoteSwap(THREE_POOL, 1n, 2n, amountIn);

  // Apply slippage tolerance
  const minDy = expectedOut - (expectedOut * slippageBps) / 10000n;

  // Approve pool to spend USDC
  await ensureApproval(USDC, THREE_POOL, amountIn);

  // Execute swap: i=1 (USDC) -> j=2 (USDT)
  const { request } = await publicClient.simulateContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "exchange",
    args: [1n, 2n, amountIn, minDy],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Swap reverted");

  return { hash, expectedOut };
}
```

## Parse Swap Event from Receipt

Curve pools emit `TokenExchange` events (Vyper-generated) on swaps.

```typescript
const tokenExchangeAbi = parseAbi([
  "event TokenExchange(address indexed buyer, int128 sold_id, uint256 tokens_sold, int128 bought_id, uint256 tokens_bought)",
]);

import { decodeEventLog } from "viem";

function parseTokenExchange(receipt: {
  logs: readonly {
    topics: readonly `0x${string}`[];
    data: `0x${string}`;
    address: Address;
  }[];
}) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: tokenExchangeAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "TokenExchange") {
        return {
          buyer: decoded.args.buyer,
          soldId: decoded.args.sold_id,
          tokensSold: decoded.args.tokens_sold,
          boughtId: decoded.args.bought_id,
          tokensBought: decoded.args.tokens_bought,
          pool: log.address,
        };
      }
    } catch {
      // Log doesn't match TokenExchange, skip
    }
  }
  return null;
}
```

## Complete Usage

```typescript
async function main() {
  const amountIn = 10_000_000000n; // 10,000 USDC (6 decimals)
  const slippageBps = 10n; // 0.1% — tight for stableswap

  // Check balance
  const balance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance < amountIn) {
    throw new Error(`Insufficient USDC: have ${balance}, need ${amountIn}`);
  }

  const { hash, expectedOut } = await swapUsdcToUsdt(amountIn, slippageBps);

  console.log(`Swapped 10,000 USDC for ~${Number(expectedOut) / 1e6} USDT`);
  console.log(`Transaction: ${hash}`);
}

main().catch(console.error);
```
