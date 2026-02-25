/**
 * Compound V3 (Comet) Client Template
 *
 * Complete starter template for interacting with Compound V3 using viem.
 * Includes supply, borrow, repay, withdraw, read state, and claim rewards.
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
  parseUnits,
  formatUnits,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  BaseError,
  ContractFunctionRevertedError,
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

const COMET_USDC = "0xc3d688B66703497DAA19211EEdff47f25384cdc3" as const;
const COMET_REWARDS = "0x1B0e765F6224C21223AeA2af16c1C46E38885a40" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

// ============================================================================
// ABIs
// ============================================================================

const cometAbi = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "borrowBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "collateralBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    name: "isLiquidatable",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getAssetInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "i", type: "uint8" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "offset", type: "uint8" },
          { name: "asset", type: "address" },
          { name: "priceFeed", type: "address" },
          { name: "scale", type: "uint64" },
          { name: "borrowCollateralFactor", type: "uint64" },
          { name: "liquidateCollateralFactor", type: "uint64" },
          { name: "liquidationFactor", type: "uint64" },
          { name: "supplyCap", type: "uint128" },
        ],
      },
    ],
  },
  {
    name: "numAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "baseToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getUtilization",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSupplyRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "getBorrowRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "priceFeed", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalBorrow",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
] as const;

const cometRewardsAbi = [
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "comet", type: "address" },
      { name: "src", type: "address" },
      { name: "shouldAccrue", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "getRewardOwed",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "comet", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "owed", type: "uint256" },
        ],
      },
    ],
  },
] as const;

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
// Supply (Base Asset = Earn Interest, Collateral = Backs Borrows)
// ============================================================================

export async function supplyToComet(
  comet: Address,
  asset: Address,
  amount: bigint
): Promise<`0x${string}`> {
  await ensureApproval(asset, comet, amount);

  const { request } = await publicClient.simulateContract({
    address: comet,
    abi: cometAbi,
    functionName: "supply",
    args: [asset, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Supply reverted");

  return hash;
}

// ============================================================================
// Borrow (Withdraw base asset when you have collateral)
// ============================================================================

export async function borrowFromComet(
  comet: Address,
  baseAsset: Address,
  amount: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: comet,
    abi: cometAbi,
    functionName: "withdraw",
    args: [baseAsset, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Borrow reverted");

  return hash;
}

// ============================================================================
// Repay (Supply base asset to reduce negative balance)
// ============================================================================

export async function repayToComet(
  comet: Address,
  baseAsset: Address,
  amount: bigint
): Promise<`0x${string}`> {
  await ensureApproval(baseAsset, comet, amount);

  const { request } = await publicClient.simulateContract({
    address: comet,
    abi: cometAbi,
    functionName: "supply",
    args: [baseAsset, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Repay reverted");

  return hash;
}

// ============================================================================
// Withdraw (Base asset or collateral)
// ============================================================================

export async function withdrawFromComet(
  comet: Address,
  asset: Address,
  amount: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: comet,
    abi: cometAbi,
    functionName: "withdraw",
    args: [asset, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Withdraw reverted");

  return hash;
}

// ============================================================================
// Read Account State
// ============================================================================

interface AccountState {
  baseSupplied: bigint;
  baseBorrowed: bigint;
  collaterals: { asset: Address; balance: bigint }[];
  isLiquidatable: boolean;
}

export async function getAccountState(
  comet: Address,
  userAddress: Address
): Promise<AccountState> {
  const [baseSupplied, baseBorrowed, numAssets, isLiquidatable] =
    await Promise.all([
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "balanceOf",
        args: [userAddress],
      }),
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "borrowBalanceOf",
        args: [userAddress],
      }),
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "numAssets",
      }),
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "isLiquidatable",
        args: [userAddress],
      }),
    ]);

  const collaterals: { asset: Address; balance: bigint }[] = [];

  for (let i = 0; i < numAssets; i++) {
    const assetInfo = await publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "getAssetInfo",
      args: [i],
    });

    const balance = await publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "collateralBalanceOf",
      args: [userAddress, assetInfo.asset],
    });

    if (balance > 0n) {
      collaterals.push({ asset: assetInfo.asset, balance: BigInt(balance) });
    }
  }

  return { baseSupplied, baseBorrowed, collaterals, isLiquidatable };
}

// ============================================================================
// Read Market Rates
// ============================================================================

interface MarketInfo {
  utilization: bigint;
  supplyApr: number;
  borrowApr: number;
  totalSupply: bigint;
  totalBorrow: bigint;
}

export async function getMarketInfo(comet: Address): Promise<MarketInfo> {
  const utilization = await publicClient.readContract({
    address: comet,
    abi: cometAbi,
    functionName: "getUtilization",
  });

  const [supplyRate, borrowRate, totalSupply, totalBorrow] = await Promise.all([
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "getSupplyRate",
      args: [utilization],
    }),
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "getBorrowRate",
      args: [utilization],
    }),
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "totalSupply",
    }),
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "totalBorrow",
    }),
  ]);

  const SECONDS_PER_YEAR = 31_536_000n;
  const supplyApr = Number(supplyRate * SECONDS_PER_YEAR) / 1e18;
  const borrowApr = Number(borrowRate * SECONDS_PER_YEAR) / 1e18;

  return { utilization, supplyApr, borrowApr, totalSupply, totalBorrow };
}

// ============================================================================
// Claim Rewards
// ============================================================================

export async function claimRewards(
  comet: Address,
  rewardsContract: Address
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: rewardsContract,
    abi: cometRewardsAbi,
    functionName: "claim",
    args: [comet, account.address, true],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Claim reverted");

  return hash;
}

// ============================================================================
// Error Handling
// ============================================================================

export function decodeCometError(err: unknown): string {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      return revertError.data?.errorName ?? "Unknown Comet error";
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  // Check market info
  const market = await getMarketInfo(COMET_USDC);
  console.log(`Supply APR: ${(market.supplyApr * 100).toFixed(2)}%`);
  console.log(`Borrow APR: ${(market.borrowApr * 100).toFixed(2)}%`);
  console.log(`Total Supply: ${formatUnits(market.totalSupply, 6)} USDC`);
  console.log(`Total Borrow: ${formatUnits(market.totalBorrow, 6)} USDC`);

  // Supply 1,000 USDC to earn interest
  const supplyHash = await supplyToComet(
    COMET_USDC,
    USDC,
    parseUnits("1000", 6)
  );
  console.log(`Supplied: ${supplyHash}`);

  // Supply 1 WETH as collateral
  const collateralHash = await supplyToComet(
    COMET_USDC,
    WETH,
    parseUnits("1", 18)
  );
  console.log(`Collateral supplied: ${collateralHash}`);

  // Borrow 500 USDC
  const borrowHash = await borrowFromComet(
    COMET_USDC,
    USDC,
    parseUnits("500", 6)
  );
  console.log(`Borrowed: ${borrowHash}`);

  // Read account state
  const state = await getAccountState(COMET_USDC, account.address);
  console.log(`Base supplied: ${formatUnits(state.baseSupplied, 6)} USDC`);
  console.log(`Base borrowed: ${formatUnits(state.baseBorrowed, 6)} USDC`);
  console.log(`Liquidatable: ${state.isLiquidatable}`);

  // Claim COMP rewards
  const claimHash = await claimRewards(COMET_USDC, COMET_REWARDS);
  console.log(`Claimed rewards: ${claimHash}`);

  // Repay 500 USDC
  const repayHash = await repayToComet(
    COMET_USDC,
    USDC,
    parseUnits("500", 6)
  );
  console.log(`Repaid: ${repayHash}`);

  // Withdraw 1 WETH collateral
  const withdrawHash = await withdrawFromComet(
    COMET_USDC,
    WETH,
    parseUnits("1", 18)
  );
  console.log(`Withdrawn: ${withdrawHash}`);
}

main().catch((err) => {
  console.error(`Failed: ${decodeCometError(err)}`);
  process.exit(1);
});
