# Analyze Meteora Pool Analytics

Use MetEngine to discover profitable Meteora liquidity pools, analyze pool performance, and score LP wallets.

## What This Builds

A TypeScript script that:
- Fetches trending Meteora LP wallets
- Analyzes specific pool metrics (volume, fees, TVL, impermanent loss)
- Scores wallets for LP strategy effectiveness
- Compares pool performance across multiple pools

## Prerequisites

- Node.js 18+
- Solana wallet with USDC (Mainnet) for x402 payments
- `@solana/web3.js` and `bs58` packages

## Install

```bash
npm install @solana/web3.js bs58
```

## x402 Payment Helper

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

## Fetch Pool Analytics

```typescript
interface PoolAnalytics {
  poolAddress: string;
  tokenA: { mint: string; symbol: string };
  tokenB: { mint: string; symbol: string };
  tvl: number;
  volume24h: number;
  fees24h: number;
  apr: number;
  impermanentLoss7d: number;
  binStep: number;
  activePositions: number;
}

async function fetchPoolAnalytics(
  connection: Connection,
  payer: Keypair,
  poolAddress: string
): Promise<PoolAnalytics> {
  return paidFetch<PoolAnalytics>(
    `${BASE_URL}/api/v1/meteora/pool/${poolAddress}/analytics`,
    connection,
    payer
  );
}
```

## Fetch Trending LP Wallets

```typescript
interface TrendingLpWallet {
  address: string;
  score: number;
  totalFeesEarned: number;
  activePools: number;
  strategy: string;
}

async function fetchTrendingLpWallets(
  connection: Connection,
  payer: Keypair
): Promise<TrendingLpWallet[]> {
  return paidFetch<TrendingLpWallet[]>(
    `${BASE_URL}/api/v1/meteora/trending-wallets`,
    connection,
    payer
  );
}
```

## Score an LP Wallet

```typescript
interface MeteoraWalletScore {
  address: string;
  overallScore: number;
  lpEfficiency: number;
  rangeAccuracy: number;
  feeCapture: number;
  positions: {
    pool: string;
    binRange: [number, number];
    liquidity: number;
    feesEarned: number;
    impermanentLoss: number;
  }[];
}

async function scoreLpWallet(
  connection: Connection,
  payer: Keypair,
  walletAddress: string
): Promise<MeteoraWalletScore> {
  return paidFetch<MeteoraWalletScore>(
    `${BASE_URL}/api/v1/meteora/wallet/${walletAddress}/score`,
    connection,
    payer
  );
}
```

## Compare Multiple Pools

```typescript
interface PoolComparison {
  poolAddress: string;
  pair: string;
  apr: number;
  tvl: number;
  volume24h: number;
  netReturn7d: number;
}

async function comparePools(
  connection: Connection,
  payer: Keypair,
  poolAddresses: string[]
): Promise<PoolComparison[]> {
  const results: PoolComparison[] = [];

  for (const address of poolAddresses) {
    const analytics = await fetchPoolAnalytics(connection, payer, address);
    // Net return accounts for fees earned minus impermanent loss
    const netReturn7d = analytics.fees24h * 7 - analytics.impermanentLoss7d;

    results.push({
      poolAddress: address,
      pair: `${analytics.tokenA.symbol}/${analytics.tokenB.symbol}`,
      apr: analytics.apr,
      tvl: analytics.tvl,
      volume24h: analytics.volume24h,
      netReturn7d,
    });
  }

  return results.sort((a, b) => b.netReturn7d - a.netReturn7d);
}
```

## Full Example: Meteora Pool Scanner

```typescript
async function scanMeteoraPools(): Promise<void> {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const payer = Keypair.fromSecretKey(
    bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
  );

  console.log("Fetching trending Meteora LP wallets...");
  const trending = await fetchTrendingLpWallets(connection, payer);
  console.log(`Found ${trending.length} trending LP wallets\n`);

  for (const wallet of trending.slice(0, 3)) {
    const score = await scoreLpWallet(connection, payer, wallet.address);
    console.log(
      `Wallet: ${wallet.address}\n` +
      `  Score: ${score.overallScore} | LP Efficiency: ${score.lpEfficiency}\n` +
      `  Range Accuracy: ${score.rangeAccuracy} | Fee Capture: ${score.feeCapture}\n` +
      `  Active Positions: ${score.positions.length}\n`
    );

    for (const pos of score.positions) {
      console.log(
        `    Pool: ${pos.pool} | Bins: [${pos.binRange[0]}, ${pos.binRange[1]}]\n` +
        `    Liquidity: $${pos.liquidity} | Fees: $${pos.feesEarned} | IL: $${pos.impermanentLoss}`
      );
    }
  }

  // Compare specific pools — replace with actual Meteora pool addresses
  const poolAddresses = [
    "FtBiMyCGFDMkJQmkA79YFdRMULbt5j5JYXBrdmRm1LiE",
    "83v8iPyZBDsYhKcGpHo61ECfSP8TV4XZUT3DUg7kQVGb",
  ];

  console.log("\nComparing pools...");
  const comparison = await comparePools(connection, payer, poolAddresses);
  for (const pool of comparison) {
    console.log(
      `${pool.pair} (${pool.poolAddress})\n` +
      `  APR: ${pool.apr}% | TVL: $${pool.tvl} | Vol 24h: $${pool.volume24h}\n` +
      `  Net 7d Return: $${pool.netReturn7d}`
    );
  }
}

scanMeteoraPools().catch((error) => {
  console.error(`Meteora scan failed: ${error.message}`);
  process.exit(1);
});
```

## Key Points

- Meteora endpoints cover pool analytics, wallet scoring, and trending LP wallets
- Pool analytics include TVL, volume, fees, APR, impermanent loss, and bin step
- Wallet scores break down into LP efficiency, range accuracy, and fee capture
- DLMM (Dynamic Liquidity Market Maker) positions use bin ranges instead of price ranges
- Net return = fees earned minus impermanent loss over the period
- Compare pools by sorting on net return rather than raw APR
