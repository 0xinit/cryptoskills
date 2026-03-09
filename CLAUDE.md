# CryptoSkills

Agent skills directory for all of crypto. Follows the [agentskills.io](https://agentskills.io) spec.

## Repo Structure

```
skills/<protocol>/SKILL.md   — One skill per protocol (required)
skills/<protocol>/docs/       — Troubleshooting, advanced patterns (optional)
skills/<protocol>/resources/  — Addresses, error codes, ABIs (optional)
skills/<protocol>/examples/   — Working code samples (optional)
skills/<protocol>/templates/  — Starter boilerplate (optional)
template/SKILL.md             — Contributor template
.claude-plugin/marketplace.json — Plugin marketplace registry
scripts/                      — Build tooling
website/                      — Next.js site (cryptoskills.dev)
```

## Writing Skills

### Naming

Use the protocol or tool name directly. No `web3-` prefix. Lowercase, hyphens for multi-word.

```
uniswap, aave, foundry, monad, solidity-security
```

### SKILL.md Format

Every SKILL.md must have YAML frontmatter:

```yaml
---
name: protocol-name
description: >-
  What this does + when to use it + trigger phrases (under 1024 chars).
  Example: "Integrate Uniswap V3 for token swaps. Use when building DEX
  integrations or executing swaps on Ethereum, Arbitrum, Base."
license: Apache-2.0
compatibility: Claude Code, Cursor, Windsurf, Cline  # optional, 1-500 chars
metadata:
  author: github-username
  version: "1.0"
  chain: ethereum | solana | arbitrum | optimism | base | monad | megaeth | multichain
  category: DeFi | Infrastructure | Dev Tools | Trading | Oracles | Cross-Chain | Security | L2 & Alt-L1 | Frontend | AI Agents | DevOps
tags:
  - relevant-tags
# Optional — declare tool requirements and MCP dependencies:
# allowed-tools: [Bash, Read, Write, Edit, WebFetch]
# mcp-server:
#   name: protocol-mcp
#   transport: http
#   url: https://api.protocol.com/mcp
---
```

### Quality Rules

1. **300-800 lines** — enough depth to be useful, not so long agents choke
2. **Copy-paste ready code** — every code block must work when pasted
3. **Verify addresses onchain** — use `cast code <address>` or `eth_getCode`
4. **Include "Last verified" dates** on addresses and gas costs
5. **"What You Probably Got Wrong" section** — correct LLM blind spots first
6. **No hardcoded secrets** — never include private keys, API keys, or .env values
7. **Reference official docs** — link to primary sources, not blog posts

### After Writing a Skill

1. Add to `.claude-plugin/marketplace.json` (alphabetical order)
2. Run `npx tsx scripts/build-registry.ts` to regenerate registry
3. Run `npx tsx scripts/validate-marketplace.ts` to check consistency

## Categories

DeFi, Infrastructure, Dev Tools, Trading, Oracles, Cross-Chain, NFT & Tokens, Security, L2 & Alt-L1, Frontend, AI Agents, DevOps

## Chains

ethereum, solana, arbitrum, optimism, base, monad, megaeth, starknet, zksync, polygon, multichain

## Commit Conventions

```
feat: add <skill-name> skill
fix: update <protocol> addresses
docs: improve <skill-name> examples
chore: update registry
```
