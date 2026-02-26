/**
 * Safe Client Template
 *
 * Complete starter template for Safe multisig integration.
 *
 * Features:
 * - Safe SDK initialization
 * - Create Safe helper
 * - Propose transaction helper
 * - Sign + execute flow
 * - Batch transaction helper
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set RPC_URL and signer private keys as environment variables
 * 3. Import and use the functions
 */

import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL!;
const CHAIN_ID = BigInt(process.env.CHAIN_ID ?? "1");

if (!RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}

// ============================================================================
// Initialization
// ============================================================================

export function createApiKit(): SafeApiKit {
  return new SafeApiKit({ chainId: CHAIN_ID });
}

export async function connectToSafe(
  signerKey: string,
  safeAddress: string
): Promise<Safe> {
  return Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress,
  });
}

// ============================================================================
// Create Safe
// ============================================================================

export async function createSafe(
  deployerKey: string,
  owners: string[],
  threshold: number,
  saltNonce?: string
): Promise<string> {
  const nonce = saltNonce ?? BigInt(Date.now()).toString();

  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: deployerKey,
    predictedSafe: {
      safeAccountConfig: { owners, threshold },
      safeDeploymentConfig: {
        saltNonce: nonce,
        safeVersion: "1.4.1",
      },
    },
  });

  const predictedAddress = await protocolKit.getAddress();
  await protocolKit.createSafeDeploymentTransaction();

  const deployedKit = await Safe.init({
    provider: RPC_URL,
    signer: deployerKey,
    safeAddress: predictedAddress,
  });

  const isDeployed = await deployedKit.isSafeDeployed();
  if (!isDeployed) {
    throw new Error(`Safe deployment failed at ${predictedAddress}`);
  }

  return predictedAddress;
}

// ============================================================================
// Propose Transaction
// ============================================================================

export async function proposeTransaction(
  signerKey: string,
  safeAddress: string,
  txData: MetaTransactionData
): Promise<string> {
  const protocolKit = await connectToSafe(signerKey, safeAddress);
  const apiKit = createApiKit();

  const safeTx = await protocolKit.createTransaction({
    transactions: [txData],
  });

  const signedTx = await protocolKit.signTransaction(safeTx);
  const safeTxHash = await protocolKit.getTransactionHash(signedTx);

  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: signedTx.data,
    safeTxHash,
    senderAddress: await protocolKit.getAddress(),
    senderSignature: signedTx.encodedSignatures(),
  });

  return safeTxHash;
}

// ============================================================================
// Confirm Transaction
// ============================================================================

export async function confirmTransaction(
  signerKey: string,
  safeAddress: string,
  safeTxHash: string
): Promise<void> {
  const protocolKit = await connectToSafe(signerKey, safeAddress);
  const apiKit = createApiKit();

  const pendingTx = await apiKit.getTransaction(safeTxHash);
  const confirmedTx = await protocolKit.signTransaction(pendingTx);

  await apiKit.confirmTransaction(
    safeTxHash,
    confirmedTx.encodedSignatures()
  );
}

// ============================================================================
// Execute Transaction
// ============================================================================

export async function executeTransaction(
  signerKey: string,
  safeAddress: string,
  safeTxHash: string
): Promise<string> {
  const protocolKit = await connectToSafe(signerKey, safeAddress);
  const apiKit = createApiKit();

  const fullySignedTx = await apiKit.getTransaction(safeTxHash);
  const result = await protocolKit.executeTransaction(fullySignedTx);

  return result.hash;
}

// ============================================================================
// Batch Transactions
// ============================================================================

export async function proposeBatchTransaction(
  signerKey: string,
  safeAddress: string,
  transactions: MetaTransactionData[]
): Promise<string> {
  const protocolKit = await connectToSafe(signerKey, safeAddress);
  const apiKit = createApiKit();

  const batchTx = await protocolKit.createTransaction({ transactions });
  const signedTx = await protocolKit.signTransaction(batchTx);
  const safeTxHash = await protocolKit.getTransactionHash(signedTx);

  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: signedTx.data,
    safeTxHash,
    senderAddress: await protocolKit.getAddress(),
    senderSignature: signedTx.encodedSignatures(),
  });

  return safeTxHash;
}

// ============================================================================
// Query Helpers
// ============================================================================

export async function getSafeInfo(safeAddress: string) {
  const apiKit = createApiKit();
  return apiKit.getSafeInfo(safeAddress);
}

export async function getPendingTransactions(safeAddress: string) {
  const apiKit = createApiKit();
  return apiKit.getPendingTransactions(safeAddress);
}

export async function getSafesByOwner(ownerAddress: string) {
  const apiKit = createApiKit();
  return apiKit.getSafesByOwner(ownerAddress);
}

// ============================================================================
// Example Usage
// ============================================================================

async function example() {
  const SAFE_ADDRESS = "0xYourSafeAddress";

  // Query Safe info
  const info = await getSafeInfo(SAFE_ADDRESS);
  console.log("Safe info:", {
    owners: info.owners,
    threshold: info.threshold,
    nonce: info.nonce,
  });

  // Propose an ETH transfer
  const safeTxHash = await proposeTransaction(
    process.env.OWNER_A_PRIVATE_KEY!,
    SAFE_ADDRESS,
    {
      to: "0xRecipientAddress",
      value: "1000000000000000000", // 1 ETH
      data: "0x",
      operation: OperationType.Call,
    }
  );
  console.log("Proposed:", safeTxHash);

  // Confirm with second owner
  await confirmTransaction(
    process.env.OWNER_B_PRIVATE_KEY!,
    SAFE_ADDRESS,
    safeTxHash
  );
  console.log("Confirmed");

  // Execute
  const txHash = await executeTransaction(
    process.env.OWNER_B_PRIVATE_KEY!,
    SAFE_ADDRESS,
    safeTxHash
  );
  console.log("Executed:", txHash);
}

if (require.main === module) {
  example().catch(console.error);
}
