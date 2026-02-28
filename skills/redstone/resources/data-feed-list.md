# RedStone Data Feed List

> **Last verified:** 2025-06-01

RedStone supports 1000+ data feeds across the `redstone-primary-prod` data service. Below are the most commonly used feeds.

## Feed ID Encoding

In Solidity, feed IDs are `bytes32`. The string is left-padded:

```solidity
bytes32 ethFeedId = bytes32("ETH");   // 0x4554480000...
bytes32 btcFeedId = bytes32("BTC");   // 0x4254430000...
```

In TypeScript (SDK), use plain strings:

```typescript
dataPackagesIds: ["ETH", "BTC", "USDC"]
```

The SDK handles the bytes32 encoding automatically.

## Crypto Major Pairs

| Feed ID | Description | Decimals | Update Frequency |
|---------|-------------|----------|-----------------|
| `ETH` | Ethereum / USD | 8 | 10s |
| `BTC` | Bitcoin / USD | 8 | 10s |
| `SOL` | Solana / USD | 8 | 10s |
| `BNB` | BNB / USD | 8 | 10s |
| `AVAX` | Avalanche / USD | 8 | 10s |
| `MATIC` | Polygon / USD | 8 | 10s |
| `DOT` | Polkadot / USD | 8 | 10s |
| `ATOM` | Cosmos / USD | 8 | 10s |
| `NEAR` | NEAR Protocol / USD | 8 | 10s |
| `ARB` | Arbitrum / USD | 8 | 10s |
| `OP` | Optimism / USD | 8 | 10s |
| `LINK` | Chainlink / USD | 8 | 10s |
| `UNI` | Uniswap / USD | 8 | 10s |
| `AAVE` | Aave / USD | 8 | 10s |
| `MKR` | Maker / USD | 8 | 10s |
| `CRV` | Curve / USD | 8 | 10s |
| `LDO` | Lido / USD | 8 | 10s |
| `SNX` | Synthetix / USD | 8 | 10s |
| `COMP` | Compound / USD | 8 | 10s |
| `FIL` | Filecoin / USD | 8 | 10s |

## Stablecoins

| Feed ID | Description | Decimals | Update Frequency |
|---------|-------------|----------|-----------------|
| `USDC` | USD Coin / USD | 8 | 10s |
| `USDT` | Tether / USD | 8 | 10s |
| `DAI` | Dai / USD | 8 | 10s |
| `FRAX` | Frax / USD | 8 | 10s |
| `LUSD` | Liquity USD / USD | 8 | 10s |
| `TUSD` | TrueUSD / USD | 8 | 10s |
| `BUSD` | Binance USD / USD | 8 | 10s |
| `crvUSD` | Curve USD / USD | 8 | 10s |
| `GHO` | Aave GHO / USD | 8 | 10s |
| `PYUSD` | PayPal USD / USD | 8 | 10s |

## Liquid Staking Tokens

| Feed ID | Description | Decimals | Update Frequency |
|---------|-------------|----------|-----------------|
| `stETH` | Lido Staked ETH / USD | 8 | 10s |
| `wstETH` | Wrapped stETH / USD | 8 | 10s |
| `rETH` | Rocket Pool ETH / USD | 8 | 10s |
| `cbETH` | Coinbase Staked ETH / USD | 8 | 10s |
| `sfrxETH` | Staked Frax ETH / USD | 8 | 10s |
| `swETH` | Swell ETH / USD | 8 | 10s |
| `ETHx` | Stader ETH / USD | 8 | 10s |
| `osETH` | StakeWise ETH / USD | 8 | 10s |
| `weETH` | ether.fi Wrapped eETH / USD | 8 | 10s |
| `mETH` | Mantle Staked ETH / USD | 8 | 10s |

## LP Tokens and Yield-Bearing Assets

| Feed ID | Description | Decimals | Update Frequency |
|---------|-------------|----------|-----------------|
| `WETH` | Wrapped ETH / USD | 8 | 10s |
| `WBTC` | Wrapped BTC / USD | 8 | 10s |
| `GLP` | GMX LP / USD | 8 | 60s |
| `sGLP` | Staked GLP / USD | 8 | 60s |
| `PENDLE` | Pendle / USD | 8 | 10s |
| `PT-stETH` | Pendle PT stETH / USD | 8 | 60s |

## DeFi Governance Tokens

| Feed ID | Description | Decimals | Update Frequency |
|---------|-------------|----------|-----------------|
| `GMX` | GMX / USD | 8 | 10s |
| `DYDX` | dYdX / USD | 8 | 10s |
| `SUSHI` | SushiSwap / USD | 8 | 10s |
| `BAL` | Balancer / USD | 8 | 10s |
| `YFI` | Yearn Finance / USD | 8 | 10s |
| `1INCH` | 1inch / USD | 8 | 10s |
| `ENS` | ENS / USD | 8 | 10s |
| `RPL` | Rocket Pool / USD | 8 | 10s |
| `EIGEN` | EigenLayer / USD | 8 | 10s |

## Cross-Pair Feeds

| Feed ID | Description | Decimals |
|---------|-------------|----------|
| `ETH/BTC` | Ethereum / Bitcoin | 18 |
| `stETH/ETH` | stETH / ETH exchange rate | 18 |
| `wstETH/ETH` | wstETH / ETH exchange rate | 18 |
| `rETH/ETH` | rETH / ETH exchange rate | 18 |
| `cbETH/ETH` | cbETH / ETH exchange rate | 18 |

## Requesting New Feeds

To request a new data feed:

1. Check the [RedStone Data Feeds Explorer](https://app.redstone.finance) for existing coverage
2. If not available, submit a request via [RedStone Discord](https://discord.gg/redstone) or [GitHub Issues](https://github.com/redstone-finance/redstone-oracles-monorepo/issues)
3. For custom/proprietary feeds, set up a custom data service (see `examples/custom-data-feed/`)

## Important Notes

- All USD-denominated feeds return 8 decimals by default
- Cross-pair feeds (e.g., `stETH/ETH`) return 18 decimals
- Update frequency shown is the minimum interval; actual updates may be more frequent during high volatility
- Feed availability varies by data service -- `redstone-primary-prod` has the broadest coverage
- Some feeds are chain-specific (e.g., `GLP` is primarily used on Arbitrum)

Source: [RedStone Data Feeds Explorer](https://app.redstone.finance)
