---
name: protocol-name
description: One-line description of what this skill does and when to use it. Include protocol name, key actions (swaps, lending, staking), and supported chains.
license: Apache-2.0
metadata:
  author: your-github-username
  version: "1.0"
  chain: ethereum
  category: DeFi
tags:
  - protocol-name
  - relevant-tag
---

# Protocol Name

Brief overview of the protocol — what it does, why it matters, and what agents can build with it.

## What You Probably Got Wrong

> AI agents have stale training data. This section corrects the most common mistakes.

- **Wrong assumption** → Correct fact (with source/date)
- **Wrong assumption** → Correct fact (with source/date)
- **Wrong assumption** → Correct fact (with source/date)

## Quick Start

### Installation

```bash
npm install @protocol/sdk
```

### Basic Setup

```typescript
import { Client } from '@protocol/sdk';

const client = new Client({
  rpcUrl: process.env.RPC_URL,
  // Add setup code
});
```

## Core Concepts

Explain the protocol's key abstractions and mental models.

### Concept 1

Description with code examples.

### Concept 2

Description with code examples.

## Common Patterns

### Pattern 1: Basic Operation

```typescript
// Working code example — copy-paste ready
```

### Pattern 2: Advanced Operation

```typescript
// Working code example — copy-paste ready
```

## Contract Addresses

> **Last verified:** YYYY-MM-DD (verified onchain via eth_getCode)

| Contract | Mainnet | Arbitrum | Base |
|----------|---------|----------|------|
| Router   | `0x...` | `0x...`  | `0x...` |
| Factory  | `0x...` | `0x...`  | `0x...` |

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `INSUFFICIENT_LIQUIDITY` | Pool has insufficient reserves | Check pool reserves before swap |
| `SLIPPAGE_EXCEEDED` | Price moved beyond tolerance | Increase slippage or use smaller amount |

## Troubleshooting

### Common Issue 1

Symptoms, root cause, and fix.

### Common Issue 2

Symptoms, root cause, and fix.

## Security Considerations

- Never hardcode private keys or RPC URLs
- Always verify contract addresses onchain before interacting
- Use slippage protection on all swaps
- Test on testnet/fork before mainnet

## References

- [Official Docs](https://docs.protocol.com)
- [GitHub](https://github.com/protocol/sdk)
- [Contract Addresses](https://docs.protocol.com/addresses)
