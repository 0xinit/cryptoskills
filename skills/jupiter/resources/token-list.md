# Common Solana Token Mints

Frequently used token mint addresses for Jupiter swaps.

Last verified: 2026-02-26

## Native and Major Tokens

| Token | Mint Address | Decimals |
|-------|-------------|----------|
| SOL (Wrapped) | `So11111111111111111111111111111111111111112` | 9 |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | 6 |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | 6 |

## Stablecoins

| Token | Mint Address | Decimals |
|-------|-------------|----------|
| PYUSD | `2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo` | 6 |
| UXD | `7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT` | 6 |

## Liquid Staking Tokens

| Token | Mint Address | Decimals |
|-------|-------------|----------|
| mSOL (Marinade) | `mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So` | 9 |
| jitoSOL | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | 9 |
| bSOL (BlazeStake) | `bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1` | 9 |

## DeFi Tokens

| Token | Mint Address | Decimals |
|-------|-------------|----------|
| RAY (Raydium) | `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R` | 6 |
| ORCA | `orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE` | 6 |
| MNDE (Marinade) | `MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey` | 9 |

## Memecoins

| Token | Mint Address | Decimals |
|-------|-------------|----------|
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | 5 |
| WIF | `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm` | 6 |

## Fetching the Full Token List

Use Jupiter's Token API to get all tradeable tokens or verified-only tokens:

```typescript
// All tradeable tokens
const allTokens = await fetch("https://api.jup.ag/tokens/v1", {
  headers: { "x-api-key": API_KEY },
}).then((res) => {
  if (!res.ok) throw new Error(`Token list fetch failed: ${res.status}`);
  return res.json();
});

// Verified tokens only (stricter list)
const verifiedTokens = await fetch("https://api.jup.ag/tokens/v1/strict", {
  headers: { "x-api-key": API_KEY },
}).then((res) => {
  if (!res.ok) throw new Error(`Verified token list fetch failed: ${res.status}`);
  return res.json();
});

// Single token metadata
const tokenInfo = await fetch("https://api.jup.ag/tokens/v1/token/So11111111111111111111111111111111111111112", {
  headers: { "x-api-key": API_KEY },
}).then((res) => {
  if (!res.ok) throw new Error(`Token info fetch failed: ${res.status}`);
  return res.json();
});
```

## Amount Conversion

Token amounts in Jupiter APIs use base units (smallest denomination). Convert between human-readable and base units:

```typescript
const USDC_DECIMALS = 6;

function toBaseUnits(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}

function fromBaseUnits(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

const fiveUsdc = toBaseUnits(5, USDC_DECIMALS);  // 5_000_000n
const readable = fromBaseUnits(5_000_000n, USDC_DECIMALS);  // 5
```

## Notes

- Always verify mint addresses on-chain or via `GET /tokens/v1/token/{mint}` before using in production
- New tokens appear on Jupiter once they have sufficient liquidity in a supported DEX pool
- The verified list (`/tokens/v1/strict`) excludes unverified and potentially fraudulent tokens
