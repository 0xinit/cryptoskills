# Ideas

Skills we want to build. Contributions welcome — pick one and open a PR.

## Ethereum DeFi

| Skill | Description | Priority |
|-------|-------------|----------|
| uniswap | Uniswap V4 hooks, swaps, liquidity, pool deployment | High |
| aave | Aave V3 lending, flash loans, e-mode, GHO | High |
| compound | Compound V3 Comet, cross-chain deployment | Medium |
| lido | stETH, wstETH, staking, withdrawals | High |
| curve | StableSwap, crvUSD, gauge voting | Medium |
| pendle | Yield tokenization, PT/YT, SY | Medium |
| eigenlayer | Restaking, AVS, operator registration | High |
| morpho | Lending optimization, MetaMorpho vaults | Medium |
| maker | DAI, DSR, vaults, Spark | Medium |
| gmx | Perpetuals on Arbitrum, V2 synthetics | Low |
| aerodrome | Base DEX, ve(3,3) tokenomics | Low |

## Ethereum Infrastructure

| Skill | Description | Priority |
|-------|-------------|----------|
| chainlink | Price feeds, VRF, Automation, CCIP | High |
| ens | Name resolution, registration, subdomains, offchain | High |
| safe | Multisig, modules, ERC-4337, transaction service | High |
| openzeppelin | Contracts library, Defender, upgrades | High |
| the-graph | Subgraphs, indexing, hosted vs decentralized | Medium |

## Dev Tools

| Skill | Description | Priority |
|-------|-------------|----------|
| foundry | forge, cast, anvil — testing, deployment, scripting | High |
| hardhat | Testing, deployment, plugins | Medium |
| viem | Client library, contract interaction, ABI typing | High |
| wagmi | React hooks for Ethereum | Medium |
| ethers-v6 | ethers.js v6 migration, providers, signers | Low |
| scaffold-eth | Full-stack Ethereum starter, hooks, components | Medium |
| tenderly | Simulation, debugging, monitoring | Low |

## Solana

| Skill | Description | Priority |
|-------|-------------|----------|
| drift | Perpetual futures, spot trading, vaults | Imported |
| jupiter | Aggregator, limit orders, DCA, Ultra | Imported |
| meteora | DLMM, dynamic pools, Alpha Vault | Imported |
| raydium | AMM, concentrated liquidity, AcceleRaytor | Imported |
| orca | Whirlpools, concentrated liquidity | Imported |
| helius | RPCs, webhooks, DAS API | Imported |
| pyth | Pull oracle, price feeds, confidence intervals | Imported |
| solana-agent-kit | AI agent toolkit for Solana | Imported |
| anchor | Solana program framework, IDL, CPI | Imported |
| metaplex | NFTs, token metadata, Bubblegum | Imported |
| squads | Multisig, program management | Imported |
| switchboard | Oracle, randomness, functions | Imported |
| marginfi | Lending, flash loans | Imported |
| kamino | Liquidity management, lending | Imported |
| sanctum | LST infrastructure, Infinity pool | Imported |
| pumpfun | Token launch platform | Imported |
| surfpool | Local Solana validator | Imported |

## L2s & Alt-L1s

| Skill | Description | Priority |
|-------|-------------|----------|
| arbitrum | Nitro, Stylus (Rust on EVM), Orbit chains | High |
| optimism | OP Stack, SuperchainERC20, interop, governance | High |
| base | Deployment, Coinbase tools, Aerodrome, OnchainKit | High |
| starknet | Cairo, Starknet.js, native account abstraction | Medium |
| zksync | ZK-specific patterns, native AA, paymaster | Medium |
| monad | Parallel execution, MonadBFT, deployment | High |
| megaeth | Real-time chain, MegaETH SDK | High |
| polygon | PoS, zkEVM, AggLayer | Low |
| scroll | zkEVM, deployment patterns | Low |
| sei | Parallel EVM, cosmwasm | Low |
| sui | Move language, object model | Low |
| aptos | Move language, account model | Low |

## Cross-Chain

| Skill | Description | Priority |
|-------|-------------|----------|
| layerzero | V2 OApp, OFT, message passing, DVN config | High |
| wormhole | NTT, cross-chain messaging, relayers | High |
| hyperlane | Permissionless interop, ISM, warp routes | Medium |
| axelar | GMP, cross-chain token transfers | Medium |
| debridge | Cross-chain swaps, DLN | Low |

## Security

| Skill | Description | Priority |
|-------|-------------|----------|
| solidity-security | CEI, reentrancy, flash loans, decimals, access control | High |
| slither | Static analysis, detectors, printers | Medium |
| echidna | Property-based fuzzing, corpus | Medium |
| certora | Formal verification, CVL | Medium |
| mythril | Symbolic execution, security analysis | Low |

## Oracles

| Skill | Description | Priority |
|-------|-------------|----------|
| chainlink | (covered in Infrastructure) | — |
| pyth | (covered in Solana imports) | — |
| redstone | Modular oracle, EVM-compatible | Low |
| api3 | First-party oracles, dAPIs | Low |
| switchboard | (covered in Solana imports) | — |

## Frontend

| Skill | Description | Priority |
|-------|-------------|----------|
| rainbowkit | Wallet connection UI | Low |
| privy | Auth + embedded wallets | Low |
| wallet-adapter | Solana wallet connection | Low |
| onchainkit | Coinbase onchain components | Medium |

## AI Agents

| Skill | Description | Priority |
|-------|-------------|----------|
| solana-agent-kit | (covered in Solana imports) | — |
| eliza | AI agent framework, plugins | Medium |
| brian-ai | Natural language to transactions | Low |

## Concepts (Cross-Protocol)

| Skill | Description | Priority |
|-------|-------------|----------|
| eip-reference | ERC-20, ERC-721, ERC-1155, ERC-8004, EIP-7702 | Medium |
| evm-testing | Foundry patterns: unit, fuzz, fork, invariant | Medium |
| contract-addresses | Verified addresses for major protocols | Medium |
| eth-concepts | Mental models for onchain development | Low |

## How to Contribute

1. Pick a skill from the tables above
2. Follow the [template](template/SKILL.md)
3. Read [CONTRIBUTING.md](CONTRIBUTING.md) for quality guidelines
4. Open a PR

High priority skills are the most impactful — start there.
