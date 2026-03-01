/**
 * deBridge Cross-Chain Bridge Client Template
 *
 * Starter template for bridging assets between Solana and EVM chains
 * using the deBridge DLN (Decentralized Liquidity Network) API.
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

const DLN_API = "https://api.dln.trade";
const SOLANA_CHAIN_ID = 7565164;

// EVM chain IDs used by deBridge
const CHAIN_IDS = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  avalanche: 43114,
  optimism: 10,
  base: 8453,
  solana: SOLANA_CHAIN_ID,
} as const;

type ChainName = keyof typeof CHAIN_IDS;

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;

if (!SOLANA_PRIVATE_KEY) {
  throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
}

const connection = new Connection(SOLANA_RPC_URL);
const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_PRIVATE_KEY));

// ============================================================================
// Types
// ============================================================================

interface BridgeQuoteParams {
  srcChain: ChainName;
  srcTokenAddress: string;
  srcTokenAmount: bigint;
  dstChain: ChainName;
  dstTokenAddress: string;
}

interface BridgeQuote {
  estimation: {
    srcChainTokenIn: { amount: string; tokenAddress: string };
    dstChainTokenOut: { amount: string; tokenAddress: string };
    costsDetails: Array<{ chain: string; tokenAddress: string; amount: string }>;
  };
  tx: {
    data: string;
    to: string;
    value: string;
  };
  orderId: string;
  fixFee: string;
}

interface OrderStatus {
  orderId: string;
  status: string;
  srcChainTxHash: string;
  dstChainTxHash: string | null;
}

// ============================================================================
// Bridge Client
// ============================================================================

async function getQuote(params: BridgeQuoteParams): Promise<BridgeQuote> {
  const searchParams = new URLSearchParams({
    srcChainId: CHAIN_IDS[params.srcChain].toString(),
    srcChainTokenIn: params.srcTokenAddress,
    srcChainTokenInAmount: params.srcTokenAmount.toString(),
    dstChainId: CHAIN_IDS[params.dstChain].toString(),
    dstChainTokenOut: params.dstTokenAddress,
    prependOperatingExpenses: "true",
    dstChainTokenOutRecipient: keypair.publicKey.toBase58(),
  });

  const res = await fetch(`${DLN_API}/v1.0/dln/order/quote?${searchParams}`);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deBridge quote failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function createAndSendOrder(
  params: BridgeQuoteParams,
): Promise<string> {
  const searchParams = new URLSearchParams({
    srcChainId: CHAIN_IDS[params.srcChain].toString(),
    srcChainTokenIn: params.srcTokenAddress,
    srcChainTokenInAmount: params.srcTokenAmount.toString(),
    dstChainId: CHAIN_IDS[params.dstChain].toString(),
    dstChainTokenOut: params.dstTokenAddress,
    dstChainTokenOutRecipient: keypair.publicKey.toBase58(),
    srcChainOrderAuthorityAddress: keypair.publicKey.toBase58(),
    dstChainOrderAuthorityAddress: keypair.publicKey.toBase58(),
    prependOperatingExpenses: "true",
  });

  const res = await fetch(
    `${DLN_API}/v1.0/dln/order/create-tx?${searchParams}`,
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deBridge create-tx failed (${res.status}): ${body}`);
  }

  const { tx } = await res.json();

  const txBuffer = Buffer.from(tx.data, "base64");
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
      `Bridge tx confirmed but failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  return txId;
}

async function getOrderStatus(orderId: string): Promise<OrderStatus> {
  const res = await fetch(
    `${DLN_API}/v1.0/dln/order/${orderId}/status`,
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deBridge status failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ============================================================================
// Usage
// ============================================================================

// SOL native = 11111111111111111111111111111111 on deBridge
// USDC on Solana
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// USDC on Ethereum
const ETHEREUM_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

async function main() {
  // Step 1: Get quote for bridging 100 USDC from Solana to Ethereum
  const quote = await getQuote({
    srcChain: "solana",
    srcTokenAddress: SOLANA_USDC,
    srcTokenAmount: 100_000_000n, // 100 USDC (6 decimals)
    dstChain: "ethereum",
    dstTokenAddress: ETHEREUM_USDC,
  });

  console.log("Bridge quote:");
  console.log(
    `  Send: ${quote.estimation.srcChainTokenIn.amount} USDC (Solana)`,
  );
  console.log(
    `  Receive: ${quote.estimation.dstChainTokenOut.amount} USDC (Ethereum)`,
  );

  // Step 2: Create and send bridge order
  const txId = await createAndSendOrder({
    srcChain: "solana",
    srcTokenAddress: SOLANA_USDC,
    srcTokenAmount: 100_000_000n,
    dstChain: "ethereum",
    dstTokenAddress: ETHEREUM_USDC,
  });
  console.log(`Bridge tx sent: https://solscan.io/tx/${txId}`);

  // Step 3: Poll order status (typically ~2s settlement)
  if (quote.orderId) {
    let status = await getOrderStatus(quote.orderId);
    console.log(`Order status: ${status.status}`);

    if (status.dstChainTxHash) {
      console.log(
        `Destination tx: https://etherscan.io/tx/${status.dstChainTxHash}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(`deBridge bridge error: ${err.message}`);
  process.exit(1);
});
