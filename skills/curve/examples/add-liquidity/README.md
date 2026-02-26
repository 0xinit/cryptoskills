# Add Liquidity to Curve 3pool

Working TypeScript examples for adding single-sided and balanced liquidity to Curve 3pool using viem.

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
const THREE_POOL_LP = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490" as const;
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;
```

## ABIs

```typescript
const threePoolAbi = parseAbi([
  "function add_liquidity(uint256[3] amounts, uint256 min_mint_amount) returns (uint256)",
  "function calc_token_amount(uint256[3] amounts, bool is_deposit) view returns (uint256)",
  "function remove_liquidity(uint256 _amount, uint256[3] min_amounts) returns (uint256[3])",
  "function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 _min_amount) returns (uint256)",
  "function calc_withdraw_one_coin(uint256 _token_amount, int128 i) view returns (uint256)",
  "function get_virtual_price() view returns (uint256)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);
```

## Token Approval Helper

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

## Add Balanced Liquidity (All Three Tokens)

Providing all tokens proportionally to pool balances minimizes slippage from the imbalance fee.

```typescript
async function addBalancedLiquidity(
  daiAmount: bigint,
  usdcAmount: bigint,
  usdtAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; estimatedLp: bigint }> {
  const amounts: readonly [bigint, bigint, bigint] = [
    daiAmount,
    usdcAmount,
    usdtAmount,
  ];

  // Estimate LP tokens received
  const estimatedLp = await publicClient.readContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "calc_token_amount",
    args: [amounts, true],
  });

  // calc_token_amount slightly overestimates — apply slippage
  const minMintAmount = estimatedLp - (estimatedLp * slippageBps) / 10000n;

  // Approve all tokens with non-zero amounts
  if (daiAmount > 0n) await ensureApproval(DAI, THREE_POOL, daiAmount);
  if (usdcAmount > 0n) await ensureApproval(USDC, THREE_POOL, usdcAmount);
  if (usdtAmount > 0n) await ensureApproval(USDT, THREE_POOL, usdtAmount);

  const { request } = await publicClient.simulateContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "add_liquidity",
    args: [amounts, minMintAmount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Add liquidity reverted");

  return { hash, estimatedLp };
}
```

## Add Single-Sided Liquidity (USDC Only)

Depositing a single token incurs an imbalance fee. The pool internally rebalances, costing slightly more than proportional deposits.

```typescript
async function addSingleSidedUsdc(
  usdcAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; estimatedLp: bigint }> {
  const amounts: readonly [bigint, bigint, bigint] = [0n, usdcAmount, 0n];

  const estimatedLp = await publicClient.readContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "calc_token_amount",
    args: [amounts, true],
  });

  // Wider slippage for single-sided (imbalance fee applies)
  const minMintAmount = estimatedLp - (estimatedLp * slippageBps) / 10000n;

  await ensureApproval(USDC, THREE_POOL, usdcAmount);

  const { request } = await publicClient.simulateContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "add_liquidity",
    args: [amounts, minMintAmount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Add liquidity reverted");

  return { hash, estimatedLp };
}
```

## Remove Liquidity (Proportional)

Withdrawing proportionally across all tokens has no imbalance fee.

```typescript
async function removeProportional(
  lpAmount: bigint
): Promise<`0x${string}`> {
  // Proportional withdraw has no slippage from imbalance
  // Still set min_amounts to protect against extreme scenarios
  const minAmounts: readonly [bigint, bigint, bigint] = [0n, 0n, 0n]; // SET IN PRODUCTION

  const { request } = await publicClient.simulateContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "remove_liquidity",
    args: [lpAmount, minAmounts],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Remove liquidity reverted");

  return hash;
}
```

## Remove Liquidity as Single Coin

Withdraw all LP value as a single token. Incurs imbalance fee on large withdrawals.

```typescript
async function removeAsSingleCoin(
  lpAmount: bigint,
  coinIndex: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; estimatedOut: bigint }> {
  const estimatedOut = await publicClient.readContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "calc_withdraw_one_coin",
    args: [lpAmount, coinIndex],
  });

  const minAmount = estimatedOut - (estimatedOut * slippageBps) / 10000n;

  const { request } = await publicClient.simulateContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "remove_liquidity_one_coin",
    args: [lpAmount, coinIndex, minAmount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Remove liquidity reverted");

  return { hash, estimatedOut };
}
```

## Complete Usage

```typescript
async function main() {
  // --- Add balanced liquidity ---
  const { hash: addHash, estimatedLp } = await addBalancedLiquidity(
    1000_000000000000000000n, // 1000 DAI (18 decimals)
    1000_000000n,             // 1000 USDC (6 decimals)
    1000_000000n,             // 1000 USDT (6 decimals)
    50n                       // 0.5% slippage
  );
  console.log(`Added liquidity: ~${Number(estimatedLp) / 1e18} LP tokens`);
  console.log(`Transaction: ${addHash}`);

  // --- Add single-sided USDC ---
  const { hash: singleHash, estimatedLp: singleLp } = await addSingleSidedUsdc(
    5000_000000n, // 5000 USDC
    100n          // 1% slippage (wider for single-sided)
  );
  console.log(`Single-sided deposit: ~${Number(singleLp) / 1e18} LP tokens`);

  // --- Check LP balance ---
  const lpBalance = await publicClient.readContract({
    address: THREE_POOL_LP,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`LP token balance: ${Number(lpBalance) / 1e18}`);

  // --- Check LP value ---
  const virtualPrice = await publicClient.readContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "get_virtual_price",
  });
  const totalValueUsd = (Number(lpBalance) * Number(virtualPrice)) / 1e36;
  console.log(`LP position value: ~$${totalValueUsd.toFixed(2)}`);

  // --- Remove as single USDC ---
  const withdrawLp = lpBalance / 2n; // withdraw half
  const { hash: removeHash, estimatedOut } = await removeAsSingleCoin(
    withdrawLp,
    1n,  // index 1 = USDC
    50n  // 0.5% slippage
  );
  console.log(`Withdrew ~${Number(estimatedOut) / 1e6} USDC`);
  console.log(`Transaction: ${removeHash}`);
}

main().catch(console.error);
```
