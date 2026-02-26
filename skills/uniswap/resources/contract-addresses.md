# Uniswap Contract Addresses

> **Last verified:** February 2026

Verified deployment addresses for Uniswap protocol contracts. All addresses are checksummed.

## Uniswap V3 Core

| Contract | Ethereum | Arbitrum | Base | Optimism | Polygon |
|----------|----------|----------|------|----------|---------|
| UniswapV3Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | `0x2626664c2603336E57B271c5C0b26F421741e481` | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| NonfungiblePositionManager | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| UniversalRouter | `0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD` | `0x5E325eDA8064b456f4781070C0738d849c824258` | `0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD` | `0xCb1355ff08Ab38bBCE60111F1bb2B784bE25D7e8` | `0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2` |
| TickLens | `0xbfd8137f7d1516D3ea5cA83523914859ec47F573` | `0xbfd8137f7d1516D3ea5cA83523914859ec47F573` | `0x0CdeE061c75D43c82520eD998C23ac2991c9ac6d` | `0xbfd8137f7d1516D3ea5cA83523914859ec47F573` | `0xbfd8137f7d1516D3ea5cA83523914859ec47F573` |

## Uniswap V4

| Contract | Ethereum |
|----------|----------|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` |

## Shared Infrastructure

| Contract | Address (All Chains) |
|----------|---------------------|
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## Deprecated Contracts

These are still deployed but should NOT be used for new integrations.

| Contract | Ethereum | Notes |
|----------|----------|-------|
| SwapRouter (V3 original) | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Replaced by SwapRouter02 |
| V2Router02 | `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` | V2 only, no V3 support |
| V2Factory | `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f` | V2 pool factory |

## Common Token Addresses (Ethereum Mainnet)

| Token | Address | Decimals |
|-------|---------|----------|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | 8 |

## Well-Known Pool Addresses (Ethereum Mainnet)

| Pair | Fee Tier | Pool Address |
|------|----------|-------------|
| USDC/WETH | 0.05% | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
| WBTC/WETH | 0.05% | `0x4585FE77225b41b697C938B018E2Ac67Ac5a20c0` |
| USDC/WETH | 0.3% | `0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8` |
| DAI/USDC | 0.01% | `0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168` |
| WBTC/USDC | 0.3% | `0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35` |

## Verification

Verify any address on-chain before use:

```bash
# Check contract has code deployed
cast code 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45 --rpc-url $RPC_URL

# Verify factory ownership
cast call 0x1F98431c8aD98523631AE4a59f267346ea31F984 "owner()(address)" --rpc-url $RPC_URL
```

## Reference

- [Official V3 Deployment Addresses](https://docs.uniswap.org/contracts/v3/reference/deployments)
- [Permit2 Deployments](https://github.com/Uniswap/permit2#deployments)
