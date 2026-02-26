# Pendle Contract Addresses

> **Last verified:** February 2026

Verified deployment addresses for Pendle v2 protocol contracts. All addresses are checksummed.

## Core Protocol

| Contract | Ethereum | Arbitrum |
|----------|----------|----------|
| PendleRouter | `0x888888888889758F76e7103c6CbF23ABbF58F946` | `0x888888888889758F76e7103c6CbF23ABbF58F946` |
| PendleRouterStatic | `0x263833d47eA3fA4a30d59B2E6C1A0e682eF1C078` | `0x263833d47eA3fA4a30d59B2E6C1A0e682eF1C078` |
| PendleMarketFactoryV3 | `0x1A6fCc85557BC4fB7B534ed835a03EF056c222E2` | `0x2FCb47B58350cD377f94d3821e7373Df60bD9Ced` |
| PendlePtOracle | `0x66a1096C6366b2529274dF4f5D8f56DA60a2CacD` | `0x66a1096C6366b2529274dF4f5D8f56DA60a2CacD` |
| vePENDLE | `0x4f30A9D41B80ecC5B94306AB4364951AE3170210` | `0x3209E9412cca80B18338f2a56ADA59c484c39644` |
| PENDLE Token | `0x808507121B80c02388fAd14726482e061B8da827` | `0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8` |

## SY/PT/YT Tokens — Major Ethereum Markets

### wstETH Market (stETH yield)

| Token | Address |
|-------|---------|
| SY-wstETH | `0xcbC72d92b2dc8187414F6734718563898740C0BC` |
| PT-wstETH (26 Dec 2024) | `0xB253A3370B1Db752D65b890B1fE093A26C398bDE` |
| YT-wstETH (26 Dec 2024) | `0x7B6C3e5486D9e6959441ab554A889099ead23c1F` |
| Market (26 Dec 2024) | `0xD0354D4e7bCf345fB117cabe41aCaDb724009CE5` |

### eETH Market (EtherFi yield)

| Token | Address |
|-------|---------|
| SY-weETH | `0xAC0047886a985071476a1186bE89222659970d65` |

### sDAI Market (Spark/Maker yield)

| Token | Address |
|-------|---------|
| SY-sDAI | `0x22E12A50e72b462B4A8eEaaCDE67672F83d8E0D2` |

## SY/PT/YT Tokens — Major Arbitrum Markets

### wstETH Market (Arbitrum)

| Token | Address |
|-------|---------|
| SY-wstETH (Arbitrum) | `0x80c12D5b6Cc494632Bf11b03F09436c8B61Cc5Df` |

### GLP Market (Arbitrum)

| Token | Address |
|-------|---------|
| SY-GLP | `0x2066a650AF4b6895f72B4C0bCc6e3eCfAdAff538` |

## Common Token Addresses (Ethereum)

| Token | Address | Decimals |
|-------|---------|----------|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` | 18 |
| stETH | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` | 18 |
| weETH | `0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee` | 18 |
| sDAI | `0x83F20F44975D03b1b09e64809B757c47f942BEeA` | 18 |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |

## Verification

Verify any address on-chain before use:

```bash
# Check contract has code deployed
cast code 0x888888888889758F76e7103c6CbF23ABbF58F946 --rpc-url $RPC_URL

# Verify router ownership
cast call 0x888888888889758F76e7103c6CbF23ABbF58F946 "owner()(address)" --rpc-url $RPC_URL

# Check a market's SY, PT, YT tokens
cast call 0xD0354D4e7bCf345fB117cabe41aCaDb724009CE5 "readTokens()(address,address,address)" --rpc-url $RPC_URL
```

## Important Notes

- **Market addresses change with each maturity.** The PT, YT, and Market addresses above are for specific maturity dates. New markets are deployed for each maturity period. Always query the Pendle API or factory to discover current active markets.
- **Router and RouterStatic addresses are stable.** These are upgraded via proxy and the addresses persist across market cycles.
- **PendlePtOracle is shared across all markets.** One oracle contract serves all Pendle markets on a given chain.

## Reference

- [Official Deployment Addresses](https://docs.pendle.finance/Developers/Deployments/Ethereum)
- [Arbitrum Deployments](https://docs.pendle.finance/Developers/Deployments/Arbitrum)
- [Pendle Market API](https://api-v2.pendle.finance/core/docs)
