/**
 * Aave V3 Lending Client Template
 *
 * Complete starter template for Aave V3 lending using viem.
 *
 * Features:
 * - Supply ERC20 tokens
 * - Borrow at variable rate
 * - Repay loans
 * - Withdraw collateral
 * - Health factor monitoring
 * - getUserAccountData helper
 *
 * Usage:
 * 1. Copy this file into your project
 * 2. Set PRIVATE_KEY and RPC_URL environment variables
 * 3. Import and use the AaveLendingClient class
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  maxUint256,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum, optimism, base, polygon } from "viem/chains";

// Pool addresses per chain (Aave V3 Main market)
const POOL_ADDRESSES: Record<number, Address> = {
  1: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  10: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  8453: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  137: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
};

const VARIABLE_RATE = 2n;

const poolAbi = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "borrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "referralCode", type: "uint16" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
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
] as const;

interface AccountData {
  collateralUsd: number;
  debtUsd: number;
  availableBorrowsUsd: number;
  ltvPct: number;
  liquidationThresholdPct: number;
  healthFactor: number;
  isLiquidatable: boolean;
}

export class AaveLendingClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient<Transport, Chain, Account>;
  private pool: Address;
  private account: Account;

  constructor(chain: Chain, rpcUrl: string, privateKey: `0x${string}`) {
    const account = privateKeyToAccount(privateKey);
    this.account = account;

    const poolAddress = POOL_ADDRESSES[chain.id];
    if (!poolAddress) {
      throw new Error(`Aave V3 Pool not configured for chain ${chain.id}`);
    }
    this.pool = poolAddress;

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
  }

  async supply(asset: Address, amount: bigint): Promise<`0x${string}`> {
    const approveHash = await this.walletClient.writeContract({
      address: asset,
      abi: erc20Abi,
      functionName: "approve",
      args: [this.pool, amount],
    });
    await this.publicClient.waitForTransactionReceipt({ hash: approveHash });

    const hash = await this.walletClient.writeContract({
      address: this.pool,
      abi: poolAbi,
      functionName: "supply",
      args: [asset, amount, this.account.address, 0],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Supply transaction reverted");
    }

    return hash;
  }

  async borrow(asset: Address, amount: bigint): Promise<`0x${string}`> {
    const { healthFactor } = await this.getAccountData();
    if (healthFactor < 1.5) {
      throw new Error(`Health factor ${healthFactor.toFixed(4)} too low to borrow safely`);
    }

    const hash = await this.walletClient.writeContract({
      address: this.pool,
      abi: poolAbi,
      functionName: "borrow",
      args: [asset, amount, VARIABLE_RATE, 0, this.account.address],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Borrow transaction reverted");
    }

    return hash;
  }

  async repay(asset: Address, amount: bigint): Promise<`0x${string}`> {
    const approveHash = await this.walletClient.writeContract({
      address: asset,
      abi: erc20Abi,
      functionName: "approve",
      args: [this.pool, amount],
    });
    await this.publicClient.waitForTransactionReceipt({ hash: approveHash });

    const hash = await this.walletClient.writeContract({
      address: this.pool,
      abi: poolAbi,
      functionName: "repay",
      args: [asset, amount, VARIABLE_RATE, this.account.address],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Repay transaction reverted");
    }

    return hash;
  }

  async repayAll(asset: Address): Promise<`0x${string}`> {
    return this.repay(asset, maxUint256);
  }

  async withdraw(asset: Address, amount: bigint): Promise<`0x${string}`> {
    const hash = await this.walletClient.writeContract({
      address: this.pool,
      abi: poolAbi,
      functionName: "withdraw",
      args: [asset, amount, this.account.address],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Withdraw transaction reverted");
    }

    return hash;
  }

  async withdrawAll(asset: Address): Promise<`0x${string}`> {
    return this.withdraw(asset, maxUint256);
  }

  async getAccountData(): Promise<AccountData> {
    const [
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ltv,
      healthFactor,
    ] = await this.publicClient.readContract({
      address: this.pool,
      abi: poolAbi,
      functionName: "getUserAccountData",
      args: [this.account.address],
    });

    const hf = Number(healthFactor) / 1e18;

    return {
      collateralUsd: Number(totalCollateralBase) / 1e8,
      debtUsd: Number(totalDebtBase) / 1e8,
      availableBorrowsUsd: Number(availableBorrowsBase) / 1e8,
      ltvPct: Number(ltv) / 100,
      liquidationThresholdPct: Number(currentLiquidationThreshold) / 100,
      healthFactor: hf,
      isLiquidatable: hf < 1.0,
    };
  }

  async isHealthy(minHealthFactor = 1.5): Promise<boolean> {
    const { healthFactor } = await this.getAccountData();
    return healthFactor > minHealthFactor;
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function example() {
  const client = new AaveLendingClient(
    mainnet,
    process.env.RPC_URL!,
    process.env.PRIVATE_KEY as `0x${string}`,
  );

  const USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  // Check account status
  const data = await client.getAccountData();
  console.log(`Collateral: $${data.collateralUsd.toFixed(2)}`);
  console.log(`Debt: $${data.debtUsd.toFixed(2)}`);
  console.log(`Health Factor: ${data.healthFactor.toFixed(4)}`);

  // Supply 1000 USDC
  await client.supply(USDC, parseUnits("1000", 6));

  // Borrow 500 USDC (if health factor allows)
  await client.borrow(USDC, parseUnits("500", 6));

  // Repay all USDC debt
  await client.repayAll(USDC);

  // Withdraw all supplied USDC
  await client.withdrawAll(USDC);
}

if (require.main === module) {
  example().catch(console.error);
}
