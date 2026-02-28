# MetEngine Endpoint Reference

Base URL: `https://agent.metengine.xyz`

63 total endpoints: 27 Polymarket, 18 Hyperliquid, 18 Meteora, plus free utility endpoints.

## Free Endpoints (No Payment Required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API health check, uptime, version |
| GET | `/api/v1/pricing` | Per-endpoint pricing in USDC |

## Polymarket Endpoints (27)

### Wallet Analysis

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/polymarket/wallet/{address}/score` | Composite smart money score for a wallet |
| GET | `/api/v1/polymarket/wallet/{address}/history` | Betting history and resolved positions |
| GET | `/api/v1/polymarket/wallet/{address}/positions` | Current open positions |
| GET | `/api/v1/polymarket/wallet/{address}/pnl` | Realized and unrealized PnL breakdown |
| GET | `/api/v1/polymarket/wallet/{address}/markets` | Markets the wallet has participated in |
| GET | `/api/v1/polymarket/wallet/{address}/stats` | Win rate, avg bet size, frequency |

### Discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/polymarket/trending-wallets` | Wallets gaining profitability recently |
| GET | `/api/v1/polymarket/insider-wallets` | Wallets with suspected insider activity |
| GET | `/api/v1/polymarket/top-wallets` | All-time highest-scoring wallets |
| GET | `/api/v1/polymarket/new-wallets` | Recently active wallets with high early scores |
| GET | `/api/v1/polymarket/whale-wallets` | Wallets with largest position sizes |

### Market Analysis

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/polymarket/market/{conditionId}/wallets` | Smart money wallets in a specific market |
| GET | `/api/v1/polymarket/market/{conditionId}/flow` | Buy/sell flow from scored wallets |
| GET | `/api/v1/polymarket/market/{conditionId}/sentiment` | Aggregated smart money sentiment |
| GET | `/api/v1/polymarket/market/{conditionId}/stats` | Market-level statistics |
| GET | `/api/v1/polymarket/market/{conditionId}/insiders` | Insider wallets in this market |

### Aggregations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/polymarket/markets/trending` | Markets with increasing smart money activity |
| GET | `/api/v1/polymarket/markets/hot` | Markets with sudden volume spikes |
| GET | `/api/v1/polymarket/markets/controversial` | Markets where smart money is split |
| GET | `/api/v1/polymarket/leaderboard` | PnL-ranked leaderboard |
| GET | `/api/v1/polymarket/leaderboard/weekly` | Weekly leaderboard snapshot |
| GET | `/api/v1/polymarket/leaderboard/monthly` | Monthly leaderboard snapshot |

### Signals

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/polymarket/signals/flow` | Real-time smart money flow signals |
| GET | `/api/v1/polymarket/signals/divergence` | Price-sentiment divergence alerts |
| GET | `/api/v1/polymarket/signals/accumulation` | Wallets quietly accumulating positions |
| GET | `/api/v1/polymarket/signals/exit` | Smart money exiting positions |
| GET | `/api/v1/polymarket/signals/contrarian` | Smart money betting against consensus |

## Hyperliquid Endpoints (18)

### Wallet Analysis

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/hyperliquid/wallet/{address}/score` | Composite trading skill score |
| GET | `/api/v1/hyperliquid/wallet/{address}/history` | Trade history with PnL per trade |
| GET | `/api/v1/hyperliquid/wallet/{address}/positions` | Current open perp positions |
| GET | `/api/v1/hyperliquid/wallet/{address}/pnl` | Detailed PnL by asset and timeframe |
| GET | `/api/v1/hyperliquid/wallet/{address}/stats` | Win rate, avg leverage, frequency |

### Discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/hyperliquid/trending-wallets` | Wallets with recent high performance |
| GET | `/api/v1/hyperliquid/insider-wallets` | Wallets with suspicious pre-move activity |
| GET | `/api/v1/hyperliquid/whale-wallets` | Largest position holders |
| GET | `/api/v1/hyperliquid/new-wallets` | New wallets with strong early results |

### Leaderboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/hyperliquid/leaderboard` | All-time PnL leaderboard |
| GET | `/api/v1/hyperliquid/leaderboard/weekly` | Weekly PnL leaderboard |
| GET | `/api/v1/hyperliquid/leaderboard/monthly` | Monthly PnL leaderboard |

### Signals

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/hyperliquid/signals/flow` | Large position open/close signals |
| GET | `/api/v1/hyperliquid/signals/liquidation` | Approaching liquidation alerts |
| GET | `/api/v1/hyperliquid/signals/accumulation` | Quiet position building detection |
| GET | `/api/v1/hyperliquid/signals/leverage` | Unusual leverage change alerts |
| GET | `/api/v1/hyperliquid/signals/whale-move` | Large wallet position changes |
| GET | `/api/v1/hyperliquid/signals/divergence` | Funding rate vs position divergence |

## Meteora Endpoints (18)

### Wallet Analysis

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/meteora/wallet/{address}/score` | LP strategy effectiveness score |
| GET | `/api/v1/meteora/wallet/{address}/history` | Position open/close history |
| GET | `/api/v1/meteora/wallet/{address}/positions` | Current LP positions |
| GET | `/api/v1/meteora/wallet/{address}/pnl` | Fees earned minus impermanent loss |
| GET | `/api/v1/meteora/wallet/{address}/stats` | Pool count, avg duration, rebalance freq |

### Discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/meteora/trending-wallets` | LPs with highest recent fee capture |
| GET | `/api/v1/meteora/top-wallets` | All-time best-performing LPs |
| GET | `/api/v1/meteora/whale-wallets` | Largest liquidity providers |
| GET | `/api/v1/meteora/new-wallets` | New LPs with strong early results |

### Pool Analysis

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/meteora/pool/{address}/analytics` | TVL, volume, fees, APR, IL metrics |
| GET | `/api/v1/meteora/pool/{address}/wallets` | Smart money LPs in a specific pool |
| GET | `/api/v1/meteora/pool/{address}/flow` | Liquidity add/remove flow |
| GET | `/api/v1/meteora/pool/{address}/stats` | Pool-level aggregate statistics |

### Signals

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/meteora/signals/flow` | Large liquidity movement signals |
| GET | `/api/v1/meteora/signals/exit` | Smart LPs removing liquidity |
| GET | `/api/v1/meteora/signals/new-pool` | New pools attracting smart money |
| GET | `/api/v1/meteora/signals/rebalance` | Smart LP rebalancing activity |
| GET | `/api/v1/meteora/signals/concentration` | Liquidity concentration shifts |

## Authentication

All paid endpoints use x402 protocol:

1. Send GET request to endpoint
2. Receive HTTP 402 with JSON payment details (recipient, amount, token, memo)
3. Sign and send USDC transfer on Solana Mainnet
4. Retry request with `X-Payment-Proof: <solana_tx_signature>` header

No API keys, no accounts, no registration. Payment is authentication.

## Rate Limits

- Free endpoints: 60 requests/minute
- Paid endpoints: No rate limit (payment governs access)
- Payment proofs are single-use and expire after 5 minutes

## Response Format

All endpoints return JSON. Successful responses use HTTP 200. Errors use standard HTTP status codes with a JSON body containing `error` and `message` fields.
