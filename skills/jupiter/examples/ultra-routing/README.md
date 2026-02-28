# Ultra Swap (Gasless Routing)

Jupiter Ultra enables gasless swaps where Jupiter handles transaction submission and gas fees. You sign an order, Jupiter executes it, and you pay nothing for gas.

## Prerequisites

```bash
npm install @solana/web3.js bs58
```

## How It Works

1. POST to `/ultra/v1/order` with your signed order
2. Jupiter submits the transaction and pays gas
3. Poll `/ultra/v1/order/{orderId}` until the order completes or fails

## Full Example

```typescript
import { Keypair, VersionedTransaction } from "@solana/web3.js";
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

type OrderStatus = "pending" | "completed" | "failed" | "expired";

interface UltraOrderRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker: string;
}

interface UltraOrderResponse {
  requestId: string;
  transaction: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  expiresAt: number;
}

interface UltraOrderStatus {
  requestId: string;
  status: OrderStatus;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  txId?: string;
}

async function createUltraOrder(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  takerPublicKey: string,
): Promise<UltraOrderResponse> {
  const body: UltraOrderRequest = {
    inputMint,
    outputMint,
    amount: amount.toString(),
    taker: takerPublicKey,
  };

  const res = await fetch(`${JUP_API}/ultra/v1/order`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Ultra order creation failed (${res.status}): ${errorBody}`);
  }

  return res.json();
}

async function signAndSubmitUltraOrder(
  order: UltraOrderResponse,
  keypair: Keypair,
): Promise<string> {
  const txBuffer = Buffer.from(order.transaction, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  transaction.sign([keypair]);

  const signedTxBase64 = Buffer.from(transaction.serialize()).toString("base64");

  const res = await fetch(`${JUP_API}/ultra/v1/execute`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      requestId: order.requestId,
      signedTransaction: signedTxBase64,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Ultra order execution failed (${res.status}): ${errorBody}`);
  }

  const result = await res.json();
  return result.requestId;
}

async function pollOrderStatus(
  requestId: string,
  maxAttempts: number = 30,
  intervalMs: number = 2000,
): Promise<UltraOrderStatus> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${JUP_API}/ultra/v1/order/${requestId}`, {
      headers: HEADERS,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Order status check failed (${res.status}): ${errorBody}`);
    }

    const status: UltraOrderStatus = await res.json();

    if (status.status === "completed") {
      return status;
    }

    if (status.status === "failed" || status.status === "expired") {
      throw new Error(
        `Order ${requestId} ${status.status}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Order ${requestId} timed out after ${maxAttempts} attempts`);
}

async function main() {
  const secretKey = process.env.SOLANA_PRIVATE_KEY;
  if (!secretKey) {
    throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
  }
  const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));

  // Swap 1 USDC to SOL via Ultra (gasless)
  const inputAmount = 1_000_000n; // 1 USDC (6 decimals)

  console.log("Creating Ultra order...");
  const order = await createUltraOrder(
    USDC_MINT,
    SOL_MINT,
    inputAmount,
    keypair.publicKey.toBase58(),
  );

  const outAmount = BigInt(order.outAmount);
  const solReadable = Number(outAmount) / 1e9;
  console.log(`Order created: ${solReadable.toFixed(6)} SOL for 1 USDC`);
  console.log(`Request ID: ${order.requestId}`);

  console.log("Signing and submitting...");
  const requestId = await signAndSubmitUltraOrder(order, keypair);

  console.log("Waiting for execution...");
  const result = await pollOrderStatus(requestId);

  console.log(`Swap complete: https://solscan.io/tx/${result.txId}`);
}

main().catch((err) => {
  console.error(`Ultra swap failed: ${err.message}`);
  process.exit(1);
});
```

## Ultra vs Standard Swap

| Feature | Standard Swap | Ultra Swap |
|---------|--------------|------------|
| Gas cost | User pays SOL | Jupiter pays gas |
| Submission | User sends tx | Jupiter sends tx |
| Speed | Depends on user | Optimized by Jupiter |
| Retry logic | User handles | Jupiter handles |

## When to Use Ultra

- User has no SOL for gas but holds SPL tokens
- You want simplified flow without managing transaction submission
- You want Jupiter's optimized transaction landing

## Common Mistakes

- Ultra order quotes expire quickly (check `expiresAt`); sign and submit immediately
- Not polling for completion -- the order may take several seconds to land
- Assuming the order succeeded without checking the final status
- Using `number` for amounts will silently lose precision on large token values

## Reference

- [Jupiter Ultra API](https://station.jup.ag/docs/api/ultra-api)
