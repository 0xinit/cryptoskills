import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

const JUP_API = "https://api.jup.ag";

interface JupiterClientConfig {
  apiKey: string;
  rpcUrl?: string;
  privateKey?: string;
}

interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  maxAccounts?: number;
}

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
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

interface SwapResult {
  txId: string;
  inputAmount: bigint;
  outputAmount: bigint;
}

class JupiterClient {
  private readonly headers: Record<string, string>;
  private readonly connection: Connection;
  private readonly keypair: Keypair | null;

  constructor(config: JupiterClientConfig) {
    this.headers = {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    };

    this.connection = new Connection(
      config.rpcUrl || "https://api.mainnet-beta.solana.com",
    );

    this.keypair = config.privateKey
      ? Keypair.fromSecretKey(bs58.decode(config.privateKey))
      : null;
  }

  get publicKey(): string {
    if (!this.keypair) {
      throw new Error("No private key configured -- cannot derive public key");
    }
    return this.keypair.publicKey.toBase58();
  }

  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    const searchParams = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount.toString(),
    });

    if (params.slippageBps !== undefined) {
      searchParams.set("slippageBps", params.slippageBps.toString());
    }
    if (params.onlyDirectRoutes) {
      searchParams.set("onlyDirectRoutes", "true");
    }
    if (params.maxAccounts !== undefined) {
      searchParams.set("maxAccounts", params.maxAccounts.toString());
    }

    const res = await fetch(`${JUP_API}/swap/v1/quote?${searchParams}`, {
      headers: this.headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
    }

    return res.json();
  }

  async swap(params: QuoteParams): Promise<SwapResult> {
    if (!this.keypair) {
      throw new Error("No private key configured -- cannot sign transactions");
    }

    const quote = await this.getQuote(params);

    const swapRes = await fetch(`${JUP_API}/swap/v1/swap`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: this.publicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: "1000000",
            priorityLevel: "high",
          },
        },
      }),
    });

    if (!swapRes.ok) {
      const body = await swapRes.text();
      throw new Error(`Jupiter swap failed (${swapRes.status}): ${body}`);
    }

    const { swapTransaction, lastValidBlockHeight } = await swapRes.json();

    const txBuffer = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([this.keypair]);

    const txId = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: true, maxRetries: 2 },
    );

    const confirmation = await this.connection.confirmTransaction(
      {
        signature: txId,
        blockhash: transaction.message.recentBlockhash,
        lastValidBlockHeight,
      },
      "confirmed",
    );

    if (confirmation.value.err) {
      throw new Error(
        `Swap tx confirmed but failed: ${JSON.stringify(confirmation.value.err)}`,
      );
    }

    return {
      txId,
      inputAmount: BigInt(quote.inAmount),
      outputAmount: BigInt(quote.outAmount),
    };
  }

  async getPrice(mintAddresses: string[]): Promise<Map<string, number>> {
    const ids = mintAddresses.join(",");
    const res = await fetch(`${JUP_API}/price/v2?ids=${ids}`, {
      headers: this.headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jupiter price fetch failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const prices = new Map<string, number>();

    for (const [mint, info] of Object.entries(data.data)) {
      const priceInfo = info as { price: string } | null;
      if (priceInfo?.price) {
        prices.set(mint, parseFloat(priceInfo.price));
      }
    }

    return prices;
  }
}

// -- Usage --

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function main() {
  const apiKey = process.env.JUP_API_KEY;
  if (!apiKey) throw new Error("JUP_API_KEY is required");

  const client = new JupiterClient({
    apiKey,
    rpcUrl: process.env.SOLANA_RPC_URL,
    privateKey: process.env.SOLANA_PRIVATE_KEY,
  });

  // Fetch prices
  const prices = await client.getPrice([SOL_MINT, USDC_MINT]);
  console.log("SOL price:", prices.get(SOL_MINT));

  // Get a quote (read-only, no signing needed)
  const quote = await client.getQuote({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amount: 100_000_000n, // 0.1 SOL
    slippageBps: 50,
  });
  console.log(`Quote: ${quote.outAmount} USDC base units for 0.1 SOL`);

  // Execute a swap (requires SOLANA_PRIVATE_KEY)
  if (process.env.SOLANA_PRIVATE_KEY) {
    const result = await client.swap({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: 100_000_000n,
      slippageBps: 50,
    });
    console.log(`Swap complete: https://solscan.io/tx/${result.txId}`);
    console.log(`Received: ${result.outputAmount} USDC base units`);
  }
}

main().catch((err) => {
  console.error(`Jupiter client error: ${err.message}`);
  process.exit(1);
});
