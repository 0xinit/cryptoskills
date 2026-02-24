# CryptoSkills

Agent skills for all of crypto. DeFi, infrastructure, security, dev tools, and more — across every major chain.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Compatible-green.svg)](https://agentskills.io)

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

## Skills

### DeFi

| Skill | Description |
|-------|-------------|
| [uniswap](skills/uniswap/) | Uniswap V4 — swaps, liquidity, hooks, pool deployment |
| [aave](skills/aave/) | Aave V3 — lending, flash loans, e-mode, GHO |
| [compound](skills/compound/) | Compound V3 Comet — lending, cross-chain |
| [lido](skills/lido/) | Lido — stETH, wstETH, staking, withdrawals |
| [curve](skills/curve/) | Curve — StableSwap, crvUSD, gauge voting |
| [pendle](skills/pendle/) | Pendle — yield tokenization, PT/YT |
| [eigenlayer](skills/eigenlayer/) | EigenLayer — restaking, AVS, operators |
| [morpho](skills/morpho/) | Morpho — lending optimization, MetaMorpho vaults |
| [drift](skills/drift/) | Drift — perpetual futures, spot trading (Solana) |
| [jupiter](skills/jupiter/) | Jupiter — aggregator, limit orders, DCA (Solana) |
| [meteora](skills/meteora/) | Meteora — DLMM, dynamic pools (Solana) |
| [raydium](skills/raydium/) | Raydium — AMM, concentrated liquidity (Solana) |
| [orca](skills/orca/) | Orca — Whirlpools, concentrated liquidity (Solana) |

### Infrastructure

| Skill | Description |
|-------|-------------|
| [chainlink](skills/chainlink/) | Chainlink — price feeds, VRF, Automation, CCIP |
| [ens](skills/ens/) | ENS — name resolution, registration, subdomains |
| [safe](skills/safe/) | Safe — multisig, modules, ERC-4337 |
| [openzeppelin](skills/openzeppelin/) | OpenZeppelin — contracts, Defender, upgrades |
| [the-graph](skills/the-graph/) | The Graph — subgraphs, indexing, querying |
| [helius](skills/helius/) | Helius — RPCs, webhooks, DAS API (Solana) |

### Dev Tools

| Skill | Description |
|-------|-------------|
| [foundry](skills/foundry/) | Foundry — forge, cast, anvil, testing, deployment |
| [hardhat](skills/hardhat/) | Hardhat — testing, deployment, plugins |
| [viem](skills/viem/) | viem — client library, ABI typing, chains |
| [wagmi](skills/wagmi/) | wagmi — React hooks for Ethereum |
| [anchor](skills/anchor/) | Anchor — Solana program framework |

### L2s & Alt-L1s

| Skill | Description |
|-------|-------------|
| [arbitrum](skills/arbitrum/) | Arbitrum — Nitro, Stylus, Orbit chains |
| [optimism](skills/optimism/) | Optimism — OP Stack, SuperchainERC20, interop |
| [base](skills/base/) | Base — deployment, Coinbase tools, Aerodrome |
| [monad](skills/monad/) | Monad — parallel execution, MonadBFT |
| [megaeth](skills/megaeth/) | MegaETH — real-time chain, MegaETH SDK |
| [starknet](skills/starknet/) | StarkNet — Cairo, account abstraction |
| [zksync](skills/zksync/) | zkSync — ZK patterns, native AA, paymaster |

### Cross-Chain

| Skill | Description |
|-------|-------------|
| [layerzero](skills/layerzero/) | LayerZero — V2 OApp, OFT, message passing |
| [wormhole](skills/wormhole/) | Wormhole — NTT, cross-chain messaging |
| [hyperlane](skills/hyperlane/) | Hyperlane — permissionless interop, ISM |

### Security

| Skill | Description |
|-------|-------------|
| [solidity-security](skills/solidity-security/) | Solidity security — CEI, reentrancy, flash loans, decimals |
| [slither](skills/slither/) | Slither — static analysis |
| [echidna](skills/echidna/) | Echidna — fuzzing |
| [certora](skills/certora/) | Certora — formal verification |

### Oracles

| Skill | Description |
|-------|-------------|
| [pyth](skills/pyth/) | Pyth — pull oracle, price feeds |
| [switchboard](skills/switchboard/) | Switchboard — oracle, randomness (Solana) |
| [redstone](skills/redstone/) | RedStone — modular oracle |

### AI Agents

| Skill | Description |
|-------|-------------|
| [solana-agent-kit](skills/solana-agent-kit/) | Solana Agent Kit — AI agent toolkit |
| [eliza](skills/eliza/) | Eliza — AI agent framework |

## Coverage

| Ecosystem | Skills |
|-----------|--------|
| Ethereum DeFi | uniswap, aave, compound, lido, curve, pendle, eigenlayer, morpho |
| Ethereum Infra | chainlink, ens, safe, openzeppelin, the-graph |
| Dev Tools | foundry, hardhat, viem, wagmi, anchor |
| Solana | drift, jupiter, meteora, raydium, orca, helius, pyth, solana-agent-kit |
| L2s | arbitrum, optimism, base, starknet, zksync |
| Alt-L1s | monad, megaeth |
| Cross-Chain | layerzero, wormhole, hyperlane |
| Security | solidity-security, slither, echidna, certora |

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
5. Pass validation (`npx skills-ref validate skills/your-skill`)

## Ideas

See [IDEAS.md](IDEAS.md) for the full ecosystem roadmap and skill requests.

## Acknowledgments

- [sendaifun/skills](https://github.com/sendaifun/skills) — Solana skills directory (Apache 2.0). Solana skills adapted from their work.
- [base/skills](https://github.com/base/skills) — Base skills directory (MIT). Base chain skills adapted from their work.
- [austintgriffith/ethskills](https://github.com/austintgriffith/ethskills) — Ethereum skills (MIT). LLM blind-spot methodology and Ethereum content.
- [agentskills.io](https://agentskills.io) — Agent Skills open specification.
- [Anthropic](https://anthropic.com) — Claude Code plugin system.

## License

Apache 2.0 — see [LICENSE](LICENSE).
