# Hyperliquid Perpetual Markets

Top perpetual futures markets on Hyperliquid with trading parameters.

Last verified: February 2026

**Note**: Asset indices, max leverage, and available markets change as new listings are added. Always query the `meta` endpoint for the authoritative list:

```python
import requests
meta = requests.post("https://api.hyperliquid.xyz/info", json={"type": "meta"}).json()
for i, asset in enumerate(meta["universe"]):
    print(f"{i}: {asset['name']} maxLev={asset['maxLeverage']}x szDec={asset['szDecimals']}")
```

## Major Markets

| Index | Symbol | Max Leverage | Size Decimals | Category |
|-------|--------|-------------|---------------|----------|
| 0 | BTC | 50x | 5 | Major |
| 1 | ETH | 50x | 4 | Major |
| 2 | SOL | 50x | 2 | Major |
| 3 | AVAX | 20x | 1 | L1 |
| 4 | ARB | 20x | 0 | L2 |

## Popular Altcoin Markets

| Symbol | Max Leverage | Category | Notes |
|--------|-------------|----------|-------|
| DOGE | 20x | Meme | High volume |
| WIF | 20x | Meme | Solana meme |
| PEPE | 10x | Meme | Lower leverage cap |
| SUI | 20x | L1 | Move-based L1 |
| TIA | 20x | Modular | Celestia |
| SEI | 20x | L1 | Parallelized L1 |
| INJ | 20x | DeFi | Injective |
| JUP | 10x | DeFi | Jupiter aggregator |
| ONDO | 10x | RWA | Real-world assets |
| LINK | 20x | Oracle | Chainlink |
| AAVE | 20x | DeFi | Lending protocol |
| UNI | 20x | DeFi | Uniswap |
| MKR | 10x | DeFi | MakerDAO |
| OP | 20x | L2 | Optimism |
| MATIC | 20x | L2 | Polygon |
| APT | 20x | L1 | Aptos |
| STX | 10x | L1 | Bitcoin L2 |
| NEAR | 20x | L1 | Near Protocol |
| FIL | 10x | Infra | Filecoin |
| ATOM | 20x | Cosmos | Cosmos Hub |

## Leverage Tiers

Maximum leverage depends on position size. Larger positions are capped at lower leverage.

| Tier | BTC Max Leverage | Approx Position Limit |
|------|-----------------|----------------------|
| 1 | 50x | < $1M notional |
| 2 | 25x | $1M - $5M |
| 3 | 10x | $5M - $25M |
| 4 | 5x | $25M+ |

Tier details vary by asset. Query `clearinghouseState` to see your effective leverage limits for each position.

## Market Properties

### Funding

- **Interval**: Every 1 hour
- **Rate cap**: ±0.05% per interval (varies by asset)
- **Calculation**: Based on mark-oracle price deviation
- **Predictive**: Query `predictedFundings` to see estimated next funding

### Fees

| Fee Type | Maker | Taker |
|----------|-------|-------|
| Base rate | 0.01% | 0.035% |
| High volume | 0.00% | 0.025% |
| Referral discount | Up to 10% off taker fees |

Fee tiers are volume-based over rolling 14-day periods. Query `userFees` for your current tier.

### Tick Sizes and Minimum Orders

Tick sizes and minimum order sizes vary per asset. The `meta` response contains `szDecimals` which determines the minimum size increment:

| `szDecimals` | Min Size Increment | Example |
|-------------|-------------------|---------|
| 0 | 1 | DOGE: minimum 1 DOGE |
| 1 | 0.1 | AVAX: minimum 0.1 AVAX |
| 2 | 0.01 | SOL: minimum 0.01 SOL |
| 3 | 0.001 | — |
| 4 | 0.0001 | ETH: minimum 0.0001 ETH |
| 5 | 0.00001 | BTC: minimum 0.00001 BTC |

Minimum notional for all perpetuals: **$10**.

### Price Precision

Prices must be divisible by the asset's tick size. Tick sizes are not directly exposed in `meta` — derive them from the order book or use the SDK which handles rounding automatically.

## Spot Markets

Spot assets use index `10000 + spot_universe_index`.

| Symbol | Pair | Notes |
|--------|------|-------|
| PURR | PURR/USDC | Hyperliquid native token |
| HYPE | HYPE/USDC | Hyperliquid governance |

Spot markets have separate balance tracking. Use `usdClassTransfer` to move USDC between perp and spot wallets.

## Querying Market Data

### All Mid Prices

```python
mids = requests.post("https://api.hyperliquid.xyz/info", json={"type": "allMids"}).json()
# {"BTC": "95123.5", "ETH": "3245.2", ...}
```

### Open Interest

```python
# Open interest is available in activeAssetCtx via WebSocket
# or derived from meta endpoint's universe data
```

### Funding Rates

```python
# Predicted (next funding)
predicted = requests.post("https://api.hyperliquid.xyz/info", json={
    "type": "predictedFundings"
}).json()

# Historical
history = requests.post("https://api.hyperliquid.xyz/info", json={
    "type": "fundingHistory",
    "coin": "BTC",
    "startTime": 1700000000000
}).json()
```
