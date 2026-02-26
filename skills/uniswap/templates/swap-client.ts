/**
 * Uniswap V3 Swap Client Template
 *
 * Complete starter template for swapping on Uniswap V3 using viem.
 * Includes token approval, quoting, and exact input swaps.
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
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
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

const SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const;
const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const;

// ============================================================================
// ABIs
// ============================================================================

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
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
// Quoting
// ============================================================================

export async function quoteExactInputSingle(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number
): Promise<{ amountOut: bigint; gasEstimate: bigint }> {
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

  return { amountOut: result[0], gasEstimate: result[3] };
}

// ============================================================================
// Swapping
// ============================================================================

export async function swapExactInputSingle(params: {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  amountIn: bigint;
  slippageBps: bigint;
}): Promise<{ hash: `0x${string}`; amountOut: bigint }> {
  const { tokenIn, tokenOut, fee, amountIn, slippageBps } = params;

  // Quote expected output
  const { amountOut: quotedOut } = await quoteExactInputSingle(
    tokenIn,
    tokenOut,
    amountIn,
    fee
  );

  // Apply slippage tolerance
  const amountOutMinimum = quotedOut - (quotedOut * slippageBps) / 10000n;

  // Approve router
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

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

  // Check balance
  const balance = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`WETH balance: ${balance}`);

  // Quote
  const { amountOut, gasEstimate } = await quoteExactInputSingle(
    WETH,
    USDC,
    1_000_000_000_000_000_000n, // 1 WETH
    500 // 0.05% fee tier
  );
  console.log(`Quote: ${Number(amountOut) / 1e6} USDC`);
  console.log(`Estimated gas: ${gasEstimate}`);

  // Swap 1 WETH -> USDC with 0.5% slippage
  const { hash, amountOut: received } = await swapExactInputSingle({
    tokenIn: WETH,
    tokenOut: USDC,
    fee: 500,
    amountIn: 1_000_000_000_000_000_000n,
    slippageBps: 50n,
  });

  console.log(`Received: ${Number(received) / 1e6} USDC`);
  console.log(`Transaction: ${hash}`);
}

main().catch(console.error);
