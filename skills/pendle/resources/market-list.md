# Active Pendle Markets

> **Last verified:** February 2026

Pendle markets are deployed per underlying asset and maturity date. New markets are created regularly as old ones expire. This list covers major markets by TVL. Always verify current active markets via the [Pendle App](https://app.pendle.finance/trade/markets) or the [Pendle API](https://api-v2.pendle.finance/core/docs).

## Ethereum Mainnet — Top Markets

### Liquid Staking Derivatives (LSDs)

| Underlying | SY Token | Maturity Dates | Category |
|-----------|----------|----------------|----------|
| wstETH (Lido) | SY-wstETH | Rolling (quarterly/semi-annual) | ETH Staking |
| weETH (EtherFi) | SY-weETH | Rolling (quarterly) | ETH Restaking |
| rETH (Rocket Pool) | SY-rETH | Rolling | ETH Staking |
| swETH (Swell) | SY-swETH | Rolling | ETH Staking |
| rsETH (Kelp) | SY-rsETH | Rolling | ETH Restaking |

### Stablecoins

| Underlying | SY Token | Maturity Dates | Category |
|-----------|----------|----------------|----------|
| sDAI (Spark) | SY-sDAI | Rolling (quarterly) | Stablecoin Yield |
| sUSDe (Ethena) | SY-sUSDe | Rolling (quarterly) | Stablecoin Yield |
| aUSDC (Aave) | SY-aUSDC | Periodic | Stablecoin Lending |

### Restaking / EigenLayer

| Underlying | SY Token | Maturity Dates | Category |
|-----------|----------|----------------|----------|
| eETH (EtherFi) | SY-eETH | Rolling | Restaking + Points |
| pufETH (Puffer) | SY-pufETH | Rolling | Restaking |
| ezETH (Renzo) | SY-ezETH | Rolling | Restaking |

## Arbitrum — Top Markets

| Underlying | SY Token | Category |
|-----------|----------|----------|
| wstETH | SY-wstETH (Arb) | ETH Staking |
| GLP (GMX) | SY-GLP | Perp LP |
| GDAI (Gains) | SY-GDAI | Stablecoin Yield |
| rETH | SY-rETH (Arb) | ETH Staking |

## Market Lifecycle

```
Creation -> Active Trading -> Approaching Maturity -> Expired
    |            |                     |                  |
    |       Normal AMM           Curve compresses     AMM stops
    |       trading              (lower IL risk)      (redeem only)
    |            |                     |                  |
    v            v                     v                  v
  Factory    Buy/Sell PT/YT     Exit LP positions    Redeem PT 1:1
  deploys    Add/Remove LP      Claim YT yield       Claim all yield
```

### Typical Maturity Schedule

Pendle deploys markets with the following maturity cadences:
- **Quarterly:** March, June, September, December (last Thursday)
- **Semi-annual:** June, December
- **Custom:** Some markets have non-standard maturities based on underlying protocol events

### How to Discover Current Active Markets

**Option 1: Pendle API**
```bash
# List all active Ethereum markets
curl "https://api-v2.pendle.finance/core/v1/1/markets?order_by=tvl&order=desc&limit=20"

# List all active Arbitrum markets
curl "https://api-v2.pendle.finance/core/v1/42161/markets?order_by=tvl&order=desc&limit=20"
```

**Option 2: On-chain via Factory**
```typescript
import { parseAbi } from "viem";

const factoryAbi = parseAbi([
  "function getMarketConfig(address market) view returns (address pt, int256 scalarRoot, int256 initialAnchor, uint80 lnFeeRateRoot)",
]);

const FACTORY_V3 = "0x1A6fCc85557BC4fB7B534ed835a03EF056c222E2" as const;

// Factory emits CreateNewMarket events — index these to discover all markets
// event CreateNewMarket(address indexed market, address indexed PT, int256 scalarRoot, int256 initialAnchor, uint256 lnFeeRateRoot)
```

**Option 3: Pendle App**
Visit [app.pendle.finance/trade/markets](https://app.pendle.finance/trade/markets) for a browsable directory sorted by TVL, APY, and maturity.

## Choosing the Right Market

| Goal | Strategy | Market Selection |
|------|----------|-----------------|
| Fixed yield on ETH staking | Buy PT-wstETH | Choose maturity matching your investment horizon |
| Leveraged ETH staking yield | Buy YT-wstETH | Choose maturity with favorable implied rate vs expected actual yield |
| Earn LP fees + yield | LP into high-TVL market | Prefer markets with high volume and PENDLE incentives |
| Fixed yield on stablecoins | Buy PT-sDAI or PT-sUSDe | Good for treasury management, predictable returns |
| Speculation on rate direction | Buy/sell YT | If you expect rates to rise, buy YT. If rates will drop, sell YT. |

## TVL Rankings by Category (Approximate)

| Rank | Category | Typical TVL Range |
|------|----------|-------------------|
| 1 | ETH Staking (wstETH, weETH) | $500M - $2B+ |
| 2 | Restaking (eETH, ezETH, rsETH) | $200M - $1B |
| 3 | Stablecoin Yield (sUSDe, sDAI) | $100M - $500M |
| 4 | GLP / Perp LP (Arbitrum) | $50M - $200M |

TVL fluctuates significantly. Check [DefiLlama Pendle page](https://defillama.com/protocol/pendle) for current numbers.
