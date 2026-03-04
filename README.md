# CryptoSkills

Agent skills for all of crypto. DeFi, infrastructure, security, dev tools, and more — across every major chain.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Compatible-green.svg)](https://agentskills.io)
[![Skills](https://img.shields.io/badge/Skills-95-e8384f.svg)](https://cryptoskills.dev)

**[cryptoskills.dev](https://cryptoskills.dev)** — Browse all skills

## Why

AI agents have stale, incorrect, or missing knowledge about crypto:

- Gas prices (LLMs think 10-30 gwei; reality is 0.05 gwei in 2026)
- Contract addresses (hallucinated — wrong address = lost funds)
- Protocol APIs (outdated SDK patterns, deprecated endpoints)
- Chain-specific nuances (Monad parallel execution, MegaETH real-time, Arbitrum Stylus)

CryptoSkills fixes this with protocol-level skills that any AI agent can load.

## Install

### Claude Code

```bash
/plugin marketplace add 0xinit/cryptoskills
/plugin install uniswap
/plugin install foundry
```

### Cursor

Settings > Rules & Commands > Remote Rule:

```
https://github.com/0xinit/cryptoskills.git
```

### Any Agent (npx)

```bash
npx skills add 0xinit/cryptoskills
```

## Skills (95)

### DeFi (13)

| Skill | Chain | Description |
|-------|-------|-------------|
| [uniswap](skills/uniswap/) | ethereum | Uniswap V3/V4 — swaps, liquidity, hooks, pool deployment |
| [aave](skills/aave/) | ethereum | Aave V3 — lending, flash loans, E-Mode, health factor |
| [compound](skills/compound/) | ethereum | Compound V3 Comet — single-asset borrowing, cross-chain |
| [lido](skills/lido/) | ethereum | Lido — stETH, wstETH, liquid staking, withdrawals |
| [curve](skills/curve/) | ethereum | Curve — StableSwap, CryptoSwap, crvUSD, gauge voting |
| [pendle](skills/pendle/) | ethereum | Pendle — yield tokenization, PT/YT trading |
| [eigenlayer](skills/eigenlayer/) | ethereum | EigenLayer — restaking, AVS, operator delegation |
| [morpho](skills/morpho/) | ethereum | Morpho Blue — permissionless markets, MetaMorpho vaults |
| [maker](skills/maker/) | ethereum | MakerDAO/Sky — DAI vaults, DSR, liquidations |
| [drift](skills/drift/) | solana | Drift — perpetual futures, spot trading |
| [jupiter](skills/jupiter/) | solana | Jupiter — aggregator, limit orders, DCA, perps |
| [meteora](skills/meteora/) | solana | Meteora — DLMM, dynamic bonding curves |
| [raydium](skills/raydium/) | solana | Raydium — AMM, CLMM, LaunchLab |
| [orca](skills/orca/) | solana | Orca — Whirlpools, concentrated liquidity |
| [kamino](skills/kamino/) | solana | Kamino — lending, liquidity strategies |
| [marginfi](skills/marginfi/) | solana | MarginFi — lending, flash loans |
| [lulo](skills/lulo/) | solana | Lulo — lending aggregator |
| [sanctum](skills/sanctum/) | solana | Sanctum — LST swaps, Infinity pool |
| [pumpfun](skills/pumpfun/) | solana | PumpFun — token launches, bonding curves |
| [glam](skills/glam/) | solana | GLAM — vault management, DeFi strategies |

### Infrastructure (10)

| Skill | Chain | Description |
|-------|-------|-------------|
| [chainlink](skills/chainlink/) | ethereum | Chainlink — price feeds, VRF, Automation, CCIP |
| [ens](skills/ens/) | ethereum | ENS — name resolution, registration, subdomains |
| [safe](skills/safe/) | multichain | Safe — multisig, modules, ERC-4337, ERC-7579 |
| [openzeppelin](skills/openzeppelin/) | multichain | OpenZeppelin — contracts v5, access control, upgrades |
| [the-graph](skills/the-graph/) | multichain | The Graph — subgraphs, indexing, querying |
| [contract-addresses](skills/contract-addresses/) | multichain | Verified contract addresses across EVM chains |
| [eth-concepts](skills/eth-concepts/) | ethereum | Core Ethereum — gas, EVM, storage, Pectra/Fusaka |
| [eip-reference](skills/eip-reference/) | ethereum | EIP/ERC reference — fetch any EIP on demand |
| [account-abstraction](skills/account-abstraction/) | multichain | ERC-4337 + EIP-7702, paymasters, session keys |
| [farcaster](skills/farcaster/) | multichain | Farcaster — Neynar API, Frames v2, Snapchain |
| [solana-simd](skills/solana-simd/) | solana | Solana SIMDs — fetch any SIMD on demand |
| [helius](skills/helius/) | solana | Helius — RPCs, webhooks, DAS API |
| [light-protocol](skills/light-protocol/) | solana | Light — ZK compression, compressed tokens |
| [magicblock](skills/magicblock/) | solana | MagicBlock — ephemeral rollups, real-time gaming |
| [squads](skills/squads/) | solana | Squads — multisig, smart accounts |

### Dev Tools (10)

| Skill | Chain | Description |
|-------|-------|-------------|
| [foundry](skills/foundry/) | multichain | Foundry — forge, cast, anvil, testing, deployment |
| [hardhat](skills/hardhat/) | multichain | Hardhat — testing, Ignition, plugins |
| [viem](skills/viem/) | multichain | viem — TypeScript client, ABI typing, transports |
| [wagmi](skills/wagmi/) | multichain | wagmi — React hooks for Ethereum |
| [ethers-js](skills/ethers-js/) | multichain | ethers.js v6 — Provider, Signer, Contract |
| [scaffold-eth-2](skills/scaffold-eth-2/) | ethereum | Scaffold-ETH 2 — full-stack dApp framework |
| [evm-testing](skills/evm-testing/) | multichain | EVM testing — fuzz, invariant, fork testing |
| [solana-kit](skills/solana-kit/) | solana | @solana/kit — modern tree-shakeable SDK |
| [solana-kit-migration](skills/solana-kit-migration/) | solana | Migration guide — web3.js v1 to @solana/kit |
| [pinocchio](skills/pinocchio/) | solana | Pinocchio — zero-copy Solana programs |

### Trading (6)

| Skill | Chain | Description |
|-------|-------|-------------|
| [polymarket](skills/polymarket/) | polygon | Polymarket — CLOB, prediction markets, CTF tokens |
| [hyperliquid](skills/hyperliquid/) | multichain | Hyperliquid — perpetual futures, 50x leverage |
| [gmx](skills/gmx/) | arbitrum | GMX V2 — perpetuals, GM tokens, Chainlink Streams |
| [vertex](skills/vertex/) | multichain | Vertex — cross-chain DEX, spot, perps |
| [dflow](skills/dflow/) | solana | DFlow — spot trading, prediction markets |
| [ranger-finance](skills/ranger-finance/) | solana | Ranger — perps aggregator |

### Security (9)

| Skill | Chain | Description |
|-------|-------|-------------|
| [solidity-security](skills/solidity-security/) | multichain | Solidity security — CEI, reentrancy, flash loans |
| [code-recon](skills/code-recon/) | multichain | Security audit context building |
| [vulnhunter](skills/vulnhunter/) | multichain | Vulnerability detection and variant analysis |
| [slither](skills/slither/) | multichain | Slither — static analysis, 90+ detectors |
| [echidna](skills/echidna/) | multichain | Echidna — property-based fuzzing |
| [mythril](skills/mythril/) | multichain | Mythril — symbolic execution |
| [certora](skills/certora/) | multichain | Certora — formal verification with CVL |
| [halmos](skills/halmos/) | multichain | Halmos — symbolic testing for Foundry |
| [semgrep-solidity](skills/semgrep-solidity/) | multichain | Semgrep — custom Solidity security rules |

### L2s & Alt-L1s (12)

| Skill | Chain | Description |
|-------|-------|-------------|
| [arbitrum](skills/arbitrum/) | arbitrum | Arbitrum Nitro — deployment, retryable tickets, Orbit |
| [arbitrum-stylus](skills/arbitrum-stylus/) | arbitrum | Stylus — Rust/C/C++ smart contracts on Arbitrum |
| [optimism](skills/optimism/) | optimism | Optimism — OP Stack, SuperchainERC20, interop |
| [base](skills/base/) | base | Base — OnchainKit, Smart Wallet, Paymaster |
| [polygon](skills/polygon/) | polygon | Polygon — PoS, zkEVM, AggLayer |
| [starknet](skills/starknet/) | starknet | StarkNet — Cairo, native account abstraction |
| [zksync](skills/zksync/) | zksync | zkSync Era — native AA, paymasters |
| [monad](skills/monad/) | monad | Monad — parallel execution, MonadBFT |
| [megaeth](skills/megaeth/) | megaeth | MegaETH — real-time chain, sub-ms storage |
| [sui](skills/sui/) | multichain | Sui — Move, object-centric model, PTBs |
| [aptos](skills/aptos/) | multichain | Aptos — Move, Block-STM parallel execution |
| [sei](skills/sei/) | multichain | Sei — parallelized EVM, twin-turbo consensus |

### Cross-Chain (4)

| Skill | Chain | Description |
|-------|-------|-------------|
| [layerzero](skills/layerzero/) | multichain | LayerZero V2 — OApp, OFT, DVN configuration |
| [wormhole](skills/wormhole/) | multichain | Wormhole — NTT, VAA, cross-chain messaging |
| [hyperlane](skills/hyperlane/) | multichain | Hyperlane — permissionless interop, ISM, Warp Routes |
| [axelar](skills/axelar/) | multichain | Axelar — GMP, Interchain Token Service |

### Oracles (4)

| Skill | Chain | Description |
|-------|-------|-------------|
| [pyth](skills/pyth/) | solana | Pyth — pull oracle, price feeds (Solana) |
| [pyth-evm](skills/pyth-evm/) | multichain | Pyth — pull oracle, Hermes API (EVM) |
| [redstone](skills/redstone/) | multichain | RedStone — modular oracle, EVM Connector |
| [switchboard](skills/switchboard/) | solana | Switchboard — oracle, VRF randomness |

### AI Agents (6)

| Skill | Chain | Description |
|-------|-------|-------------|
| [solana-agent-kit](skills/solana-agent-kit/) | solana | Solana Agent Kit — 60+ onchain actions |
| [eliza](skills/eliza/) | multichain | elizaOS — multi-agent AI framework |
| [goat](skills/goat/) | multichain | GOAT — 200+ protocol integrations |
| [coinbase-agentkit](skills/coinbase-agentkit/) | multichain | Coinbase AgentKit — AI agents with wallets |
| [brian-api](skills/brian-api/) | multichain | Brian API — natural language to transactions |
| [x402](skills/x402/) | multichain | x402 — HTTP 402 payment protocol for AI agents |

### Frontend (2)

| Skill | Chain | Description |
|-------|-------|-------------|
| [frontend-ux](skills/frontend-ux/) | multichain | dApp UX patterns — wallet flow, tx lifecycle |
| [privy](skills/privy/) | multichain | Privy — embedded wallets, social login |

### NFT & Tokens (2)

| Skill | Chain | Description |
|-------|-------|-------------|
| [evm-nfts](skills/evm-nfts/) | multichain | ERC-721/1155 — minting, metadata, royalties, Seaport |
| [metaplex](skills/metaplex/) | solana | Metaplex — Core, Bubblegum, Candy Machine |

### Data & Analytics (2)

| Skill | Chain | Description |
|-------|-------|-------------|
| [coingecko](skills/coingecko/) | solana | CoinGecko — token prices, DEX data, OHLCV |
| [metengine](skills/metengine/) | multichain | MetEngine — smart money analytics via x402 |

### DevOps (2)

| Skill | Chain | Description |
|-------|-------|-------------|
| [tenderly](skills/tenderly/) | multichain | Tenderly — simulation, forks, alerts, Web3 Actions |
| [surfpool](skills/surfpool/) | solana | Surfpool — Solana test validator with mainnet forking |

## How It Works

Each skill is a directory under `skills/` containing:

```
protocol-name/
├── SKILL.md          # Required — full SDK guide with code examples
├── docs/             # Optional — troubleshooting, advanced patterns
├── resources/        # Optional — addresses, error codes, API refs
├── examples/         # Optional — working code by use case
└── templates/        # Optional — starter boilerplate
```

Skills follow the [Agent Skills specification](https://agentskills.io/specification) for cross-agent compatibility. They work with Claude Code, Cursor, Gemini CLI, OpenAI Codex, VS Code, and 25+ other agents.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Every skill must:

1. Follow the [template](template/SKILL.md)
2. Include YAML frontmatter with name, description, chain, and category
3. Have working, copy-paste ready code examples
4. Verify contract addresses onchain
5. Pass validation (`npx tsx scripts/validate-marketplace.ts`)

## Acknowledgments

- [sendaifun/skills](https://github.com/sendaifun/skills) — Solana skills directory (Apache 2.0). Solana skills adapted from their work.
- [base/skills](https://github.com/base/skills) — Base skills directory (MIT). Base chain skills adapted from their work.
- [austintgriffith/ethskills](https://github.com/austintgriffith/ethskills) — Ethereum skills (MIT). LLM blind-spot methodology and Ethereum content.
- [agentskills.io](https://agentskills.io) — Agent Skills open specification.
- [Anthropic](https://anthropic.com) — Claude Code plugin system.

## License

Apache 2.0 — see [LICENSE](LICENSE).
