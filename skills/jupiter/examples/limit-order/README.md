# Limit Orders

Create limit orders that execute automatically when the target price is reached. Jupiter monitors the market and fills orders without requiring you to be online.

## Prerequisites

```bash
npm install @solana/web3.js bs58
```

## How It Works

1. POST to `/trigger/v1/createOrder` with your order parameters
2. Sign and submit the returned transaction
3. Jupiter monitors the market and fills the order when the price hits your target
4. Query your open orders via `/trigger/v1/orders/{publicKey}`

## Full Example: Create a Limit Order

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

interface CreateOrderResponse {
  order: string;
  tx: string;
}

interface OpenOrder {
  publicKey: string;
  account: {
    maker: string;
    inputMint: string;
    outputMint: string;
    makingAmount: string;
    takingAmount: string;
    expiredAt: number | null;
    createdAt: number;
  };
}

async function createLimitOrder(
  connection: Connection,
  keypair: Keypair,
  inputMint: string,
  outputMint: string,
  makingAmount: bigint,
  takingAmount: bigint,
  expireInSeconds?: number,
): Promise<string> {
  const body: Record<string, unknown> = {
    maker: keypair.publicKey.toBase58(),
    payer: keypair.publicKey.toBase58(),
    inputMint,
    outputMint,
    makingAmount: makingAmount.toString(),
    takingAmount: takingAmount.toString(),
  };

  if (expireInSeconds !== undefined) {
    const expiredAt = Math.floor(Date.now() / 1000) + expireInSeconds;
    body.expiredAt = expiredAt;
  }

  const res = await fetch(`${JUP_API}/trigger/v1/createOrder`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Limit order creation failed (${res.status}): ${errorBody}`);
  }

  const data: CreateOrderResponse = await res.json();

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
      `Limit order tx confirmed but failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  console.log(`Order account: ${data.order}`);
  return txId;
}

async function getOpenOrders(walletAddress: string): Promise<OpenOrder[]> {
  const res = await fetch(
    `${JUP_API}/trigger/v1/orders/${walletAddress}`,
    { headers: HEADERS },
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to fetch orders (${res.status}): ${errorBody}`);
  }

  return res.json();
}

async function cancelOrder(
  connection: Connection,
  keypair: Keypair,
  orderPublicKey: string,
): Promise<string> {
  const res = await fetch(`${JUP_API}/trigger/v1/cancelOrder`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      maker: keypair.publicKey.toBase58(),
      order: orderPublicKey,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Cancel order failed (${res.status}): ${errorBody}`);
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

async function main() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  );

  const secretKey = process.env.SOLANA_PRIVATE_KEY;
  if (!secretKey) {
    throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
  }
  const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
  const wallet = keypair.publicKey.toBase58();

  // Limit order: sell 10 USDC for SOL at a specific price
  // Offering 10 USDC, wanting at least 0.05 SOL
  const makingAmount = 10_000_000n;   // 10 USDC (6 decimals)
  const takingAmount = 50_000_000n;   // 0.05 SOL (9 decimals) -- target price: 200 USDC/SOL

  console.log("Creating limit order: sell 10 USDC for 0.05 SOL...");
  // Expire in 24 hours
  const txId = await createLimitOrder(
    connection,
    keypair,
    USDC_MINT,
    SOL_MINT,
    makingAmount,
    takingAmount,
    86400,
  );
  console.log(`Order placed: https://solscan.io/tx/${txId}`);

  console.log("\nFetching open orders...");
  const orders = await getOpenOrders(wallet);
  console.log(`Found ${orders.length} open order(s)`);

  for (const order of orders) {
    const making = BigInt(order.account.makingAmount);
    const taking = BigInt(order.account.takingAmount);
    console.log(
      `  ${order.publicKey}: offering ${making} ${order.account.inputMint} for ${taking} ${order.account.outputMint}`,
    );
  }
}

main().catch((err) => {
  console.error(`Limit order failed: ${err.message}`);
  process.exit(1);
});
```

## Order Parameters

| Parameter | Description |
|-----------|-------------|
| `makingAmount` | Amount of input token you are offering (in base units, as `bigint`) |
| `takingAmount` | Minimum amount of output token you want (in base units, as `bigint`) |
| `expiredAt` | Unix timestamp (seconds) when the order expires. Omit for no expiry. |
| `maker` | Your wallet public key |

## Price Calculation

The effective price of a limit order is `takingAmount / makingAmount`, adjusted for decimal differences.

Example: selling USDC (6 decimals) for SOL (9 decimals):
- `makingAmount = 10_000_000n` (10 USDC)
- `takingAmount = 50_000_000n` (0.05 SOL)
- Effective price: 10 / 0.05 = 200 USDC per SOL

## Common Mistakes

- Confusing `makingAmount` and `takingAmount` -- making is what you give, taking is what you receive
- Forgetting decimal differences between tokens when calculating target prices
- Not setting an expiry on limit orders, leaving stale orders open indefinitely
- Using `number` for amounts -- always use `bigint` to avoid precision loss

## Reference

- [Jupiter Limit Order API](https://station.jup.ag/docs/api/limit-order-api)
