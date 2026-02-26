/**
 * OP Stack Client Template
 *
 * Starter template for interacting with Optimism / OP Stack chains.
 *
 * Features:
 * - Viem client setup for OP Mainnet
 * - Gas price oracle reading (L1 data fee)
 * - ETH bridge helper (L1 → L2)
 * - Cross-chain message sender
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set environment variables: PRIVATE_KEY, OP_MAINNET_RPC, ETH_RPC_URL
 * 3. Import and use the functions
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  formatEther,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import { optimism, mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ============================================================================
// Configuration
// ============================================================================

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable is required");
}

const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);

// ============================================================================
// Clients
// ============================================================================

export const l2PublicClient: PublicClient = createPublicClient({
  chain: optimism,
  transport: http(process.env.OP_MAINNET_RPC || "https://mainnet.optimism.io"),
});

export const l2WalletClient: WalletClient<Transport, Chain, Account> =
  createWalletClient({
    account,
    chain: optimism,
    transport: http(
      process.env.OP_MAINNET_RPC || "https://mainnet.optimism.io"
    ),
  });

export const l1PublicClient: PublicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

export const l1WalletClient: WalletClient<Transport, Chain, Account> =
  createWalletClient({
    account,
    chain: mainnet,
    transport: http(process.env.ETH_RPC_URL),
  });

// ============================================================================
// Predeploy Addresses
// ============================================================================

const GAS_PRICE_ORACLE: Address =
  "0x420000000000000000000000000000000000000F";
const L2_CROSS_DOMAIN_MESSENGER: Address =
  "0x4200000000000000000000000000000000000007";
const L2_STANDARD_BRIDGE: Address =
  "0x4200000000000000000000000000000000000010";
const L1_BLOCK: Address = "0x4200000000000000000000000000000000000015";

// L1 Contracts (OP Mainnet)
const L1_STANDARD_BRIDGE: Address =
  "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1";
const L1_CROSS_DOMAIN_MESSENGER: Address =
  "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1";

// ============================================================================
// ABIs
// ============================================================================

const gasPriceOracleAbi = parseAbi([
  "function getL1Fee(bytes memory _data) external view returns (uint256)",
  "function l1BaseFee() external view returns (uint256)",
  "function blobBaseFee() external view returns (uint256)",
  "function baseFeeScalar() external view returns (uint32)",
  "function blobBaseFeeScalar() external view returns (uint32)",
]);

const l1StandardBridgeAbi = parseAbi([
  "function depositETH(uint32 _minGasLimit, bytes calldata _extraData) external payable",
  "function depositETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) external payable",
]);

const crossDomainMessengerAbi = parseAbi([
  "function sendMessage(address _target, bytes calldata _message, uint32 _minGasLimit) external payable",
]);

const l1BlockAbi = parseAbi([
  "function number() external view returns (uint64)",
  "function timestamp() external view returns (uint64)",
  "function basefee() external view returns (uint256)",
]);

// ============================================================================
// Gas Oracle
// ============================================================================

export async function getL1DataFee(
  serializedTx: `0x${string}`
): Promise<bigint> {
  return l2PublicClient.readContract({
    address: GAS_PRICE_ORACLE,
    abi: gasPriceOracleAbi,
    functionName: "getL1Fee",
    args: [serializedTx],
  });
}

export async function getGasOracleState() {
  const [l1BaseFee, blobBaseFee, baseFeeScalar, blobBaseFeeScalar] =
    await Promise.all([
      l2PublicClient.readContract({
        address: GAS_PRICE_ORACLE,
        abi: gasPriceOracleAbi,
        functionName: "l1BaseFee",
      }),
      l2PublicClient.readContract({
        address: GAS_PRICE_ORACLE,
        abi: gasPriceOracleAbi,
        functionName: "blobBaseFee",
      }),
      l2PublicClient.readContract({
        address: GAS_PRICE_ORACLE,
        abi: gasPriceOracleAbi,
        functionName: "baseFeeScalar",
      }),
      l2PublicClient.readContract({
        address: GAS_PRICE_ORACLE,
        abi: gasPriceOracleAbi,
        functionName: "blobBaseFeeScalar",
      }),
    ]);

  return { l1BaseFee, blobBaseFee, baseFeeScalar, blobBaseFeeScalar };
}

// ============================================================================
// L1 Block Info
// ============================================================================

export async function getL1BlockInfo() {
  const [number, timestamp, basefee] = await Promise.all([
    l2PublicClient.readContract({
      address: L1_BLOCK,
      abi: l1BlockAbi,
      functionName: "number",
    }),
    l2PublicClient.readContract({
      address: L1_BLOCK,
      abi: l1BlockAbi,
      functionName: "timestamp",
    }),
    l2PublicClient.readContract({
      address: L1_BLOCK,
      abi: l1BlockAbi,
      functionName: "basefee",
    }),
  ]);

  return { number, timestamp, basefee };
}

// ============================================================================
// Bridge ETH (L1 → L2)
// ============================================================================

export async function bridgeETHToL2(amountEth: string): Promise<`0x${string}`> {
  const hash = await l1WalletClient.writeContract({
    address: L1_STANDARD_BRIDGE,
    abi: l1StandardBridgeAbi,
    functionName: "depositETH",
    args: [200_000, "0x"],
    value: parseEther(amountEth),
  });

  return hash;
}

// ============================================================================
// Cross-Chain Messaging (L1 → L2)
// ============================================================================

export async function sendMessageL1ToL2(
  l2Target: Address,
  message: `0x${string}`,
  minGasLimit: number
): Promise<`0x${string}`> {
  const hash = await l1WalletClient.writeContract({
    address: L1_CROSS_DOMAIN_MESSENGER,
    abi: crossDomainMessengerAbi,
    functionName: "sendMessage",
    args: [l2Target, message, minGasLimit],
  });

  return hash;
}

// ============================================================================
// Cross-Chain Messaging (L2 → L1)
// ============================================================================

export async function sendMessageL2ToL1(
  l1Target: Address,
  message: `0x${string}`,
  minGasLimit: number
): Promise<`0x${string}`> {
  const hash = await l2WalletClient.writeContract({
    address: L2_CROSS_DOMAIN_MESSENGER,
    abi: crossDomainMessengerAbi,
    functionName: "sendMessage",
    args: [l1Target, message, minGasLimit],
  });

  return hash;
}

// ============================================================================
// Example Usage
// ============================================================================

async function example() {
  const gasState = await getGasOracleState();
  console.log("Gas Oracle State:", {
    l1BaseFee: formatEther(gasState.l1BaseFee),
    blobBaseFee: formatEther(gasState.blobBaseFee),
    baseFeeScalar: gasState.baseFeeScalar,
    blobBaseFeeScalar: gasState.blobBaseFeeScalar,
  });

  const l1Block = await getL1BlockInfo();
  console.log("L1 Block Info:", {
    number: l1Block.number.toString(),
    timestamp: new Date(Number(l1Block.timestamp) * 1000).toISOString(),
    basefee: formatEther(l1Block.basefee),
  });
}

if (require.main === module) {
  example().catch(console.error);
}
