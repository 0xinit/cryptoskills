# Priority Fees

Estimate, set, and optimize priority fees for Solana transactions. Covers compute budget instructions, dynamic fee estimation, and versioned transactions with priority fees.

## Basic Priority Fee Setup

Every priority-fee transaction needs two Compute Budget instructions: one to set the compute unit limit and one to set the price per compute unit.

```typescript
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

async function transferWithPriorityFee(
  connection: Connection,
  sender: Keypair,
  recipient: PublicKey,
  lamports: number,
  microLamportsPerCU: number
): Promise<string> {
  const tx = new Transaction().add(
    // Set compute unit limit (SOL transfer uses ~450 CU, pad to 1000)
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000 }),
    // Set price per compute unit
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamportsPerCU }),
    // Actual instruction
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [sender]);
  // Total priority fee = 1,000 CU * microLamportsPerCU / 1,000,000 lamports
  return sig;
}
```

## Dynamic Fee Estimation

Use `getRecentPrioritizationFees` to estimate competitive fees based on recent block data. Filter by the writable accounts your transaction touches for account-specific fee markets.

```typescript
import { Connection, PublicKey } from "@solana/web3.js";

interface FeeEstimate {
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
}

async function estimatePriorityFees(
  connection: Connection,
  writableAccounts: PublicKey[]
): Promise<FeeEstimate> {
  const recentFees = await connection.getRecentPrioritizationFees({
    lockedWritableAccounts: writableAccounts,
  });

  if (recentFees.length === 0) {
    return { low: 0, medium: 0, high: 0, veryHigh: 0 };
  }

  // Filter out zero-fee slots (no priority fee transactions)
  const nonZeroFees = recentFees
    .map((f) => f.prioritizationFee)
    .filter((f) => f > 0)
    .sort((a, b) => a - b);

  if (nonZeroFees.length === 0) {
    return { low: 1_000, medium: 10_000, high: 100_000, veryHigh: 1_000_000 };
  }

  const percentile = (p: number) =>
    nonZeroFees[Math.floor(nonZeroFees.length * p)] ?? nonZeroFees[0];

  return {
    low: percentile(0.25),
    medium: percentile(0.5),
    high: percentile(0.75),
    veryHigh: percentile(0.95),
  };
}

// Usage
async function main() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  // Fee market for a specific AMM pool
  const ammPoolAccount = new PublicKey("...");
  const fees = await estimatePriorityFees(connection, [ammPoolAccount]);

  console.log("Fee estimates (microLamports/CU):");
  console.log("  Low (p25):", fees.low);
  console.log("  Medium (p50):", fees.medium);
  console.log("  High (p75):", fees.high);
  console.log("  Very High (p95):", fees.veryHigh);
}
```

## Priority Fees with Versioned Transactions

When using Address Lookup Tables, priority fee instructions work the same way but go into the versioned transaction message.

```typescript
import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  TransactionInstruction,
} from "@solana/web3.js";

async function sendVersionedTxWithPriorityFee(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  lookupTableAddress: PublicKey,
  computeUnits: number,
  microLamports: number
): Promise<string> {
  const lookupTableAccount = await connection
    .getAddressLookupTable(lookupTableAddress)
    .then((res) => res.value);

  if (!lookupTableAccount) {
    throw new Error("Lookup table not found");
  }

  const { blockhash } = await connection.getLatestBlockhash();

  // Prepend compute budget instructions
  const allInstructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    ...instructions,
  ];

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: allInstructions,
  }).compileToV0Message([lookupTableAccount]);

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer]);

  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
  });

  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
```

## Simulate to Get Actual Compute Usage

Avoid overpaying by simulating first to learn actual compute consumption, then setting the limit with a small buffer.

```typescript
import {
  Connection,
  Transaction,
  Keypair,
  ComputeBudgetProgram,
} from "@solana/web3.js";

async function simulateAndSend(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  microLamportsPerCU: number
): Promise<string> {
  // Step 1: Simulate without compute budget to learn actual usage
  const simTx = new Transaction().add(...instructions);
  simTx.feePayer = payer.publicKey;
  simTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const simulation = await connection.simulateTransaction(simTx);
  if (simulation.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  const unitsConsumed = simulation.value.unitsConsumed ?? 200_000;
  // 20% buffer over actual usage
  const computeLimit = Math.ceil(unitsConsumed * 1.2);

  // Step 2: Send with tight compute budget
  const finalTx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeLimit }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamportsPerCU }),
    ...instructions
  );

  const sig = await sendAndConfirmTransaction(connection, finalTx, [payer]);
  console.log(`Used ~${unitsConsumed} CU, set limit to ${computeLimit}`);
  return sig;
}
```

## Cost Calculation Reference

```
priority_fee (lamports) = compute_units * microLamports_per_CU / 1,000,000
base_fee = 5,000 lamports (fixed per signature)
total_fee = base_fee + priority_fee
```

| Compute Units | microLamports/CU | Priority Fee | Total Fee (1 sig) |
|---------------|-----------------|--------------|-------------------|
| 200,000 | 1,000 | 200 lamports | 5,200 lamports |
| 200,000 | 10,000 | 2,000 lamports | 7,000 lamports |
| 200,000 | 100,000 | 20,000 lamports | 25,000 lamports |
| 200,000 | 1,000,000 | 200,000 lamports | 205,000 lamports |
| 1,400,000 | 100,000 | 140,000 lamports | 145,000 lamports |

1 SOL = 1,000,000,000 lamports. A 200,000 CU transaction at 100,000 microLamports/CU costs 0.000025 SOL in total fees.

## Common Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| Setting price but not limit | Default 200K CU used, overpay | Always set both instructions |
| Very high limit with high price | Massive overpay | Simulate first, use actual + 20% buffer |
| Not filtering by writable accounts | Irrelevant fee data | Pass `lockedWritableAccounts` to fee API |
| Compute budget instructions not first | May fail | Place CU instructions before all others |

Last verified: 2026-03-01
