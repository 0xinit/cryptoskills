# MetEngine Pricing

All prices in USDC (Solana Mainnet). Payment via x402 protocol -- no API keys, no subscriptions.

## Free Endpoints

| Endpoint | Price |
|----------|-------|
| `GET /health` | Free |
| `GET /api/v1/pricing` | Free |

## Polymarket Endpoints

| Endpoint | Price (USDC) |
|----------|-------------|
| `/api/v1/polymarket/wallet/{address}/score` | 0.05 |
| `/api/v1/polymarket/wallet/{address}/history` | 0.05 |
| `/api/v1/polymarket/wallet/{address}/positions` | 0.03 |
| `/api/v1/polymarket/wallet/{address}/pnl` | 0.05 |
| `/api/v1/polymarket/wallet/{address}/markets` | 0.03 |
| `/api/v1/polymarket/wallet/{address}/stats` | 0.03 |
| `/api/v1/polymarket/trending-wallets` | 0.10 |
| `/api/v1/polymarket/insider-wallets` | 0.15 |
| `/api/v1/polymarket/top-wallets` | 0.10 |
| `/api/v1/polymarket/new-wallets` | 0.10 |
| `/api/v1/polymarket/whale-wallets` | 0.10 |
| `/api/v1/polymarket/market/{conditionId}/wallets` | 0.08 |
| `/api/v1/polymarket/market/{conditionId}/flow` | 0.08 |
| `/api/v1/polymarket/market/{conditionId}/sentiment` | 0.05 |
| `/api/v1/polymarket/market/{conditionId}/stats` | 0.05 |
| `/api/v1/polymarket/market/{conditionId}/insiders` | 0.15 |
| `/api/v1/polymarket/markets/trending` | 0.10 |
| `/api/v1/polymarket/markets/hot` | 0.10 |
| `/api/v1/polymarket/markets/controversial` | 0.10 |
| `/api/v1/polymarket/leaderboard` | 0.10 |
| `/api/v1/polymarket/leaderboard/weekly` | 0.08 |
| `/api/v1/polymarket/leaderboard/monthly` | 0.08 |
| `/api/v1/polymarket/signals/flow` | 0.12 |
| `/api/v1/polymarket/signals/divergence` | 0.12 |
| `/api/v1/polymarket/signals/accumulation` | 0.12 |
| `/api/v1/polymarket/signals/exit` | 0.12 |
| `/api/v1/polymarket/signals/contrarian` | 0.12 |

## Hyperliquid Endpoints

| Endpoint | Price (USDC) |
|----------|-------------|
| `/api/v1/hyperliquid/wallet/{address}/score` | 0.05 |
| `/api/v1/hyperliquid/wallet/{address}/history` | 0.05 |
| `/api/v1/hyperliquid/wallet/{address}/positions` | 0.03 |
| `/api/v1/hyperliquid/wallet/{address}/pnl` | 0.05 |
| `/api/v1/hyperliquid/wallet/{address}/stats` | 0.03 |
| `/api/v1/hyperliquid/trending-wallets` | 0.10 |
| `/api/v1/hyperliquid/insider-wallets` | 0.15 |
| `/api/v1/hyperliquid/whale-wallets` | 0.10 |
| `/api/v1/hyperliquid/new-wallets` | 0.10 |
| `/api/v1/hyperliquid/leaderboard` | 0.10 |
| `/api/v1/hyperliquid/leaderboard/weekly` | 0.08 |
| `/api/v1/hyperliquid/leaderboard/monthly` | 0.08 |
| `/api/v1/hyperliquid/signals/flow` | 0.12 |
| `/api/v1/hyperliquid/signals/liquidation` | 0.12 |
| `/api/v1/hyperliquid/signals/accumulation` | 0.12 |
| `/api/v1/hyperliquid/signals/leverage` | 0.12 |
| `/api/v1/hyperliquid/signals/whale-move` | 0.12 |
| `/api/v1/hyperliquid/signals/divergence` | 0.12 |

## Meteora Endpoints

| Endpoint | Price (USDC) |
|----------|-------------|
| `/api/v1/meteora/wallet/{address}/score` | 0.05 |
| `/api/v1/meteora/wallet/{address}/history` | 0.05 |
| `/api/v1/meteora/wallet/{address}/positions` | 0.03 |
| `/api/v1/meteora/wallet/{address}/pnl` | 0.05 |
| `/api/v1/meteora/wallet/{address}/stats` | 0.03 |
| `/api/v1/meteora/trending-wallets` | 0.10 |
| `/api/v1/meteora/top-wallets` | 0.10 |
| `/api/v1/meteora/whale-wallets` | 0.10 |
| `/api/v1/meteora/new-wallets` | 0.10 |
| `/api/v1/meteora/pool/{address}/analytics` | 0.08 |
| `/api/v1/meteora/pool/{address}/wallets` | 0.08 |
| `/api/v1/meteora/pool/{address}/flow` | 0.08 |
| `/api/v1/meteora/pool/{address}/stats` | 0.05 |
| `/api/v1/meteora/signals/flow` | 0.12 |
| `/api/v1/meteora/signals/exit` | 0.12 |
| `/api/v1/meteora/signals/new-pool` | 0.12 |
| `/api/v1/meteora/signals/rebalance` | 0.12 |
| `/api/v1/meteora/signals/concentration` | 0.12 |

## Pricing Tiers Summary

| Tier | Price Range | Endpoint Types |
|------|-------------|----------------|
| Free | $0.00 | Health, pricing |
| Basic | $0.03 | Positions, simple stats |
| Standard | $0.05 | Scores, PnL, history, sentiment |
| Discovery | $0.08-0.10 | Trending, leaderboards, market wallets, pool analytics |
| Premium | $0.12 | Signals (flow, divergence, accumulation, etc.) |
| Insider | $0.15 | Insider wallet detection |

## Cost Estimation

| Use Case | Approx. Calls | Estimated Cost |
|----------|---------------|----------------|
| Score a single wallet on one platform | 1 | $0.05 |
| Full wallet analysis (score + history + positions + PnL) | 4 | $0.16 |
| Trending wallets scan (all 3 platforms) | 3 | $0.30 |
| Score top 10 trending wallets on one platform | 11 | $0.60 |
| Full dashboard refresh (trending + top 5 scored, all platforms) | 18 | $1.05 |

## Notes

- Prices are per-request and deducted via x402 Solana USDC transfer
- Check `GET /api/v1/pricing` for the authoritative live pricing -- amounts may change
- No subscriptions, no rate limits on paid endpoints, no minimum spend
- Each payment proof is single-use and expires 5 minutes after on-chain confirmation
