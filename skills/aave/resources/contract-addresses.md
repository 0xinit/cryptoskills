# Aave V3 Contract Addresses

> **Last verified:** 2025-05-01. Sources: `@bgd-labs/aave-address-book` and official Aave governance deployments. Always verify before mainnet use: `cast code <address> --rpc-url $RPC_URL`

## Pool (Main Entry Point)

All supply, borrow, repay, withdraw, flash loan, and E-Mode operations go through the Pool contract.

| Chain | Address |
|-------|---------|
| Ethereum | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Arbitrum | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Optimism | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Polygon  | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Base     | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |

## PoolAddressesProvider

Registry contract that resolves Pool, Oracle, and other protocol addresses. Use `getPool()` to get the current Pool proxy address.

| Chain | Address |
|-------|---------|
| Ethereum | `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e` |
| Arbitrum | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| Optimism | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| Polygon  | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| Base     | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |

## Aave Oracle

Aggregates Chainlink price feeds. Returns prices in the oracle's base currency (USD with 8 decimals on Ethereum mainnet).

| Chain | Address |
|-------|---------|
| Ethereum | `0x54586bE62E3c3580375aE3723C145253060Ca0C2` |
| Arbitrum | `0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7` |
| Optimism | `0xD81eb3728a631871a7eBBaD631b5f424909f0c77` |
| Polygon  | `0xb023e699F5a33916Ea823A16485e259257cA8Bd1` |
| Base     | `0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156` |

## Pool Data Provider

Exposes per-reserve configuration, user-specific reserve data, and supply/borrow caps.

| Chain | Address |
|-------|---------|
| Ethereum | `0x7B4EB56E7CD4b454BA8ff71E4518426c84552Dc` |
| Arbitrum | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| Optimism | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| Polygon  | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| Base     | `0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac` |

## WETH Gateway

Wraps/unwraps native ETH for supply and withdraw. Only needed for native ETH -- ERC20 tokens interact with the Pool directly.

| Chain | Address |
|-------|---------|
| Ethereum | `0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C` |
| Arbitrum | `0xB5Ee21786D28c5Ba61661550879475976B707099` |
| Optimism | `0xe9E52021f4e11DEAD8661812A0A6c8627abA2a54` |
| Polygon  | `0x1e4b7A6b903680eab0c5dAbcb8fD429cD2a9598c` |
| Base     | `0x8be473dCfA93132559B118a2F8e8bcf3B1b82d23` |

## aToken Addresses (Ethereum Mainnet)

aTokens are interest-bearing receipt tokens. Balance increases every block as interest accrues.

| Asset | aToken | Address |
|-------|--------|---------|
| WETH  | aWETH  | `0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8` |
| USDC  | aUSDC  | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| DAI   | aDAI   | `0x018008bfb33d285247A21d44E50697654f754e63` |
| USDT  | aUSDT  | `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a` |
| WBTC  | aWBTC  | `0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8` |
| wstETH | awstETH | `0x0B925eD163218f6662a35e0f0371Ac234f9E9371` |
| LINK  | aLINK  | `0x5E8C8A7aB6C6eE97DA98C48cBA1B3CD84B30C4F5` |

## Variable Debt Token Addresses (Ethereum Mainnet)

Track outstanding variable-rate borrow positions. `balanceOf` returns current debt including accrued interest.

| Asset | Variable Debt Token | Address |
|-------|-------------------|---------|
| WETH  | vdWETH | `0xeA51d7853EEFb32b6ee06b1C12E6dcCA88Be0fFE` |
| USDC  | vdUSDC | `0x72E95b8931767C79bA4EeE721354d6E99a61D004` |
| DAI   | vdDAI  | `0xcF8d0c70c850859266f5C338b38F9D663181C314` |
| USDT  | vdUSDT | `0x6df1C1E379bC5a00a7b4C6e67A203333772f45A8` |
| WBTC  | vdWBTC | `0xA8105F174c12FAF7408c4F85457891bCb1857BEF` |

## Common Underlying Tokens (Ethereum Mainnet)

| Token | Address | Decimals |
|-------|---------|----------|
| WETH  | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| USDC  | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| USDT  | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| DAI   | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |
| WBTC  | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | 8 |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` | 18 |
| LINK  | `0x514910771AF9Ca656af840dff83E8264EcF986CA` | 18 |

## Notes

- Ethereum has multiple markets (Main, Lido, EtherFi). All addresses above are for the **Main** market.
- Arbitrum, Optimism, and Polygon share the same Pool address because they use the same deployment factory. They are separate contracts on separate chains.
- Use `@bgd-labs/aave-address-book` npm package for programmatic address lookup.
- Base addresses differ from other L2s due to a separate deployment cycle.
