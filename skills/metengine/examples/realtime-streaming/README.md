# Track Hyperliquid Whale Positions

Monitor large traders on Hyperliquid using MetEngine's wallet scoring, leaderboard, and insider detection endpoints.

## What This Builds

A TypeScript script that:
- Pulls the Hyperliquid leaderboard for top PnL traders
- Scores individual whale wallets for trading skill
- Detects insider wallets with unusual position sizing
- Polls for trending wallet changes at regular intervals

## Prerequisites

- Node.js 18+
- Solana wallet with USDC (Mainnet) for x402 payments
- `@solana/web3.js` and `bs58` packages

## Install

```bash
npm install @solana/web3.js bs58
```

## x402 Payment Helper

Reusable function that handles the 402 payment cycle for any endpoint.

```typescript
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

const BASE_URL = "https://agent.metengine.xyz";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

interface PaymentDetails {
  recipient: string;
  amount: number;
  token: string;
  memo: string;
}

async function paidFetch<T>(
  url: string,
  connection: Connection,
  payer: Keypair
): Promise<T> {
  const initialResponse = await fetch(url);

  if (initialResponse.status === 402) {
    const paymentDetails: PaymentDetails = await initialResponse.json();

    const payerAta = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);
    const recipientPubkey = new PublicKey(paymentDetails.recipient);
    const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

    const amountInSmallestUnit = BigInt(Math.round(paymentDetails.amount * 1_000_000));

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

    const paidResponse = await fetch(url, {
      headers: { "X-Payment-Proof": signature },
    });

    if (!paidResponse.ok) {
      throw new Error(`Request failed after payment: ${paidResponse.status} ${url}`);
    }

    return paidResponse.json();
  }

  if (!initialResponse.ok) {
    throw new Error(`Request failed: ${initialResponse.status} ${url}`);
  }

  return initialResponse.json();
}
```

## Fetch Hyperliquid Leaderboard

```typescript
interface LeaderboardEntry {
  address: string;
  pnl: number;
  volume: number;
  winRate: number;
  rank: number;
}

async function fetchLeaderboard(
  connection: Connection,
  payer: Keypair
): Promise<LeaderboardEntry[]> {
  return paidFetch<LeaderboardEntry[]>(
    `${BASE_URL}/api/v1/hyperliquid/leaderboard`,
    connection,
    payer
  );
}
```

## Score a Hyperliquid Wallet

```typescript
interface HyperliquidWalletScore {
  address: string;
  overallScore: number;
  tradingSkill: number;
  riskManagement: number;
  consistency: number;
  openPositions: {
    asset: string;
    side: "long" | "short";
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
  }[];
}

async function scoreHyperliquidWallet(
  connection: Connection,
  payer: Keypair,
  walletAddress: string
): Promise<HyperliquidWalletScore> {
  return paidFetch<HyperliquidWalletScore>(
    `${BASE_URL}/api/v1/hyperliquid/wallet/${walletAddress}/score`,
    connection,
    payer
  );
}
```

## Detect Insider Wallets

```typescript
interface InsiderWallet {
  address: string;
  score: number;
  suspicionLevel: "low" | "medium" | "high";
  unusualActivity: string[];
  recentPnl: number;
}

async function fetchInsiderWallets(
  connection: Connection,
  payer: Keypair
): Promise<InsiderWallet[]> {
  return paidFetch<InsiderWallet[]>(
    `${BASE_URL}/api/v1/hyperliquid/insider-wallets`,
    connection,
    payer
  );
}
```

## Fetch Trending Wallets

```typescript
interface TrendingWallet {
  address: string;
  score: number;
  trendReason: string;
  recentVolume: number;
  pnl24h: number;
}

async function fetchTrendingWallets(
  connection: Connection,
  payer: Keypair
): Promise<TrendingWallet[]> {
  return paidFetch<TrendingWallet[]>(
    `${BASE_URL}/api/v1/hyperliquid/trending-wallets`,
    connection,
    payer
  );
}
```

## Polling for Whale Activity

```typescript
async function pollWhaleActivity(
  connection: Connection,
  payer: Keypair,
  intervalMs: number = 60_000
): Promise<void> {
  let previousAddresses = new Set<string>();

  const poll = async (): Promise<void> => {
    try {
      const trending = await fetchTrendingWallets(connection, payer);
      const currentAddresses = new Set(trending.map((w) => w.address));

      const newWhales = trending.filter((w) => !previousAddresses.has(w.address));

      if (newWhales.length > 0) {
        console.log(`${newWhales.length} new trending whale(s) detected:`);
        for (const whale of newWhales) {
          const score = await scoreHyperliquidWallet(connection, payer, whale.address);
          console.log(
            `  ${whale.address} | Score: ${score.overallScore} | ` +
            `Positions: ${score.openPositions.length} | 24h PnL: $${whale.pnl24h}`
          );
        }
      }

      previousAddresses = currentAddresses;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Polling failed: ${error.message}`);
      }
    }
  };

  await poll();
  setInterval(() => void poll(), intervalMs);
}
```

## Full Example: Whale Tracker

```typescript
async function trackHyperliquidWhales(): Promise<void> {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const payer = Keypair.fromSecretKey(
    bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
  );

  console.log("Fetching Hyperliquid leaderboard...");
  const leaderboard = await fetchLeaderboard(connection, payer);
  console.log(`Top ${leaderboard.length} traders loaded`);

  for (const entry of leaderboard.slice(0, 3)) {
    const score = await scoreHyperliquidWallet(connection, payer, entry.address);
    console.log(
      `#${entry.rank} ${entry.address}\n` +
      `  PnL: $${entry.pnl} | Win Rate: ${entry.winRate}%\n` +
      `  Trading Skill: ${score.tradingSkill} | Risk Mgmt: ${score.riskManagement}\n` +
      `  Open Positions: ${score.openPositions.length}`
    );
  }

  console.log("\nChecking for insider activity...");
  const insiders = await fetchInsiderWallets(connection, payer);
  const highSuspicion = insiders.filter((w) => w.suspicionLevel === "high");
  console.log(`${highSuspicion.length} high-suspicion wallets found`);

  console.log("\nStarting whale activity polling (60s interval)...");
  await pollWhaleActivity(connection, payer, 60_000);
}

trackHyperliquidWhales().catch((error) => {
  console.error(`Whale tracker failed: ${error.message}`);
  process.exit(1);
});
```

## Key Points

- Hyperliquid endpoints cover leaderboard, wallet scoring, insider detection, and trending wallets
- The `paidFetch` helper abstracts the x402 payment cycle for any endpoint
- Polling detects new trending wallets by diffing against the previous set
- Each wallet score breaks down into trading skill, risk management, and consistency
- Open positions include asset, side, size, entry price, and unrealized PnL
- Payment is per-request — poll interval affects cost
