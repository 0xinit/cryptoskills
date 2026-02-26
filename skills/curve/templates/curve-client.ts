/**
 * Curve Finance Client Template
 *
 * Complete starter template for swapping and providing liquidity on Curve
 * using viem. Covers StableSwap pools (3pool pattern).
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set RPC_URL and PRIVATE_KEY environment variables
 * 3. Import and use the functions
 *
 * Dependencies: viem
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;

if (!RPC_URL) throw new Error("RPC_URL environment variable is required");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY environment variable is required");

const account = privateKeyToAccount(PRIVATE_KEY);

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(RPC_URL),
});

// ============================================================================
// Contract Addresses (Ethereum Mainnet)
// ============================================================================

const THREE_POOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7" as const;
const THREE_POOL_LP = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490" as const;
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;

// ============================================================================
// ABIs
// ============================================================================

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const threePoolAbi = parseAbi([
  "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)",
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
  "function coins(uint256 i) view returns (address)",
  "function add_liquidity(uint256[3] amounts, uint256 min_mint_amount) returns (uint256)",
  "function remove_liquidity(uint256 _amount, uint256[3] min_amounts) returns (uint256[3])",
  "function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 _min_amount) returns (uint256)",
  "function calc_token_amount(uint256[3] amounts, bool is_deposit) view returns (uint256)",
  "function calc_withdraw_one_coin(uint256 _token_amount, int128 i) view returns (uint256)",
  "function get_virtual_price() view returns (uint256)",
  "function balances(uint256 i) view returns (uint256)",
  "function fee() view returns (uint256)",
  "function A() view returns (uint256)",
]);

// ============================================================================
// Token Approval
// ============================================================================

export async function ensureApproval(
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

// ============================================================================
// Token Index Verification
// ============================================================================

export async function verifyTokenIndex(
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

// ============================================================================
// Quoting
// ============================================================================

export async function quoteSwap(
  i: bigint,
  j: bigint,
  amountIn: bigint
): Promise<bigint> {
  return publicClient.readContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "get_dy",
    args: [i, j, amountIn],
  });
}

// ============================================================================
// Swapping
// ============================================================================

export async function swap(params: {
  i: bigint;
  j: bigint;
  tokenIn: Address;
  amountIn: bigint;
  slippageBps: bigint;
}): Promise<{ hash: `0x${string}`; expectedOut: bigint }> {
  const { i, j, tokenIn, amountIn, slippageBps } = params;

  // Quote expected output
  const expectedOut = await quoteSwap(i, j, amountIn);

  // Apply slippage tolerance
  const minDy = expectedOut - (expectedOut * slippageBps) / 10000n;

  // Approve pool to spend tokenIn
  await ensureApproval(tokenIn, THREE_POOL, amountIn);

  // Execute swap
  const { request } = await publicClient.simulateContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "exchange",
    args: [i, j, amountIn, minDy],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Swap reverted");

  return { hash, expectedOut };
}

// ============================================================================
// Liquidity
// ============================================================================

export async function addLiquidity(params: {
  amounts: readonly [bigint, bigint, bigint];
  slippageBps: bigint;
}): Promise<{ hash: `0x${string}`; estimatedLp: bigint }> {
  const { amounts, slippageBps } = params;
  const [daiAmt, usdcAmt, usdtAmt] = amounts;

  // Estimate LP tokens received
  const estimatedLp = await publicClient.readContract({
    address: THREE_POOL,
    abi: threePoolAbi,
    functionName: "calc_token_amount",
    args: [amounts, true],
  });

  const minMintAmount = estimatedLp - (estimatedLp * slippageBps) / 10000n;

  // Approve all tokens with non-zero amounts
  if (daiAmt > 0n) await ensureApproval(DAI, THREE_POOL, daiAmt);
  if (usdcAmt > 0n) await ensureApproval(USDC, THREE_POOL, usdcAmt);
  if (usdtAmt > 0n) await ensureApproval(USDT, THREE_POOL, usdtAmt);

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

export async function removeLiquidityOneCoin(params: {
  lpAmount: bigint;
  coinIndex: bigint;
  slippageBps: bigint;
}): Promise<{ hash: `0x${string}`; estimatedOut: bigint }> {
  const { lpAmount, coinIndex, slippageBps } = params;

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

// ============================================================================
// Pool State
// ============================================================================

export async function getPoolState(): Promise<{
  virtualPrice: bigint;
  balances: readonly [bigint, bigint, bigint];
  amplification: bigint;
  feePercent: number;
}> {
  const [virtualPrice, bal0, bal1, bal2, amplification, fee] = await Promise.all([
    publicClient.readContract({ address: THREE_POOL, abi: threePoolAbi, functionName: "get_virtual_price" }),
    publicClient.readContract({ address: THREE_POOL, abi: threePoolAbi, functionName: "balances", args: [0n] }),
    publicClient.readContract({ address: THREE_POOL, abi: threePoolAbi, functionName: "balances", args: [1n] }),
    publicClient.readContract({ address: THREE_POOL, abi: threePoolAbi, functionName: "balances", args: [2n] }),
    publicClient.readContract({ address: THREE_POOL, abi: threePoolAbi, functionName: "A" }),
    publicClient.readContract({ address: THREE_POOL, abi: threePoolAbi, functionName: "fee" }),
  ]);

  // Fee is in 1e10 precision: 4000000 = 0.04%
  const feePercent = Number(fee) / 1e10 * 100;

  return {
    virtualPrice,
    balances: [bal0, bal1, bal2] as const,
    amplification,
    feePercent,
  };
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  // Verify token indices (3pool: 0=DAI, 1=USDC, 2=USDT)
  await verifyTokenIndex(THREE_POOL, DAI, 0n);
  await verifyTokenIndex(THREE_POOL, USDC, 1n);
  await verifyTokenIndex(THREE_POOL, USDT, 2n);

  // Check pool state
  const poolState = await getPoolState();
  console.log(`Virtual price: ${Number(poolState.virtualPrice) / 1e18}`);
  console.log(`Fee: ${poolState.feePercent.toFixed(4)}%`);
  console.log(`A: ${poolState.amplification}`);

  // Check balance
  const usdcBalance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`USDC balance: ${Number(usdcBalance) / 1e6}`);

  // Quote USDC -> USDT
  const amountIn = 1000_000000n; // 1000 USDC
  const quote = await quoteSwap(1n, 2n, amountIn);
  console.log(`Quote: 1000 USDC -> ${Number(quote) / 1e6} USDT`);

  // Swap USDC -> USDT with 0.1% slippage
  const { hash, expectedOut } = await swap({
    i: 1n,
    j: 2n,
    tokenIn: USDC,
    amountIn,
    slippageBps: 10n,
  });
  console.log(`Swapped: ~${Number(expectedOut) / 1e6} USDT`);
  console.log(`Transaction: ${hash}`);

  // Add single-sided USDC liquidity
  const { hash: lpHash, estimatedLp } = await addLiquidity({
    amounts: [0n, 5000_000000n, 0n], // 5000 USDC only
    slippageBps: 100n, // 1% for single-sided
  });
  console.log(`Minted: ~${Number(estimatedLp) / 1e18} LP tokens`);
  console.log(`Transaction: ${lpHash}`);

  // Check LP balance
  const lpBalance = await publicClient.readContract({
    address: THREE_POOL_LP,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const lpValueUsd = (Number(lpBalance) * Number(poolState.virtualPrice)) / 1e36;
  console.log(`LP balance: ${Number(lpBalance) / 1e18} (~$${lpValueUsd.toFixed(2)})`);
}

main().catch(console.error);
