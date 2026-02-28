import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

const BASE_URL = "https://agent.metengine.xyz";
// USDC on Solana Mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// x402 payment proofs expire after this window
const PROOF_HEADER = "X-Payment-Proof";

interface PaymentDetails {
  recipient: string;
  amount: number;
  token: string;
  memo: string;
}

type Platform = "polymarket" | "hyperliquid" | "meteora";

export class MetEngineClient {
  private connection: Connection;
  private payer: Keypair;

  constructor(solanaRpcUrl: string, payerPrivateKey: string) {
    this.connection = new Connection(solanaRpcUrl, "confirmed");
    this.payer = Keypair.fromSecretKey(bs58.decode(payerPrivateKey));
  }

  async health(): Promise<{ status: string; uptime: number; version: string }> {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  async pricing(): Promise<Record<string, { price: number; unit: string }>> {
    const response = await fetch(`${BASE_URL}/api/v1/pricing`);
    if (!response.ok) {
      throw new Error(`Pricing request failed: ${response.status}`);
    }
    return response.json();
  }

  async walletScore(platform: Platform, address: string): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/${platform}/wallet/${address}/score`
    );
  }

  async walletHistory(platform: Platform, address: string): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/${platform}/wallet/${address}/history`
    );
  }

  async walletPositions(platform: Platform, address: string): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/${platform}/wallet/${address}/positions`
    );
  }

  async walletPnl(platform: Platform, address: string): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/${platform}/wallet/${address}/pnl`
    );
  }

  async trendingWallets(platform: Platform): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/${platform}/trending-wallets`
    );
  }

  async insiderWallets(platform: Platform): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/${platform}/insider-wallets`
    );
  }

  async leaderboard(platform: "polymarket" | "hyperliquid"): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/${platform}/leaderboard`
    );
  }

  async poolAnalytics(poolAddress: string): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/meteora/pool/${poolAddress}/analytics`
    );
  }

  async marketWallets(conditionId: string): Promise<unknown> {
    return this.paidRequest(
      `${BASE_URL}/api/v1/polymarket/market/${conditionId}/wallets`
    );
  }

  private async paidRequest<T>(url: string): Promise<T> {
    const initialResponse = await fetch(url);

    if (initialResponse.status === 402) {
      const paymentDetails: PaymentDetails = await initialResponse.json();
      const signature = await this.executePayment(paymentDetails);

      const paidResponse = await fetch(url, {
        headers: { [PROOF_HEADER]: signature },
      });

      if (!paidResponse.ok) {
        const errorBody = await paidResponse.text();
        throw new Error(
          `Request failed after payment (${paidResponse.status}): ${errorBody}`
        );
      }

      return paidResponse.json();
    }

    if (!initialResponse.ok) {
      const errorBody = await initialResponse.text();
      throw new Error(
        `Request failed (${initialResponse.status}): ${errorBody}`
      );
    }

    return initialResponse.json();
  }

  private async executePayment(details: PaymentDetails): Promise<string> {
    const payerAta = await getAssociatedTokenAddress(
      USDC_MINT,
      this.payer.publicKey
    );
    const recipientPubkey = new PublicKey(details.recipient);
    const recipientAta = await getAssociatedTokenAddress(
      USDC_MINT,
      recipientPubkey
    );

    // USDC has 6 decimals; Math.round prevents floating point truncation
    const amountInSmallestUnit = BigInt(Math.round(details.amount * 1_000_000));

    const transferIx = createTransferInstruction(
      payerAta,
      recipientAta,
      this.payer.publicKey,
      amountInSmallestUnit,
      [],
      TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(transferIx);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.payer.publicKey;
    transaction.sign(this.payer);

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize()
    );
    await this.connection.confirmTransaction(signature, "confirmed");

    return signature;
  }
}

// Usage:
//
// const client = new MetEngineClient(
//   "https://api.mainnet-beta.solana.com",
//   process.env.SOLANA_PRIVATE_KEY!
// );
//
// const health = await client.health();
// const trending = await client.trendingWallets("polymarket");
// const score = await client.walletScore("hyperliquid", "0x1234...");
// const pool = await client.poolAnalytics("FtBiMyCGFDMkJQmkA79YFdRMULbt5j5JYXBrdmRm1LiE");
