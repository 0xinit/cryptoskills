# Build a Multi-Platform Smart Money Dashboard

Combine Polymarket, Hyperliquid, and Meteora data from MetEngine into a unified dashboard that cross-references smart money activity across platforms.

## What This Builds

A TypeScript application that:
- Aggregates trending wallets from all three platforms
- Cross-references addresses that appear on multiple platforms
- Builds a composite smart money score across platforms
- Outputs a ranked dashboard of the most active smart money wallets

## Prerequisites

- Node.js 18+
- Solana wallet with USDC (Mainnet) for x402 payments
- `@solana/web3.js` and `bs58` packages

## Install

```bash
npm install @solana/web3.js bs58
```

## Shared Types and Payment Client

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

type Platform = "polymarket" | "hyperliquid" | "meteora";

interface PlatformWallet {
  address: string;
  score: number;
  platform: Platform;
  pnl: number;
}

interface CrossPlatformProfile {
  address: string;
  platforms: Platform[];
  scores: Record<Platform, number>;
  compositeScore: number;
  totalPnl: number;
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

## Fetch Trending Wallets from All Platforms

```typescript
async function fetchAllTrendingWallets(
  connection: Connection,
  payer: Keypair
): Promise<PlatformWallet[]> {
  const platforms: Platform[] = ["polymarket", "hyperliquid", "meteora"];
  const allWallets: PlatformWallet[] = [];

  for (const platform of platforms) {
    try {
      const wallets = await paidFetch<PlatformWallet[]>(
        `${BASE_URL}/api/v1/${platform}/trending-wallets`,
        connection,
        payer
      );

      const tagged = wallets.map((w) => ({ ...w, platform }));
      allWallets.push(...tagged);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch ${platform} wallets: ${error.message}`);
      }
    }
  }

  return allWallets;
}
```

## Cross-Reference Wallets Across Platforms

```typescript
function buildCrossPlatformProfiles(
  wallets: PlatformWallet[]
): CrossPlatformProfile[] {
  const profileMap = new Map<string, CrossPlatformProfile>();

  for (const wallet of wallets) {
    const existing = profileMap.get(wallet.address);

    if (existing) {
      existing.platforms.push(wallet.platform);
      existing.scores[wallet.platform] = wallet.score;
      existing.totalPnl += wallet.pnl;
    } else {
      profileMap.set(wallet.address, {
        address: wallet.address,
        platforms: [wallet.platform],
        scores: { [wallet.platform]: wallet.score } as Record<Platform, number>,
        compositeScore: 0,
        totalPnl: wallet.pnl,
      });
    }
  }

  for (const profile of profileMap.values()) {
    const platformScores = Object.values(profile.scores).filter(
      (s): s is number => s !== undefined
    );
    const avgScore =
      platformScores.reduce((sum, s) => sum + s, 0) / platformScores.length;

    // Wallets active on multiple platforms get a multiplier
    const platformMultiplier = 1 + (profile.platforms.length - 1) * 0.15;
    profile.compositeScore = Math.round(avgScore * platformMultiplier);
  }

  return Array.from(profileMap.values()).sort(
    (a, b) => b.compositeScore - a.compositeScore
  );
}
```

## Deep Score a Wallet on Each Platform

```typescript
interface DetailedProfile extends CrossPlatformProfile {
  detailedScores: Record<string, unknown>[];
}

async function deepScoreWallet(
  connection: Connection,
  payer: Keypair,
  profile: CrossPlatformProfile
): Promise<DetailedProfile> {
  const detailedScores: Record<string, unknown>[] = [];

  for (const platform of profile.platforms) {
    try {
      const score = await paidFetch<Record<string, unknown>>(
        `${BASE_URL}/api/v1/${platform}/wallet/${profile.address}/score`,
        connection,
        payer
      );
      detailedScores.push({ platform, ...score });
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Failed to score ${profile.address} on ${platform}: ${error.message}`
        );
      }
    }
  }

  return { ...profile, detailedScores };
}
```

## Check API Health and Pricing

```typescript
interface HealthStatus {
  status: string;
  uptime: number;
  version: string;
}

interface PricingInfo {
  endpoints: Record<string, { price: number; unit: string }>;
}

async function checkHealthAndPricing(): Promise<{
  health: HealthStatus;
  pricing: PricingInfo;
}> {
  const healthResponse = await fetch(`${BASE_URL}/health`);
  if (!healthResponse.ok) {
    throw new Error(`Health check failed: ${healthResponse.status}`);
  }
  const health: HealthStatus = await healthResponse.json();

  const pricingResponse = await fetch(`${BASE_URL}/api/v1/pricing`);
  if (!pricingResponse.ok) {
    throw new Error(`Pricing check failed: ${pricingResponse.status}`);
  }
  const pricing: PricingInfo = await pricingResponse.json();

  return { health, pricing };
}
```

## Full Example: Multi-Platform Dashboard

```typescript
async function buildDashboard(): Promise<void> {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const payer = Keypair.fromSecretKey(
    bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
  );

  const { health, pricing } = await checkHealthAndPricing();
  console.log(`API Status: ${health.status} | Version: ${health.version}\n`);

  console.log("Fetching trending wallets across all platforms...");
  const allWallets = await fetchAllTrendingWallets(connection, payer);
  console.log(`Total wallets collected: ${allWallets.length}\n`);

  const profiles = buildCrossPlatformProfiles(allWallets);
  const multiPlatform = profiles.filter((p) => p.platforms.length > 1);

  console.log(`=== Multi-Platform Smart Money (${multiPlatform.length} wallets) ===\n`);

  for (const profile of multiPlatform.slice(0, 10)) {
    const detailed = await deepScoreWallet(connection, payer, profile);
    console.log(
      `${detailed.address}\n` +
      `  Platforms: ${detailed.platforms.join(", ")}\n` +
      `  Composite Score: ${detailed.compositeScore}\n` +
      `  Total PnL: $${detailed.totalPnl}\n` +
      `  Detailed Scores: ${detailed.detailedScores.length} platform(s) scored\n`
    );
  }

  console.log(`\n=== Top 20 by Composite Score ===\n`);

  for (const [index, profile] of profiles.slice(0, 20).entries()) {
    console.log(
      `${index + 1}. ${profile.address} | ` +
      `Score: ${profile.compositeScore} | ` +
      `Platforms: ${profile.platforms.join(", ")} | ` +
      `PnL: $${profile.totalPnl}`
    );
  }
}

buildDashboard().catch((error) => {
  console.error(`Dashboard build failed: ${error.message}`);
  process.exit(1);
});
```

## Key Points

- The dashboard aggregates data from all three MetEngine platforms (Polymarket, Hyperliquid, Meteora)
- Wallets active across multiple platforms receive a composite score boost (15% per additional platform)
- `GET /health` and `GET /api/v1/pricing` are free endpoints -- use them to verify API status before paid calls
- Each paid API call incurs a separate x402 payment -- batch calls where possible
- Cross-platform wallets are rare but highly informative for identifying sophisticated traders
- The composite scoring formula is customizable -- adjust the multiplier based on your strategy
