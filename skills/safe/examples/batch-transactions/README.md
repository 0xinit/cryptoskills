# Batch Transactions Examples

Batching multiple operations into a single Safe transaction using MultiSend.

## Setup

```typescript
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";
import { encodeFunctionData } from "viem";

const RPC_URL = process.env.RPC_URL!;
const SAFE_ADDRESS = "0xYourSafeAddress";
const CHAIN_ID = 1n;
```

## How MultiSend Works

Protocol Kit automatically routes through the MultiSend contract when you pass multiple transactions to `createTransaction`. The Safe executes a DelegateCall to MultiSend, which then makes individual Calls to each target. You do not need to encode MultiSend data manually.

## Batch ETH Transfers

```typescript
async function batchETHTransfers(signerKey: string) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const transactions: MetaTransactionData[] = [
    {
      to: "0xRecipient1",
      value: "100000000000000000", // 0.1 ETH
      data: "0x",
      operation: OperationType.Call,
    },
    {
      to: "0xRecipient2",
      value: "200000000000000000", // 0.2 ETH
      data: "0x",
      operation: OperationType.Call,
    },
    {
      to: "0xRecipient3",
      value: "300000000000000000", // 0.3 ETH
      data: "0x",
      operation: OperationType.Call,
    },
  ];

  // Protocol Kit routes through MultiSend automatically
  const batchTx = await protocolKit.createTransaction({ transactions });
  const signedTx = await protocolKit.signTransaction(batchTx);
  const result = await protocolKit.executeTransaction(signedTx);

  console.log("Batch ETH transfer:", result.hash);
  return result.hash;
}
```

## Batch ERC-20 Transfers

```typescript
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

async function batchERC20Transfers(
  signerKey: string,
  tokenAddress: string,
  transfers: { recipient: string; amount: bigint }[]
) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const transactions: MetaTransactionData[] = transfers.map(
    ({ recipient, amount }) => ({
      to: tokenAddress,
      value: "0",
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [recipient as `0x${string}`, amount],
      }),
      operation: OperationType.Call,
    })
  );

  const batchTx = await protocolKit.createTransaction({ transactions });
  const signedTx = await protocolKit.signTransaction(batchTx);
  const result = await protocolKit.executeTransaction(signedTx);

  console.log("Batch ERC-20 transfer:", result.hash);
  return result.hash;
}

// Transfer USDC to multiple recipients in one transaction
await batchERC20Transfers(
  process.env.OWNER_PRIVATE_KEY!,
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  [
    { recipient: "0xAlice", amount: 500_000000n },  // 500 USDC
    { recipient: "0xBob", amount: 1000_000000n },   // 1000 USDC
    { recipient: "0xCarol", amount: 250_000000n },   // 250 USDC
  ]
);
```

## Mixed Batch: ETH + ERC-20 + Contract Call

```typescript
async function mixedBatch(signerKey: string) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const transactions: MetaTransactionData[] = [
    // 1. Send ETH
    {
      to: "0xRecipient",
      value: "500000000000000000", // 0.5 ETH
      data: "0x",
      operation: OperationType.Call,
    },
    // 2. ERC-20 approve
    {
      to: "0xTokenAddress",
      value: "0",
      data: encodeFunctionData({
        abi: [
          {
            name: "approve",
            type: "function",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ type: "bool" }],
          },
        ],
        functionName: "approve",
        args: ["0xSpenderContract" as `0x${string}`, 1000000n],
      }),
      operation: OperationType.Call,
    },
    // 3. Custom contract call
    {
      to: "0xTargetContract",
      value: "0",
      data: encodeFunctionData({
        abi: [
          {
            name: "doSomething",
            type: "function",
            inputs: [{ name: "param", type: "uint256" }],
            outputs: [],
          },
        ],
        functionName: "doSomething",
        args: [42n],
      }),
      operation: OperationType.Call,
    },
  ];

  const batchTx = await protocolKit.createTransaction({ transactions });
  const signedTx = await protocolKit.signTransaction(batchTx);
  const result = await protocolKit.executeTransaction(signedTx);

  console.log("Mixed batch:", result.hash);
}
```

## DelegateCall vs Call

| Type | Value | Behavior |
|------|-------|----------|
| `OperationType.Call` | `0` | Calls target contract normally. Safe is `msg.sender`. |
| `OperationType.DelegateCall` | `1` | Executes target code in Safe's context. Can modify Safe storage. |

**Use `Call` for nearly everything.** DelegateCall is only needed for library-style contracts that must run in the Safe's storage context. MultiSend itself is invoked via DelegateCall by Protocol Kit internally -- you do not set this yourself on the individual transactions within a batch.

## Propose a Batch via Transaction Service

For multisig Safes where threshold > 1, propose the batch instead of executing directly.

```typescript
async function proposeBatch(
  signerKey: string,
  transactions: MetaTransactionData[]
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const apiKit = new SafeApiKit({ chainId: CHAIN_ID });

  const batchTx = await protocolKit.createTransaction({ transactions });
  const signedTx = await protocolKit.signTransaction(batchTx);
  const safeTxHash = await protocolKit.getTransactionHash(signedTx);

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: signedTx.data,
    safeTxHash,
    senderAddress: await protocolKit.getAddress(),
    senderSignature: signedTx.encodedSignatures(),
  });

  console.log("Batch proposed:", safeTxHash);
  return safeTxHash;
}
```

## Gas Estimation for Batches

Batch transactions use more gas than individual ones due to MultiSend overhead. Each sub-transaction adds roughly 5,000-10,000 gas for the encoding and call routing. Estimate gas on a fork before submitting large batches.

```typescript
async function estimateBatchGas(
  signerKey: string,
  transactions: MetaTransactionData[]
): Promise<void> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const batchTx = await protocolKit.createTransaction({ transactions });

  // estimateGas from the Protocol Kit returns the safeTxGas value
  const gasEstimate = await protocolKit.estimateGas(batchTx);
  console.log("Estimated safeTxGas:", gasEstimate);
}
```
