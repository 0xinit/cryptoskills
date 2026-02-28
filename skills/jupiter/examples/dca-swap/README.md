# DCA (Dollar-Cost Average) Swaps

Set up recurring swaps that execute automatically at fixed intervals. Jupiter DCA splits a large order into smaller periodic swaps to reduce price impact and average your entry.

## Prerequisites

```bash
npm install @solana/web3.js bs58
```

## How It Works

1. POST to `/recurring/v1/createOrder` with total amount, frequency, and number of orders
2. Sign and submit the returned transaction to create the DCA account on-chain
3. Jupiter fills one portion per interval automatically
4. Query active DCA positions via `/recurring/v1/orders/{publicKey}`

## Full Example: Create a DCA Position

```typescript
import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUP_API_KEY;

if (!API_KEY) {
  throw new Error("JUP_API_KEY environment variable is required");
}

const HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface DCACreateResponse {
  order: string;
  tx: string;
}

interface DCAOrder {
  publicKey: string;
  account: {
    user: string;
    inputMint: string;
    outputMint: string;
    inDeposited: string;
    inUsed: string;
    outReceived: string;
    inAmountPerCycle: string;
    cycleFrequency: number;
    nextCycleAt: number;
    createdAt: number;
  };
}

async function createDCAOrder(
  connection: Connection,
  keypair: Keypair,
  inputMint: string,
  outputMint: string,
  totalInputAmount: bigint,
  numberOfOrders: number,
  cycleFrequencySeconds: number,
): Promise<{ txId: string; orderAccount: string }> {
  // Each cycle swaps an equal portion
  const amountPerCycle = totalInputAmount / BigInt(numberOfOrders);

  if (amountPerCycle === 0n) {
    throw new Error(
      `Total amount ${totalInputAmount} too small for ${numberOfOrders} orders`,
    );
  }

  const body = {
    user: keypair.publicKey.toBase58(),
    payer: keypair.publicKey.toBase58(),
    inputMint,
    outputMint,
    inAmount: totalInputAmount.toString(),
    inAmountPerCycle: amountPerCycle.toString(),
    cycleFrequency: cycleFrequencySeconds,
  };

  const res = await fetch(`${JUP_API}/recurring/v1/createOrder`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`DCA order creation failed (${res.status}): ${errorBody}`);
  }

  const data: DCACreateResponse = await res.json();

  const txBuffer = Buffer.from(data.tx, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);
  transaction.sign([keypair]);

  const txId = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 2,
  });

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    {
      signature: txId,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(
      `DCA order tx failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  return { txId, orderAccount: data.order };
}

async function getActiveDCAOrders(walletAddress: string): Promise<DCAOrder[]> {
  const res = await fetch(
    `${JUP_API}/recurring/v1/orders/${walletAddress}`,
    { headers: HEADERS },
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to fetch DCA orders (${res.status}): ${errorBody}`);
  }

  return res.json();
}

async function closeDCAOrder(
  connection: Connection,
  keypair: Keypair,
  orderPublicKey: string,
): Promise<string> {
  const res = await fetch(`${JUP_API}/recurring/v1/cancelOrder`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      user: keypair.publicKey.toBase58(),
      order: orderPublicKey,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`DCA cancel failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const txBuffer = Buffer.from(data.tx, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);
  transaction.sign([keypair]);

  const txId = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 2,
  });

  return txId;
}

function formatDCAProgress(order: DCAOrder): string {
  const deposited = BigInt(order.account.inDeposited);
  const used = BigInt(order.account.inUsed);
  const received = BigInt(order.account.outReceived);
  const remaining = deposited - used;
  const progressPct = deposited > 0n
    ? Number((used * 10000n) / deposited) / 100
    : 0;

  const nextCycle = new Date(order.account.nextCycleAt * 1000);

  return [
    `Order: ${order.publicKey}`,
    `  Input: ${order.account.inputMint}`,
    `  Output: ${order.account.outputMint}`,
    `  Deposited: ${deposited} | Used: ${used} | Remaining: ${remaining}`,
    `  Received: ${received}`,
    `  Progress: ${progressPct.toFixed(2)}%`,
    `  Next cycle: ${nextCycle.toISOString()}`,
    `  Cycle frequency: ${order.account.cycleFrequency}s`,
  ].join("\n");
}

async function main() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  );

  const secretKey = process.env.SOLANA_PRIVATE_KEY;
  if (!secretKey) {
    throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
  }
  const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));

  // DCA: invest 100 USDC into SOL over 10 daily swaps
  const totalAmount = 100_000_000n; // 100 USDC (6 decimals)
  const numberOfOrders = 10;
  const oneDayInSeconds = 86400;

  console.log("Creating DCA: 100 USDC -> SOL over 10 days...");
  const { txId, orderAccount } = await createDCAOrder(
    connection,
    keypair,
    USDC_MINT,
    SOL_MINT,
    totalAmount,
    numberOfOrders,
    oneDayInSeconds,
  );

  console.log(`DCA created: https://solscan.io/tx/${txId}`);
  console.log(`Order account: ${orderAccount}`);

  console.log("\nActive DCA positions:");
  const orders = await getActiveDCAOrders(keypair.publicKey.toBase58());

  for (const order of orders) {
    console.log(formatDCAProgress(order));
  }
}

main().catch((err) => {
  console.error(`DCA setup failed: ${err.message}`);
  process.exit(1);
});
```

## DCA Parameters

| Parameter | Description |
|-----------|-------------|
| `inAmount` | Total amount to invest over the DCA period (base units, `bigint`) |
| `inAmountPerCycle` | Amount swapped per cycle (base units, `bigint`). Must divide evenly or last cycle adjusts. |
| `cycleFrequency` | Seconds between each swap. 60 = every minute, 86400 = daily. |

## Common Frequencies

| Interval | Seconds |
|----------|---------|
| Every minute | 60 |
| Hourly | 3600 |
| Daily | 86400 |
| Weekly | 604800 |

## Common Mistakes

- Setting `inAmountPerCycle` larger than `inAmount` -- only one swap will execute
- Very short cycle frequencies (< 60s) may not execute reliably due to Solana slot times
- Cancelling a DCA order returns remaining unfilled input tokens to your wallet
- Not accounting for token decimals when calculating per-cycle amounts

## Reference

- [Jupiter DCA API](https://station.jup.ag/docs/api/recurring-api)
