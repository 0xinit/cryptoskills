/**
 * Polygon Client Template
 *
 * Starter template for interacting with Polygon PoS and zkEVM using viem.
 *
 * Features:
 * - Dual-chain client setup (PoS + zkEVM)
 * - PoS Bridge deposit helper
 * - zkEVM LxLy bridge helper
 * - Staking state reader
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set environment variables (PRIVATE_KEY, ETH_RPC_URL)
 * 3. Import and use the functions
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import { mainnet, polygon, polygonZkEvm } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// --- Configuration ---

const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const ZKEVM_RPC = process.env.ZKEVM_RPC_URL || "https://zkevm-rpc.com";
const ETH_RPC = process.env.ETH_RPC_URL || "https://eth.llamarpc.com";

// --- Clients ---

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`);

export const ethPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(ETH_RPC),
});

export const posPublicClient = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC),
});

export const zkEvmPublicClient = createPublicClient({
  chain: polygonZkEvm,
  transport: http(ZKEVM_RPC),
});

export const ethWalletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(ETH_RPC),
});

export const posWalletClient = createWalletClient({
  account,
  chain: polygon,
  transport: http(POLYGON_RPC),
});

export const zkEvmWalletClient = createWalletClient({
  account,
  chain: polygonZkEvm,
  transport: http(ZKEVM_RPC),
});

// --- Contract ABIs ---

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

const rootChainManagerAbi = parseAbi([
  "function depositFor(address user, address rootToken, bytes calldata depositData) external",
  "function depositEtherFor(address user) external payable",
]);

const zkEvmBridgeAbi = parseAbi([
  "function bridgeAsset(uint32 destinationNetwork, address destinationAddress, uint256 amount, address token, bool forceUpdateGlobalExitRoot, bytes calldata permitData) external payable",
]);

const validatorShareAbi = parseAbi([
  "function getLiquidRewards(address user) external view returns (uint256)",
  "function getTotalStake(address user) external view returns (uint256, uint256)",
]);

// --- Contract Addresses ---

const ROOT_CHAIN_MANAGER = "0xA0c68C638235ee32657e8f720a23ceC1bFc77C77" as const;
const ERC20_PREDICATE = "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf" as const;
const ZKEVM_BRIDGE = "0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe" as const;

// --- PoS Bridge Helpers ---

export async function depositERC20ToPoS(
  tokenAddress: Address,
  amount: bigint,
  recipient: Address
): Promise<`0x${string}`> {
  const currentAllowance = await ethPublicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ERC20_PREDICATE],
  });

  if (currentAllowance < amount) {
    const approveTx = await ethWalletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [ERC20_PREDICATE, amount],
    });
    const receipt = await ethPublicClient.waitForTransactionReceipt({ hash: approveTx });
    if (receipt.status === "reverted") {
      throw new Error("ERC20 approval reverted");
    }
  }

  const depositData = encodeAbiParameters(
    parseAbiParameters("uint256"),
    [amount]
  );

  const depositTx = await ethWalletClient.writeContract({
    address: ROOT_CHAIN_MANAGER,
    abi: rootChainManagerAbi,
    functionName: "depositFor",
    args: [recipient, tokenAddress, depositData],
  });

  const receipt = await ethPublicClient.waitForTransactionReceipt({ hash: depositTx });
  if (receipt.status === "reverted") {
    throw new Error("PoS bridge deposit reverted");
  }

  return depositTx;
}

// --- zkEVM Bridge Helpers ---

// networkId 0 = Ethereum, 1 = zkEVM
const ZKEVM_NETWORK_ID = 1;

export async function bridgeETHToZkEVM(
  amount: bigint,
  recipient: Address
): Promise<`0x${string}`> {
  const bridgeTx = await ethWalletClient.writeContract({
    address: ZKEVM_BRIDGE,
    abi: zkEvmBridgeAbi,
    functionName: "bridgeAsset",
    args: [
      ZKEVM_NETWORK_ID,
      recipient,
      amount,
      "0x0000000000000000000000000000000000000000",
      true,
      "0x",
    ],
    value: amount,
  });

  const receipt = await ethPublicClient.waitForTransactionReceipt({ hash: bridgeTx });
  if (receipt.status === "reverted") {
    throw new Error("zkEVM bridge deposit reverted");
  }

  return bridgeTx;
}

// --- Staking State Reader ---

export async function getStakingState(
  validatorShareAddress: Address,
  delegator: Address
): Promise<{
  totalStaked: bigint;
  shares: bigint;
  pendingRewards: bigint;
}> {
  const [stakeResult, pendingRewards] = await Promise.all([
    ethPublicClient.readContract({
      address: validatorShareAddress,
      abi: validatorShareAbi,
      functionName: "getTotalStake",
      args: [delegator],
    }),
    ethPublicClient.readContract({
      address: validatorShareAddress,
      abi: validatorShareAbi,
      functionName: "getLiquidRewards",
      args: [delegator],
    }),
  ]);

  const [totalStaked, shares] = stakeResult;
  return { totalStaked, shares, pendingRewards };
}

// --- Utility ---

export async function getGasPrices(): Promise<{
  posGasPrice: bigint;
  zkEvmGasPrice: bigint;
}> {
  const [posGasPrice, zkEvmGasPrice] = await Promise.all([
    posPublicClient.getGasPrice(),
    zkEvmPublicClient.getGasPrice(),
  ]);

  return { posGasPrice, zkEvmGasPrice };
}
