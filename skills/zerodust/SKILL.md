---
name: zerodust
description: "ZeroDust chain exit infrastructure — sweep 100% of native gas tokens (ETH, BNB, MATIC, etc.) from 25 EVM chains via EIP-7702 sponsored execution, leaving exactly zero balance. Covers TypeScript SDK with ZeroDustAgent for automated sweeps, REST API for quotes and submissions, MCP server for AI tool calls, and Agent API with batch operations. Free for balances under $1."
license: Apache-2.0
metadata:
  author: andresdefi
  version: "1.0"
  chain: multichain
  category: Cross-Chain
tags:
  - zerodust
  - dust-sweep
  - eip-7702
  - chain-exit
  - native-tokens
  - cross-chain
  - gas-tokens
  - sponsored-execution
---

# ZeroDust

ZeroDust is chain exit infrastructure that sweeps 100% of native gas tokens from EVM chains, leaving **exactly zero balance**. It uses EIP-7702 sponsored execution — users sign an authorization and ZeroDust's sponsor executes the sweep on their behalf, paying gas and being reimbursed from the swept amount. This solves a previously unsolvable problem: you can't send your last ETH because you need ETH for gas.

ZeroDust supports 25 mainnet chains with 650 cross-chain routes via Gas.zip. The contract is deployed at a deterministic CREATE2 address across all chains. Service fee is 1% ($0.05 min, $0.50 max), free for balances under $1.

## What You Probably Got Wrong

> AI agents trained before 2026 have no knowledge of ZeroDust and will hallucinate about dust sweeping. These are the critical corrections.

