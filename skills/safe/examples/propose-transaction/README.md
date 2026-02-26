# Propose Transaction Examples

Proposing, signing, and executing Safe transactions through the full multisig lifecycle.

## Setup

```typescript
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";

const RPC_URL = process.env.RPC_URL!;
const SAFE_ADDRESS = "0xYourSafeAddress";
const CHAIN_ID = 1n;
```

## Create and Propose a Transaction (Owner A)

```typescript
async function proposeTransaction(
  signerKey: string,
  txData: MetaTransactionData
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const apiKit = new SafeApiKit({ chainId: CHAIN_ID });

  const safeTx = await protocolKit.createTransaction({
    transactions: [txData],
  });

  const signedTx = await protocolKit.signTransaction(safeTx);
  const safeTxHash = await protocolKit.getTransactionHash(signedTx);

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: signedTx.data,
    safeTxHash,
    senderAddress: await protocolKit.getAddress(),
    senderSignature: signedTx.encodedSignatures(),
  });

  console.log("Proposed:", safeTxHash);
  return safeTxHash;
}

// ETH transfer
const safeTxHash = await proposeTransaction(
  process.env.OWNER_A_PRIVATE_KEY!,
  {
    to: "0xRecipientAddress",
    value: "500000000000000000", // 0.5 ETH in wei
    data: "0x",
    operation: OperationType.Call,
  }
);
```

## Confirm a Transaction (Owner B)

```typescript
async function confirmTransaction(
  signerKey: string,
  safeTxHash: string
): Promise<void> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const apiKit = new SafeApiKit({ chainId: CHAIN_ID });

  const pendingTx = await apiKit.getTransaction(safeTxHash);
  const confirmedTx = await protocolKit.signTransaction(pendingTx);

  await apiKit.confirmTransaction(
    safeTxHash,
    confirmedTx.encodedSignatures()
  );

  console.log("Confirmed:", safeTxHash);
}

await confirmTransaction(process.env.OWNER_B_PRIVATE_KEY!, safeTxHash);
```

## Execute When Threshold Met

```typescript
async function executeTransaction(
  signerKey: string,
  safeTxHash: string
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const apiKit = new SafeApiKit({ chainId: CHAIN_ID });
  const fullySignedTx = await apiKit.getTransaction(safeTxHash);

  const result = await protocolKit.executeTransaction(fullySignedTx);
  console.log("Executed:", result.hash);
  return result.hash;
}

const txHash = await executeTransaction(
  process.env.OWNER_B_PRIVATE_KEY!,
  safeTxHash
);
```

## List Pending Transactions

```typescript
async function listPending(): Promise<void> {
  const apiKit = new SafeApiKit({ chainId: CHAIN_ID });

  const pendingTxs = await apiKit.getPendingTransactions(SAFE_ADDRESS);

  for (const tx of pendingTxs.results) {
    console.log({
      nonce: tx.nonce,
      to: tx.to,
      value: tx.value,
      safeTxHash: tx.safeTxHash,
      confirmations: tx.confirmations?.length ?? 0,
      confirmationsRequired: tx.confirmationsRequired,
    });
  }
}
```

## Collect Off-Chain Signatures

Multiple owners can sign the same transaction off-chain without submitting to the Transaction Service. Useful for air-gapped signing workflows.

```typescript
async function collectSignaturesOffChain(
  txData: MetaTransactionData,
  signerKeys: string[]
): Promise<void> {
  const apiKit = new SafeApiKit({ chainId: CHAIN_ID });

  // First signer creates the transaction
  let protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKeys[0],
    safeAddress: SAFE_ADDRESS,
  });

  const safeTx = await protocolKit.createTransaction({
    transactions: [txData],
  });

  let signedTx = await protocolKit.signTransaction(safeTx);

  // Remaining signers add their signatures
  for (const key of signerKeys.slice(1)) {
    protocolKit = await Safe.init({
      provider: RPC_URL,
      signer: key,
      safeAddress: SAFE_ADDRESS,
    });

    signedTx = await protocolKit.signTransaction(signedTx);
  }

  // All signatures collected -- propose and execute in one shot
  const safeTxHash = await protocolKit.getTransactionHash(signedTx);

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: signedTx.data,
    safeTxHash,
    senderAddress: await protocolKit.getAddress(),
    senderSignature: signedTx.encodedSignatures(),
  });

  const result = await protocolKit.executeTransaction(signedTx);
  console.log("Executed with all signatures:", result.hash);
}
```

## Reject a Pending Transaction

A rejection is a zero-value self-transfer with the same nonce, which replaces the original transaction when executed.

```typescript
async function rejectTransaction(
  signerKey: string,
  nonce: number
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const apiKit = new SafeApiKit({ chainId: CHAIN_ID });

  const rejectionTx = await protocolKit.createRejectionTransaction(nonce);
  const signedRejection = await protocolKit.signTransaction(rejectionTx);
  const rejectionHash = await protocolKit.getTransactionHash(signedRejection);

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: signedRejection.data,
    safeTxHash: rejectionHash,
    senderAddress: await protocolKit.getAddress(),
    senderSignature: signedRejection.encodedSignatures(),
  });

  console.log("Rejection proposed for nonce:", nonce);
  return rejectionHash;
}
```

## Propose an ERC-20 Transfer

```typescript
import { encodeFunctionData } from "viem";

async function proposeERC20Transfer(
  signerKey: string,
  tokenAddress: string,
  recipient: string,
  amount: bigint
): Promise<string> {
  // ERC-20 transfer(address,uint256)
  const data = encodeFunctionData({
    abi: [
      {
        name: "transfer",
        type: "function",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
      },
    ],
    functionName: "transfer",
    args: [recipient as `0x${string}`, amount],
  });

  return proposeTransaction(signerKey, {
    to: tokenAddress,
    value: "0",
    data,
    operation: OperationType.Call,
  });
}

// Transfer 1000 USDC (6 decimals)
await proposeERC20Transfer(
  process.env.OWNER_A_PRIVATE_KEY!,
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on mainnet
  "0xRecipientAddress",
  1000_000000n // 1000 USDC
);
```

## Complete Lifecycle

```typescript
async function fullLifecycle() {
  const txData: MetaTransactionData = {
    to: "0xRecipientAddress",
    value: "1000000000000000000", // 1 ETH
    data: "0x",
    operation: OperationType.Call,
  };

  // Owner A proposes
  const safeTxHash = await proposeTransaction(
    process.env.OWNER_A_PRIVATE_KEY!,
    txData
  );

  // Owner B confirms
  await confirmTransaction(
    process.env.OWNER_B_PRIVATE_KEY!,
    safeTxHash
  );

  // Anyone can execute once threshold is met
  const txHash = await executeTransaction(
    process.env.OWNER_B_PRIVATE_KEY!,
    safeTxHash
  );

  console.log("Full lifecycle complete. TX:", txHash);
}

fullLifecycle().catch(console.error);
```
