# Curve Contract Addresses

> **Last verified:** February 2026

Verified deployment addresses for Curve Finance contracts on Ethereum mainnet. All addresses are checksummed.

## Core Pools

| Pool | Address | Coins | Indices |
|------|---------|-------|---------|
| 3pool (DAI/USDC/USDT) | `0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7` | DAI, USDC, USDT | 0, 1, 2 |
| stETH/ETH | `0xDC24316b9AE028F1497c275EB9192a3Ea0f67022` | ETH, stETH | 0, 1 |
| frxETH/ETH | `0xa1F8A6807c402E4A15ef4EBa36528A3FED24E577` | ETH, frxETH | 0, 1 |
| Tricrypto2 (USDT/WBTC/WETH) | `0xD51a44d3FaE010294C616388b506AcdA1bfAAE46` | USDT, WBTC, WETH | 0, 1, 2 |
| FRAX/USDC | `0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2` | FRAX, USDC | 0, 1 |

## LP Tokens

| Pool | LP Token Address |
|------|-----------------|
| 3pool | `0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490` |
| stETH/ETH | `0x06325440D014e39736583c165C2963BA99fAf14E` |
| Tricrypto2 | `0xc4AD29ba4B3c580e6D59105FFf484999997675Ff` |

## CRV Token and Governance

| Contract | Address |
|----------|---------|
| CRV Token | `0xD533a949740bb3306d119CC777fa900bA034cd52` |
| veCRV (Vote-Escrowed CRV) | `0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2` |
| GaugeController | `0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB` |
| Minter (CRV rewards) | `0xd061D61a4d941c39E5453435B6345Dc261C2fcE0` |
| FeeDistributor (3CRV fees to veCRV holders) | `0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc` |

## Gauges

| Pool | Gauge Address |
|------|--------------|
| 3pool | `0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A` |
| stETH/ETH | `0x182B723a58739a9c974cFDB385ceaDb237453c28` |
| Tricrypto2 | `0xDeFd8FdD20e0f34115C7018CCfb655796F6B2168` |
| frxETH/ETH | `0x2932a86df44Fe8D2A706d8e9c44b84Ee845aeCd9` |

## crvUSD

| Contract | Address |
|----------|---------|
| crvUSD Token | `0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E` |
| Controller (WETH collateral) | `0xA920De414eA4Ab66b97dA1bFE9e6EcA7d4219635` |
| Controller (WBTC collateral) | `0x4e59541306910aD6dC1daC0AC9dFB29bD9F15c67` |
| Controller (wstETH collateral) | `0x100dAa78fC509Db39Ef7D04DE0c1ABD299f4C6CE` |
| Controller Factory | `0xC9332fdCB1C4b38B32E5079e6a0A4265a6FAE60F` |
| PriceAggregator | `0xe5Afcf332a5457E8FafCD668BcE3dF953762Dfe7` |

## Router and Registry

| Contract | Address |
|----------|---------|
| Curve Router | `0xF0d4c12A5768D806021F80a262B4d39d26C58b8D` |
| MetaRegistry | `0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC` |
| AddressProvider | `0x0000000022D53366457F9d5E68Ec105046FC4383` |
| StableSwap Factory | `0xB9fC157394Af804a3578134A6585C0dc9cc990d4` |
| CryptoSwap Factory | `0xF18056Bbd320E96A48e3Fbf8bC061322531aac99` |

## Common Token Addresses (Ethereum Mainnet)

| Token | Address | Decimals |
|-------|---------|----------|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | 8 |
| FRAX | `0x853d955aCEf822Db058eb8505911ED77F175b99e` | 18 |
| stETH | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` | 18 |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` | 18 |
| frxETH | `0x5E8422345238F34275888049021821E8E08CAa1f` | 18 |
| crvUSD | `0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E` | 18 |

## Verification

Verify any address on-chain before use:

```bash
# Check contract has code deployed
cast code 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7 --rpc-url $RPC_URL

# Verify 3pool coins
cast call 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7 "coins(uint256)(address)" 0 --rpc-url $RPC_URL
cast call 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7 "coins(uint256)(address)" 1 --rpc-url $RPC_URL
cast call 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7 "coins(uint256)(address)" 2 --rpc-url $RPC_URL
```

## Reference

- [Official Curve Deployed Contracts](https://docs.curve.fi/references/deployed-contracts/)
- [Curve Address Provider](https://etherscan.io/address/0x0000000022D53366457F9d5E68Ec105046FC4383)
