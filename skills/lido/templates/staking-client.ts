/**
 * Lido Staking Client Template
 *
 * Starter template for Lido protocol integration with viem.
 *
 * Features:
 * - Stake ETH for stETH
 * - Wrap/unwrap stETH <-> wstETH
 * - Request and claim withdrawals
 * - Read exchange rates and protocol state
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set PRIVATE_KEY and RPC_URL environment variables
 * 3. Import and use the functions
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  formatEther,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Contract addresses (Ethereum mainnet)
const LIDO = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as const;
const WITHDRAWAL_QUEUE = "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1" as const;

const LIDO_ABI = parseAbi([
  "function submit(address _referral) external payable returns (uint256)",
  "function balanceOf(address _account) external view returns (uint256)",
  "function sharesOf(address _account) external view returns (uint256)",
  "function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256)",
  "function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256)",
  "function getTotalPooledEther() external view returns (uint256)",
  "function getTotalShares() external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const WSTETH_ABI = parseAbi([
  "function wrap(uint256 _stETHAmount) external returns (uint256)",
  "function unwrap(uint256 _wstETHAmount) external returns (uint256)",
  "function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256)",
  "function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256)",
  "function stEthPerToken() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const WITHDRAWAL_ABI = parseAbi([
  "function requestWithdrawals(uint256[] _amounts, address _owner) external returns (uint256[])",
  "function claimWithdrawals(uint256[] _requestIds, uint256[] _hints) external",
  "function getWithdrawalStatus(uint256[] _requestIds) external view returns ((uint256 amountOfStETH, uint256 amountOfShares, address owner, uint256 timestamp, bool isFinalized, bool isClaimed)[])",
  "function findCheckpointHints(uint256[] _requestIds, uint256 _firstIndex, uint256 _lastIndex) external view returns (uint256[])",
  "function getLastCheckpointIndex() external view returns (uint256)",
  "function getLastFinalizedRequestId() external view returns (uint256)",
]);

// Initialize clients
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

// -- Staking --

export async function stakeEth(amountEth: string): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: LIDO,
    abi: LIDO_ABI,
    functionName: "submit",
    args: ["0x0000000000000000000000000000000000000000"],
    value: parseEther(amountEth),
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Stake tx reverted");
  return hash;
}

// -- Wrap / Unwrap --

export async function wrapSteth(stEthAmount: bigint): Promise<`0x${string}`> {
  const approveHash = await walletClient.writeContract({
    address: LIDO,
    abi: LIDO_ABI,
    functionName: "approve",
    args: [WSTETH, stEthAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const { request } = await publicClient.simulateContract({
    address: WSTETH,
    abi: WSTETH_ABI,
    functionName: "wrap",
    args: [stEthAmount],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Wrap tx reverted");
  return hash;
}

export async function unwrapWsteth(wstEthAmount: bigint): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: WSTETH,
    abi: WSTETH_ABI,
    functionName: "unwrap",
    args: [wstEthAmount],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Unwrap tx reverted");
  return hash;
}

// -- Withdrawals --

export async function requestWithdrawal(stEthAmounts: bigint[]): Promise<`0x${string}`> {
  const totalAmount = stEthAmounts.reduce((a, b) => a + b, 0n);

  const approveHash = await walletClient.writeContract({
    address: LIDO,
    abi: LIDO_ABI,
    functionName: "approve",
    args: [WITHDRAWAL_QUEUE, totalAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const { request } = await publicClient.simulateContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "requestWithdrawals",
    args: [stEthAmounts, account.address],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Withdrawal request reverted");
  return hash;
}

export async function checkWithdrawalStatus(requestIds: bigint[]) {
  const statuses = await publicClient.readContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "getWithdrawalStatus",
    args: [requestIds],
  });

  return statuses.map((s, i) => ({
    requestId: requestIds[i],
    amountOfStETH: s.amountOfStETH,
    isFinalized: s.isFinalized,
    isClaimed: s.isClaimed,
  }));
}

export async function claimWithdrawals(requestIds: bigint[]): Promise<`0x${string}`> {
  const lastCheckpointIndex = await publicClient.readContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "getLastCheckpointIndex",
  });

  const hints = await publicClient.readContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "findCheckpointHints",
    args: [requestIds, 1n, lastCheckpointIndex],
  });

  const { request } = await publicClient.simulateContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "claimWithdrawals",
    args: [requestIds, hints],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Claim tx reverted");
  return hash;
}

// -- Read State --

export async function getExchangeRate(): Promise<{ stEthPerWstEth: bigint; shareRate: bigint }> {
  const [stEthPerWstEth, totalPooledEther, totalShares] = await Promise.all([
    publicClient.readContract({
      address: WSTETH,
      abi: WSTETH_ABI,
      functionName: "stEthPerToken",
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getTotalPooledEther",
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getTotalShares",
    }),
  ]);

  const shareRate = (totalPooledEther * 10n ** 18n) / totalShares;

  return { stEthPerWstEth, shareRate };
}

// -- Example Usage --

async function main() {
  const rate = await getExchangeRate();
  console.log(`1 wstETH = ${formatEther(rate.stEthPerWstEth)} stETH`);
  console.log(`Share rate: ${formatEther(rate.shareRate)} ETH/share`);
}

if (require.main === module) {
  main().catch(console.error);
}
