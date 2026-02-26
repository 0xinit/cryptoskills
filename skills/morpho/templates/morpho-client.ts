/**
 * Morpho Blue Client Template
 *
 * Complete starter template for interacting with Morpho Blue using viem.
 * Includes supply, borrow, repay, withdraw, collateral management,
 * market state reads, and MetaMorpho vault deposits.
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
  encodeAbiParameters,
  keccak256,
  formatUnits,
  type Address,
  type PublicClient,
  type WalletClient,
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

const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as const;
const ADAPTIVE_CURVE_IRM = "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC" as const;

// ============================================================================
// Types
// ============================================================================

export type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

// ============================================================================
// ABIs
// ============================================================================

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const morphoAbi = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "assetsSupplied", type: "uint256" },
      { name: "sharesSupplied", type: "uint256" },
    ],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      { name: "assetsWithdrawn", type: "uint256" },
      { name: "sharesWithdrawn", type: "uint256" },
    ],
  },
  {
    name: "borrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      { name: "assetsBorrowed", type: "uint256" },
      { name: "sharesBorrowed", type: "uint256" },
    ],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "assetsRepaid", type: "uint256" },
      { name: "sharesRepaid", type: "uint256" },
    ],
  },
  {
    name: "supplyCollateral",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "withdrawCollateral",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "accrueInterest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "market",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "totalSupplyAssets", type: "uint128" },
      { name: "totalSupplyShares", type: "uint128" },
      { name: "totalBorrowAssets", type: "uint128" },
      { name: "totalBorrowShares", type: "uint128" },
      { name: "lastUpdate", type: "uint128" },
      { name: "fee", type: "uint128" },
    ],
  },
  {
    name: "position",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
  },
  {
    name: "idToMarketParams",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const vaultAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "maxDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ============================================================================
// Market ID
// ============================================================================

export function computeMarketId(params: MarketParams): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
    ],
    [
      params.loanToken,
      params.collateralToken,
      params.oracle,
      params.irm,
      params.lltv,
    ]
  );
  return keccak256(encoded);
}

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
// Supply (Lender)
// ============================================================================

export async function supplyLoanToken(
  params: MarketParams,
  assets: bigint
): Promise<{ hash: `0x${string}`; assetsSupplied: bigint; sharesSupplied: bigint }> {
  await ensureApproval(params.loanToken, MORPHO, assets);

  const { request, result } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "supply",
    args: [params, assets, 0n, account.address, "0x"],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Supply reverted");

  return { hash, assetsSupplied: result[0], sharesSupplied: result[1] };
}

// ============================================================================
// Withdraw (Lender)
// ============================================================================

export async function withdrawLoanToken(
  params: MarketParams,
  shares: bigint
): Promise<{ hash: `0x${string}`; assetsWithdrawn: bigint }> {
  const { request, result } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "withdraw",
    args: [params, 0n, shares, account.address, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Withdraw reverted");

  return { hash, assetsWithdrawn: result[0] };
}

// ============================================================================
// Supply Collateral (Borrower)
// ============================================================================

export async function supplyCollateral(
  params: MarketParams,
  assets: bigint
): Promise<`0x${string}`> {
  await ensureApproval(params.collateralToken, MORPHO, assets);

  const { request } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "supplyCollateral",
    args: [params, assets, account.address, "0x"],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Supply collateral reverted");

  return hash;
}

// ============================================================================
// Borrow (Borrower)
// ============================================================================

export async function borrow(
  params: MarketParams,
  assets: bigint
): Promise<{ hash: `0x${string}`; assetsBorrowed: bigint }> {
  const { request, result } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "borrow",
    args: [params, assets, 0n, account.address, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Borrow reverted");

  return { hash, assetsBorrowed: result[0] };
}

// ============================================================================
// Repay (Borrower)
// ============================================================================

export async function repayByShares(
  params: MarketParams,
  shares: bigint,
  maxApproval: bigint
): Promise<{ hash: `0x${string}`; assetsRepaid: bigint }> {
  await ensureApproval(params.loanToken, MORPHO, maxApproval);

  const { request, result } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "repay",
    args: [params, 0n, shares, account.address, "0x"],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Repay reverted");

  return { hash, assetsRepaid: result[0] };
}

// ============================================================================
// Withdraw Collateral (Borrower)
// ============================================================================

export async function withdrawCollateral(
  params: MarketParams,
  assets: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "withdrawCollateral",
    args: [params, assets, account.address, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Withdraw collateral reverted");

  return hash;
}

// ============================================================================
// Read State
// ============================================================================

export async function getMarketState(marketId: `0x${string}`) {
  const data = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "market",
    args: [marketId],
  });

  return {
    totalSupplyAssets: data[0],
    totalSupplyShares: data[1],
    totalBorrowAssets: data[2],
    totalBorrowShares: data[3],
    lastUpdate: data[4],
    fee: data[5],
  };
}

export async function getPosition(marketId: `0x${string}`, user: Address) {
  const data = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "position",
    args: [marketId, user],
  });

  return {
    supplyShares: data[0],
    borrowShares: data[1],
    collateral: data[2],
  };
}

// ============================================================================
// MetaMorpho Vault
// ============================================================================

export async function depositToVault(
  vaultAddress: Address,
  assetAddress: Address,
  amount: bigint
): Promise<{ hash: `0x${string}`; shares: bigint }> {
  await ensureApproval(assetAddress, vaultAddress, amount);

  const { request, result } = await publicClient.simulateContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "deposit",
    args: [amount, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Vault deposit reverted");

  return { hash, shares: result };
}

export async function redeemFromVault(
  vaultAddress: Address,
  shares: bigint
): Promise<{ hash: `0x${string}`; assets: bigint }> {
  const { request, result } = await publicClient.simulateContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "redeem",
    args: [shares, account.address, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Vault redeem reverted");

  return { hash, assets: result };
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;

  const marketParams: MarketParams = {
    loanToken: USDC,
    collateralToken: WETH,
    oracle: "0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2" as Address,
    irm: ADAPTIVE_CURVE_IRM as Address,
    lltv: 860000000000000000n,
  };

  const marketId = computeMarketId(marketParams);
  console.log(`Market ID: ${marketId}`);

  // Read market state
  const state = await getMarketState(marketId);
  console.log(`Total supply: ${state.totalSupplyAssets}`);
  console.log(`Total borrow: ${state.totalBorrowAssets}`);

  // Read position
  const position = await getPosition(marketId, account.address);
  console.log(`Supply shares: ${position.supplyShares}`);
  console.log(`Borrow shares: ${position.borrowShares}`);
  console.log(`Collateral: ${position.collateral}`);
}

main().catch(console.error);
