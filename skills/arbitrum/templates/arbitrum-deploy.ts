/**
 * Arbitrum Starter Template
 *
 * Provides helpers for common Arbitrum operations:
 * - Client setup for Arbitrum One
 * - Contract deployment via viem
 * - ETH bridging (L1→L2 and L2→L1)
 * - ArbOS precompile reads
 * - Cross-chain message sender (L1→L2 retryable ticket)
 *
 * Usage:
 *   PRIVATE_KEY=0x... ARBITRUM_RPC_URL=https://... ETHEREUM_RPC_URL=https://... npx tsx arbitrum-deploy.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";

// -- Config --

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const l1PublicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const l1WalletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const l2PublicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const l2WalletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

// -- Precompile Addresses --

const ARBSYS = "0x0000000000000000000000000000000000000064" as const;
const ARBGASINFO = "0x000000000000000000000000000000000000006C" as const;
const NODE_INTERFACE = "0x00000000000000000000000000000000000000C8" as const;
const INBOX = "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f" as const;

// -- ABIs --

const arbSysAbi = [
  { name: "arbBlockNumber", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "withdrawEth", type: "function", stateMutability: "payable", inputs: [{ name: "destination", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const arbGasInfoAbi = [
  { name: "getL1BaseFeeEstimate", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "getPricesInWei", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "perL2Tx", type: "uint256" }, { name: "perL1CalldataUnit", type: "uint256" }, { name: "perStorageAlloc", type: "uint256" }, { name: "perArbGasBase", type: "uint256" }, { name: "perArbGasCongestion", type: "uint256" }, { name: "perArbGasTotal", type: "uint256" }] },
] as const;

const inboxAbi = [
  { name: "depositEth", type: "function", stateMutability: "payable", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "createRetryableTicket", type: "function", stateMutability: "payable", inputs: [{ name: "to", type: "address" }, { name: "l2CallValue", type: "uint256" }, { name: "maxSubmissionCost", type: "uint256" }, { name: "excessFeeRefundAddress", type: "address" }, { name: "callValueRefundAddress", type: "address" }, { name: "gasLimit", type: "uint256" }, { name: "maxFeePerGas", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

// -- Helpers --

async function getL2BlockNumber(): Promise<bigint> {
  return l2PublicClient.readContract({
    address: ARBSYS,
    abi: arbSysAbi,
    functionName: "arbBlockNumber",
  });
}

async function getGasPrices() {
  const [prices, l1BaseFee] = await Promise.all([
    l2PublicClient.readContract({
      address: ARBGASINFO,
      abi: arbGasInfoAbi,
      functionName: "getPricesInWei",
    }),
    l2PublicClient.readContract({
      address: ARBGASINFO,
      abi: arbGasInfoAbi,
      functionName: "getL1BaseFeeEstimate",
    }),
  ]);

  return {
    perL2Tx: prices[0],
    perL1CalldataUnit: prices[1],
    perArbGasTotal: prices[5],
    l1BaseFee,
  };
}

async function bridgeEthL1ToL2(amountEth: string): Promise<`0x${string}`> {
  const { request } = await l1PublicClient.simulateContract({
    address: INBOX,
    abi: inboxAbi,
    functionName: "depositEth",
    value: parseEther(amountEth),
    account: account.address,
  });

  const hash = await l1WalletClient.writeContract(request);
  const receipt = await l1PublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("ETH deposit failed");
  return hash;
}

async function withdrawEthL2ToL1(
  amountEth: string,
  l1Destination: `0x${string}`
): Promise<`0x${string}`> {
  const { request } = await l2PublicClient.simulateContract({
    address: ARBSYS,
    abi: arbSysAbi,
    functionName: "withdrawEth",
    args: [l1Destination],
    value: parseEther(amountEth),
    account: account.address,
  });

  const hash = await l2WalletClient.writeContract(request);
  return hash;
}

async function sendL1ToL2Message(
  l2Target: `0x${string}`,
  l2Calldata: `0x${string}`,
  gasLimit: bigint = 1_000_000n,
  maxFeePerGas: bigint = 100_000_000n
): Promise<`0x${string}`> {
  const maxSubmissionCost = parseEther("0.001");
  const totalValue = maxSubmissionCost + gasLimit * maxFeePerGas;

  const { request } = await l1PublicClient.simulateContract({
    address: INBOX,
    abi: inboxAbi,
    functionName: "createRetryableTicket",
    args: [
      l2Target,
      0n,
      maxSubmissionCost,
      account.address,
      account.address,
      gasLimit,
      maxFeePerGas,
      l2Calldata,
    ],
    value: totalValue,
    account: account.address,
  });

  const hash = await l1WalletClient.writeContract(request);
  const receipt = await l1PublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Retryable ticket creation failed");
  return hash;
}
