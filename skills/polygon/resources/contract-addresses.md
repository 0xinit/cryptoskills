# Polygon Contract Addresses

## Ethereum L1 Contracts (PoS Infrastructure)

| Contract | Address | Purpose |
|----------|---------|---------|
| RootChain | `0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287` | Checkpoint submission |
| StateSender | `0x28e4F3a7f651294B9564800b2D01f35189A5bFbE` | L1 -> PoS state sync |
| StakeManager (Proxy) | `0x5e3Ef299fDDf15eAa0432E6e66473ace8c13D908` | Validator staking |
| RootChainManager (Proxy) | `0xA0c68C638235ee32657e8f720a23ceC1bFc77C77` | Bridge deposits |
| ERC20Predicate | `0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf` | ERC20 bridge deposit handler |
| EtherPredicate | `0x8484Ef722627bf18ca5Ae6BcF031c23E6e922B30` | ETH bridge deposit handler |
| MintableERC20Predicate | `0x9923263fA127b3d1484cFD649df8f1831c2A74e4` | Mintable ERC20 bridge |
| MATIC Token | `0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0` | Legacy native token |
| POL Token | `0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6` | New native token |
| POL Migration | `0x29e7DF7b6c1264C3F63e2E7bB27143EeB8A05fe3` | MATIC -> POL migration |

*Last verified: 2025-12-01*

## Polygon PoS Chain Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| ChildChainManager (Proxy) | `0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa` | Bridge withdrawals |
| WPOL (Wrapped POL) | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | Wrapped native token |
| WETH | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | Wrapped Ether |
| USDC (Native) | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Circle native USDC |
| USDC.e (Bridged) | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Bridged USDC |
| USDT | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | Tether USDT |
| WBTC | `0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6` | Wrapped Bitcoin |
| DAI | `0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063` | DAI Stablecoin |
| AAVE | `0xD6DF932A45C0f255f85145f286eA0b292B21C90B` | Aave governance token |
| LINK | `0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39` | Chainlink token |

*Last verified: 2025-12-01*

## Polygon zkEVM Contracts (Ethereum L1)

| Contract | Address | Purpose |
|----------|---------|---------|
| PolygonZkEVM (Proxy) | `0x5132A183E9F3CB7C848b0AAC5Ae0c4f0491B7aB2` | Rollup contract |
| PolygonZkEVMBridge (Proxy) | `0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe` | LxLy bridge |
| PolygonZkEVMGlobalExitRoot | `0x580bda1e7A0CFAe92Fa7F6c20A3794F169CE3CFb` | Global exit root manager |
| PolygonRollupManager | `0x5132A183E9F3CB7C848b0AAC5Ae0c4f0491B7aB2` | Rollup batch management |

*Last verified: 2025-12-01*

## Polygon zkEVM Chain Tokens

| Token | Address | Notes |
|-------|---------|-------|
| WETH | `0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9` | Wrapped ETH on zkEVM |
| USDC | `0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035` | Bridged USDC |
| USDT | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` | Bridged USDT |
| DAI | `0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4` | Bridged DAI |
| MATIC | `0xa2036f0538221a77A3937F1379699f44945018d0` | Bridged MATIC |

*Last verified: 2025-12-01*

## Amoy Testnet (PoS Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| RootChain | `0x2890bA17EfE978480615e330ecB65333b880928e` | Checkpoint submission |
| RootChainManager | `0x34F5A25B627f50Bb3A0cE20b4aEc0a1b89cA229` | Bridge deposits |

*Last verified: 2025-12-01*

## Cardona Testnet (zkEVM Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| PolygonZkEVMBridge | `0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582` | LxLy bridge (testnet) |

*Last verified: 2025-12-01*

## DeFi Protocols on Polygon PoS

| Protocol | Contract | Address |
|----------|----------|---------|
| QuickSwap V3 Factory | Factory | `0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28` |
| Uniswap V3 Factory | Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Aave V3 Pool | Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Aave V3 Pool Addresses Provider | Provider | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| 1inch V5 Router | Router | `0x1111111254EEB25477B68fb85Ed929f73A960582` |

*Last verified: 2025-12-01*

## Verification

Verify any address is a contract with:

```bash
# PoS
cast code <ADDRESS> --rpc-url https://polygon-rpc.com

# zkEVM
cast code <ADDRESS> --rpc-url https://zkevm-rpc.com

# Ethereum (for L1 contracts)
cast code <ADDRESS> --rpc-url https://eth.llamarpc.com
```
