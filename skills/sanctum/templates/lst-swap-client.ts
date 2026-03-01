/**
 * Sanctum LST Swap Client Template
 *
 * Starter template for swapping between Liquid Staking Tokens (LSTs)
 * on Solana using the Sanctum Router API.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set SOLANA_RPC_URL and SOLANA_PRIVATE_KEY environment variables
 * 3. Import and use the functions
 *
 * Dependencies: @solana/web3.js, bs58
 */

import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

// ============================================================================
// Configuration
// ============================================================================

const SANCTUM_API = "https://sanctum-s-api.fly.dev";

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;

if (!SOLANA_PRIVATE_KEY) {
  throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
}

const connection = new Connection(SOLANA_RPC_URL);
const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_PRIVATE_KEY));

// ============================================================================
// Common LST Mint Addresses
// ============================================================================

const LST_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  INF: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
  mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  jitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  bSOL: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
  jupSOL: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
  bbSOL: "bbso1MfE7KVL7DhqwZ6dVfKrD3oNV1PEykLNM4kk5dD",
  hSOL: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A",
} as const;

type LstName = keyof typeof LST_MINTS;

// ============================================================================
// Types
// ============================================================================

interface SwapQuote {
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
  feePct: string;
  priceImpactPct: string;
}

interface LstSolValue {
  mint: string;
  solValue: string;
  lastUpdatedEpoch: number;
}

// ============================================================================
// Sanctum Client
// ============================================================================

async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  mode: "ExactIn" | "ExactOut" = "ExactIn",
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    input: inputMint,
    outputLstMint: outputMint,
    amount: amount.toString(),
    mode,
  });

  const res = await fetch(`${SANCTUM_API}/v1/swap/quote?${params}`);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sanctum quote failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function executeSwap(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  quotedAmount: string,
  slippageBps: number = 50,
): Promise<string> {
  const swapRes = await fetch(`${SANCTUM_API}/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: inputMint,
      outputLstMint: outputMint,
      amount: amount.toString(),
      quotedAmount,
      signer: keypair.publicKey.toBase58(),
      swapSrc: "STAKEDEX",
      priorityFee: {
        // Auto priority fee based on network conditions
        Auto: { max_unit_price_micro_lamports: 5000 },
      },
    }),
  });

  if (!swapRes.ok) {
    const body = await swapRes.text();
    throw new Error(`Sanctum swap failed (${swapRes.status}): ${body}`);
  }

  const { tx: txBase64 } = await swapRes.json();

  const txBuffer = Buffer.from(txBase64, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);
  transaction.sign([keypair]);

  const txId = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  const latestBlockhash = await connection.getLatestBlockhash();
  const confirmation = await connection.confirmTransaction(
    { signature: txId, ...latestBlockhash },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(
      `LST swap tx confirmed but failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  return txId;
}

async function getSolValues(mints: string[]): Promise<LstSolValue[]> {
  const params = new URLSearchParams();
  for (const mint of mints) {
    params.append("lst", mint);
  }

  const res = await fetch(`${SANCTUM_API}/v1/sol-value/current?${params}`);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sanctum sol-value failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.solValues;
}

// ============================================================================
// Usage
// ============================================================================

async function main() {
  // Step 1: Check SOL value of LSTs to compare yields
  const solValues = await getSolValues([
    LST_MINTS.mSOL,
    LST_MINTS.jitoSOL,
    LST_MINTS.INF,
    LST_MINTS.jupSOL,
  ]);

  console.log("LST SOL Values:");
  for (const sv of solValues) {
    const name = Object.entries(LST_MINTS).find(([_, m]) => m === sv.mint)?.[0];
    console.log(`  ${name || sv.mint}: ${sv.solValue} SOL`);
  }

  // Step 2: Get quote for swapping 1 SOL → jitoSOL
  const amount = 1_000_000_000n; // 1 SOL in lamports
  const quote = await getSwapQuote(
    LST_MINTS.SOL,
    LST_MINTS.jitoSOL,
    amount,
  );

  console.log("\nSwap Quote (1 SOL → jitoSOL):");
  console.log(`  Output: ${quote.outAmount} jitoSOL lamports`);
  console.log(`  Fee: ${quote.feeAmount} (${quote.feePct}%)`);
  console.log(`  Price Impact: ${quote.priceImpactPct}%`);

  // Step 3: Execute the swap
  const txId = await executeSwap(
    LST_MINTS.SOL,
    LST_MINTS.jitoSOL,
    amount,
    quote.outAmount,
    50, // 0.5% slippage
  );
  console.log(`\nSwap complete: https://solscan.io/tx/${txId}`);

  // Step 4: LST-to-LST swap (mSOL → jitoSOL)
  const lstQuote = await getSwapQuote(
    LST_MINTS.mSOL,
    LST_MINTS.jitoSOL,
    500_000_000n, // 0.5 mSOL
  );
  console.log("\nSwap Quote (0.5 mSOL → jitoSOL):");
  console.log(`  Output: ${lstQuote.outAmount} jitoSOL lamports`);
}

main().catch((err) => {
  console.error(`Sanctum client error: ${err.message}`);
  process.exit(1);
});