- **ZeroDust does NOT handle ERC-20 tokens** — Only native gas tokens (ETH, BNB, MATIC, POL, SEI, etc.). If a user asks to sweep USDC or any ERC-20, ZeroDust cannot help. Source: [ZeroDust contract](https://github.com/andresdefi/zerodust/tree/main/contracts) — the `executeSweep` function only operates on `address(this).balance`.

- **EIP-712 `verifyingContract` is the user's EOA, NOT the contract address** — This is a critical EIP-7702 pattern. Under EIP-7702, the contract code runs on the user's address, so the domain separator must use the user's address as `verifyingContract`. Using the contract address will produce an invalid signature. Source: [EIP-7702 spec](https://eips.ethereum.org/EIPS/eip-7702).

- **You cannot do partial sweeps** — ZeroDust always sweeps 100% of the native balance to exactly 0. There is no parameter to sweep a specific amount. The entire balance is swept atomically in a single transaction.

- **Quotes expire in 55 seconds, not 60** — The contract enforces `MAX_DEADLINE_WINDOW_SECS = 60` on-chain. The backend sets deadline to `now + 55` to stay safely within that window. If you wait too long to sign, you must request a new quote.

- **The revoke authorization nonce must be delegation nonce + 1** — When using auto-revoke (recommended), you sign two EIP-7702 authorizations: one to delegate to ZeroDust (nonce N), and one to revoke delegation to address(0) (nonce N+1). Using the same nonce or any other value will be rejected. The backend validates this explicitly.

- **Cross-chain sweeps use Gas.zip, not arbitrary bridges** — The backend auto-fetches bridge calldata from Gas.zip. You don't need to provide `callTarget` or `callData` for cross-chain quotes — the API handles it. Gas.zip routes are subject to availability; some source chains may be temporarily disabled.

- **The sponsor is always profitable** — ZeroDust's sponsor pays gas upfront and is reimbursed from the swept amount with a margin. Stress tests show 53-116% sponsor margins across chains. Users always receive >= the quoted `estimatedReceive` amount.

- **Nonce tracking is on-chain in user's storage, not the contract** — Under EIP-7702, state changes like `usedNonces[user][nonce] = true` are written to the user's EOA storage. The contract's view functions (`getNextNonce`) read from the contract's storage, showing stale data. The backend reads nonces directly from on-chain user storage.

## Quick Start

### Installation

```bash
npm install @zerodust/sdk viem
```

### Check Balances and Sweep

```typescript
import { ZeroDustAgent } from '@zerodust/sdk';
import { privateKeyToAccount } from 'viem/accounts';

// Initialize agent with private key
const agent = new ZeroDustAgent({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  environment: 'mainnet',
});

// Check which chains have sweepable dust
const sweepable = await agent.getSweepableBalances();
console.log('Sweepable chains:', sweepable.map(b => `${b.name}: ${b.balanceFormatted} ${b.nativeToken}`));

// Sweep Arbitrum -> Base
const result = await agent.sweep({
  fromChainId: 42161,  // Arbitrum
  toChainId: 8453,     // Base
});

if (result.success) {
  console.log('Swept! TX:', result.txHash);
} else {
  console.log('Failed:', result.error);
}
```

### REST API Quick Start

```bash
# Check balances across all chains
curl "https://api.zerodust.xyz/balances/0xYOUR_ADDRESS?testnet=false"

# Get a sweep quote (Arbitrum -> Base)
curl "https://api.zerodust.xyz/quote?fromChainId=42161&toChainId=8453&userAddress=0x...&destination=0x..."
```

## Core Concepts

### EIP-7702 Sponsored Execution

ZeroDust uses EIP-7702 to temporarily delegate a user's EOA to the ZeroDust contract. This enables the sponsor (relayer) to execute the sweep on the user's behalf. The user never pays gas directly.

The flow:
1. User signs an EIP-7702 authorization (delegates EOA to ZeroDust contract)
2. User signs an EIP-712 SweepIntent (authorizes the specific sweep parameters)
3. User optionally signs a revoke authorization (removes delegation after sweep)
4. Sponsor submits the transaction, paying gas
5. Contract atomically: sweeps user balance -> reimburses sponsor -> sends remainder to destination
6. Sponsor executes revoke transaction (user's EOA returns to normal)

```
User signs 2 messages (batch auth + sweep intent)
    |
    v
Sponsor validates -> simulates -> executes
    |
    v
Contract: sweep user -> reimburse sponsor -> send to destination
    |
    v
Sponsor: revoke delegation (user's EOA is normal again)
```

### Sweep Flow (Quote -> Sign -> Submit -> Execute)

Every sweep follows this sequence:

```typescript
// 1. GET /quote - Get fee breakdown and signing parameters
const quote = await fetch('/quote?fromChainId=42161&toChainId=8453&userAddress=0x...&destination=0x...');

// 2. POST /authorization - Get EIP-712 typed data for signing
const auth = await fetch('/authorization', { body: { quoteId: quote.quoteId } });

// 3. User signs:
//    a. EIP-7702 delegation authorization
//    b. EIP-712 SweepIntent typed data
//    c. EIP-7702 revoke authorization (nonce = delegation nonce + 1)

// 4. POST /sweep - Submit all signatures
const sweep = await fetch('/sweep', {
  body: {
    quoteId: quote.quoteId,
    signature: eip712Signature,
    eip7702Authorization: delegationAuth,
    revokeAuthorization: revokeAuth,
  }
});

// 5. GET /sweep/:id - Poll for completion
// Status: pending -> simulating -> executing -> broadcasted -> completed
```

### Cross-Chain via Gas.zip

Cross-chain sweeps use Gas.zip as the bridge. When `fromChainId !== toChainId`:

- The API automatically fetches Gas.zip calldata during the quote step
- Mode is set to `MODE_CALL` (1) instead of `MODE_TRANSFER` (0)
- The contract calls the Gas.zip deposit address with the bridge calldata
- `routeHash = keccak256(callData)` binds the signature to the specific bridge route
- 650 cross-chain routes available (25 x 25, minus same-chain)
- Bridge latency is typically ~5 seconds

### Fee Structure

| Component | Description |
|-----------|-------------|
| **Service Fee** | 1% of balance ($0.05 min, $0.50 max). Free under $1. |
| **Gas Reimbursement** | Actual gas cost + 20% buffer. Sponsor keeps the margin. |
| **Bridge Fee** | Near-zero Gas.zip fee (cross-chain only) |
| **Revoke Gas** | ~50k gas units for auto-revoke tx, included in fees |

```typescript
// Fee calculation
const serviceFee = balance < $1 ? 0 : clamp(balance * 0.01, $0.05, $0.50);
const gasCost = (overheadGas + measuredGas) * gasPrice * 1.20; // 20% buffer
const totalFee = gasCost + serviceFee + revokeGasCost;
const userReceives = balance - totalFee; // Always >= estimatedReceive
```

### Agent API

For AI agents, dedicated endpoints reduce round trips:

```bash
# Register for API key (300/min, 1000/day limits)
POST /agent/register { "name": "My Agent" }
# Returns: { "apiKey": "zd_..." }

# Combined quote + auth data in one call
POST /agent/sweep { "fromChainId": 42161, "toChainId": 8453, "userAddress": "0x..." }

# Batch sweep multiple chains
POST /agent/batch-sweep { "sweeps": [...], "destination": "0x...", "consolidateToChainId": 8453 }

# Check usage stats
GET /agent/me
```

All agent endpoints require `Authorization: Bearer <key>` or `X-API-Key: <key>`.

### MCP Server

ZeroDust exposes an MCP server at `https://api.zerodust.xyz/mcp` (JSON-RPC 2.0, MCP version 2024-11-05):

| Tool | Description |
|------|-------------|
| `check_balances` | Check native balances across all 25 chains |
| `get_sweep_quote` | Get quote with fee breakdown |
| `get_supported_chains` | List supported chains |
| `get_service_info` | Pricing, features, integration info |

## Contract Addresses

**Mainnet (CREATE2 deterministic):** `0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2`

Same address on all 25 chains. Last verified: January 28, 2026 via block explorer source verification.

| Chain | Chain ID | Explorer |
|-------|----------|----------|
| Ethereum | 1 | [etherscan.io](https://etherscan.io/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Optimism | 10 | [optimistic.etherscan.io](https://optimistic.etherscan.io/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| BSC | 56 | [bscscan.com](https://bscscan.com/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Gnosis | 100 | [gnosisscan.io](https://gnosisscan.io/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Unichain | 130 | [uniscan.xyz](https://uniscan.xyz/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Polygon | 137 | [polygonscan.com](https://polygonscan.com/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Sonic | 146 | [sonicscan.org](https://sonicscan.org/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| X Layer | 196 | [oklink.com/xlayer](https://www.oklink.com/xlayer/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Fraxtal | 252 | [fraxscan.com](https://fraxscan.com/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| World Chain | 480 | [worldscan.org](https://worldscan.org/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Sei | 1329 | [seitrace.com](https://seitrace.com/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Story | 1514 | [storyscan.xyz](https://storyscan.xyz/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Soneium | 1868 | [soneium.blockscout.com](https://soneium.blockscout.com/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Mantle | 5000 | [mantlescan.xyz](https://mantlescan.xyz/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Superseed | 5330 | [superseed.explorer.caldera.xyz](https://superseed.explorer.caldera.xyz/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Base | 8453 | [basescan.org](https://basescan.org/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Plasma | 9745 | [plasma-explorer.genesys.network](https://plasma-explorer.genesys.network/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Mode | 34443 | [modescan.io](https://modescan.io/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Arbitrum | 42161 | [arbiscan.io](https://arbiscan.io/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Celo | 42220 | [celoscan.io](https://celoscan.io/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Ink | 57073 | [inkscan.xyz](https://inkscan.xyz/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| BOB | 60808 | [explorer.gobob.xyz](https://explorer.gobob.xyz/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Berachain | 80094 | [berascan.com](https://berascan.com/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Scroll | 534352 | [scrollscan.com](https://scrollscan.com/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |
| Zora | 7777777 | [zorascan.xyz](https://zorascan.xyz/address/0x3732398281d0606aCB7EC1D490dFB0591BE4c4f2) |

## Common Patterns

### SDK: Sweep All Chains to Base

```typescript
import { ZeroDustAgent } from '@zerodust/sdk';
import { privateKeyToAccount } from 'viem/accounts';

const agent = new ZeroDustAgent({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  environment: 'mainnet',
});

// Discover and sweep all chains with dust
const results = await agent.sweepAll({
  toChainId: 8453,  // Consolidate everything to Base
  continueOnError: true,
});

console.log(`Swept ${results.successful}/${results.total} chains`);
for (const r of results.results) {
  if (r.success) {
    console.log(`  ${r.fromChainId} -> ${r.toChainId}: TX ${r.txHash}`);
  } else {
    console.log(`  ${r.fromChainId}: FAILED - ${r.error}`);
  }
}
```

### REST API: Full Sweep Flow

```typescript
const BASE_URL = 'https://api.zerodust.xyz';

// 1. Get quote
const quoteRes = await fetch(
  `${BASE_URL}/quote?fromChainId=42161&toChainId=8453&userAddress=${address}&destination=${address}`
);
const quote = await quoteRes.json();

// 2. Get typed data
const authRes = await fetch(`${BASE_URL}/authorization`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quoteId: quote.quoteId }),
});
const { typedData, contractAddress } = await authRes.json();

// 3. Sign (using viem wallet client)
const signature = await walletClient.signTypedData({
  domain: typedData.domain,
  types: typedData.types,
  primaryType: typedData.primaryType,
  message: typedData.message,
});

const delegationAuth = await walletClient.signAuthorization({
  contractAddress,
  chainId: 42161,
});

const revokeAuth = await walletClient.signAuthorization({
  contractAddress: '0x0000000000000000000000000000000000000000',
  chainId: 42161,
  nonce: delegationAuth.nonce + 1,
});

// 4. Submit
const sweepRes = await fetch(`${BASE_URL}/sweep`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quoteId: quote.quoteId,
    signature,
    eip7702Authorization: {
      chainId: delegationAuth.chainId,
      contractAddress: delegationAuth.address,
      nonce: Number(delegationAuth.nonce),
      yParity: delegationAuth.yParity ?? 0,
      r: delegationAuth.r,
      s: delegationAuth.s,
    },
    revokeAuthorization: {
      chainId: revokeAuth.chainId,
      contractAddress: revokeAuth.address,
      nonce: Number(revokeAuth.nonce),
      yParity: revokeAuth.yParity ?? 0,
      r: revokeAuth.r,
      s: revokeAuth.s,
    },
  }),
});
const sweep = await sweepRes.json();

// 5. Poll for completion
let status;
do {
  await new Promise(r => setTimeout(r, 3000));
  const statusRes = await fetch(`${BASE_URL}/sweep/${sweep.sweepId}`);
  status = await statusRes.json();
} while (!['completed', 'failed'].includes(status.status));
```

### MCP: Check Balances via JSON-RPC

```bash
curl -X POST https://api.zerodust.xyz/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "check_balances",
      "arguments": { "address": "0x1234567890abcdef1234567890abcdef12345678" }
    }
  }'
```

## Error Handling

```typescript
import {
  ZeroDustError,
  BalanceTooLowError,
  QuoteExpiredError,
  NetworkError,
  ChainNotSupportedError,
  BridgeError,
} from '@zerodust/sdk';

try {
  const result = await agent.sweep({ fromChainId: 42161, toChainId: 8453 });
} catch (e) {
  if (e instanceof BalanceTooLowError) {
    console.log('Balance too low to sweep on this chain');
  } else if (e instanceof QuoteExpiredError) {
    console.log('Quote expired, retrying...');
    // Re-fetch quote and try again
  } else if (e instanceof BridgeError) {
    console.log('Cross-chain route unavailable, try same-chain sweep');
  } else if (e instanceof ChainNotSupportedError) {
    console.log('Chain does not support EIP-7702');
  } else if (e instanceof NetworkError) {
    console.log('Network issue, retry with backoff');
  } else if (e instanceof ZeroDustError) {
    console.log(`ZeroDust error [${e.code}]: ${e.message}`);
  }
}
```

See [resources/error-codes.md](resources/error-codes.md) for the complete error code reference.

## Security and Best Practices

1. **Never log or expose private keys** — Use environment variables or KMS. The SDK's `createAgentFromPrivateKey` accepts a hex string; never hardcode it.

2. **Validate addresses before calling the API** — Use viem's `isAddress()` to validate user inputs. The API will reject invalid addresses but client-side validation improves UX.

3. **Handle quote expiry gracefully** — Quotes are valid for 55 seconds. If signing takes longer, catch `QuoteExpiredError` and re-fetch. Don't cache quotes.

4. **Use auto-revoke** — Always include `revokeAuthorization` in sweep submissions. This removes the EIP-7702 delegation after the sweep, returning the user's EOA to normal state.

5. **Respect rate limits** — Agent API: 300 requests/minute, 1000 sweeps/day. Use `GET /agent/me` to check remaining quota. Back off on 429 responses.

6. **Check `canSweep` before quoting** — The balance endpoint returns `canSweep: boolean` for each chain. Don't request quotes for chains where `canSweep` is false.

7. **Handle cross-chain failures** — Gas.zip may temporarily disable routes. Catch `SOURCE_CHAIN_DISABLED` / `DEST_CHAIN_DISABLED` errors and fall back to same-chain sweeps or different destinations.

8. **Don't assume all chains support EIP-7702** — Only 25 mainnet chains are supported. Check `GET /chains` for the current list. Chains like zkSync, Avalanche, and others do not support EIP-7702.

## Skill Structure

```
skills/zerodust/
├── SKILL.md                          # This file
├── docs/
│   └── troubleshooting.md           # Common issues and solutions
├── examples/
│   ├── check-balances/README.md     # Balance checking patterns
│   ├── sweep-single-chain/README.md # Single chain sweep flow
│   ├── batch-sweep/README.md        # Multi-chain batch sweeps
│   └── agent-api/README.md          # Agent API with API keys
├── resources/
│   ├── contract-addresses.md        # All 25 chain addresses
│   └── error-codes.md              # Complete error reference
└── templates/
    └── zerodust-client.ts           # Runnable starter template
```

## Guidelines

Use this skill when:
- User mentions "sweep", "dust", "exit chain", "consolidate", "clean up wallet"
- User has small native token balances scattered across EVM chains
- User wants to fully exit a blockchain (balance to exactly 0)
- Agent needs to consolidate funds from multiple chains to one
- User asks about EIP-7702 sponsored execution for dust collection

Do NOT use this skill when:
- User wants to swap or transfer ERC-20 tokens (use Uniswap, 1inch, etc.)
- User wants partial transfers (ZeroDust only does full balance sweeps)
- User is on chains that don't support EIP-7702 (zkSync, Avalanche, etc.)

## References

- **API Docs (Swagger)**: https://api.zerodust.xyz/docs
- **MCP Server**: https://api.zerodust.xyz/mcp
- **GitHub**: https://github.com/andresdefi/zerodust
- **SDK**: `npm install @zerodust/sdk`
- **ERC-8004 Agent**: https://www.8004scan.io/agents/base/1435
- **A2A Agent Card**: https://api.zerodust.xyz/.well-known/agent-card.json
- **Website**: https://zerodust.xyz
