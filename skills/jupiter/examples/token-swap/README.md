# Token Swap via Quote + Swap API

Swap tokens on Solana using Jupiter's two-step flow: get a quote, then execute the swap.

## Prerequisites

```bash
npm install @solana/web3.js bs58
```

## How It Works

1. Request a quote from `/swap/v1/quote` with input/output mints and amount
2. Submit the quote to `/swap/v1/swap` to get a serialized transaction
3. Deserialize, sign, and send the transaction on-chain

## Full Example

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

// SOL and USDC mints on Solana mainnet
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: bigint,
  slippageBps: number = 50,
): Promise<QuoteResponse> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountLamports.toString(),
    slippageBps: slippageBps.toString(),
  });

  const res = await fetch(`${JUP_API}/swap/v1/quote?${params}`, {
    headers: HEADERS,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Quote request failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function getSwapTransaction(
  quote: QuoteResponse,
  userPublicKey: string,
): Promise<SwapResponse> {
  const res = await fetch(`${JUP_API}/swap/v1/swap`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1_000_000n.toString(),
          priorityLevel: "high",
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Swap request failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function executeSwap(
  connection: Connection,
  keypair: Keypair,
  swapResponse: SwapResponse,
): Promise<string> {
  const txBuffer = Buffer.from(swapResponse.swapTransaction, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  transaction.sign([keypair]);

  const rawTx = transaction.serialize();
  const txId = await connection.sendRawTransaction(rawTx, {
    skipPreflight: true,
    maxRetries: 2,
  });

  const confirmation = await connection.confirmTransaction(
    {
      signature: txId,
      blockhash: transaction.message.recentBlockhash,
      lastValidBlockHeight: swapResponse.lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(
      `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

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

  // Swap 0.1 SOL to USDC (SOL has 9 decimals)
  const inputAmount = 100_000_000n; // 0.1 SOL in lamports

  console.log("Fetching quote...");
  const quote = await getQuote(SOL_MINT, USDC_MINT, inputAmount);

  const outAmount = BigInt(quote.outAmount);
  // USDC has 6 decimals
  const usdcReadable = Number(outAmount) / 1e6;
  console.log(`Quote: ${usdcReadable.toFixed(2)} USDC for 0.1 SOL`);
  console.log(`Route: ${quote.routePlan.map((r) => r.swapInfo.label).join(" -> ")}`);

  console.log("Executing swap...");
  const swapResponse = await getSwapTransaction(
    quote,
    keypair.publicKey.toBase58(),
  );

  const txId = await executeSwap(connection, keypair, swapResponse);
  console.log(`Swap complete: https://solscan.io/tx/${txId}`);
}

main().catch((err) => {
  console.error(`Swap failed: ${err.message}`);
  process.exit(1);
});
```

## Key Parameters

| Parameter | Description |
|-----------|-------------|
| `amount` | Input amount in smallest unit (lamports for SOL, base units for SPL tokens). Must use `bigint`. |
| `slippageBps` | Slippage tolerance in basis points. 50 = 0.5%. |
| `dynamicSlippage` | Let Jupiter optimize slippage based on route volatility. |
| `dynamicComputeUnitLimit` | Auto-set compute budget based on simulated CU usage. |

## Common Mistakes

- Using `number` instead of `bigint` for token amounts causes precision loss on large values
- Not setting `skipPreflight: true` can cause stale blockhash rejections on mainnet
- Forgetting to check `confirmation.value.err` means you miss on-chain failures
- Quote TTL is short (~30 seconds); execute the swap promptly after getting a quote

## Reference

- [Jupiter Swap API docs](https://station.jup.ag/docs/api/swap-api)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
