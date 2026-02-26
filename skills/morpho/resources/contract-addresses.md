# Morpho Blue Contract Addresses

> **Last verified:** February 2026

All addresses are checksummed. Verify on-chain before mainnet use.

## Core Contracts (Ethereum Mainnet)

| Contract | Address | Description |
|----------|---------|-------------|
| Morpho Blue (Singleton) | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | All markets live here |
| AdaptiveCurveIRM | `0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC` | Default interest rate model |
| MetaMorpho Factory | `0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101` | Factory for creating MetaMorpho vaults |
| Morpho Bundler V2 | `0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077` | Multicall helper for batched operations |
| MorphoChainlinkOracleV2 Factory | `0x3A7bB36Ee3f3eE32A60e9a666B659756A49eFFa3` | Factory for Chainlink oracle adapters |

## Popular MetaMorpho Vaults (Ethereum Mainnet)

| Vault | Address | Asset | Curator |
|-------|---------|-------|---------|
| Steakhouse USDC | `0xBEEF01735c132Ada46AA9aA9B6290e7a2CE81cd` | USDC | Steakhouse Financial |
| Steakhouse USDT | `0xBEEF02e1b1C4Cb2a6C71eFB1B5A59b6a7c233c20` | USDT | Steakhouse Financial |
| Gauntlet USDC Prime | `0xdd0f28e19C1780eb6396170735D45153D261571d` | USDC | Gauntlet |
| Gauntlet WETH Prime | `0x4881Ef0BF6d2365D3dd6499ccd7532bcdBCE0658` | WETH | Gauntlet |
| Re7 WETH | `0x78Fc2c2eD71dAb0491d268d1a4C3a0b44DBFc287` | WETH | Re7 Capital |

> Vault addresses and availability change as new vaults are deployed. Verify on [app.morpho.org](https://app.morpho.org) or on-chain.

## Common Oracle Adapters

| Oracle | Address | Market Pair |
|--------|---------|-------------|
| wstETH/USDC | `0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2` | USDC/wstETH |
| WBTC/USDC | `0xDddd770BADd886dF3864029e4B377B5F6a2B6b83` | USDC/WBTC |
| WETH/USDC | `0x2772337eE25D6669e420dCB70ed5a6131888E404` | USDC/WETH |

## Popular Market IDs

Market IDs are deterministic: `keccak256(abi.encode(loanToken, collateralToken, oracle, irm, lltv))`.

| Market | LLTV | Market ID |
|--------|------|-----------|
| USDC/wstETH | 86% | Compute from params above |
| USDC/WETH | 86% | Compute from params above |

> Market IDs depend on exact oracle and IRM addresses. Always compute from MarketParams rather than hardcoding.

## Common Token Addresses (Ethereum Mainnet)

| Token | Address | Decimals |
|-------|---------|----------|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` | 18 |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | 8 |
| sDAI | `0x83F20F44975D03b1b09e64809B757c47f942BEeA` | 18 |

## Governance-Enabled LLTVs

These are the only LLTV values accepted by `createMarket()`:

| LLTV (raw) | Percentage |
|-----------|-----------|
| `0` | 0% |
| `385000000000000000` | 38.5% |
| `625000000000000000` | 62.5% |
| `770000000000000000` | 77% |
| `860000000000000000` | 86% |
| `915000000000000000` | 91.5% |
| `945000000000000000` | 94.5% |
| `965000000000000000` | 96.5% |

## Verification

```bash
# Verify Morpho Blue has code deployed
cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url $RPC_URL

# Verify AdaptiveCurveIRM
cast code 0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC --rpc-url $RPC_URL

# Check if an LLTV is enabled
cast call 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb "isLltvEnabled(uint256)(bool)" 860000000000000000 --rpc-url $RPC_URL

# Check if an IRM is enabled
cast call 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb "isIrmEnabled(address)(bool)" 0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC --rpc-url $RPC_URL
```

## References

- [Morpho Blue Deployments](https://docs.morpho.org)
- [MetaMorpho Vaults](https://app.morpho.org)
- [Morpho Blue GitHub](https://github.com/morpho-org/morpho-blue)
