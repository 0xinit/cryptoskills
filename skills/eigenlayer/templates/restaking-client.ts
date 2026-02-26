/**
 * EigenLayer Restaking Client Template
 *
 * Complete starter template for interacting with EigenLayer: deposit LSTs,
 * delegate to operators, queue/complete withdrawals, and read restaking state.
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
  parseEther,
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
// Contract Addresses (Ethereum Mainnet — Proxy Addresses)
// ============================================================================

const STRATEGY_MANAGER = "0x858646372CC42E1A627fcE94aa7A7033e7CF075A" as const;
const DELEGATION_MANAGER = "0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A" as const;
const EIGEN_POD_MANAGER = "0x91E677b07F7AF907ec9a428aafA9fc14a0d3A338" as const;
const REWARDS_COORDINATOR = "0x7750d328b314EfFa365A0402CcfD489B80B0adda" as const;

interface StrategyConfig {
  strategy: Address;
  token: Address;
}

const STRATEGIES: Record<string, StrategyConfig> = {
  stETH: {
    strategy: "0x93c4b944D05dfe6df7645A86cd2206016c51564D",
    token: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  },
  rETH: {
    strategy: "0x1BeE69b7dFFfA4E2d53C2a2Df135C388AD25dCD2",
    token: "0xae78736Cd615f374D3085123A210448E74Fc6393",
  },
  cbETH: {
    strategy: "0x54945180dB7943c0ed0FEE7EdaB2Bd24620256bc",
    token: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49BBa",
  },
};

// ============================================================================
// ABIs
// ============================================================================

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const strategyManagerAbi = parseAbi([
  "function depositIntoStrategy(address strategy, address token, uint256 amount) external returns (uint256 shares)",
  "function stakerStrategyShares(address staker, address strategy) external view returns (uint256)",
  "function stakerStrategyList(address staker) external view returns (address[])",
  "function strategyIsWhitelistedForDeposit(address strategy) external view returns (bool)",
]);

const strategyAbi = parseAbi([
  "function sharesToUnderlyingView(uint256 amountShares) external view returns (uint256)",
  "function underlyingToSharesView(uint256 amountUnderlying) external view returns (uint256)",
  "function totalShares() external view returns (uint256)",
]);

const delegationManagerAbi = parseAbi([
  "function delegateTo(address operator, (bytes signature, uint256 expiry) approverSignatureAndExpiry, bytes32 approverSalt) external",
  "function undelegate(address staker) external returns (bytes32[] withdrawalRoots)",
  "function queueWithdrawals((address[] strategies, uint256[] shares, address withdrawer)[] queuedWithdrawalParams) external returns (bytes32[] withdrawalRoots)",
  "function completeQueuedWithdrawals((address staker, address delegatedTo, address withdrawer, uint256 nonce, uint32 startBlock, address[] strategies, uint256[] shares)[] withdrawals, address[][] tokens, uint256[] middlewareTimesIndexes, bool[] receiveAsTokens) external",
  "function delegatedTo(address staker) external view returns (address)",
  "function isDelegated(address staker) external view returns (bool)",
  "function isOperator(address operator) external view returns (bool)",
  "function operatorShares(address operator, address strategy) external view returns (uint256)",
  "function minWithdrawalDelayBlocks() external view returns (uint256)",
  "function cumulativeWithdrawalsQueued(address staker) external view returns (uint256)",
]);

const eigenPodManagerAbi = parseAbi([
  "function createPod() external returns (address)",
  "function getPod(address podOwner) external view returns (address)",
  "function hasPod(address podOwner) external view returns (bool)",
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
// Deposit LST
// ============================================================================

export async function depositLst(
  lstName: string,
  amount: bigint
): Promise<{ hash: `0x${string}`; shares: bigint }> {
  const config = STRATEGIES[lstName];
  if (!config) throw new Error(`Unknown LST: ${lstName}. Available: ${Object.keys(STRATEGIES).join(", ")}`);

  const balance = await publicClient.readContract({
    address: config.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < amount) {
    throw new Error(`Insufficient ${lstName}: have ${balance}, need ${amount}`);
  }

  await ensureApproval(config.token, STRATEGY_MANAGER, amount);

  const { request, result } = await publicClient.simulateContract({
    address: STRATEGY_MANAGER,
    abi: strategyManagerAbi,
    functionName: "depositIntoStrategy",
    args: [config.strategy, config.token, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Deposit reverted");

  return { hash, shares: result };
}

// ============================================================================
// Delegation
// ============================================================================

export async function delegateToOperator(
  operatorAddress: Address
): Promise<`0x${string}`> {
  const [isOperator, isDelegated] = await Promise.all([
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "isOperator",
      args: [operatorAddress],
    }),
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "isDelegated",
      args: [account.address],
    }),
  ]);

  if (!isOperator) throw new Error(`${operatorAddress} is not a registered operator`);
  if (isDelegated) throw new Error("Already delegated. Call undelegate() first.");

  const emptySignature: `0x${string}` = "0x";
  const emptySalt = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  const { request } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "delegateTo",
    args: [operatorAddress, { signature: emptySignature, expiry: 0n }, emptySalt],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Delegation reverted");

  return hash;
}

export async function undelegate(): Promise<{
  hash: `0x${string}`;
  withdrawalRoots: readonly `0x${string}`[];
}> {
  const { request, result } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "undelegate",
    args: [account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Undelegate reverted");

  return { hash, withdrawalRoots: result };
}

// ============================================================================
// Withdrawals
// ============================================================================

export async function queueWithdrawal(
  strategies: Address[],
  shares: bigint[]
): Promise<{ hash: `0x${string}`; withdrawalRoots: readonly `0x${string}`[] }> {
  if (strategies.length !== shares.length) {
    throw new Error("Strategies and shares arrays must have equal length");
  }

  const { request, result } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "queueWithdrawals",
    args: [
      [{ strategies, shares, withdrawer: account.address }],
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Queue withdrawal reverted");

  return { hash, withdrawalRoots: result };
}

interface Withdrawal {
  staker: Address;
  delegatedTo: Address;
  withdrawer: Address;
  nonce: bigint;
  startBlock: number;
  strategies: Address[];
  shares: bigint[];
}

export async function completeWithdrawal(
  withdrawal: Withdrawal,
  tokens: Address[],
  receiveAsTokens: boolean
): Promise<`0x${string}`> {
  const [currentBlock, minDelay] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "minWithdrawalDelayBlocks",
    }),
  ]);

  const blocksElapsed = currentBlock - BigInt(withdrawal.startBlock);
  if (blocksElapsed < minDelay) {
    throw new Error(
      `Withdrawal not ready. ${minDelay - blocksElapsed} blocks remaining (approx ${Number(minDelay - blocksElapsed) * 12}s).`
    );
  }

  const { request } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "completeQueuedWithdrawals",
    args: [[withdrawal], [tokens], [0n], [receiveAsTokens]],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Complete withdrawal reverted");

  return hash;
}

// ============================================================================
// Reading State
// ============================================================================

export async function getRestakedShares(
  staker: Address,
  lstName: string
): Promise<{ shares: bigint; underlyingTokens: bigint }> {
  const config = STRATEGIES[lstName];
  if (!config) throw new Error(`Unknown LST: ${lstName}`);

  const shares = await publicClient.readContract({
    address: STRATEGY_MANAGER,
    abi: strategyManagerAbi,
    functionName: "stakerStrategyShares",
    args: [staker, config.strategy],
  });

  const underlyingTokens = await publicClient.readContract({
    address: config.strategy,
    abi: strategyAbi,
    functionName: "sharesToUnderlyingView",
    args: [shares],
  });

  return { shares, underlyingTokens };
}

export async function getDelegationStatus(staker: Address): Promise<{
  isDelegated: boolean;
  operator: Address;
}> {
  const [isDelegated, operator] = await Promise.all([
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "isDelegated",
      args: [staker],
    }),
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "delegatedTo",
      args: [staker],
    }),
  ]);

  return { isDelegated, operator };
}

export async function getOperatorTotalShares(
  operator: Address,
  lstName: string
): Promise<bigint> {
  const config = STRATEGIES[lstName];
  if (!config) throw new Error(`Unknown LST: ${lstName}`);

  return publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "operatorShares",
    args: [operator, config.strategy],
  });
}

export async function getStakerStrategies(
  staker: Address
): Promise<readonly Address[]> {
  return publicClient.readContract({
    address: STRATEGY_MANAGER,
    abi: strategyManagerAbi,
    functionName: "stakerStrategyList",
    args: [staker],
  });
}

export async function getWithdrawalDelay(): Promise<bigint> {
  return publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "minWithdrawalDelayBlocks",
  });
}

// ============================================================================
// EigenPod (Native Restaking)
// ============================================================================

export async function getOrCreateEigenPod(): Promise<Address> {
  const hasPod = await publicClient.readContract({
    address: EIGEN_POD_MANAGER,
    abi: eigenPodManagerAbi,
    functionName: "hasPod",
    args: [account.address],
  });

  if (hasPod) {
    return publicClient.readContract({
      address: EIGEN_POD_MANAGER,
      abi: eigenPodManagerAbi,
      functionName: "getPod",
      args: [account.address],
    });
  }

  const { request } = await publicClient.simulateContract({
    address: EIGEN_POD_MANAGER,
    abi: eigenPodManagerAbi,
    functionName: "createPod",
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("EigenPod creation reverted");

  return publicClient.readContract({
    address: EIGEN_POD_MANAGER,
    abi: eigenPodManagerAbi,
    functionName: "getPod",
    args: [account.address],
  });
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  // 1. Deposit stETH into EigenLayer
  console.log("Depositing 1 stETH into EigenLayer...");
  const { hash: depositHash, shares } = await depositLst("stETH", parseEther("1"));
  console.log(`Deposit tx: ${depositHash}`);
  console.log(`Shares received: ${shares}`);

  // 2. Check restaked balance
  const { shares: totalShares, underlyingTokens } = await getRestakedShares(
    account.address,
    "stETH"
  );
  console.log(`\nRestaked shares: ${totalShares}`);
  console.log(`Underlying stETH: ${underlyingTokens}`);

  // 3. Delegate to an operator
  const operatorAddress = "0x..." as Address; // Replace with actual operator
  console.log(`\nDelegating to ${operatorAddress}...`);
  const delegateHash = await delegateToOperator(operatorAddress);
  console.log(`Delegation tx: ${delegateHash}`);

  // 4. Check delegation status
  const { isDelegated, operator } = await getDelegationStatus(account.address);
  console.log(`\nDelegated: ${isDelegated}`);
  console.log(`Operator: ${operator}`);

  // 5. Queue withdrawal (when ready to exit)
  const stETHStrategy = STRATEGIES["stETH"].strategy;
  console.log("\nQueuing withdrawal...");
  const { hash: withdrawHash, withdrawalRoots } = await queueWithdrawal(
    [stETHStrategy],
    [totalShares]
  );
  console.log(`Withdrawal queued: ${withdrawHash}`);
  console.log(`Withdrawal roots: ${withdrawalRoots.length}`);

  // 6. Check withdrawal delay
  const delay = await getWithdrawalDelay();
  console.log(`\nWithdrawal delay: ${delay} blocks (~${Number(delay) * 12 / 86400} days)`);
}

main().catch(console.error);
