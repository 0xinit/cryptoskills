# Contributing to CryptoSkills

Thanks for contributing. Every skill you add helps AI agents build better crypto applications.

## Quick Start

1. Fork and clone the repo
2. Copy the template: `cp -r template/SKILL.md skills/your-protocol/SKILL.md`
3. Write your skill following the guidelines below
4. Add your skill to `.claude-plugin/marketplace.json`
5. Submit a PR

## Creating a New Skill

### 1. Choose a Name

Use the protocol or tool name directly. No `web3-` prefix — everything here is crypto.

| Style | Example |
|-------|---------|
| Protocol name | `uniswap`, `aave`, `drift` |
| Tool name | `foundry`, `hardhat`, `viem` |
| Chain name | `monad`, `megaeth`, `arbitrum` |
| Concept | `solidity-security`, `evm-testing` |

Lowercase, hyphens for multi-word names.

### 2. Write SKILL.md

Every skill needs YAML frontmatter:

```yaml
---
name: protocol-name
description: What this skill does and when to use it. Include protocol name, key actions, and supported chains.
license: Apache-2.0
metadata:
  author: your-github-username
  version: "1.0"
  chain: ethereum
  category: DeFi
tags:
  - protocol-name
  - relevant-tags
---
```

**Frontmatter rules:**
- `description`: Under 1024 chars. Include protocol name, key verbs (swap, lend, stake), and chain names.
- `chain`: One of `ethereum`, `solana`, `arbitrum`, `optimism`, `base`, `monad`, `megaeth`, `starknet`, `zksync`, `polygon`, `multichain`.
- `category`: One of `DeFi`, `Infrastructure`, `Dev Tools`, `Trading`, `Oracles`, `Cross-Chain`, `NFT & Tokens`, `Security`, `L2 & Alt-L1`, `Frontend`, `AI Agents`, `DevOps`.

**Body structure:**
1. Overview — what the protocol does
2. "What You Probably Got Wrong" — correct LLM blind spots (ethskills methodology)
3. Quick Start — install + basic setup
4. Core Concepts — key abstractions
5. Common Patterns — working code examples
6. Contract Addresses — verified onchain with date
7. Error Handling — common errors and fixes
8. Security Considerations

**Quality bar:**
- 300-800 lines (enough depth to be useful, not so long agents choke)
- All code examples must be copy-paste ready and working
- Contract addresses must be verified onchain (use `cast code <address>` or `eth_getCode`)
- Include "Last verified" dates on addresses and gas costs
- Reference official docs, not blog posts

### 3. Add Supporting Files (Optional)

```
your-skill/
├── SKILL.md              # Required
├── docs/                 # Troubleshooting, advanced patterns
│   └── troubleshooting.md
├── resources/            # Addresses, error codes, ABIs
│   └── addresses.json
├── examples/             # Working code samples
│   └── basic-swap/
│       └── index.ts
└── templates/            # Starter boilerplate
    └── client.ts
```

| Directory | When to Use |
|-----------|-------------|
| `docs/` | SKILL.md is getting too long (>500 lines) |
| `resources/` | Static data agents look up frequently (addresses, error codes) |
| `examples/` | Complete, runnable implementations |
| `templates/` | Common boilerplate for scaffolding |

### 4. Add to Marketplace

Add your skill to `.claude-plugin/marketplace.json` in the `plugins` array. Keep alphabetical order.

```json
{
  "name": "your-protocol",
  "source": "./skills/your-protocol",
  "description": "Same description as SKILL.md frontmatter",
  "category": "DeFi"
}
```

### 5. Test Your Skill

Before submitting:

```bash
# Load in Claude Code and test
/skill load skills/your-protocol

# Test with realistic prompts
"Build a swap interface using [protocol]"
"How do I integrate [protocol] in my dapp?"
"What are the contract addresses for [protocol] on Arbitrum?"
```

Verify:
- Agent gets correct contract addresses
- Code examples compile/run
- Error handling advice is accurate
- Security guidance is present

### 6. Validate

```bash
npx skills-ref validate skills/your-protocol
node scripts/validate-marketplace.ts
```

## PR Checklist

- [ ] Skill directory follows naming convention (lowercase, hyphens)
- [ ] SKILL.md has valid YAML frontmatter (name, description, chain, category)
- [ ] Description is under 1024 characters
- [ ] Code examples are working and copy-paste ready
- [ ] Contract addresses verified onchain with "Last verified" date
- [ ] No hardcoded secrets, private keys, or RPC URLs
- [ ] Added to `.claude-plugin/marketplace.json` (alphabetical order)
- [ ] Tested with AI agent using realistic prompts

## Commit Conventions

```
feat: add uniswap skill
fix: update aave V3 pool addresses
docs: improve chainlink VRF examples
```

## Content Methodology

We follow [ethskills' triage methodology](https://github.com/austintgriffith/ethskills) for quality:

Every fact in a skill should fill one of these roles:

| Classification | Action |
|---------------|--------|
| LLM blind spot — agent gets this wrong | **Keep** and correct prominently |
| Human needs to learn this | **Keep** with clear explanation |
| Agent knows but skips in practice | **Compress** to one line |
| Agent does naturally and human doesn't need teaching | **Cut** |

Don't pad skills with information the agent already knows. Focus on what it gets wrong.

## Style Guide

- **Imperative voice**: "Install the SDK" not "You should install the SDK"
- **Copy-paste ready**: Every code block should work when pasted
- **Specific over general**: "Use `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`" not "Use the router address"
- **Devnet vs mainnet**: Always specify which network. Default examples to mainnet.
- **Security first**: Include warnings about private keys, address verification, slippage

## License

By contributing, you agree that your contributions will be licensed under Apache 2.0.
