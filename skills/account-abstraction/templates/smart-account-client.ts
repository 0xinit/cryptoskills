/**
 * Smart Account Client Template
 *
 * Complete starter template for ERC-4337 smart account operations using
 * permissionless.js with Pimlico bundler and paymaster.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set environment variables: RPC_URL, PRIVATE_KEY, PIMLICO_API_KEY
 * 3. Import and use the functions
 *
 * Dependencies: permissionless viem
 */

import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import {
  createPublicClient,
  http,
  parseEther,
  encodeFunctionData,
  parseAbi,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;

if (!RPC_URL) throw new Error("RPC_URL environment variable is required");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY environment variable is required");
if (!PIMLICO_API_KEY) throw new Error("PIMLICO_API_KEY environment variable is required");

const CHAIN = sepolia;
const PIMLICO_URL = `https://api.pimlico.io/v2/${CHAIN.id}/rpc?apikey=${PIMLICO_API_KEY}`;

// ============================================================================
// Clients
// ============================================================================

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

const owner = privateKeyToAccount(PRIVATE_KEY);

const pimlicoClient = createPimlicoClient({
  transport: http(PIMLICO_URL),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

// ============================================================================
// Account Setup
// ============================================================================

export async function createAccount() {
  const simpleAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: CHAIN,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      },
    },
  });

  return { account: simpleAccount, client: smartAccountClient };
}

// ============================================================================
// Send UserOp
// ============================================================================

export async function sendUserOp(
  client: Awaited<ReturnType<typeof createAccount>>["client"],
  to: Address,
  value: bigint,
  data: `0x${string}` = "0x"
): Promise<`0x${string}`> {
  const txHash = await client.sendTransaction({ to, value, data });
  return txHash;
}

// ============================================================================
// Batch UserOps
// ============================================================================

export async function sendBatchUserOp(
  client: Awaited<ReturnType<typeof createAccount>>["client"],
  calls: Array<{ to: Address; value: bigint; data: `0x${string}` }>
): Promise<`0x${string}`> {
  const hash = await client.sendUserOperation({ calls });

  const receipt = await client.waitForUserOperationReceipt({ hash });
  if (!receipt.success) {
    throw new Error(`Batch UserOp failed: ${receipt.reason}`);
  }

  return receipt.receipt.transactionHash;
}

// ============================================================================
// Wait for Receipt
// ============================================================================

export async function waitForUserOp(
  client: Awaited<ReturnType<typeof createAccount>>["client"],
  hash: `0x${string}`
) {
  const receipt = await client.waitForUserOperationReceipt({ hash });

  if (!receipt.success) {
    throw new Error(`UserOp failed: ${receipt.reason}`);
  }

  return {
    transactionHash: receipt.receipt.transactionHash,
    blockNumber: receipt.receipt.blockNumber,
    gasUsed: receipt.actualGasUsed,
  };
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  const { account, client } = await createAccount();
  console.log(`Smart account: ${account.address}`);
  console.log(`Owner: ${owner.address}`);

  // Send a simple transfer
  const txHash = await sendUserOp(
    client,
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address,
    parseEther("0.001")
  );
  console.log(`UserOp hash: ${txHash}`);

  // Wait for confirmation
  const result = await waitForUserOp(client, txHash);
  console.log(`Mined in block: ${result.blockNumber}`);
  console.log(`Gas used: ${result.gasUsed}`);
}

main().catch(console.error);
