# Query Polymarket Smart Money Wallets

Track and analyze the sharpest bettors on Polymarket using MetEngine's smart money scoring and trending wallet endpoints.

## What This Builds

A TypeScript script that:
- Fetches trending Polymarket wallets ranked by profitability
- Scores individual wallets for betting accuracy
- Retrieves insider wallet activity on specific markets
- Handles x402 payment flow automatically

## Prerequisites

- Node.js 18+
- Solana wallet with USDC (Mainnet) for x402 payments
- `@solana/web3.js` and `bs58` packages

## Install

```bash
npm install @solana/web3.js bs58
```

## x402 Payment Flow

MetEngine uses x402 protocol — no API keys. Every paid request follows this cycle:

1. Send request to endpoint
2. Receive 402 response with payment details (amount, recipient, token)
3. Sign and send USDC transfer on Solana Mainnet
4. Retry original request with payment proof in header

```typescript
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

const BASE_URL = "https://agent.metengine.xyz";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
// USDC on Solana Mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

interface PaymentDetails {
  recipient: string;
  amount: number;
  token: string;
  memo: string;
}

async function makePayment(
  connection: Connection,
  payer: Keypair,
  details: PaymentDetails
): Promise<string> {
  const payerAta = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);
  const recipientPubkey = new PublicKey(details.recipient);
  const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  // USDC has 6 decimals
  const amountInSmallestUnit = BigInt(Math.round(details.amount * 1_000_000));

  const transferIx = createTransferInstruction(
    payerAta,
    recipientAta,
    payer.publicKey,
    amountInSmallestUnit,
    [],
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(transferIx);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer.publicKey;
  transaction.sign(payer);

  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
```

## Fetch Trending Polymarket Wallets

```typescript
interface TrendingWallet {
  address: string;
  score: number;
  pnl: number;
  winRate: number;
  totalBets: number;
}

async function fetchTrendingWallets(
  connection: Connection,
  payer: Keypair
): Promise<TrendingWallet[]> {
  const url = `${BASE_URL}/api/v1/polymarket/trending-wallets`;

  const initialResponse = await fetch(url);

  if (initialResponse.status === 402) {
    const paymentDetails: PaymentDetails = await initialResponse.json();
    const signature = await makePayment(connection, payer, paymentDetails);

    const paidResponse = await fetch(url, {
      headers: {
        "X-Payment-Proof": signature,
      },
    });

    if (!paidResponse.ok) {
      throw new Error(
        `Trending wallets request failed after payment: ${paidResponse.status}`
      );
    }

    return paidResponse.json();
  }

  if (!initialResponse.ok) {
    throw new Error(`Trending wallets request failed: ${initialResponse.status}`);
  }

  return initialResponse.json();
}
```

## Score a Specific Wallet

```typescript
interface WalletScore {
  address: string;
  overallScore: number;
  profitScore: number;
  consistencyScore: number;
  volumeScore: number;
  recentActivity: {
    markets: number;
    pnl: number;
    winRate: number;
  };
}

async function scoreWallet(
  connection: Connection,
  payer: Keypair,
  walletAddress: string
): Promise<WalletScore> {
  const url = `${BASE_URL}/api/v1/polymarket/wallet/${walletAddress}/score`;

  const initialResponse = await fetch(url);

  if (initialResponse.status === 402) {
    const paymentDetails: PaymentDetails = await initialResponse.json();
    const signature = await makePayment(connection, payer, paymentDetails);

    const paidResponse = await fetch(url, {
      headers: {
        "X-Payment-Proof": signature,
      },
    });

    if (!paidResponse.ok) {
      throw new Error(`Wallet score request failed after payment: ${paidResponse.status}`);
    }

    return paidResponse.json();
  }

  if (!initialResponse.ok) {
    throw new Error(`Wallet score request failed: ${initialResponse.status}`);
  }

  return initialResponse.json();
}
```

## Get Insider Wallets for a Market

```typescript
interface InsiderWallet {
  address: string;
  position: "yes" | "no";
  size: number;
  entryPrice: number;
  score: number;
}

async function getMarketInsiders(
  connection: Connection,
  payer: Keypair,
  conditionId: string
): Promise<InsiderWallet[]> {
  const url = `${BASE_URL}/api/v1/polymarket/market/${conditionId}/wallets`;

  const initialResponse = await fetch(url);

  if (initialResponse.status === 402) {
    const paymentDetails: PaymentDetails = await initialResponse.json();
    const signature = await makePayment(connection, payer, paymentDetails);

    const paidResponse = await fetch(url, {
      headers: {
        "X-Payment-Proof": signature,
      },
    });

    if (!paidResponse.ok) {
      throw new Error(`Market insiders request failed after payment: ${paidResponse.status}`);
    }

    return paidResponse.json();
  }

  if (!initialResponse.ok) {
    throw new Error(`Market insiders request failed: ${initialResponse.status}`);
  }

  return initialResponse.json();
}
```

## Full Example: Smart Money Scanner

```typescript
async function scanPolymarketSmartMoney(): Promise<void> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const payer = Keypair.fromSecretKey(
    bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
  );

  const trending = await fetchTrendingWallets(connection, payer);
  console.log(`Found ${trending.length} trending wallets`);

  const topWallets = trending.slice(0, 5);

  for (const wallet of topWallets) {
    const score = await scoreWallet(connection, payer, wallet.address);
    console.log(
      `Wallet: ${wallet.address} | Score: ${score.overallScore} | ` +
      `Win Rate: ${score.recentActivity.winRate}% | PnL: $${score.recentActivity.pnl}`
    );
  }
}

scanPolymarketSmartMoney().catch((error) => {
  console.error(`Smart money scan failed: ${error.message}`);
  process.exit(1);
});
```

## Key Points

- Every paid endpoint returns 402 on first call with payment instructions
- Payment is a standard Solana USDC transfer — sign and send, then retry
- The `X-Payment-Proof` header carries the Solana transaction signature
- Wallet scores range from 0-100 across multiple dimensions
- Trending wallets are ranked by recent profitability and volume
- Use `GET /health` and `GET /api/v1/pricing` for free without payment
