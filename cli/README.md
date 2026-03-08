# cryptoskills

Install crypto agent skills from [cryptoskills.dev](https://cryptoskills.dev).

[![npm](https://img.shields.io/npm/v/cryptoskills.svg)](https://www.npmjs.com/package/cryptoskills)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/0xinit/cryptoskills/blob/main/LICENSE)

```bash
npx cryptoskills install --all
```

95 protocol-level skills covering DeFi, infrastructure, security, dev tools, trading, AI agents, and more — across Ethereum, Solana, L2s, and alt-L1s.

## Quick Start

```bash
npx cryptoskills install uniswap
```

## Commands

### install

```bash
# Single skill
npx cryptoskills install aave

# Multiple skills
npx cryptoskills install aave uniswap compound

# All 95 skills
npx cryptoskills install --all

# Target a specific agent
npx cryptoskills install foundry -a cursor

# Global install (home directory)
npx cryptoskills install solidity-security -g
```

### find

```bash
# Search by name or keyword
npx cryptoskills find uniswap

# Search descriptions
npx cryptoskills find "lending"

# Filter by chain
npx cryptoskills find dex --chain solana

# Filter by category
npx cryptoskills find swap --category DeFi
```

### update

```bash
# Update all installed skills
npx cryptoskills update

# Update specific skills
npx cryptoskills update uniswap

# Update for a specific agent
npx cryptoskills update -a cursor

# Update global installs
npx cryptoskills update -g
```

### init

```bash
# Interactive project setup
npx cryptoskills init

# Target a specific agent
npx cryptoskills init -a cursor
```

Walks you through selecting categories and chains, then installs matching skills to your project.

### list

```bash
# All skills
npx cryptoskills list

# Filter by category
npx cryptoskills list --category DeFi

# Filter by chain
npx cryptoskills list --chain solana
```

## Agent Targeting

By default, the CLI auto-detects which agents are set up in your project. Use `-a` to target a specific agent:

```bash
npx cryptoskills install aave -a claude-code
npx cryptoskills install aave -a cursor
```

| Agent | Flag | Install Path |
|-------|------|-------------|
| Claude Code | `-a claude-code` | `.claude/skills/<skill>/` |
| Cursor | `-a cursor` | `.cursor/skills/<skill>/` |
| Codex | `-a codex` | `.codex/skills/<skill>/` |
| OpenCode | `-a opencode` | `.opencode/skill/<skill>/` |

## Global Install

Use `-g` to install skills to your home directory so they're available across all projects:

```bash
npx cryptoskills install --all -g
```

## Browse Skills

Visit **[cryptoskills.dev](https://cryptoskills.dev)** to search and browse all available skills.

## License

Apache 2.0
